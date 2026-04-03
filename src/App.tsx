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
  Trash2
} from 'lucide-react';
import { analyzePrescription, MedicineAlternative, PrescriptionAnalysis } from './services/geminiService';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
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
  OperationType
} from './firebase';
import { deleteDoc } from 'firebase/firestore';

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'scan' | 'history'>('scan');
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<PrescriptionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PrescriptionRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Sync user profile
        const userRef = doc(db, 'users', currentUser.uid);
        setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          updatedAt: Timestamp.now()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`));
      }
    });
    return () => unsubscribe();
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

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Failed to sign in. Please try again.");
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-brand-500 p-2 rounded-xl">
            <Pill className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-display font-bold text-slate-800">MediRec</h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-3">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || ''} 
                className="w-8 h-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
              <button onClick={handleLogout} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="text-sm font-bold text-brand-600 hover:text-brand-700"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === 'scan' ? (
            <motion.div 
              key="scan-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              {!image ? (
                <div className="space-y-8 py-10">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-display font-bold text-slate-900">Scan Prescription</h2>
                    <p className="text-slate-500">Upload a photo of your handwritten prescription to find cheaper alternatives.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed border-slate-300 rounded-3xl hover:border-brand-500 hover:bg-brand-50 transition-all group"
                    >
                      <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera className="w-8 h-8 text-brand-600" />
                      </div>
                      <div className="text-center">
                        <span className="block font-semibold text-slate-900">Take a Photo</span>
                        <span className="text-sm text-slate-500">or upload from gallery</span>
                      </div>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>

                  {!user && (
                    <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm text-amber-800 font-bold">Not Signed In</p>
                        <p className="text-xs text-amber-700">Sign in to save your prescriptions to your history and track your medical journey.</p>
                        <button onClick={handleLogin} className="text-xs font-bold text-amber-900 underline mt-1">Sign in with Google</button>
                      </div>
                    </div>
                  )}

                  <div className="bg-brand-50 p-4 rounded-2xl flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-brand-800 leading-relaxed">
                      <strong>Note:</strong> This AI tool is for informational purposes only. Always consult with your doctor or pharmacist before switching medications.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Image Preview */}
                  <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-[4/3] bg-slate-200">
                    <img 
                      src={image} 
                      alt="Prescription" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {!results && !isAnalyzing && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <button 
                          onClick={startAnalysis}
                          className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-3 rounded-full font-semibold shadow-xl flex items-center gap-2 transition-all active:scale-95"
                        >
                          <Search className="w-5 h-5" />
                          Analyze Now
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={reset}
                      className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {isAnalyzing && (
                    <div className="py-12 text-center space-y-4">
                      <div className="relative w-20 h-20 mx-auto">
                        <Loader2 className="w-20 h-20 text-brand-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-brand-500" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-lg">Reading Prescription...</h3>
                        <p className="text-slate-500 animate-pulse">Extracting medicine names and finding alternatives</p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 p-4 rounded-2xl flex gap-3 items-center text-red-800">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  {results && (
                    <div className="space-y-6 pb-10">
                      {/* Prescription Metadata */}
                      {(results.doctorName || results.patientName || results.prescriptionDate) && (
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Prescription Info</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {results.doctorName && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-brand-500 uppercase">Doctor</span>
                                <p className="text-sm font-semibold text-slate-800">{results.doctorName}</p>
                              </div>
                            )}
                            {results.prescriptionDate && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-brand-500 uppercase">Date</span>
                                <p className="text-sm font-semibold text-slate-800">{results.prescriptionDate}</p>
                              </div>
                            )}
                            {results.patientName && (
                              <div className="space-y-1 col-span-2">
                                <span className="text-[10px] font-bold text-brand-500 uppercase">Patient</span>
                                <p className="text-sm font-semibold text-slate-800">
                                  {results.patientName} {results.patientAge ? `(${results.patientAge})` : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-display font-bold text-slate-900">Extracted Medicines</h3>
                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {results.medicines.length} Found
                        </span>
                      </div>

                      <div className="space-y-4">
                        {results.medicines.map((med, idx) => (
                          <div 
                            key={idx}
                            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prescribed</span>
                                <h4 className="text-lg font-bold text-slate-900">{med.originalName}</h4>
                              </div>
                            </div>

                            {(med.dosage || med.frequency || med.duration) && (
                              <div className="bg-brand-50/50 rounded-2xl p-4 grid grid-cols-3 gap-2">
                                {med.dosage && (
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-brand-600 uppercase">Dosage</span>
                                    <p className="text-xs font-semibold text-slate-700">{med.dosage}</p>
                                  </div>
                                )}
                                {med.frequency && (
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-brand-600 uppercase">Frequency</span>
                                    <p className="text-xs font-semibold text-slate-700">{med.frequency}</p>
                                  </div>
                                )}
                                {med.duration && (
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-brand-600 uppercase">Duration</span>
                                    <p className="text-xs font-semibold text-slate-700">{med.duration}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-3">
                              <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Cheaper Alternatives</span>
                              {med.alternatives.map((alt, altIdx) => (
                                <div key={altIdx} className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800">{alt.name}</span>
                                    {alt.estimatedPriceRange && (
                                      <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                                        {alt.estimatedPriceRange}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    {alt.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button 
                        onClick={reset}
                        className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Scan Another
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
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

              {!user ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <UserIcon className="w-10 h-10 text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">Sign in to see history</h3>
                    <p className="text-slate-500 text-sm px-10">Your past prescriptions will be securely stored and accessible across all your devices.</p>
                  </div>
                  <button 
                    onClick={handleLogin}
                    className="bg-brand-500 text-white px-8 py-3 rounded-full font-bold shadow-lg"
                  >
                    Sign In with Google
                  </button>
                </div>
              ) : history.length === 0 ? (
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
      <nav className="bg-white border-t border-slate-200 px-8 py-4 flex justify-around items-center sticky bottom-0 z-20">
        <button 
          onClick={() => setView('scan')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            view === 'scan' ? "text-brand-500" : "text-slate-400"
          )}
        >
          <Camera className="w-6 h-6" />
          <span className="text-[10px] font-bold">Scan</span>
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            view === 'history' ? "text-brand-500" : "text-slate-400"
          )}
        >
          <HistoryIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">History</span>
        </button>
      </nav>
    </div>
  );
}
