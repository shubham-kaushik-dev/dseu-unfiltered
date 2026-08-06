import React, { useState, useContext, useEffect } from 'react';
import { UserContext, UserProvider } from './context/UserContext';
import { SocketContext, SocketProvider } from './context/SocketContext';
import { ToastProvider, ToastContext } from './context/ToastContext';
import SplashScreen from './components/SplashScreen';
import DashboardPage from './pages/DashboardPage';
import BannedPage from './components/BannedPage';
import ForceChangePassword from './components/ForceChangePassword';
import LoginModal from './components/LoginModal';
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
import Logo from './components/Logo';
import { ShieldCheck, HardHat, Lock } from 'lucide-react';
import CommunityRulesModal from './components/CommunityRulesModal';

const API_BASE = import.meta.env.VITE_API_URL || "";

function AppContent() {
  const { 
    user, 
    loading, 
    isBanned, 
    isMaintenanceActive, 
    maintenanceMessage, 
    setIsMaintenanceActive, 
    refreshProfile,
    showLoginModal,
    setShowLoginModal,
    onLoginSuccess
  } = useContext(UserContext);
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  
  const [entered, setEntered] = useState(false);
  const [showRules, setShowRules] = useState(() => {
    return localStorage.getItem('dseu_rules_accepted') !== '1.0';
  });

  useEffect(() => {
    const accepted = localStorage.getItem('dseu_rules_accepted') === '1.0';
    if (!accepted) {
      setShowRules(true);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin_session_expired')) {
      showToast('Admin session expired or invalid. Please login again.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showToast]);
  const [showAdminBypass, setShowAdminBypass] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [siteConfig, setSiteConfig] = useState(null);

  // Apply settings (Title, theme accent colors) dynamically
  const applySettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const config = await res.json();
        setSiteConfig(config);
        document.title = config.website_name || 'DSEU Unfiltered';
        
        const primaryColor = config.primary_theme_color || '#8b5cf6';
        document.documentElement.style.setProperty('--primary-color', primaryColor);
        
        const hex = primaryColor.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          document.documentElement.style.setProperty('--primary-color-rgb', `${r}, ${g}, ${b}`);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    applySettings();
    if (socket) {
      socket.on('settings-updated', applySettings);
      return () => socket.off('settings-updated', applySettings);
    }
  }, [socket]);

  // If admin logs in from bypass, reload profile to bypass maintenance
  const handleAdminStateChange = (isLoggedIn) => {
    setAdminLoggedIn(isLoggedIn);
    if (isLoggedIn) {
      setShowAdminBypass(false);
      setIsMaintenanceActive(false);
      refreshProfile(); // Fetch profile again with admin session cookies set
    }
  };

  // 0. Render Force Password Change Screen if user logged in with temp password
  if (user?.mustChangePassword) {
    return <ForceChangePassword />;
  }

  // 1. Render Ban Lockout Screen if user is banned
  if (isBanned || user?.isBanned) {
    return (
      <>
        <BannedPage user={user || { browserToken: localStorage.getItem('dseu_unfiltered_token') }} />
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={onLoginSuccess} />
      </>
    );
  }

  // 2. Render maintenance page if active
  if (isMaintenanceActive && !adminLoggedIn) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-50/50 px-4">
        <div className="absolute inset-0 radial-grid pointer-events-none opacity-80" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)', backgroundSize: '24px 24px' }}></div>

        <div className="max-w-md w-full bg-white border border-slate-200/80 p-8 rounded-[20px] text-center space-y-6 shadow-[0_4px_25px_-5px_rgba(148,163,184,0.1)] z-10 select-none">
          <div className="flex justify-center">
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-full text-purple-650 animate-pulse" style={{ color: 'var(--primary-color)', backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)', borderColor: 'rgba(var(--primary-color-rgb), 0.2)' }}>
              <HardHat className="h-10 w-10" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Logo size="sm" showText={false} className="mx-auto h-12 w-12" />
            <h1 className="text-[28px] font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mt-2 leading-tight uppercase" style={{ backgroundImage: 'linear-gradient(to right, var(--primary-color), #2563eb)' }}>
              {siteConfig?.website_name || 'DSEU Unfiltered'}
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Maintenance Mode Active</p>
          </div>

          <p className="text-slate-650 text-[15px] font-semibold leading-relaxed bg-slate-50 p-4 border border-slate-200/60 rounded-xl">
            {siteConfig?.maintenance_message || 'DSEU Unfiltered is currently undergoing scheduled maintenance. We will be back online shortly!'}
          </p>

          <div className="text-[11px] text-slate-400 font-extrabold border-t border-slate-100 pt-4 uppercase tracking-wider">
            {siteConfig?.website_tagline || 'Delhi Skill and Entrepreneurship University • Student Community'}
          </div>

          {/* Admin Login Bypass Link */}
          <div className="pt-2">
            <button
              onClick={() => setShowAdminBypass(true)}
              className="inline-flex items-center gap-2 text-slate-450 hover:text-purple-600 text-[16px] font-semibold tracking-wide cursor-pointer transition duration-255"
              style={{ '--hover-color': 'var(--primary-color)' }}
            >
              <Lock className="h-4 w-4" />
              <span>Admin Bypass Login</span>
            </button>
          </div>
        </div>

        {/* Admin Login Modal Overlay */}
        {showAdminBypass && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="relative max-w-md w-full bg-white border border-slate-250 rounded-[20px] p-6 shadow-2xl space-y-4 animate-slide-in">
              <button
                onClick={() => setShowAdminBypass(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer font-mono"
              >
                ✕ Close
              </button>
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center p-8 space-y-3">
                  <div className="h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-slate-450 uppercase tracking-widest animate-pulse">Establishing connection...</span>
                </div>
              }>
                <AdminPanel onAdminStateChange={handleAdminStateChange} />
              </React.Suspense>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Normal Flow
  return entered ? (
    <>
      <DashboardPage />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={onLoginSuccess} />
      <CommunityRulesModal isOpen={showRules} onAccept={() => setShowRules(false)} />
    </>
  ) : (
    <SplashScreen user={user} loading={loading} onComplete={() => setEntered(true)} />
  );
}

function App() {
  return (
    <UserProvider>
      <SocketProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SocketProvider>
    </UserProvider>
  );
}

export default App;
