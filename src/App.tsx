/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  FileText, 
  Search, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  X,
  ArrowLeft,
  Pill,
  History as HistoryIcon,
  LogOut,
  User as UserIcon,
  Trash2,
  Home as HomeIcon,
  Sparkles,
  Calendar,
  Shield,
  Lock,
  Info
} from 'lucide-react';
import { analyzePrescription, MedicineAlternative, PrescriptionAnalysis } from './services/geminiService';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  User,
  handleFirestoreError,
  OperationType,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously
} from './firebase';
import { deleteDoc } from 'firebase/firestore';
import HomeScreen from './components/HomeScreen';
import PrescriptionScheduleScreen from './components/PrescriptionScheduleScreen';
import ScanResultsScreen from './components/ScanResultsScreen';
import LoginScreen from './components/LoginScreen';
import MedicineSearch from './components/MedicineSearch';

const MOCK_USER: any = {
  uid: 'apothecary_guest_user',
  email: 'guest@medirec.app',
  displayName: 'Guest User',
  photoURL: null,
  getIdToken: async () => 'mock_jwt_token_for_apothecary_guest'
};

interface PrescriptionRecord {
  id: string;
  imageUrl: string;
  medicines: MedicineAlternative[];
  doctorName?: string;
  patientName?: string;
  patientAge?: string;
  prescriptionDate?: string;
  scannedAt: Timestamp;
}

// Cryptographically secure client-side JWT Decoder helper
function parseJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    
    const headerDecoded = JSON.parse(atob(parts[0]));
    const payloadDecoded = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    return {
      header: headerDecoded,
      payload: payloadDecoded,
      signature: parts[2] ? parts[2].substring(0, 16) + '...' : ''
    };
  } catch (e) {
    console.error('JWT decoding error:', e);
    return null;
  }
}

export default function App() {
  const [portalUser, setPortalUser] = useState<string | null>(() => {
    return localStorage.getItem('medirec_portal_user') || null;
  });
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('medirec_portal_user');
    if (saved) {
      const cleanUser = saved.trim();
      return {
        uid: cleanUser.toLowerCase(),
        email: `${cleanUser.toLowerCase()}@medirec.app`,
        displayName: cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
        photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUser.toLowerCase()}`,
        getIdToken: async () => 'mock_jwt_token_for_' + cleanUser.toLowerCase()
      } as any;
    }
    return null;
  });
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [view, setView] = useState<'home' | 'scan' | 'history' | 'schedule'>('home');

  // Sync portal user display name back to firestore for beautiful stats & history
  useEffect(() => {
    if (user && portalUser) {
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        uid: user.uid,
        displayName: portalUser.charAt(0).toUpperCase() + portalUser.slice(1),
        email: `${user.uid}@medirec.app`,
        photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${user.uid}`
      }, { merge: true }).catch(err => {
        console.warn('Failed to sync portal user details:', err);
      });
    }
  }, [user, portalUser]);

  const handleLoginSuccess = (username: string) => {
    const cleanUser = username.trim();
    localStorage.setItem('medirec_portal_user', cleanUser);
    setPortalUser(cleanUser);
    setUser({
      uid: cleanUser.toLowerCase(),
      email: `${cleanUser.toLowerCase()}@medirec.app`,
      displayName: cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
      photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUser.toLowerCase()}`,
      getIdToken: async () => 'mock_jwt_token_for_' + cleanUser.toLowerCase()
    } as any);
    setView('home');
  };
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<PrescriptionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PrescriptionRecord[]>([]);
  const [scheduleInitial, setScheduleInitial] = useState<any | null>(null);
  const [isJwtModalOpen, setIsJwtModalOpen] = useState(false);
  const [jwtToken, setJwtToken] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync JWT token on authentication state change
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token) => {
        setJwtToken(token);
      }).catch(err => {
        console.error('Failed to retrieve JWT Token:', err);
      });
    } else {
      setJwtToken('');
    }
  }, [user]);

  // Auth Listener
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setIsAuthReady(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // History Listener
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const path = `users/${user.uid}/prescriptions`;
    const q = query(collection(db, path), orderBy('scannedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PrescriptionRecord[];
      setHistory(records);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('medirec_portal_user');
      setPortalUser(null);
      await signOut(auth);
      reset();
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResults(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysis = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzePrescription(image);
      setResults(data);
      
      // Save to history if logged in
      if (user) {
        const path = `users/${user.uid}/prescriptions`;
        await addDoc(collection(db, path), {
          userId: user.uid,
          imageUrl: image,
          medicines: data.medicines,
          doctorName: data.doctorName || null,
          patientName: data.patientName || null,
          patientAge: data.patientAge || null,
          prescriptionDate: data.prescriptionDate || null,
          scannedAt: Timestamp.now()
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, path));
      }
    } catch (err) {
      setError("Failed to analyze the prescription. Please try again with a clearer image.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}/prescriptions/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const reset = () => {
    setImage(null);
    setResults(null);
    setError(null);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#faf8f5] sm:bg-[#f3efe8] flex items-center justify-center font-sans">
        <div className="w-full max-w-md h-full min-h-screen sm:min-h-[820px] sm:h-[820px] bg-white sm:rounded-[2.75rem] sm:border sm:border-stone-200/60 sm:shadow-[0_32px_96px_-16px_rgba(27,77,62,0.06)] flex flex-col items-center justify-center relative overflow-hidden">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        </div>
      </div>
    );
  }

  // Dynamic classic apothecary styling themes based on application active view: all set to high-style premium off-whites
  const VIEW_THEMES = {
    home: {
      outerBg: "bg-[#faf8f5] sm:bg-[#f3efe8]", // Classic high-style off-white ivory
      innerBg: "bg-white",
      decor1: "bg-brand-500/[0.02]",
      decor2: "bg-brand-600/[0.03]",
      borderColor: "sm:border-[#e3ded5]",
      shadow: "sm:shadow-[0_24px_64px_-12px_rgba(27,77,62,0.06),0_8px_24px_-16px_rgba(27,77,62,0.04)]",
      logoBg: "bg-brand-600 text-stone-100",
      logoBorder: "border-brand-500/20",
      logoSub: "text-stone-400",
      headerBg: "bg-white/90"
    },
    scan: {
      outerBg: "bg-[#f5f6f8] sm:bg-[#e9ebef]", // Clean porcelain/slate off-white
      innerBg: "bg-[#fbfcfd]",
      decor1: "bg-blue-500/[0.02]",
      decor2: "bg-indigo-500/[0.03]",
      borderColor: "sm:border-[#dee1e7]",
      shadow: "sm:shadow-[0_24px_64px_-12px_rgba(27,117,162,0.04),0_8px_24px_-16px_rgba(27,117,162,0.02)]",
      logoBg: "bg-blue-800 text-stone-100",
      logoBorder: "border-blue-600/20",
      logoSub: "text-blue-500/80",
      headerBg: "bg-[#fbfcfd]/90"
    },
    schedule: {
      outerBg: "bg-[#f4f7f5] sm:bg-[#e6ebe8]", // Delicate mint/sage off-white
      innerBg: "bg-[#fafcfb]",
      decor1: "bg-emerald-500/[0.02]",
      decor2: "bg-teal-600/[0.02]",
      borderColor: "sm:border-[#d7e0dc]",
      shadow: "sm:shadow-[0_24px_64px_-12px_rgba(15,45,35,0.04),0_8px_24px_-16px_rgba(15,45,35,0.02)]",
      logoBg: "bg-emerald-800 text-stone-100",
      logoBorder: "border-emerald-600/20",
      logoSub: "text-emerald-600/85",
      headerBg: "bg-[#fafcfb]/90"
    },
    history: {
      outerBg: "bg-[#f8f5f0] sm:bg-[#ede7db]", // Soft vintage chamomile/wheat off-white
      innerBg: "bg-[#fdfcf9]",
      decor1: "bg-amber-600/[0.02]",
      decor2: "bg-amber-700/[0.03]",
      borderColor: "sm:border-[#e2dacb]",
      shadow: "sm:shadow-[0_24px_64px_-12px_rgba(95,65,30,0.04),0_8px_24px_-16px_rgba(95,65,30,0.02)]",
      logoBg: "bg-amber-800 text-amber-50",
      logoBorder: "border-amber-700/20",
      logoSub: "text-amber-700/80",
      headerBg: "bg-[#fdfcf9]/90"
    }
  };

  const activeTheme = VIEW_THEMES[view] || VIEW_THEMES.home;

  return (
    <div className={`min-h-screen ${activeTheme.outerBg} flex items-center justify-center p-0 sm:p-6 lg:p-8 relative overflow-hidden font-sans selection:bg-brand-100 selection:text-brand-900 transition-colors duration-700`}>
      {/* Classic Minimalist Decorative Background Elements */}
      <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[40%] ${activeTheme.decor1} blur-[120px] rounded-full pointer-events-none transition-colors duration-700`} />
      <div className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[40%] ${activeTheme.decor2} blur-[120px] rounded-full pointer-events-none transition-colors duration-700`} />

      {/* Floating Application Viewport Mockup */}
      <div className={`w-full max-w-md h-full min-h-screen sm:min-h-[820px] sm:h-[820px] ${activeTheme.innerBg} sm:rounded-[2.5rem] sm:border ${activeTheme.borderColor} ${activeTheme.shadow} flex flex-col relative overflow-hidden transition-all duration-700`}>
        {!portalUser ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        ) : (
          <>
            {/* Header */}
            <header className={`${activeTheme.headerBg} backdrop-blur-md px-6 py-4.5 border-b border-stone-200/50 flex items-center justify-between sticky top-0 z-30 transition-colors duration-500`}>
              <motion.div 
                initial={{ x: -15, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex items-center gap-3"
              >
                {/* Elegant Brand Apothecary Emblem */}
                <div className={`relative w-9 h-9 rounded-full ${activeTheme.logoBg} flex items-center justify-center shadow-md shadow-brand-600/10 hover:scale-105 transition-all duration-500`}>
                  <div className={`absolute inset-[2.5px] rounded-full border ${activeTheme.logoBorder}`} />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-stone-100 relative z-10">
                    <path d="M12 3c.132 0 .263 0 .393.007a7.5 7.5 0 0 1 7.92 12.446a9 9 0 1 1 -16.626-6.425A7.49 7.49 0 0 1 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 9v6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 12h4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-display font-medium tracking-[0.05em] text-stone-900 leading-none">MediRec</span>
                </div>
              </motion.div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsJwtModalOpen(true)}
                    title="Inspect Secure JWT ID Token Payload"
                    className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full"
                  >
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || 'Profile'} 
                        className="w-8 h-8 rounded-full border border-stone-200/50 bg-[#fafcfb] object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-stone-200/50 bg-stone-100 flex items-center justify-center">
                        <UserIcon className="w-4.5 h-4.5 text-stone-400" />
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 bg-brand-600 rounded-full border border-white flex items-center justify-center w-4 h-4 shadow-sm">
                      <Shield className="w-2.5 h-2.5 text-white" />
                    </span>
                  </button>
                  <button 
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-1.5 hover:bg-stone-50 active:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === 'home' ? (
            <HomeScreen
              key="home-view"
              user={user}
              onNavigate={(v) => setView(v)}
              prescriptionsHistory={history}
              onViewScannedDetails={(imageUrl, medicines, docName, patName, patAge, pDate) => {
                setImage(imageUrl);
                setResults({
                  medicines,
                  doctorName: docName,
                  patientName: patName,
                  patientAge: patAge,
                  prescriptionDate: pDate
                });
                setView('scan');
              }}
            />
          ) : view === 'scan' ? (
            <motion.div 
              key="scan-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              {!image ? (
                <div className="space-y-8 py-6">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-center space-y-3"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-[10px] font-bold uppercase tracking-wider mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                      </span>
                      Digital Medical Assistant
                    </div>
                    <h2 className="text-3xl font-display font-extrabold text-slate-900 leading-tight">Scan & Save on <span className="text-brand-600">Prescriptions</span></h2>
                    <p className="text-slate-500 text-sm px-4">Upload your handwritten prescription to instantly find chemically identical, cheaper alternatives.</p>
                  </motion.div>

                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white hover:border-brand-500 hover:bg-brand-50 transition-all group premium-shadow relative overflow-hidden"
                    >
                      <div className="absolute inset-0 shimmer-bg animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner relative z-10">
                        <Camera className="w-10 h-10 text-brand-600" />
                      </div>
                      <div className="text-center relative z-10">
                        <span className="block font-bold text-lg text-slate-900">Take a Photo</span>
                        <span className="text-sm text-slate-400">or select from gallery</span>
                      </div>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </motion.div>

                  <MedicineSearch />


                </div>
              ) : (
                <div className="space-y-6">
                  {/* Image Preview */}
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative rounded-[2.5rem] overflow-hidden shadow-2xl aspect-[4/3] bg-slate-200 border-4 border-white premium-shadow"
                  >
                    <img 
                      src={image} 
                      alt="Prescription" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {!results && !isAnalyzing && (
                      <div className="absolute inset-0 flex items-center justify-center p-6">
                        <button 
                          onClick={startAnalysis}
                          className="w-full max-w-xs bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-brand-500/40 flex items-center justify-center gap-3 transition-all active:scale-95 group"
                        >
                          <Search className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          Start Analysis
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={reset}
                      className="absolute top-4 right-4 p-2.5 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-colors border border-white/20"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>

                  {isAnalyzing && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="py-12 text-center space-y-6"
                    >
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-brand-100 rounded-full animate-pulse" />
                        <Loader2 className="w-24 h-24 text-brand-500 animate-spin relative z-10" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Pill className="w-10 h-10 text-brand-600 animate-bounce" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-display font-extrabold text-xl text-slate-900">Analyzing...</h3>
                        <p className="text-slate-500 text-sm animate-pulse max-w-[200px] mx-auto">Extracting medicines and searching for equivalents</p>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <div className="bg-red-50 p-4 rounded-2xl flex gap-3 items-center text-red-800">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  {results && (
                    <ScanResultsScreen
                      results={results}
                      image={image!}
                      onReset={reset}
                      onNavigate={(v) => setView(v)}
                      setScheduleInitial={setScheduleInitial}
                      user={user}
                    />
                  )}
                </div>
              )}
            </motion.div>
          ) : view === 'schedule' ? (
            <PrescriptionScheduleScreen
              key="schedule-view"
              user={user}
              onNavigate={(v) => setView(v)}
              initialPrescription={scheduleInitial}
              onClearInitialPrescription={() => setScheduleInitial(null)}
            />
          ) : (
            <motion.div 
              key="history-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold text-slate-900">History</h2>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{history.length} Records</span>
              </div>

              {history.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <HistoryIcon className="w-10 h-10 text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">No history yet</h3>
                    <p className="text-slate-500 text-sm px-10">Start scanning prescriptions to build your medical history.</p>
                  </div>
                  <button 
                    onClick={() => setView('scan')}
                    className="bg-brand-500 text-white px-8 py-3 rounded-full font-bold shadow-lg"
                  >
                    Start Scanning
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pb-10">
                  {history.map((record) => (
                    <div 
                      key={record.id}
                      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100"
                    >
                      <div className="flex p-4 gap-4">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100">
                          <img 
                            src={record.imageUrl} 
                            alt="Prescription" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {record.scannedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <button 
                              onClick={() => deleteRecord(record.id)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <h4 className="font-bold text-slate-800 truncate">
                            {record.medicines.map(m => m.originalName).join(', ')}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {record.medicines.length} medicine{record.medicines.length !== 1 ? 's' : ''} found
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setImage(record.imageUrl);
                          setResults({
                            medicines: record.medicines,
                            doctorName: record.doctorName,
                            patientName: record.patientName,
                            patientAge: record.patientAge,
                            prescriptionDate: record.prescriptionDate
                          });
                          setView('scan');
                        }}
                        className="w-full py-3 bg-slate-50 border-t border-slate-100 text-xs font-bold text-brand-600 flex items-center justify-center gap-1 hover:bg-brand-50 transition-colors"
                      >
                        View Details
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-t border-stone-200/40 px-6 py-4 flex justify-around items-center sticky bottom-0 z-30">
        <button 
          onClick={() => setView('home')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all relative",
            view === 'home' ? "text-brand-600" : "text-stone-400 hover:text-stone-600"
          )}
        >
          <HomeIcon className={cn("w-5 h-5 transition-transform duration-300", view === 'home' && "scale-105")} />
          <span className="text-[9px] font-medium tracking-[0.15em] uppercase font-sans mt-1">Home</span>
          {view === 'home' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-brand-600 rounded-full" />
          )}
        </button>
        <button 
          onClick={() => setView('scan')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all relative",
            view === 'scan' ? "text-blue-700" : "text-stone-400 hover:text-stone-600"
          )}
        >
          <Camera className={cn("w-5 h-5 transition-transform duration-300", view === 'scan' && "scale-105")} />
          <span className="text-[9px] font-medium tracking-[0.15em] uppercase font-sans mt-1">Scan</span>
          {view === 'scan' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-blue-700 rounded-full" />
          )}
        </button>
        <button 
          onClick={() => setView('schedule')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all relative",
            view === 'schedule' ? "text-emerald-700" : "text-stone-400 hover:text-stone-600"
          )}
        >
          <Calendar className={cn("w-5 h-5 transition-transform duration-300", view === 'schedule' && "scale-105")} />
          <span className="text-[9px] font-medium tracking-[0.15em] uppercase font-sans mt-1">Schedule</span>
          {view === 'schedule' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-emerald-700 rounded-full" />
          )}
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all relative",
            view === 'history' ? "text-amber-800" : "text-stone-400 hover:text-stone-600"
          )}
        >
          <HistoryIcon className={cn("w-5 h-5 transition-transform duration-300", view === 'history' && "scale-105")} />
          <span className="text-[9px] font-medium tracking-[0.15em] uppercase font-sans mt-1">History</span>
          {view === 'history' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-amber-800 rounded-full" />
          )}
        </button>
      </nav>

      {/* Secure JWT Authentication Inspector Sheet */}
      <AnimatePresence>
        {isJwtModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col justify-end"
          >
            <div 
              className="absolute inset-0" 
              onClick={() => setIsJwtModalOpen(false)} 
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white rounded-t-[2.5rem] border-t border-stone-200 p-6 flex flex-col max-h-[85%] overflow-y-auto relative z-50 space-y-5 shadow-2xl font-sans"
            >
              {/* Top Drag Indicator Notch */}
              <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto" />

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                    <Shield className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-display font-medium text-stone-900 text-lg">Secure JWT ID Vault</h3>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Stateless Token Inspector</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsJwtModalOpen(false)}
                  className="p-1.5 hover:bg-stone-50 rounded-full transition-colors font-bold text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[11px] text-slate-500 leading-relaxed font-semibold text-left">
                <div className="flex gap-2.5 mb-1.5">
                  <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                  <span className="font-bold text-slate-800 text-xs">Cryptographic Security</span>
                </div>
                This device hub uses cryptographically signed JSON Web Tokens (JWT) for authentication. When you log in, your app receives an ID token valid for session verification.
              </div>

              {jwtToken ? (
                (() => {
                  const decoded = parseJwt(jwtToken);
                  if (!decoded) {
                    return (
                      <p className="text-xs text-red-500 font-bold text-left">Failed to decode valid JWT format.</p>
                    );
                  }
                  return (
                    <div className="space-y-4 font-sans pb-4 text-left">
                      {/* Visual JWT color legend */}
                      <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider justify-around bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                        <span className="text-pink-600">■ Header</span>
                        <span className="text-cyan-600">■ Payload</span>
                        <span className="text-emerald-600">■ Signature</span>
                      </div>

                      {/* Section 1: HEADER */}
                      <div className="space-y-1.5 text-left">
                        <span className="text-[9px] font-black uppercase text-pink-600 pl-1 tracking-wider block">1. Header (Algorithm & Typ)</span>
                        <pre className="p-3 bg-stone-900 rounded-xl text-[10px] text-pink-400 font-mono overflow-x-auto shadow-inner leading-relaxed">
                          {JSON.stringify(decoded.header, null, 2)}
                        </pre>
                      </div>

                      {/* Section 2: PAYLOAD */}
                      <div className="space-y-1.5 text-left">
                        <span className="text-[9px] font-black uppercase text-cyan-600 pl-1 tracking-wider block">2. Payload (Claims & Identity)</span>
                        <pre className="p-3 bg-stone-900 rounded-xl text-[10px] text-cyan-400 font-mono overflow-x-auto shadow-inner leading-relaxed max-h-48 overflow-y-auto">
                          {JSON.stringify(decoded.payload, null, 2)}
                        </pre>
                      </div>

                      {/* Grid format summary of Claims */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1 text-left">
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Auth Provider</span>
                          <span className="text-slate-800">{decoded.payload?.firebase?.sign_in_provider === 'password' ? 'Email/Password' : decoded.payload?.firebase?.sign_in_provider || 'Google OAuth'}</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Issuer (iss)</span>
                          <span className="text-slate-800 truncate block text-[11px]" title={decoded.payload?.iss}>Google Secure Token</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 col-span-2 font-semibold">
                          <span className="text-[9px] text-slate-400 uppercase font-black block">Subject UID (sub)</span>
                          <span className="text-slate-800 truncate block text-[11px]" title={decoded.payload?.sub}>{decoded.payload?.sub || 'Guest'}</span>
                        </div>
                      </div>

                      {/* Section 3: SIGNATURE */}
                      <div className="space-y-1.5 text-left font-semibold">
                        <span className="text-[9px] font-black uppercase text-emerald-600 pl-1 tracking-wider block font-semibold">3. Cryptographic Signature</span>
                        <div className="p-3.5 bg-emerald-50/30 border border-emerald-100 rounded-xl flex items-center justify-between text-xs">
                          <div className="space-y-0.5 text-left">
                            <span className="block font-sans font-extrabold text-[#115e43] uppercase tracking-wider text-[9px]">Verified Signature</span>
                            <span className="font-mono text-[10px] text-emerald-800">{decoded.signature}</span>
                          </div>
                          <div className="bg-emerald-500 rounded-full p-1.5 text-white shadow-md shadow-emerald-500/25 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* Diagnostic Action footer */}
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(jwtToken);
                            alert('Copied secure JWT Token to clipboard!');
                          }}
                          className="flex-1 py-3 text-center bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-stone-700 text-xs transition-colors cursor-pointer"
                        >
                          Copy Encoded Token
                        </button>
                        <button
                          onClick={() => setIsJwtModalOpen(false)}
                          className="flex-1 py-3 text-center bg-slate-900 hover:bg-slate-800 font-bold rounded-xl text-white text-xs transition-colors cursor-pointer"
                        >
                          Close Vault
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium font-sans">Acquiring secure identity credentials...</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
