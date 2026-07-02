import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Pill, 
  Loader2, 
  TrendingDown, 
  Building, 
  Sparkles, 
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  X
} from 'lucide-react';
import { searchMedicineByName, MedicineAlternative } from '../services/geminiService';
import { cn } from '../lib/utils';

export default function MedicineSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MedicineAlternative | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await searchMedicineByName(query);
      if (data && data.alternatives && data.alternatives.length > 0) {
        setResult(data);
      } else {
        setError("Could not find cheaper alternatives for this medicine. Try another common brand name (e.g., Augmentin, Combiflam, Lipitor, Crocin).");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch medicine details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResult(null);
    setError(null);
  };

  // Safe numeric parsing for calculations
  const parsePrice = (priceStr?: string): number => {
    if (!priceStr) return 0;
    const match = priceStr.replace(/,/g, '').match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-6"
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="bg-brand-50 text-brand-600 p-1.5 rounded-lg">
            <Search className="w-4 h-4 text-brand-600" />
          </div>
          <h3 className="font-display font-bold text-slate-900 text-lg">Search Medicine Alternatives</h3>
        </div>
        <p className="text-slate-400 text-xs">
          Enter any brand-name or prescribed medicine to find chemically identical, cheaper generic substitutes.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brand e.g., Combiflam, Augmentin..."
            className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 rounded-2xl text-sm transition-all outline-none font-medium text-slate-800"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !searchQuery.trim()}
          className="px-6 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-2xl text-sm transition-all active:scale-95 shadow-md shadow-brand-500/10 shrink-0 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            "Search"
          )}
        </button>
      </form>

      {/* Loading state skeletal pulse */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4 p-5 bg-slate-50 rounded-3xl animate-pulse border border-slate-100"
          >
            <div className="flex justify-between">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
            </div>
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="border-t border-slate-200/50 pt-4 space-y-3">
              <div className="h-3 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded-2xl w-full" />
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs rounded-2xl flex gap-2.5 items-start font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            {/* Searched Medicine Card */}
            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-brand-500/5 blur-xl rounded-full" />
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Searched Medicine</span>
                  <h4 className="font-display font-black text-slate-900 text-lg flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-brand-500 shrink-0" />
                    {result.originalName}
                  </h4>
                  {result.activeIngredient && (
                    <div className="inline-block px-2 py-0.5 bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-bold rounded-lg mt-1">
                      Molecule: {result.activeIngredient}
                    </div>
                  )}
                </div>
                {result.originalEstimatedPrice && (
                  <div className="text-right">
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider block">Price</span>
                    <span className="text-base font-black text-slate-900">{result.originalEstimatedPrice}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cheaper Alternatives Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 pl-1">
                <TrendingDown className="w-4 h-4 text-green-600" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cheaper Alternatives Found ({result.alternatives.length})
                </h4>
              </div>

              <div className="space-y-3">
                {result.alternatives.map((alt, idx) => {
                  const originalPrice = parsePrice(result.originalEstimatedPrice);
                  const altPrice = parsePrice(alt.estimatedPrice);
                  const priceDiff = originalPrice - altPrice;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white border border-slate-100 hover:border-brand-200 rounded-3xl p-4.5 shadow-sm space-y-3 transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <h5 className="font-display font-bold text-slate-900 text-md group-hover:text-brand-600 transition-colors">
                            {alt.name}
                          </h5>
                          {alt.manufacturer && (
                            <p className="text-[10px] text-slate-400 font-semibold font-mono flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {alt.manufacturer}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-green-600 block">
                            {alt.estimatedPrice || "N/A"}
                          </span>
                          {alt.savingsPercentage && (
                            <span className="inline-block text-[8px] font-bold bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded mt-0.5">
                              Save {alt.savingsPercentage}
                            </span>
                          )}
                        </div>
                      </div>

                      {alt.description && (
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          {alt.description}
                        </p>
                      )}

                      {/* Info / Links Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full animate-pulse",
                            alt.availabilityStatus?.toLowerCase().includes('out') ? "bg-red-500" : "bg-green-500"
                          )} />
                          <span>{alt.availabilityStatus || "In Stock"}</span>
                        </div>
                        
                        {priceDiff > 0 && (
                          <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                            Save ₹{priceDiff.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Direct links */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={`https://www.1mg.com/search/all?name=${encodeURIComponent(alt.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-red-50 hover:bg-red-100 text-red-600 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all block flex items-center justify-center gap-1"
                        >
                          <span>Tata 1mg ↗</span>
                        </a>
                        <a
                          href={`https://www.netmeds.com/catalogsearch/result?q=${encodeURIComponent(alt.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all block flex items-center justify-center gap-1"
                        >
                          <span>Netmeds ↗</span>
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
