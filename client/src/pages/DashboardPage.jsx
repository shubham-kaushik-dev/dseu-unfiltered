import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { SocketContext } from '../context/SocketContext';
import Logo from '../components/Logo';
import professorAvatar from '../assets/professor-avatar.png';
import ProfileModal from '../components/ProfileModal';

const API_BASE = import.meta.env.VITE_API_URL || "";

// Code splitting & lazy loading components for performance optimization
const ChatBox = React.lazy(() => import('../components/ChatBox'));
const ConfessionsBoard = React.lazy(() => import('../components/ConfessionsBoard'));
const MemesBoard = React.lazy(() => import('../components/MemesBoard'));
const PollsBoard = React.lazy(() => import('../components/PollsBoard'));
const AdminPanel = React.lazy(() => import('../components/AdminPanel'));
const SupportChat = React.lazy(() => import('../components/SupportChat'));

import { 
  MessageSquare, HeartHandshake, Image as ImageIcon, BarChart3, 
  ShieldAlert, Megaphone, User as UserIcon, Volume2, VolumeX, Menu, X, Bell, RotateCcw, HelpCircle, Shield
} from 'lucide-react';

export default function DashboardPage({ onOpenRules }) {
  const { user, isBanned, openLoginModal, logout } = useContext(UserContext);
  const { socket, onlineCount, pinnedAnnouncement, setPinnedAnnouncement } = useContext(SocketContext);
  
  const [activeTab, setActiveTab] = useState('chat');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Unread badges state
  const [unreadCounts, setUnreadCounts] = useState({
    chat: 0,
    confessions: 0,
    memes: 0,
    polls: 0,
    support: 0
  });

  // Sound notification toggle (synced from localStorage)
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem('dseu_sound_enabled') !== 'false'
  );

  // PWA install states
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt choice: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Retrieve initial pinned announcement on load
  useEffect(() => {
    // A quick check to fetch slowmode/announcement
    fetch(`${API_BASE}/api/admin/stats`)
      .catch(() => {});
    
    // Set default announcement (will sync via socket also)
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/confessions`); // Wake up endpoint or similar
      } catch (err) {}
    };
    fetchSettings();

    // Listen for custom tab switch redirects
    const handleSwitch = (e) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-dashboard-tab', handleSwitch);
    return () => window.removeEventListener('switch-dashboard-tab', handleSwitch);
  }, []);

  // Listen to socket events to trigger unread counts
  useEffect(() => {
    if (!socket) return;

    // Fetch initial slowmode and pinned announcement from handshakes/sockets
    // We can also fetch them directly via endpoints or wait for events.

    const handleNewMessage = (msg) => {
      if (activeTab !== 'chat') {
        setUnreadCounts(prev => ({ ...prev, chat: prev.chat + 1 }));
      }
    };

    const handleNewConfession = () => {
      if (activeTab !== 'confessions') {
        setUnreadCounts(prev => ({ ...prev, confessions: prev.confessions + 1 }));
      }
    };

    const handleNewMeme = () => {
      if (activeTab !== 'memes') {
        setUnreadCounts(prev => ({ ...prev, memes: prev.memes + 1 }));
      }
    };

    const handleNewPoll = () => {
      if (activeTab !== 'polls') {
        setUnreadCounts(prev => ({ ...prev, polls: prev.polls + 1 }));
      }
    };

    // When client is banned redirect them
    socket.on('banned-redirect', () => {
      window.location.reload();
    });

    socket.on('user-banned-alert', (token) => {
      if (user?.browserToken === token) {
        window.location.reload();
      }
    });

    socket.on('new-chat-message', handleNewMessage);
    socket.on('new-confession', handleNewConfession);
    socket.on('new-meme', handleNewMeme);
    socket.on('new-poll', handleNewPoll);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
      socket.off('new-confession', handleNewConfession);
      socket.off('new-meme', handleNewMeme);
      socket.off('new-poll', handleNewPoll);
      socket.off('banned-redirect');
      socket.off('user-banned-alert');
    };
  }, [socket, activeTab, user]);

  // Update dynamic SEO Titles & Meta Descriptions
  useEffect(() => {
    const tabTitles = {
      chat: 'Live Chat | DSEU Unfiltered',
      confessions: 'Confessions Board | DSEU Unfiltered',
      memes: 'Campus Meme Board | DSEU Unfiltered',
      polls: 'Interactive Polls | DSEU Unfiltered',
      admin: 'Administrator Portal | DSEU Unfiltered'
    };

    const tabDescriptions = {
      chat: 'Join the real-time public anonymous chat room and connect with students across DSEU campuses.',
      confessions: 'Read and write anonymous campus confessions. Share secrets, struggles, and gossip safely without registration.',
      memes: 'Browse and share hilarious student memes. Client-side watermarked original student jokes.',
      polls: 'Vote in interactive, anonymous campus polls. Let Delhi Skill and Entrepreneurship University student voices be heard.',
      admin: 'DSEU Unfiltered secure admin console, moderation controls, and audit trails.'
    };

    document.title = tabTitles[activeTab] || 'DSEU Unfiltered';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', tabDescriptions[activeTab] || 'The official public anonymous community for DSEU.');
    }
  }, [activeTab]);

  // Clear unread counts when user switches tabs
  const handleTabChange = (tab) => {
    if (tab === 'rules') {
      if (onOpenRules) onOpenRules();
      setMobileMenuOpen(false);
      return;
    }
    setActiveTab(tab);
    setUnreadCounts(prev => ({ ...prev, [tab]: 0 }));
    setMobileMenuOpen(false);
  };

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('dseu_sound_enabled', String(newVal));
  };

  const handleResetIdentity = () => {
    if (window.confirm("Are you sure you want to reset your anonymous identity? This will generate a completely new anonymous username.")) {
      localStorage.removeItem('dseu_unfiltered_token');
      // Also clear token cookies from browser if possible
      document.cookie = "dseu_unfiltered_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      window.location.reload();
    }
  };

  const renderActiveComponent = () => {
    return (
      <React.Suspense fallback={
        <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-500 space-y-3">
          <div className="h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold tracking-widest uppercase animate-pulse">Decrypting content...</span>
        </div>
      }>
        {(() => {
          switch (activeTab) {
            case 'chat':
              return <ChatBox isAdmin={isAdmin} />;
            case 'confessions':
              return <ConfessionsBoard isAdmin={isAdmin} />;
            case 'memes':
              return <MemesBoard isAdmin={isAdmin} />;
            case 'polls':
              return <PollsBoard isAdmin={isAdmin} />;
            case 'support':
              return <SupportChat />;
            case 'admin':
              return <AdminPanel onAdminStateChange={setIsAdmin} />;
            default:
              return <ChatBox isAdmin={isAdmin} />;
          }
        })()}
      </React.Suspense>
    );
  };

  // Sidebar navigation tabs data
  const navTabs = [
    { id: 'chat', label: 'Live Chat', icon: MessageSquare },
    { id: 'confessions', label: 'Confessions', icon: HeartHandshake },
    { id: 'memes', label: 'Meme Board', icon: ImageIcon },
    { id: 'polls', label: 'Campus Polls', icon: BarChart3 },
    ...((user?.isRegistered || user?.role === 'admin') ? [{ id: 'support', label: 'Contact Professor', icon: HelpCircle }] : []),
    { id: 'rules', label: 'Rules & Regulations', icon: Shield },
    { id: 'admin', label: 'Admin Moderation', icon: ShieldAlert }
  ];

  return (
    <div className="flex h-screen bg-white text-slate-800 overflow-hidden relative font-sans">
      
      {/* 1. LEFT SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex flex-col w-76 bg-slate-50/60 border-r border-slate-200/65 shrink-0 select-none">
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-200/65 bg-white">
          <Logo size="md" />
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="px-3.5 mb-3 text-[11px] font-black text-slate-400 tracking-wider uppercase">Menu</div>
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const unread = unreadCounts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full relative flex items-center justify-between pl-8 pr-4 py-3 rounded-xl text-[16px] font-semibold transition cursor-pointer border ${
                  isActive 
                    ? 'bg-purple-50/60 border-purple-100/60 text-purple-700 shadow-sm shadow-purple-500/5' 
                    : 'text-slate-500 hover:bg-slate-100/60 hover:text-slate-800 border-transparent'
                }`}
              >
                {/* Left accent bar for active tab */}
                {isActive && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-purple-600 to-indigo-600 rounded-r-full transition-all duration-300"></span>
                )}

                <div className="flex items-center gap-3.5">
                  <Icon className={`h-5 w-5 transition duration-300 ${isActive ? 'text-purple-600 scale-105' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span>{tab.label}</span>
                </div>

                {unread > 0 && (
                  <span className="h-5 min-w-5 flex items-center justify-center px-1 rounded-full bg-purple-600 text-white font-extrabold text-[10px] animate-pulse">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* PWA Install Button inside sidebar */}
        {deferredPrompt && (
          <div className="px-4 pb-3">
            <button
              onClick={handleInstallApp}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-black bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border border-purple-500/15 text-white transition cursor-pointer shadow-md shadow-purple-600/15"
            >
              <span>📲 Install Platform</span>
            </button>
          </div>
        )}

        {/* User Identity widget */}
        <div className="p-5 bg-white border-t border-slate-200/65 flex flex-col gap-3 shadow-[0_-2px_10px_rgba(148,163,184,0.02)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.role === 'admin' || user?.isAdmin === true || user?.displayName === 'Professor (ADMIN)' ? (
                <img 
                  src={professorAvatar} 
                  alt="Admin Avatar" 
                  className="h-12 w-12 rounded-full border border-slate-200 bg-slate-50 object-cover shrink-0" 
                />
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-full text-purple-650 shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
              <div className="flex flex-col leading-none overflow-hidden">
                <span className="text-[14px] font-black text-slate-800 truncate">{user?.displayName}</span>
                <span className="text-[9px] text-slate-400 font-bold tracking-wider mt-1.5 uppercase">
                  {(user?.isRegistered || user?.role === 'admin') ? 'Registered User' : 'Visitor ID'}
                </span>
              </div>
            </div>

            <button
              onClick={toggleSound}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              title={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-500" />}
            </button>
          </div>

          {/* User Auth Actions */}
          <div className="flex gap-2">
            {(user?.isRegistered || user?.role === 'admin') ? (
              <>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-850 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-slate-200 transition cursor-pointer text-center"
                >
                  Profile
                </button>
                <button
                  onClick={logout}
                  className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-750 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-red-100 transition cursor-pointer text-center"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => openLoginModal(() => {})}
                className="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 text-[11px] font-extrabold uppercase tracking-wider rounded-lg border border-purple-100 transition cursor-pointer text-center"
              >
                Login / Register
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MOBILE HEADER & NAVIGATION DRAWER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 border-b border-slate-200 flex items-center justify-between px-4 z-40 backdrop-blur-md">
        <Logo size="sm" showText={true} />
        
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white/98 z-30 pt-20 flex flex-col justify-between animate-slide-in">
          <nav className="p-4 space-y-2">
            <div className="px-3 mb-2 text-[10px] font-black text-slate-400 tracking-wider uppercase">Menu Sections</div>
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const unread = unreadCounts[tab.id] || 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold border transition cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-purple-500/10 to-indigo-500/5 border-purple-500/15 text-purple-700' 
                      : 'border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                  {unread > 0 && (
                    <span className="h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full bg-purple-600 text-white font-extrabold text-[10px]">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile Install Button */}
          {deferredPrompt && (
            <div className="px-4 pb-2">
              <button
                onClick={handleInstallApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-blue-600 text-white cursor-pointer"
              >
                <span>📲 Install Platform</span>
              </button>
            </div>
          )}

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {user?.role === 'admin' || user?.isAdmin === true || user?.displayName === 'Professor (ADMIN)' ? (
                <img 
                  src={professorAvatar} 
                  alt="Admin Avatar" 
                  className="h-12 w-12 rounded-full border border-slate-200 bg-slate-50 object-cover shrink-0" 
                />
              ) : (
                <UserIcon className="h-4 w-4 text-purple-600" />
              )}
              <div className="flex flex-col text-xs leading-none">
                <span className="font-extrabold text-slate-800">{user?.displayName}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Campus Student</span>
              </div>
            </div>
            <button
              onClick={toggleSound}
              className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-500" />}
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN CONTENT AND RIGHT STATS PANEL GRID */}
      <main className="flex-1 flex flex-col pt-16 md:pt-0 overflow-hidden bg-slate-50/50">
           {/* Top Header Bar */}
        <header className="h-20 border-b border-slate-200/65 bg-white flex items-center justify-between px-6 shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.01)] select-none">
          <div className="flex items-center gap-4">
            <div className="flex flex-col leading-none">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">IDENTITY ESTABLISHED</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[16px] font-bold text-slate-800 flex items-center gap-1.5">
                  🐼 {user?.displayName}
                </span>
                {!(user?.role === 'admin' || user?.isAdmin === true || user?.displayName === 'Professor (ADMIN)') && (
                  <button
                    onClick={handleResetIdentity}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                    title="Reset Identity"
                  >
                    <RotateCcw className="h-3.5 w-3.5 animate-spin-once" />
                  </button>
                )}
              </div>
            </div>
            <div className="h-5 w-px bg-slate-200"></div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{onlineCount || 1} online</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search Input Placeholder */}
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search community..."
                disabled
                className="bg-slate-50 border border-slate-200/80 rounded-full px-5 py-2 text-xs text-slate-700 w-52 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500/50 transition"
              />
            </div>
            
            {/* Notifications quick link */}
            <div className="h-9 w-9 flex items-center justify-center bg-slate-50 border border-slate-200/80 text-slate-400 rounded-full hover:bg-purple-50/50 hover:border-purple-200/50 hover:text-purple-650 transition duration-300 cursor-pointer" title="Announcements">
              <Bell className="h-4.5 w-4.5" />
            </div>
          </div>
        </header>

        {/* Workspace Body container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main scrollable center feed panel */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {renderActiveComponent()}
          </div>

          {/* Right Sidebar Widgets Panel */}
          <aside className="hidden lg:flex flex-col w-80 bg-white border-l border-slate-200/65 shrink-0 p-6 overflow-y-auto space-y-6 select-none shadow-sm">
            {/* Community stats card */}
            <div className="p-5 bg-slate-50 border border-slate-200/60 rounded-[20px] shadow-sm space-y-2.5">
              <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider block">Campus Status</span>
              <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-650">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
                <span>Sync Node Active</span>
              </div>
            </div>

            {/* Pinned announcement if active */}
            {pinnedAnnouncement && (
              <div className="p-5 bg-purple-50/20 border border-purple-200/50 rounded-[20px] space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] text-purple-700 font-extrabold uppercase tracking-wider">
                  <Megaphone className="h-3.5 w-3.5 text-purple-600" /> Pinned announcement
                </div>
                <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                  {pinnedAnnouncement}
                </p>
              </div>
            )}

            {/* Trending tags section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Trending topics</h4>
              <div className="space-y-4">
                <div className="p-4 bg-white hover:bg-slate-50/50 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.015] transition duration-300 cursor-pointer">
                  <span className="text-purple-600 font-black text-[15px]">#PlacementDrive</span>
                  <p className="text-slate-550 text-xs mt-1.5 truncate font-medium">Are the software roles open for all DSEU campuses?</p>
                </div>
                <div className="p-4 bg-white hover:bg-slate-50/50 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.015] transition duration-300 cursor-pointer">
                  <span className="text-blue-600 font-black text-[15px]">#UnfilteredConfessions</span>
                  <p className="text-slate-550 text-xs mt-1.5 truncate font-medium">That confession #F293 is actually crazy lol</p>
                </div>
                <div className="p-4 bg-white hover:bg-slate-50/50 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.015] transition duration-300 cursor-pointer">
                  <span className="text-emerald-600 font-black text-[15px]">#MidsemPrep</span>
                  <p className="text-slate-550 text-xs mt-1.5 truncate font-medium">Dwarka campus library is fully packed today.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

      </main>
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} onOpenSupport={() => setActiveTab('support')} />
    </div>
  );
}
