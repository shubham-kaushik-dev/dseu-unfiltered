import React, { useState, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { ToastContext } from '../context/ToastContext';
import Logo from './Logo';
import { KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';

export default function ForceChangePassword() {
  const { refreshProfile } = useContext(UserContext);
  const { showToast } = useContext(ToastContext);
  const API_BASE = import.meta.env.VITE_API_URL || "";

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showToast('All fields are required.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Password changed successfully! Welcome back to normal access.', 'success');
        await refreshProfile();
      } else {
        showToast(data.message || 'Failed to update password.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to change password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] select-none">
      <div className="max-w-md w-full bg-white border border-slate-250 rounded-[28px] p-8 shadow-2xl space-y-6 text-center">
        
        {/* Shield Icon Warning */}
        <div className="flex justify-center">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-full text-amber-500 animate-pulse">
            <ShieldAlert className="h-10 w-10" />
          </div>
        </div>

        {/* Messaging */}
        <div className="space-y-2">
          <Logo size="sm" showText={false} className="mx-auto h-10 w-10" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 leading-tight">
            Force Password Change
          </h2>
          <p className="text-slate-500 text-[13px] font-semibold leading-relaxed">
            You are logged in with a temporary password. You must configure a new private password before you can access the platform.
          </p>
        </div>

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Create New Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
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

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Confirm New Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-650 to-blue-600 hover:from-purple-550 hover:to-blue-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/10 cursor-pointer transition transform active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Saving New Password...' : 'Save & Unlock Platform'}
          </button>
        </form>

      </div>
    </div>
  );
}
