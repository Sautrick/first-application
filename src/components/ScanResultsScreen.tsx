import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pill, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  TrendingDown, 
  Building, 
  Info, 
  ArrowLeft, 
  Sparkles, 
  RotateCcw, 
  Package, 
  Calculator,
  AlertCircle
} from 'lucide-react';
import { PrescriptionAnalysis, MedicineAlternative } from '../services/geminiService';
import { cn } from '../lib/utils';

interface ScanResultsScreenProps {
  results: PrescriptionAnalysis;
  image: string;
  onReset: () => void;
  onNavigate: (view: 'home' | 'scan' | 'history' | 'schedule') => void;
  setScheduleInitial: (data: any) => void;
  user: any;
}

export default function ScanResultsScreen({
  results,
  image,
  onReset,
  onNavigate,
  setScheduleInitial,
  user
}: ScanResultsScreenProps) {
  // Step 1 is 'names', Step 2 is 'alternatives'
  const [subStep, setSubStep] = useState<'names' | 'alternatives'>('names');
  const [activeMedicineIdx, setActiveMedicineIdx] = useState(0);
  const [packQuantity, setPackQuantity] = useState<number>(1);

  const medicines = results.medicines || [];
  const currentMed = medicines[activeMedicineIdx];

  // Helper to construct netmeds and 1mg links safely
  const getTata1mgLink = (name: string) => {
    return `https://www.1mg.com/search/all?name=${encodeURIComponent(name)}`;
  };

  const getNetmedsLink = (name: string) => {
    return `https://www.netmeds.com/catalogsearch/result?q=${encodeURIComponent(name)}`;
  };

  const getApolloLink = (name: string) => {
    return `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(name)}`;
  };

  // Safe numeric parsing for calculations (extracting first numbers found in strings like "₹250.00" or "₹40")
  const parsePrice = (priceStr?: string): number => {
    if (!priceStr) return 0;
    const match = priceStr.replace(/,/g, '').match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const originalPriceNum = parsePrice(currentMed?.originalEstimatedPrice);
  
  return (
    <div className="space-y-6 pb-12">
      {/* Step Progress Tracker */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-50 text-brand-600 p-2 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Analysis Portal</span>
            <h3 className="text-xs font-bold text-slate-800">
              {subStep === 'names' ? 'Step 1: Medicine Verification' : 'Step 2: Alternatives & Pharmacy'}
            </h3>
          </div>
        </div>
        <div>
          <span className="text-[10px] font-bold text-brand-700 bg-brand-50/80 px-2.5 py-1 rounded-lg">
            {subStep === 'names' ? '1 of 2' : '2 of 2'}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {subStep === 'names' ? (
          /* STEP 1: EXTRACT ONLY MEDICINE NAMES SCREEN */
          <motion.div
            key="step-names"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Introductory Guide */}
            <div className="bg-slate-950 text-white p-5 rounded-2xl relative overflow-hidden border border-slate-900">
              <div className="space-y-1 relative z-10">
                <span className="text-[8px] bg-brand-500/10 text-brand-300 border border-brand-500/20 px-2 py-0.5 rounded font-bold tracking-widest uppercase">
                  OCR Engine
                </span>
                <h4 className="text-md font-display font-semibold tracking-tight mt-1">Extracted Medicaments</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                  Our clinical vision parser identified the following entries from your prescription sketch. Please verify these before retrieving cheap substitutes.
                </p>
              </div>
            </div>

            {/* Prescribed List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Medicines Extracted ({medicines.length})
                </h4>
                <span className="inline-flex items-center gap-1 text-[9px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-bold">
                  <CheckCircle2 className="w-3 h-3" /> OCR High Quality
                </span>
              </div>

              {medicines.length === 0 ? (
                <div className="bg-white rounded-[2rem] p-8 text-center border border-slate-100 space-y-3">
                  <Pill className="w-10 h-10 text-slate-300 mx-auto animate-bounce" />
                  <p className="text-sm font-bold text-slate-700">No medicines could be identified.</p>
                  <p className="text-xs text-slate-400">Please try again with a cleaner, hand-aligned image.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {medicines.map((med, idx) => (
                    <div 
                      key={idx}
                      className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 hover:border-slate-200 transition-all flex items-start gap-4 relative"
                    >
                      <div className="bg-brand-50 text-brand-600 p-3.5 rounded-2xl shrink-0">
                        <Pill className="w-5 h-5 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-display font-black text-slate-900 text-lg truncate">
                            {med.originalName}
                          </h5>
                          {med.originalEstimatedPrice && (
                            <span className="text-xs font-black bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                              {med.originalEstimatedPrice}
                            </span>
                          )}
                        </div>
                        
                        {med.activeIngredient && (
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 font-normal normal-case">Molecule:</span>
                            <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 font-extrabold text-brand-700">
                              {med.activeIngredient}
                            </span>
                          </p>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-2">
                          {med.dosage && (
                            <div className="bg-slate-50 p-2 rounded-xl text-center text-[10px] border border-slate-100">
                              <span className="block font-medium text-slate-400 text-[8px] uppercase">Dosage</span>
                              <span className="font-extrabold text-slate-700">{med.dosage}</span>
                            </div>
                          )}
                          {med.frequency && (
                            <div className="bg-slate-50 p-2 rounded-xl text-center text-[10px] border border-slate-100">
                              <span className="block font-medium text-slate-400 text-[8px] uppercase">Freq</span>
                              <span className="font-extrabold text-slate-700">{med.frequency}</span>
                            </div>
                          )}
                          {med.duration && (
                            <div className="bg-slate-50 p-2 rounded-xl text-center text-[10px] border border-slate-100">
                              <span className="block font-medium text-slate-400 text-[8px] uppercase">Duration</span>
                              <span className="font-extrabold text-slate-700">{med.duration}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medical Disclaimer Row */}
            <div className="bg-amber-50/60 p-4.5 rounded-[2rem] border border-amber-100 flex gap-3 text-xs text-amber-800 leading-relaxed font-semibold shadow-sm">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">Verification Notice</p>
                <p className="text-[11px] text-amber-700 font-medium font-sans">
                  Please review the spelling of extracted medicines. If they match your prescription, click below to compare exact clinical active molecule recommendations with Indian wholesale equivalents.
                </p>
              </div>
            </div>

            {/* Navigation Drawer CTAs */}
            <div className="flex gap-3">
              <button
                onClick={onReset}
                className="flex-1 py-4.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-Upload</span>
              </button>
              <button
                disabled={medicines.length === 0}
                onClick={() => setSubStep('alternatives')}
                className="flex-[2] py-4.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-2xl text-xs transition-colors shadow-lg shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Find Cheaper Alternatives</span>
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* STEP 2: ALTERNATIVES PAGES WITH tabs/pages for each medicine */
          <motion.div
            key="step-alternatives"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Top Pagination Pager */}
            <div className="flex items-center justify-between bg-white rounded-3xl p-3 shadow-sm border border-slate-100">
              <button
                disabled={activeMedicineIdx === 0}
                onClick={() => {
                  setActiveMedicineIdx(prev => prev - 1);
                  setPackQuantity(1);
                }}
                className="p-3 hover:bg-slate-50 disabled:opacity-30 rounded-2xl text-slate-600 transition-colors shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Medicine Page</span>
                <h4 className="text-xs font-black text-slate-800">
                  {activeMedicineIdx + 1} of {medicines.length}: <span className="text-brand-600 font-extrabold">{currentMed?.originalName}</span>
                </h4>
              </div>
              <button
                disabled={activeMedicineIdx === medicines.length - 1}
                onClick={() => {
                  setActiveMedicineIdx(prev => prev + 1);
                  setPackQuantity(1);
                }}
                className="p-3 hover:bg-slate-50 disabled:opacity-30 rounded-2xl text-slate-600 transition-colors shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick overview progress indicator bar */}
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-brand-500 h-full transition-all duration-300" 
                style={{ width: `${((activeMedicineIdx + 1) / medicines.length) * 100}%` }}
              />
            </div>

            {/* Selected Prescribed Medicine Summary Card */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50/50 blur-xl rounded-full" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prescribed Rx Medication</span>
                </div>
                <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md font-extrabold uppercase">
                  Reference Brand
                </span>
              </div>

              <div className="flex justify-between items-start pt-1 relative z-10">
                <div className="space-y-1 select-none">
                  <h4 className="text-2xl font-black font-display text-slate-900 leading-tight">
                    {currentMed?.originalName}
                  </h4>
                  {currentMed?.activeIngredient && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50/80 border border-brand-100 text-[10px] font-bold text-brand-700 rounded-xl">
                      <span className="font-black text-brand-600">Active Compound:</span> {currentMed.activeIngredient}
                    </div>
                  )}
                </div>
                {currentMed?.originalEstimatedPrice && (
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Est. Price</span>
                    <span className="text-xl font-black text-slate-900">
                      {currentMed.originalEstimatedPrice}
                    </span>
                  </div>
                )}
              </div>

              {/* Reference clinical stats */}
              {(currentMed?.dosage || currentMed?.frequency || currentMed?.duration) && (
                <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100 grid grid-cols-3 gap-4 relative z-10 select-none">
                  {currentMed.dosage && (
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Dosage Span</span>
                      <p className="text-xs font-black text-slate-800">{currentMed.dosage}</p>
                    </div>
                  )}
                  {currentMed.frequency && (
                    <div className="space-y-0.5 border-l border-slate-200 pl-4">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Frequency</span>
                      <p className="text-xs font-black text-slate-800 truncate">{currentMed.frequency}</p>
                    </div>
                  )}
                  {currentMed.duration && (
                    <div className="space-y-0.5 border-l border-slate-200 pl-4">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Rx Duration</span>
                      <p className="text-xs font-black text-slate-800">{currentMed.duration}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DYNAMIC SAVINGS MULTIPLIER / CALCULATOR TILES */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white p-5 rounded-[2.5rem] shadow-md space-y-4 relative overflow-hidden">
              <div className="absolute bottom-[-10%] right-[-10%] w-32 h-32 bg-brand-500/20 blur-3xl rounded-full" />
              <div className="flex items-center justify-between relative z-10 select-none">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-brand-400" />
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                    Savings Multiplier Calculator
                  </h5>
                </div>
                <span className="text-[9px] bg-brand-500/20 text-brand-300 border border-brand-500/25 px-2 py-0.5 rounded uppercase font-black">
                  Live Estimate
                </span>
              </div>

              {/* Slider for Quantity Packs */}
              <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-xs font-bold font-mono">
                  <span>Count of Month Packs:</span>
                  <span className="text-brand-400 font-extrabold text-sm">{packQuantity} Pack{packQuantity !== 1 ? 's' : ''}</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="12"
                  value={packQuantity}
                  onChange={(e) => setPackQuantity(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Comparison calculations display */}
              {originalPriceNum > 0 && currentMed?.alternatives && currentMed.alternatives.length > 0 && (
                <div className="border-t border-slate-800/80 pt-3 flex justify-between items-center relative z-10 select-none">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 block">Prescribed Cost (Total)</span>
                    <span className="text-sm font-semibold text-slate-400 line-through">
                      ₹{(originalPriceNum * packQuantity).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-widest text-green-400 block font-black">Cheapest Alternative Cost</span>
                    <span className="text-base font-black text-green-400">
                      ₹{(((() => {
                        const lowestPrice = currentMed.alternatives.reduce((min, alt) => {
                          const p = parsePrice(alt.estimatedPrice);
                          return p < min ? p : min;
                        }, parsePrice(currentMed.alternatives[0]?.estimatedPrice));
                        return lowestPrice;
                      })() || 0) * packQuantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* BRAND & PRICING COMPARISON TABLE / GRAPH AREA */}
            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-green-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Price vs. Brand Analysis
                  </h4>
                </div>
                <span className="text-[9px] text-slate-400 font-bold uppercase">Generic vs. Patent</span>
              </div>

              {/* Graphic Comparison Row helper */}
              <div className="space-y-3 pt-1">
                {/* Reference item */}
                <div className="space-y-1 leading-none select-none">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span className="truncate max-w-[150px]">Prescribed Name: ({currentMed?.originalName})</span>
                    <span className="font-extrabold">{currentMed?.originalEstimatedPrice}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-slate-400 h-full w-full rounded-full" />
                  </div>
                </div>

                {/* Alternatives mapped as graphic comparison */}
                {currentMed?.alternatives && currentMed.alternatives.map((alt, idx) => {
                  const altCost = parsePrice(alt.estimatedPrice);
                  const savingRatio = originalPriceNum > 0 ? (originalPriceNum - altCost) / originalPriceNum : 0;
                  const percentWidth = Math.max(15, Math.min(100, 100 - Math.round(savingRatio * 100)));

                  return (
                    <div key={idx} className="space-y-1 leading-none select-none">
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span className="truncate max-w-[150px] font-black">Alternative: {alt.name}</span>
                        <span className="font-extrabold text-green-600">{alt.estimatedPrice} ({alt.savingsPercentage || 'Save'})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-550 h-full rounded-full transition-all duration-350"
                          style={{ width: `${percentWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CHEAPER REPLICAS & PLATFORM ORDER LINKS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pl-1">
                <Package className="w-4.5 h-4.5 text-slate-400" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Chemical Bio-Equivalents Found ({currentMed?.alternatives?.length || 0})
                </h4>
              </div>

              {(!currentMed?.alternatives || currentMed.alternatives.length === 0) ? (
                <div className="bg-white rounded-3xl p-6 text-center border border-slate-100">
                  <p className="text-slate-400 text-xs italic">No alternative suggestions available for this drug formulation.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentMed.alternatives.map((alt, altIdx) => {
                    const pricePerPack = parsePrice(alt.estimatedPrice);
                    const totalSavingsInINR = originalPriceNum > 0 ? (originalPriceNum - pricePerPack) * packQuantity : 0;

                    return (
                      <motion.div
                        key={altIdx}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: altIdx * 0.1 }}
                        className="bg-white rounded-[2.5rem] p-5 border border-slate-100 hover:border-brand-300 transition-all shadow-sm flex flex-col gap-4 relative group"
                      >
                        {/* Header alt name and savings */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-display font-black text-slate-900 text-lg group-hover:text-brand-600 transition-colors">
                              {alt.name}
                            </h5>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[10px] text-slate-500 font-bold font-mono">
                                {alt.manufacturer || "Generic Bio-Pharma"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right flex flex-col items-end">
                            <span className="text-base font-black text-slate-900 block">
                              {alt.estimatedPrice || "N/A"}
                            </span>
                            {alt.savingsPercentage && (
                              <span className="text-[9px] font-black bg-green-500 text-white px-2 py-0.5 rounded-md shadow-md shadow-green-500/20">
                                SAVE {alt.savingsPercentage}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description rationale */}
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          {alt.description}
                        </p>

                        {/* Status availability flag */}
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 select-none">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "h-2 w-2 rounded-full animate-pulse",
                              alt.availabilityStatus?.toLowerCase().includes('out') ? "bg-red-500" : "bg-green-500"
                            )} />
                            <span className="text-[10px] font-bold text-slate-600">
                              Status: {alt.availabilityStatus || "In Stock"}
                            </span>
                          </div>
                          {totalSavingsInINR > 0 && (
                            <span className="text-[9px] font-black text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-lg">
                              Net saved: ₹{totalSavingsInINR.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Order action buttons targeting verified pharmacies */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block pl-0.5 select-none text-center">
                            🛒 Order Alternatives From Trusted Pharmacies
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={getTata1mgLink(alt.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#FFEBEB] text-[#FF4444] hover:bg-[#FFD4D4] py-3.5 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all block flex items-center justify-center gap-1 leading-none shadow-sm active:scale-95"
                            >
                              <span>Tata 1mg ↗</span>
                            </a>
                            <a
                              href={getNetmedsLink(alt.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#EBF7FF] text-[#008BE3] hover:bg-[#D4EFFF] py-3.5 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all block flex items-center justify-center gap-1 leading-none shadow-sm active:scale-95"
                            >
                              <span>Netmeds ↗</span>
                            </a>
                          </div>
                          <a
                            href={getApolloLink(alt.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#ECFBF0] text-[#0A9F43] hover:bg-[#D5F8DC] py-2.5 text-center text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all block flex items-center justify-center gap-1 leading-none border border-green-200/50 shadow-sm active:scale-95"
                          >
                            <span>Apollo Pharmacy direct checkout ↗</span>
                          </a>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Nav Actions for flipping pagination or final schedule */}
            <div className="flex gap-3 pt-3">
              <button
                onClick={() => {
                  setSubStep('names');
                  setActiveMedicineIdx(0);
                }}
                className="flex-1 py-4.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              {activeMedicineIdx < medicines.length - 1 ? (
                <button
                  onClick={() => {
                    setActiveMedicineIdx(prev => prev + 1);
                    setPackQuantity(1);
                  }}
                  className="flex-[2] py-4.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-2xl text-xs transition-colors shadow-lg shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>Next Medicine ({activeMedicineIdx + 2}/{medicines.length})</span>
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setScheduleInitial({
                      doctorName: results.doctorName,
                      patientName: results.patientName,
                      patientAge: results.patientAge,
                      prescriptionDate: results.prescriptionDate,
                      medicines: results.medicines
                    });
                    onNavigate('schedule');
                  }}
                  className="flex-[2] py-4.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>Create Intake Schedule ➔</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
