import React, { useState, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { ToastContext } from '../context/ToastContext';
import Logo from './Logo';
import { Lock, KeyRound, Eye, EyeOff, Calendar } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose, onOpenSupport }) {
  const { user, refreshProfile } = useContext(UserContext);
  const { showToast } = useContext(ToastContext);
  const API_BASE = import.meta.env.VITE_API_URL || "";

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast('Anonymous username cannot be empty.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          password: password ? password : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Profile updated successfully.', 'success');
        setPassword('');
        await refreshProfile();
        onClose();
      } else {
        showToast(data.message || 'Profile update failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to update profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not Available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
          <Logo size="sm" showText={false} className="h-10 w-10" />
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Your Profile
          </h2>
          <p className="text-xs text-slate-450 font-bold uppercase tracking-wider">Configure Anonymous Identity</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            
            {/* Registration Date (Read-Only) */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4.5 w-4.5 text-purple-600" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Registration Date</span>
                  <span className="text-[13px] font-semibold text-slate-700 mt-0.5">
                    {formatDate(user?.registrationDate || user?.createdAt)}
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-extrabold bg-purple-100 text-purple-750 px-2 py-0.5 rounded-full uppercase tracking-wider">Locked</span>
            </div>

            {/* Edit Username */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Anonymous Username</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Anonymous Username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Edit Password */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">New Password (Leave blank to keep current)</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
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

          <div className="flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-650 to-blue-600 hover:from-purple-550 hover:to-blue-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/10 cursor-pointer transition transform active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Saving Settings...' : 'Update Settings'}
            </button>

            {onOpenSupport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupport();
                }}
                className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider rounded-xl border border-purple-100 cursor-pointer transition text-center"
              >
                Contact Professor / Message Admin
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}
