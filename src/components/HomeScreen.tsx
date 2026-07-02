import React from 'react';
import { motion } from 'motion/react';
import { 
  Camera, 
  Sparkles, 
  Pill, 
  Coins, 
  Shield, 
  ArrowRight
} from 'lucide-react';
import { User } from '../firebase';

interface HomeScreenProps {
  user: User;
  onNavigate: (view: 'scan' | 'history' | 'schedule') => void;
  onViewScannedDetails: (imageUrl: string, medicines: any[], doctorName?: string, patientName?: string, patientAge?: string, prescriptionDate?: string) => void;
  prescriptionsHistory: any[];
}

export default function HomeScreen({ 
  user, 
  onNavigate, 
  onViewScannedDetails,
  prescriptionsHistory 
}: HomeScreenProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-7"
    >
      {/* Elegant Classic Seal Header */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-stone-100 space-y-4">
        {/* Elegant Premium Apothecary Seal */}
        <div className="relative w-20 h-20 rounded-full bg-brand-50/60 border border-brand-500/20 flex items-center justify-center shadow-inner group">
          {/* Circular tracked text or borders */}
          <div className="absolute inset-1.5 rounded-full border border-dashed border-brand-500/30" />
          <div className="absolute inset-3 rounded-full border border-brand-500/10" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-brand-600 relative z-10 transition-transform duration-500 group-hover:rotate-12">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
            {/* Elegant Leaf-crest cross detail */}
            <path d="M12 8c1-1.5 3-1.5 4 0c0 2.5-4 5.5-4 5.5s-4-3-4-5.5c1-1.5 3-1.5 4 0Z" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 14v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-display font-medium text-stone-900 leading-tight">
            Welcome, <span className="italic font-display font-normal text-stone-700">{user.displayName?.split(' ')[0] || 'User'}</span>
          </h2>
        </div>
      </div>

      {/* Classic Apothecary Scanner Hub Card */}
      <div className="bg-brand-600 p-6 rounded-[2rem] text-stone-100 relative overflow-hidden shadow-xl shadow-brand-700/10 border border-brand-700/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/[0.04] rounded-full pointer-events-none" />
        
        <div className="space-y-4 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/5">
            <Sparkles className="w-3 h-3 text-stone-200 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-stone-200">Scanner</span>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-display font-medium tracking-tight text-white">Extract Medicines from Prescriptions</h3>
            <p className="text-xs text-[#cedad5] leading-relaxed font-normal">
              Upload a handwritten prescription, and the system will automatically identify and extract medicine names using OCR technology. It then analyzes the extracted medicines to help users find affordable alternatives and manage their medication schedule efficiently.
            </p>
          </div>

          <button 
            onClick={() => onNavigate('scan')}
            className="w-full mt-2 py-3.5 bg-white hover:bg-stone-50 text-brand-700 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
          >
            <Camera className="w-4 h-4 text-brand-600" />
            <span>Upload and Scan</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 text-brand-600" />
          </button>
        </div>
      </div>

      {/* High-Contrast Bento Feature Highlights - Step-by-Step Android Workflow */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
            Features & Security Vault
          </h4>
          <p className="text-xs text-stone-500 font-medium ml-1">
            How our Android application secures and simplifies your healthcare journey step-by-step:
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Step 1 */}
          <div className="bg-slate-50/40 rounded-2xl p-4.5 border border-slate-100 flex flex-col gap-3 transition-all hover:bg-slate-50 hover:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="bg-blue-50/80 p-2.5 rounded-xl text-blue-600">
                <Camera className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black bg-blue-100/50 text-blue-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Step 1
              </span>
            </div>
            <div className="space-y-1.5">
              <h5 className="text-sm font-black text-slate-800">Prescription Upload</h5>
              <p className="text-[10px] font-extrabold text-brand-600 uppercase tracking-wider">
                Handwritten Script Capture
              </p>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Snap a photo or upload your handwritten prescription securely through our mobile app interface.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-50/40 rounded-2xl p-4.5 border border-slate-100 flex flex-col gap-3 transition-all hover:bg-slate-50 hover:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="bg-purple-50/80 p-2.5 rounded-xl text-purple-600">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black bg-purple-100/50 text-purple-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Step 2
              </span>
            </div>
            <div className="space-y-1.5">
              <h5 className="text-sm font-black text-slate-800">Intelligent Transcription</h5>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Our vision engine deciphers complex doctor handwriting, automatically digitizing medicine names.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-50/40 rounded-2xl p-4.5 border border-slate-100 flex flex-col gap-3 transition-all hover:bg-slate-50 hover:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="bg-green-50/80 p-2.5 rounded-xl text-green-600">
                <Coins className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black bg-green-100/50 text-green-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Step 3
              </span>
            </div>
            <div className="space-y-1.5">
              <h5 className="text-sm font-black text-slate-800">Substitute Matching</h5>
              <p className="text-[10px] font-extrabold text-brand-600 uppercase tracking-wider">
                Bioidentical Cost Savings
              </p>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                We locate chemically identical, FDA-approved substitutes to help you save on medical bills.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-50/40 rounded-2xl p-4.5 border border-slate-100 flex flex-col gap-3 transition-all hover:bg-slate-50 hover:border-slate-200">
            <div className="flex items-center justify-between">
              <div className="bg-amber-50/80 p-2.5 rounded-xl text-amber-600">
                <Shield className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black bg-amber-100/50 text-amber-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Step 4
              </span>
            </div>
            <div className="space-y-1.5">
              <h5 className="text-sm font-black text-slate-800">Routine Generation</h5>
              <p className="text-[10px] font-extrabold text-brand-600 uppercase tracking-wider">
                Automated Intake Scheduling
              </p>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Receive an interactive daily schedule with smart meal reminders and precise dosage details.
              </p>
            </div>
          </div>
        </div>
      </div>

    </motion.div>
  );
}
