import React, { useState, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { ToastContext } from '../context/ToastContext';
import Logo from './Logo';
import { Lock, User, MapPin, KeyRound, Eye, EyeOff, Sparkles, HelpCircle } from 'lucide-react';

const CAMPUSES = [
  "Guru Nanak Dev DSEU Campus",
  "DSEU Rajokri Campus",
  "CHAMPS DSEU Campus",
  "DSEU Wazirpur Campus",
  "Ambedkar DSEU Campus",
  "DSEU Ranhola Campus",
  "DSEU Vivek Vihar Campus",
  "Mayur Vihar Campus",
  "Siri Fort Campus",
  "DSEU Narela Campus",
  "DSEU Pusa I Campus",
  "DSEU Pusa II Campus",
  "DSEU Jhandewalan Campus",
  "GB Pant DSEU Campus",
  "DSEU OKHLA CAMPUS",
  "Aryabhatt DSEU Campus",
  "DSEU Dheerpur Campus",
  "Meerabai DSEU Campus",
  "DSEU Jaffarpur Campus",
  "Bhai Parmanand DSEU Campus"
];

export default function LoginModal({ isOpen, onClose, onSuccess, originalMessageState }) {
  const { refreshProfile } = useContext(UserContext);
  const { showToast } = useContext(ToastContext);
  const API_BASE = import.meta.env.VITE_API_URL || "";

  // View state: 'login', 'register', 'forgot'
  const [view, setView] = useState('register');

  // Dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredCampuses = CAMPUSES.filter(c =>
    c.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  // Input states
  const [realName, setRealName] = useState('');
  const [campus, setCampus] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery states
  const [recoveryReason, setRecoveryReason] = useState('');

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!realName.trim() || !campus.trim() || !displayName.trim() || !password.trim()) {
      showToast('All registration fields are required.', 'warning');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const browserToken = localStorage.getItem('dseu_unfiltered_token');
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realName,
          campus,
          displayName,
          password,
          browserToken
        })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('dseu_unfiltered_token', data.token);
        showToast('Registration successful! Welcome to the community.', 'success');
        await refreshProfile();
        onSuccess();
      } else {
        showToast(data.message || 'Registration failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to register.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !password.trim()) {
      showToast('Anonymous username and password are required.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: displayName,
          password
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.isAdmin) {
          localStorage.setItem('dseu_admin_jwt', data.token);
          localStorage.setItem('dseu_admin_role', data.role);
          localStorage.setItem('dseu_unfiltered_token', data.token);
          showToast('Welcome back, Admin.', 'success');
          window.location.reload();
          return;
        }
        localStorage.setItem('dseu_unfiltered_token', data.token);
        showToast('Login successful.', 'success');
        await refreshProfile();
        onSuccess();
      } else {
        showToast(data.message || 'Invalid username or password.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to login.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !realName.trim() || !campus.trim() || !recoveryReason.trim()) {
      showToast('All recovery fields are required.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: displayName,
          realName,
          campus,
          reason: recoveryReason
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Password recovery request submitted successfully.', 'success');
        localStorage.setItem('dseu_unfiltered_token', data.browserToken);
        await refreshProfile();
        onClose();
        window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: 'support' }));
      } else {
        showToast(data.message || 'Failed to submit reset request.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to submit recovery request.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in select-none">
      <div className="relative max-w-md w-full bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-2xl space-y-5 animate-slide-in">
        
        {/* Header Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-extrabold text-sm cursor-pointer font-mono p-1 rounded-full hover:bg-slate-100 transition"
        >
          ✕
        </button>

        {/* Branding Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="md" showText={false} className="h-10 w-10" />
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {view === 'register' ? 'Register Identity' : view === 'login' ? 'Lounge Login' : 'Password Recovery'}
          </h2>
        </div>

        {/* Privacy Note notice box */}
        {(view === 'register' || view === 'forgot') && (
          <div className="bg-purple-50/60 border border-purple-100/70 p-4 rounded-2xl text-[12px] text-purple-750 font-medium space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase text-purple-600 tracking-wider">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Identity Protection System</span>
            </div>
            <p>Your Real Name and Campus are completely private.</p>
            <p>Only the administrator can view these details.</p>
            <p className="font-bold">Other users will ONLY see your Anonymous Username.</p>
          </div>
        )}

        {/* Dynamic Forms */}
        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Real Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Campus / College</label>
                <div className="relative">
                  {/* Hidden input to keep it required in the HTML form validation */}
                  <input
                    type="text"
                    required
                    value={campus}
                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                  
                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(!isDropdownOpen);
                      setDropdownSearch('');
                      setHighlightedIndex(0);
                    }}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-left text-slate-800 focus:outline-none focus:border-purple-500/50 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <span className={campus ? 'text-slate-800' : 'text-slate-400'}>
                        {campus || 'Select your DSEU Campus'}
                      </span>
                    </div>
                    <span className="text-slate-400 text-xs">▼</span>
                  </button>

                  {/* Click-outside backdrop overlay */}
                  {isDropdownOpen && (
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                  )}

                  {/* Floating Searchable Panel */}
                  {isDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-60">
                      {/* Search Box */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type to search..."
                          value={dropdownSearch}
                          onChange={(e) => {
                            setDropdownSearch(e.target.value);
                            setHighlightedIndex(0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedIndex(prev => 
                                prev < filteredCampuses.length - 1 ? prev + 1 : prev
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredCampuses[highlightedIndex]) {
                                setCampus(filteredCampuses[highlightedIndex]);
                                setIsDropdownOpen(false);
                              }
                            } else if (e.key === 'Escape') {
                              setIsDropdownOpen(false);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 transition"
                        />
                      </div>

                      {/* Options List */}
                      <div className="overflow-y-auto flex-1 max-h-44 py-1 divide-y divide-slate-50">
                        {filteredCampuses.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center font-medium">
                            No campuses found
                          </div>
                        ) : (
                          filteredCampuses.map((item, idx) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                setCampus(item);
                                setIsDropdownOpen(false);
                              }}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              className={`w-full text-left px-4 py-2 text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                                idx === highlightedIndex 
                                  ? 'bg-purple-50 text-purple-700' 
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{item}</span>
                              {campus === item && <span className="text-purple-600 font-bold">✓</span>}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Anonymous Username</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="E.g. AnonymousPanther"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-650 to-blue-600 hover:from-purple-550 hover:to-blue-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/10 cursor-pointer transition transform active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Creating Identity...' : 'Register Identity & Send'}
            </button>
          </form>
        )}

        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Anonymous Username</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Anonymous Username"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-650 to-blue-600 hover:from-purple-550 hover:to-blue-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/10 cursor-pointer transition transform active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Lounge Login'}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleRecoverySubmit} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Anonymous Username</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Anonymous Username"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Real Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your registered Real Name"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Registered Campus</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your registered Campus"
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Reason for Password Reset</label>
                <div className="relative">
                  <HelpCircle className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    required
                    placeholder="Explain why you need a reset (visible to admin)"
                    value={recoveryReason}
                    onChange={(e) => setRecoveryReason(e.target.value)}
                    rows="3"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition resize-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-650 to-blue-600 hover:from-purple-550 hover:to-blue-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/10 cursor-pointer transition transform active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Submitting Request...' : 'Submit Reset Request'}
            </button>
          </form>
        )}

        {/* Tab/Switcher links */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
          {view === 'register' && (
            <>
              <span>Already registered?</span>
              <button onClick={() => setView('login')} className="text-purple-600 hover:text-purple-750 cursor-pointer">Login here</button>
            </>
          )}
          {view === 'login' && (
            <>
              <button onClick={() => setView('forgot')} className="text-slate-400 hover:text-slate-600 cursor-pointer">Forgot Password?</button>
              <button onClick={() => setView('register')} className="text-purple-600 hover:text-purple-750 cursor-pointer font-black uppercase tracking-wide">Register Account</button>
            </>
          )}
          {view === 'forgot' && (
            <>
              <span>Remembered details?</span>
              <button onClick={() => setView('login')} className="text-purple-600 hover:text-purple-750 cursor-pointer">Back to Login</button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
