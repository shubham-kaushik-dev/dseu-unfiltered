import React, { useState, useContext, useEffect, useRef } from 'react';
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

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeUserToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    if (!res.ok) throw new Error('Failed to get public VAPID key');
    const { publicKey } = await res.json();

    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    };

    const subscription = await reg.pushManager.subscribe(subscribeOptions);

    const token = localStorage.getItem('dseu_unfiltered_token');
    const adminJwtToken = localStorage.getItem('dseu_admin_jwt') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['x-anonymous-token'] = token;
    }
    if (adminJwtToken) {
      headers['Authorization'] = `Bearer ${adminJwtToken}`;
    }

    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify(subscription)
    });
    console.log('Successfully registered Web Push notification subscription');
  } catch (err) {
    console.error('Error during Web Push registration:', err);
  }
}

function AppContent() {
  const { 
    user, 
    setUser,
    loading, 
    isBanned, 
    isMaintenanceActive, 
    maintenanceMessage, 
    setIsMaintenanceActive, 
    refreshProfile,
    showLoginModal,
    setShowLoginModal,
    loginModalInitialView,
    onLoginSuccess
  } = useContext(UserContext);
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  
  const [entered, setEntered] = useState(true);
  const COMMUNITY_RULES_VERSION = "1.0";
  const hasCheckedRules = useRef(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (hasCheckedRules.current) return;

    hasCheckedRules.current = true;

    if (user && user.isRegistered) {
      if (user.rulesAcceptedVersion !== COMMUNITY_RULES_VERSION) {
        setShowRules(true);
      }
    } else {
      const localAcceptedVersion = localStorage.getItem('communityRulesAcceptedVersion');
      if (localAcceptedVersion !== COMMUNITY_RULES_VERSION) {
        setShowRules(true);
      }
    }
  }, [user, loading]);

  const handleAcceptRules = async () => {
    localStorage.setItem('communityRulesAcceptedVersion', COMMUNITY_RULES_VERSION);
    setShowRules(false);

    if (user && user.isRegistered) {
      try {
        const jwtToken = localStorage.getItem('dseu_jwt') || '';
        await fetch(`${API_BASE}/api/auth/accept-rules`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ version: COMMUNITY_RULES_VERSION })
        });
        refreshProfile();
      } catch (err) {
        console.error('Error saving rules acceptance to database:', err);
      }
    }
  };

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications are not supported in this browser.');
      return;
    }

    const initPush = async () => {
      try {
        if (Notification.permission === 'default') {
          // Wait 3 seconds so we don't startle the user immediately
          await new Promise(resolve => setTimeout(resolve, 3000));
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            await subscribeUserToPush();
          }
        } else if (Notification.permission === 'granted') {
          await subscribeUserToPush();
        }
      } catch (err) {
        console.error('Error initializing push subscription:', err);
      }
    };

    if (user) {
      initPush();
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        navigator.clipboard.writeText('');
        showToast('Screen capture protection active. Content copying is disabled.', 'warning');
        e.preventDefault();
      }

      // 2. Key combinations for screenshots (Cmd/Win + Shift + S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        showToast('Screen capture protection active. Content copying is disabled.', 'warning');
        e.preventDefault();
      }

      // 3. Print dialog (Ctrl/Cmd + P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'P' || e.key === 'p')) {
        showToast('Printing is disabled to protect platform confidentiality.', 'warning');
        e.preventDefault();
      }
    };

    const handleBlur = () => {
      document.body.classList.add('blurred-screen-protect');
    };
    const handleFocus = () => {
      document.body.classList.remove('blurred-screen-protect');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        document.body.classList.add('blurred-screen-protect');
      } else {
        document.body.classList.remove('blurred-screen-protect');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showToast]);

  useEffect(() => {
    if (!loading && user) {
      const isPrivileged = ['admin', 'sub-admin', 'sub_admin'].includes(user.role);
      const isGuest = !user.isRegistered && !isPrivileged;
      
      if (isGuest) {
        const shownKey = `dseu_random_name_shown_for_${user.displayName}`;
        if (!localStorage.getItem(shownKey)) {
          showToast(`Your random name is ${user.displayName}`, 'identity');
          localStorage.setItem(shownKey, 'true');
        }
      }
    }
  }, [user, loading, showToast]);

  useEffect(() => {
    if (!socket) return;
    const handleProfileUpdate = (data) => {
      setUser((prev) => {
        if (!prev) return prev;
        return { ...prev, ...data };
      });
    };
    socket.on('profile-update', handleProfileUpdate);
    return () => {
      socket.off('profile-update', handleProfileUpdate);
    };
  }, [socket, setUser]);

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
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={onLoginSuccess} initialView={loginModalInitialView} />
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
      <DashboardPage onOpenRules={() => setShowRules(true)} />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={onLoginSuccess} initialView={loginModalInitialView} />
      <CommunityRulesModal isOpen={showRules} onAccept={handleAcceptRules} />
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
