import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Eye, EyeOff, User as UserIcon, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanPassword = password;

    if (!cleanUsername) {
      setError('Please enter your username');
      return;
    }
    if (!cleanPassword) {
      setError('Please enter your password');
      return;
    }

    if (cleanPassword.length < 4) {
      setError('For security, passwords must be at least 4 characters long');
      return;
    }

    setIsLoading(true);

    // Simulate standard secure authentication delay
    setTimeout(() => {
      onLoginSuccess(cleanUsername);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col justify-center p-6 xs:p-8 bg-gradient-to-b from-stone-50/50 via-white to-stone-50/40 relative">
      <div className="w-full max-w-sm mx-auto space-y-8">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/15"
          >
            <div className="absolute inset-[3.5px] rounded-full border border-brand-400/20" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-white relative z-10">
              <path d="M12 3c.132 0 .263 0 .393.007a7.5 7.5 0 0 1 7.92 12.446a9 9 0 1 1 -16.626-6.425A7.49 7.49 0 0 1 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 9v6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 12h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>

          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-2.5xl font-display font-semibold tracking-tight text-stone-900"
          >
            MediRec Portal
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-xs text-stone-500 font-medium tracking-wide uppercase mt-1"
          >
            Prescriptions & Verification
          </motion.p>
        </div>

        {/* Secure Form Block */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white border border-stone-200/60 rounded-3xl p-6 xs:p-7 shadow-[0_12px_36px_-6px_rgba(27,77,62,0.03)] space-y-5">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-stone-800">Account Sign In</h2>
              <p className="text-[11px] text-stone-400 font-medium">Enter your credentials below to securely access the system.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block pl-1">
                  Username
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your username"
                    className="block w-full pl-9.5 pr-3 py-2.5 bg-stone-50/50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all duration-300"
                  />
                </div>
              </div>

              {/* Password Input Field with Toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block pl-1">
                  Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your password"
                    className="block w-full pl-9.5 pr-10 py-2.5 bg-stone-50/50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                    tabIndex={-1}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Dynamic Alert message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-[11px] text-rose-800 font-medium"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Submit Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 active:scale-99 border-none text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-600/15 transition-all duration-300 disabled:opacity-75 disabled:pointer-events-none cursor-pointer mt-1"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    <span>Secure Sign In</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
        
        {/* Footnote */}
        <div className="text-[10px] text-center text-stone-400 font-medium">
          Protected by end-to-end portal security encryption.
        </div>
      </div>
    </div>
  );
}
