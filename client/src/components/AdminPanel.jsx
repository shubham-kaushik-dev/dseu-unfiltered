import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { UserContext } from '../context/UserContext';
import { 
  ShieldCheck, Lock, Users, MessageSquare, Megaphone, Clock, 
  Trash2, ShieldAlert, Ban, Search, FileText, AlertTriangle, Play,
  X, Check, ChevronLeft, ChevronRight, Eye, UserX, RefreshCw, Layers
} from 'lucide-react';

export default function AdminPanel({ onAdminStateChange }) {
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const { adminCsrfToken, setAdminCsrfToken } = useContext(UserContext);
  
  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'users', 'reports', 'logs'

  // Statistics State
  const [stats, setStats] = useState({
    onlineUsers: 0,
    offlineUsers: 0,
    totalUsers: 0,
    totalChatMessages: 0,
    totalConfessions: 0,
    totalMemes: 0,
    totalPolls: 0,
    totalReports: 0,
    bannedUsers: 0,
    mutedUsers: 0,
    todayActiveUsers: 0,
    today: { newUsers: 0, chatMessages: 0, confessions: 0, memes: 0 }
  });

  // Timeline / Activity Feed State
  const [timeline, setTimeline] = useState([]);
  const timelineEndRef = useRef(null);

  // Reports Queue State
  const [reports, setReports] = useState([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

  // Paginated Users State
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({ totalUsers: 0, totalPages: 1, currentPage: 1, limit: 10 });
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all'); // 'all', 'online', 'offline', 'muted', 'banned', 'reported'
  const [userSort, setUserSort] = useState('newest'); // 'newest', 'oldest', 'most_active', 'least_active'
  const [userPage, setUserPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Profile Drawer State
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState('chats'); // 'chats', 'confessions', 'memes', 'polls', 'reports', 'logs'

  // Control State
  const [slowmodeVal, setSlowmodeVal] = useState(0);
  const [announcementText, setAnnouncementText] = useState('');
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMsgText, setMaintenanceMsgText] = useState('');
  const [backupStatus, setBackupStatus] = useState(null);
  const [loadingBackup, setLoadingBackup] = useState(false);
  
  // Bulk controls
  const [bulkAction, setBulkAction] = useState('ban');
  const [bulkMuteMins, setBulkMuteMins] = useState(60);

  // Check login on mount
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch('/api/admin/check', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(true);
          setAdminCsrfToken(data.csrfToken || '');
          onAdminStateChange(true);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkLogin();
  }, []);

  // Fetch dashboard and lists data once logged in
  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats', { credentials: 'include' });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setSlowmodeVal(statsData.slowModeSeconds || 0);
        setMaintenanceEnabled(statsData.maintenanceMode || false);
        setMaintenanceMsgText(statsData.maintenanceMessage || '');
      }

      const reportsRes = await fetch('/api/admin/reports', { credentials: 'include' });
      if (reportsRes.ok) {
        setReports(await reportsRes.json());
      }

      const logsRes = await fetch('/api/admin/logs', { credentials: 'include' });
      if (logsRes.ok) {
        setAuditLogs(await logsRes.json());
      }

      const backupRes = await fetch('/api/admin/backup/status', { credentials: 'include' });
      if (backupRes.ok) {
        setBackupStatus(await backupRes.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch paginated users
  const fetchUsers = async () => {
    try {
      const queryParams = new URLSearchParams({
        page: userPage,
        limit: 10,
        search: userSearch,
        filter: userFilter,
        sort: userSort
      });
      const res = await fetch(`/api/admin/users?${queryParams}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUserPagination(data.pagination || { totalUsers: 0, totalPages: 1, currentPage: 1, limit: 10 });
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardData();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUsers();
    }
  }, [isLoggedIn, userPage, userFilter, userSort]);

  // Handle Search submit
  const handleUserSearchSubmit = (e) => {
    e.preventDefault();
    setUserPage(1);
    fetchUsers();
  };

  // Fetch user profile drawer data
  const fetchUserProfile = async (id) => {
    try {
      setLoadingProfile(true);
      const res = await fetch(`/api/admin/user/${id}/profile`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      } else {
        showToast('Failed to load user profile.', 'error');
        setSelectedProfileId(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error loading profile.', 'error');
      setSelectedProfileId(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (selectedProfileId) {
      fetchUserProfile(selectedProfileId);
    }
  }, [selectedProfileId]);

  // Real-time socket registrations for live updates
  useEffect(() => {
    if (!socket || !isLoggedIn) return;

    // Join admin channel
    socket.emit('admin-join');

    // Stats updates
    const handleStatsUpdate = (updatedStats) => {
      setStats(prev => ({ ...prev, ...updatedStats }));
    };

    // Live moderation ticker
    const handleModerationActivity = (activity) => {
      setTimeline(prev => {
        const newTimeline = [...prev, activity];
        return newTimeline.slice(-50); // Keep last 50 activities
      });
      // Refresh list depending on activity
      fetchDashboardData();
      fetchUsers();
      if (selectedProfileId) {
        fetchUserProfile(selectedProfileId);
      }
    };

    // User status online/offline socket events
    const handleUserStatusChange = ({ userId, browserToken, isOnline }) => {
      setUsers(prevUsers => 
        prevUsers.map(u => u.browserToken === browserToken ? { ...u, isOnline } : u)
      );
      // Recalculate stats online/offline
      fetchDashboardData();
    };

    // Reset moniker identity listener
    const handleIdentityReset = ({ userId, newName }) => {
      setUsers(prevUsers => 
        prevUsers.map(u => u._id === userId ? { ...u, displayName: newName } : u)
      );
      if (selectedProfileId === userId) {
        setProfileData(prev => prev ? { ...prev, profile: { ...prev.profile, displayName: newName } } : null);
      }
    };

    // Bulk action refresh updates
    const handleBulkUpdate = () => {
      fetchUsers();
      fetchDashboardData();
      if (selectedProfileId) {
        fetchUserProfile(selectedProfileId);
      }
    };

    socket.on('admin-stats-update', handleStatsUpdate);
    socket.on('moderation-activity', handleModerationActivity);
    socket.on('user-status-change', handleUserStatusChange);
    socket.on('user-identity-reset', handleIdentityReset);
    socket.on('bulk-moderation-update', handleBulkUpdate);

    return () => {
      socket.off('admin-stats-update', handleStatsUpdate);
      socket.off('moderation-activity', handleModerationActivity);
      socket.off('user-status-change', handleUserStatusChange);
      socket.off('user-identity-reset', handleIdentityReset);
      socket.off('bulk-moderation-update', handleBulkUpdate);
    };
  }, [socket, isLoggedIn, selectedProfileId]);

  // Scroll timeline to bottom
  useEffect(() => {
    if (timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [timeline]);

  // Authentication Login Handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Both username and password are required.');
      return;
    }

    try {
      setLoadingLogin(true);
      setLoginError('');

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.message || 'Invalid credentials.');
      } else {
        setIsLoggedIn(true);
        setAdminCsrfToken(data.csrfToken || '');
        onAdminStateChange(true);
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Connection refused by server.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
      setIsLoggedIn(false);
      setAdminCsrfToken('');
      onAdminStateChange(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Admin action triggers
  const handleResetIdentity = async (userId) => {
    if (!window.confirm('Reset this user\'s anonymous nickname?')) return;
    try {
      const res = await fetch(`/api/admin/user/${userId}/reset-identity`, {
        method: 'POST',
        headers: { 'x-csrf-token': adminCsrfToken },
        credentials: 'include'
      });
      if (res.ok) {
        showToast('Anonymous nickname regenerated.', 'success');
        fetchUsers();
      } else {
        const err = await res.json();
        showToast(err.message || 'Reset failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed.', 'error');
    }
  };

  const handleToggleUserBan = async (token) => {
    if (!window.confirm('Toggle ban status for this identity?')) return;
    try {
      const res = await fetch(`/api/admin/user/${token}/ban`, {
        method: 'POST',
        headers: { 'x-csrf-token': adminCsrfToken },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Ban status updated.', 'success');
        fetchUsers();
        fetchDashboardData();
        if (selectedProfileId) fetchUserProfile(selectedProfileId);
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error.', 'error');
    }
  };

  const handleMuteUser = async (token, durationMins) => {
    const mins = durationMins || prompt('Enter mute duration in minutes:', '60');
    if (mins === null) return;
    try {
      const res = await fetch(`/api/admin/user/${token}/mute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken 
        },
        body: JSON.stringify({ durationMinutes: mins }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast(`User muted for ${mins} minutes.`, 'success');
        fetchUsers();
        fetchDashboardData();
        if (selectedProfileId) fetchUserProfile(selectedProfileId);
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error.', 'error');
    }
  };

  const handleUnmuteUser = async (token) => {
    try {
      const res = await fetch(`/api/admin/user/${token}/unmute`, {
        method: 'POST',
        headers: { 'x-csrf-token': adminCsrfToken },
        credentials: 'include'
      });
      if (res.ok) {
        showToast('User unmuted.', 'success');
        fetchUsers();
        fetchDashboardData();
        if (selectedProfileId) fetchUserProfile(selectedProfileId);
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error.', 'error');
    }
  };

  const handleSingleUserDelete = async (userId) => {
    if (!window.confirm('WARNING: This will permanently delete the user and ALL their chats, confessions, and memes. Proceed?')) return;
    try {
      const res = await fetch('/api/admin/user/bulk-action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken 
        },
        body: JSON.stringify({ userIds: [userId], action: 'delete' }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('User and associated content fully deleted.', 'success');
        setSelectedProfileId(null);
        fetchUsers();
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showToast('Deletion failed.', 'error');
    }
  };

  // Perform bulk action
  const handleBulkActionSubmit = async () => {
    if (selectedUserIds.length === 0) {
      showToast('Please select at least one user.', 'warning');
      return;
    }
    if (!window.confirm(`Perform bulk "${bulkAction}" on ${selectedUserIds.length} users?`)) return;

    try {
      const res = await fetch('/api/admin/user/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({
          userIds: selectedUserIds,
          action: bulkAction,
          durationMinutes: bulkMuteMins
        }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast(`Bulk ${bulkAction} processed successfully.`, 'success');
        setSelectedUserIds([]);
        fetchUsers();
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showToast('Bulk operation failed.', 'error');
    }
  };

  // Content deletion helper
  const handleContentDelete = async (targetId, targetType) => {
    if (!window.confirm(`Delete this ${targetType}?`)) return;
    try {
      const res = await fetch('/api/admin/content/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({ targetIds: [targetId], targetType }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast(`${targetType.toUpperCase()} deleted successfully.`, 'success');
        if (selectedProfileId) fetchUserProfile(selectedProfileId);
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showToast('Deletion failed.', 'error');
    }
  };

  // Resolve content reports
  const handleReportAction = async (reportId, action) => {
    try {
      const res = await fetch(`/api/admin/report/${reportId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({ action }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('Report resolved successfully.', 'success');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showToast('Report action failed.', 'error');
    }
  };

  // Global settings updates
  const handleUpdateSlowmode = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/slowmode', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({ seconds: slowmodeVal }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('Slow mode configuration updated.', 'success');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({ text: announcementText }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('Announcement updated.', 'success');
        setAnnouncementText('');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMaintenance = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        body: JSON.stringify({ 
          enabled: maintenanceEnabled, 
          message: maintenanceMsgText 
        }),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('Maintenance settings updated.', 'success');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerBackup = async () => {
    if (loadingBackup) return;
    try {
      setLoadingBackup(true);
      const res = await fetch('/api/admin/backup', { 
        method: 'POST',
        headers: { 'x-csrf-token': adminCsrfToken },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setBackupStatus(data);
        showToast('Database backup completed successfully.', 'success');
        fetchDashboardData();
      } else {
        showToast(data.message || 'Backup failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Database backup failed.', 'error');
    } finally {
      setLoadingBackup(false);
    }
  };

  // Toggle selection checkbox
  const handleSelectUser = (id) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllUsers = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u._id));
    }
  };

  // RENDER LOGIN CARD
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[75vh] px-4 font-inter select-none">
        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 shadow-2xl glass-panel relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
          <div className="text-center space-y-3 mb-8">
            <div className="mx-auto h-12 w-12 bg-purple-600/10 rounded-2xl border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-zinc-100 uppercase tracking-wide">ADMINISTRATOR</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">Sign in to access platform moderation controls</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter administrator username"
                className="w-full bg-zinc-950/80 border border-zinc-850 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 placeholder-zinc-700 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full bg-zinc-950/80 border border-zinc-850 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 placeholder-zinc-700 transition"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-center gap-2.5 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full py-3 bg-purple-600 hover:bg-purple-550 disabled:bg-purple-800 text-white font-bold text-sm rounded-xl tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loadingLogin ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'AUTHENTICATE'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // RENDER PRINCIPAL PANEL
  return (
    <div className="space-y-6 font-inter pb-16 relative">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-5 select-none glass-panel">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <h2 className="text-2xl font-black text-zinc-100 uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-purple-400" />
              MODERATION CONTROL CENTER
            </h2>
          </div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Real-time college surveillance and content filters</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="px-3.5 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload stats
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white border border-red-800/20 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Tabs list menu */}
      <div className="flex border-b border-zinc-850 gap-2 select-none">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition ${activeTab === 'analytics' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          📈 Analytics & Controls
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition ${activeTab === 'users' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          👥 User Directory
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition relative ${activeTab === 'reports' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          🚨 Reports Queue
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center animate-pulse">
              {reports.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition ${activeTab === 'logs' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          📋 Audit Trail Logs
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      
      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Stats widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Total Users</span>
              <strong className="text-2xl text-zinc-200">{stats.totalUsers || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Online Sockets</span>
              <strong className="text-2xl text-emerald-400">{stats.onlineUsers || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Offline monikers</span>
              <strong className="text-2xl text-zinc-400">{stats.offlineUsers || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Active Today</span>
              <strong className="text-2xl text-indigo-400">{stats.todayActiveUsers || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Chat Messages</span>
              <strong className="text-2xl text-zinc-300">{stats.totalChatMessages || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Confessions</span>
              <strong className="text-2xl text-zinc-300">{stats.totalConfessions || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Memes Board</span>
              <strong className="text-2xl text-zinc-300">{stats.totalMemes || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Poll Votes</span>
              <strong className="text-2xl text-zinc-300">{stats.totalPolls || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Banned Monikers</span>
              <strong className="text-2xl text-red-500">{stats.bannedUsers || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Muted Monikers</span>
              <strong className="text-2xl text-yellow-500">{stats.mutedUsers || 0}</strong>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 glass-panel col-span-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Reports received</span>
              <strong className="text-2xl text-red-400">{stats.totalReports || 0} ({stats.totalReportsPending || 0} pending)</strong>
            </div>
          </div>

          {/* Today's Activity widgets */}
          <div className="bg-zinc-900/30 border border-zinc-855 rounded-2xl p-5 select-none glass-panel">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Today's Activity Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900">
                <span className="text-[10px] text-zinc-500 block font-bold">New Users</span>
                <strong className="text-xl text-zinc-200">{stats.today?.newUsers || 0}</strong>
              </div>
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900">
                <span className="text-[10px] text-zinc-500 block font-bold">Chat Messages</span>
                <strong className="text-xl text-zinc-200">{stats.today?.chatMessages || 0}</strong>
              </div>
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900">
                <span className="text-[10px] text-zinc-500 block font-bold">Confessions</span>
                <strong className="text-xl text-zinc-200">{stats.today?.confessions || 0}</strong>
              </div>
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900">
                <span className="text-[10px] text-zinc-500 block font-bold">Meme Uploads</span>
                <strong className="text-xl text-zinc-205">{stats.today?.memes || 0}</strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Live Mod Ticker */}
            <div className="md:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col h-[380px] glass-panel">
              <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest border-b border-zinc-800/60 pb-3 mb-3 flex items-center gap-1.5">
                <Play className="h-4 w-4 fill-cyan-400 text-cyan-400 rotate-90" />
                LIVE MODERATION TIMELINE
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed">
                {timeline.length === 0 ? (
                  <p className="text-zinc-650 italic">Timeline listener active. Awaiting socket events...</p>
                ) : (
                  timeline.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-2 border-b border-zinc-900/50 pb-1.5">
                      <span className="text-zinc-300">{item.text}</span>
                      <span className="text-zinc-600 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                  ))
                )}
                <div ref={timelineEndRef} />
              </div>
            </div>

            {/* Quick config settings */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4 glass-panel">
              <h3 className="text-xs font-black text-violet-400 uppercase tracking-widest border-b border-zinc-800/60 pb-3">
                ⚙️ GLOBAL CONTROLS
              </h3>
              
              {/* Slowmode */}
              <form onSubmit={handleUpdateSlowmode} className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  CHAT SLOWMODE (SECONDS)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={slowmodeVal}
                    onChange={(e) => setSlowmodeVal(e.target.value)}
                    min="0"
                    max="300"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-200"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-violet-650 hover:bg-violet-550 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              </form>

              {/* Announcement */}
              <form onSubmit={handleUpdateAnnouncement} className="space-y-2 pt-2 border-t border-zinc-850">
                <label className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5" />
                  PIN CAMPUS ANNOUNCEMENT
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="e.g. Server maintenance..."
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-violet-650 hover:bg-violet-550 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Pin
                  </button>
                </div>
              </form>

              {/* Maintenance Toggle */}
              <form onSubmit={handleUpdateMaintenance} className="space-y-3 pt-2 border-t border-zinc-850">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    MAINTENANCE MODE
                  </label>
                  <input
                    type="checkbox"
                    checked={maintenanceEnabled}
                    onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                    className="h-4.5 w-4.5 accent-purple-650 rounded bg-zinc-900 border-zinc-800"
                  />
                </div>
                {maintenanceEnabled && (
                  <div className="space-y-2">
                    <textarea
                      value={maintenanceMsgText}
                      onChange={(e) => setMaintenanceMsgText(e.target.value)}
                      placeholder="Enter maintenance page description..."
                      rows="2"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 resize-none"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-1.5 bg-purple-650 hover:bg-purple-550 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Save Mode Settings
                </button>
              </form>

              {/* Backup Trigger */}
              <div className="pt-2 border-t border-zinc-850 space-y-2">
                <span className="text-[10px] text-zinc-550 font-bold block">DATABASE BACKUP</span>
                <button
                  onClick={handleTriggerBackup}
                  disabled={loadingBackup}
                  className="w-full py-1.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-905 disabled:bg-zinc-950 text-zinc-300 hover:text-zinc-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {loadingBackup ? (
                    <div className="h-3.5 w-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Run DB Backup Now'
                  )}
                </button>
                {backupStatus && (
                  <div className="text-[10px] text-zinc-500 font-mono text-center">
                    Last backup: {backupStatus.status === 'success' ? `✅ ${backupStatus.sizeKb} KB` : '❌ Failed'} - {new Date(backupStatus.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER DIRECTORY TABLE */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel select-none">
            <form onSubmit={handleUserSearchSubmit} className="flex gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search by nickname, ID, token..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-purple-650 transition"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-655 hover:bg-purple-550 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              {/* Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Filter</span>
                <select
                  value={userFilter}
                  onChange={(e) => { setUserFilter(e.target.value); setUserPage(1); }}
                  className="bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Users</option>
                  <option value="online">Online Users</option>
                  <option value="offline">Offline Users</option>
                  <option value="muted">Muted Users</option>
                  <option value="banned">Banned Users</option>
                  <option value="reported">Reported Users</option>
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Sort</span>
                <select
                  value={userSort}
                  onChange={(e) => { setUserSort(e.target.value); setUserPage(1); }}
                  className="bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="most_active">Most Active</option>
                  <option value="least_active">Least Active</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Actions Panel */}
          {selectedUserIds.length > 0 && (
            <div className="bg-purple-950/20 border border-purple-900/40 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in select-none">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-400" />
                <span className="text-xs font-bold text-purple-300">
                  {selectedUserIds.length} users selected for bulk moderation
                </span>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="ban">Ban selected</option>
                  <option value="unban">Unban selected</option>
                  <option value="mute">Mute selected</option>
                  <option value="unmute">Unmute selected</option>
                  <option value="reset-identity">Reset nickname</option>
                  <option value="delete">Delete selected accounts</option>
                  <option value="delete-messages">Delete all user chats</option>
                  <option value="delete-memes">Delete all user memes</option>
                  <option value="delete-confessions">Delete all user confessions</option>
                  <option value="delete-polls">Delete all user polls</option>
                </select>
                {bulkAction === 'mute' && (
                  <input
                    type="number"
                    value={bulkMuteMins}
                    onChange={(e) => setBulkMuteMins(e.target.value)}
                    placeholder="Mins"
                    min="1"
                    className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-zinc-200 text-center"
                  />
                )}
                <button
                  onClick={handleBulkActionSubmit}
                  className="px-4 py-1.5 bg-purple-650 hover:bg-purple-550 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Apply Action
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-3 py-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 text-xs font-medium rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="bg-zinc-950/80 border-b border-zinc-850 text-zinc-550 uppercase tracking-widest text-[10px] font-bold">
                    <th className="py-4 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedUserIds.length === users.length}
                        onChange={handleSelectAllUsers}
                        className="h-4 w-4 accent-purple-600 rounded bg-zinc-900 border-zinc-800 cursor-pointer"
                      />
                    </th>
                    <th className="py-4 px-4">Anonymous nickname</th>
                    <th className="py-4 px-4">Browser Token / ID</th>
                    <th className="py-4 px-4 text-center">Online Status</th>
                    <th className="py-4 px-4">Counters (Chats/Conf/Memes)</th>
                    <th className="py-4 px-4">Ban / Mute status</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/40 text-zinc-300">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-zinc-600 italic">
                        No registered users found matching the search/filter criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id} className="hover:bg-zinc-950/20 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u._id)}
                            onChange={() => handleSelectUser(u._id)}
                            className="h-4 w-4 accent-purple-600 rounded bg-zinc-900 border-zinc-800 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                            {u.displayName}
                            {u.isBanned && (
                              <span className="px-1.5 py-0.5 bg-red-950/60 border border-red-900 text-red-500 text-[9px] font-black rounded-md uppercase">
                                Banned
                              </span>
                            )}
                            {u.mutedUntil && new Date(u.mutedUntil) > new Date() && (
                              <span className="px-1.5 py-0.5 bg-yellow-950/60 border border-yellow-900 text-yellow-500 text-[9px] font-black rounded-md uppercase animate-pulse">
                                Muted
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-600">Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px] text-zinc-500">
                          <div className="group relative cursor-help">
                            <span>ID: {u._id}</span>
                            <div className="hidden group-hover:block absolute bg-zinc-950 border border-zinc-800 text-[9px] text-zinc-400 p-1.5 rounded-lg -top-8 left-0 z-20 whitespace-nowrap">
                              Token: {u.browserToken}
                            </div>
                          </div>
                          <span className="block text-[9px] text-zinc-600">Active: {new Date(u.lastActive).toLocaleTimeString([], { hour12: false })}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {u.isOnline ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-900 text-emerald-400 font-bold text-[9px] uppercase tracking-wide">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-950/50 border border-zinc-850 text-zinc-500 font-bold text-[9px] uppercase tracking-wide">
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-450">
                          <span>💬 {u.chatCount || 0}</span>
                          <span className="mx-2">|</span>
                          <span>📝 {u.confessionCount || 0}</span>
                          <span className="mx-2">|</span>
                          <span>🖼️ {u.memeCount || 0}</span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-450">
                          {u.isBanned ? (
                            <span className="text-red-500 font-semibold block text-[10px]">Permanently Banned</span>
                          ) : (
                            <span className="text-zinc-600 block text-[10px]">Ban clear</span>
                          )}
                          {u.mutedUntil && new Date(u.mutedUntil) > new Date() ? (
                            <span className="text-yellow-500 text-[10px] block">
                              Muted until {new Date(u.mutedUntil).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-zinc-650 text-[10px] block">Mute clear</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedProfileId(u._id)}
                              title="View full Profile timeline history"
                              className="p-1 bg-zinc-950 hover:bg-zinc-900 text-indigo-400 hover:text-indigo-300 border border-zinc-850 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="h-4.5 w-4.5" />
                            </button>
                            <button
                              onClick={() => handleResetIdentity(u._id)}
                              title="Reset Moniker Display Name"
                              className="p-1 bg-zinc-950 hover:bg-zinc-900 text-teal-400 hover:text-teal-300 border border-zinc-850 rounded-lg transition cursor-pointer"
                            >
                              <RefreshCw className="h-4.5 w-4.5" />
                            </button>
                            {u.mutedUntil && new Date(u.mutedUntil) > new Date() ? (
                              <button
                                onClick={() => handleUnmuteUser(u.browserToken)}
                                title="Unmute User"
                                className="p-1 bg-zinc-950 hover:bg-zinc-900 text-yellow-500 hover:text-yellow-400 border border-zinc-850 rounded-lg transition cursor-pointer"
                              >
                                <Check className="h-4.5 w-4.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMuteUser(u.browserToken)}
                                title="Mute User"
                                className="p-1 bg-zinc-950 hover:bg-zinc-900 text-yellow-600 hover:text-yellow-550 border border-zinc-850 rounded-lg transition cursor-pointer"
                              >
                                <Clock className="h-4.5 w-4.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleUserBan(u.browserToken)}
                              title={u.isBanned ? 'Unban User' : 'Ban User'}
                              className={`p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 rounded-lg transition cursor-pointer ${u.isBanned ? 'text-emerald-500 hover:text-emerald-400' : 'text-red-500 hover:text-red-400'}`}
                            >
                              <Ban className="h-4.5 w-4.5" />
                            </button>
                            <button
                              onClick={() => handleSingleUserDelete(u._id)}
                              title="Delete Account & Content"
                              className="p-1 bg-zinc-950 hover:bg-zinc-900 text-red-600 hover:text-red-550 border border-zinc-850 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {userPagination.totalPages > 1 && (
              <div className="bg-zinc-950/80 px-4 py-3 border-t border-zinc-855 flex items-center justify-between select-none">
                <span className="text-zinc-550 text-[10px]">
                  Showing Page {userPagination.currentPage} of {userPagination.totalPages} (Total {userPagination.totalUsers} users)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                    disabled={userPage === 1}
                    className="p-1.5 bg-zinc-900 border border-zinc-800 disabled:opacity-40 text-zinc-400 hover:text-zinc-200 rounded-xl transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => setUserPage(prev => Math.min(userPagination.totalPages, prev + 1))}
                    disabled={userPage === userPagination.totalPages}
                    className="p-1.5 bg-zinc-900 border border-zinc-800 disabled:opacity-40 text-zinc-400 hover:text-zinc-200 rounded-xl transition cursor-pointer"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REPORTS QUEUE */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.filter(r => r.status === 'pending').length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-8 text-center text-zinc-650 italic select-none glass-panel">
              🎉 No pending reports in the queue.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.filter(r => r.status === 'pending').map((rep) => (
                <div key={rep._id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4 glass-panel flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2 py-0.5 bg-red-950/50 border border-red-900 text-red-500 font-bold text-[9px] uppercase rounded-md tracking-wider">
                        {rep.targetType} reported
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {new Date(rep.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900/80 font-mono text-[11px] text-zinc-400 break-words max-h-32 overflow-y-auto">
                      <span className="text-zinc-550 block text-[9px] font-bold uppercase tracking-wider mb-1">Target ID: {rep.targetId}</span>
                      {rep.targetDetails || 'Content details unavailable.'}
                    </div>

                    <div className="text-[10px] text-zinc-500">
                      <span className="block font-bold">Reason: <span className="text-zinc-300 font-normal">{rep.reason}</span></span>
                      <span className="block font-bold mt-0.5">Reporter Token: <span className="text-zinc-300 font-mono font-normal">{rep.reporterToken}</span></span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-900/80 justify-end">
                    <button
                      onClick={() => handleReportAction(rep._id, 'ignore')}
                      className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-450 hover:text-zinc-200 text-[10px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Ignore Report
                    </button>
                    <button
                      onClick={() => handleReportAction(rep._id, 'mute_user')}
                      className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-yellow-600 hover:text-yellow-500 text-[10px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Mute Creator
                    </button>
                    <button
                      onClick={() => handleReportAction(rep._id, 'ban_user')}
                      className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-red-650 hover:text-red-500 text-[10px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Ban Creator
                    </button>
                    <button
                      onClick={() => handleReportAction(rep._id, 'delete_content')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Target Content
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden glass-panel select-none">
          <div className="p-4 bg-zinc-950/80 border-b border-zinc-850 flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileText className="h-4.5 w-4.5" />
              SYSTEM AUDIT TRAIL LOG
            </h3>
            <span className="text-[10px] text-zinc-550 font-mono">Showing last 200 logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-950/40 border-b border-zinc-900 text-zinc-500 uppercase tracking-widest text-[9px] font-bold">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4">Action description logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-955/30 text-zinc-300 font-mono text-[10px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-zinc-650 italic">
                      No system admin action logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-zinc-950/10">
                      <td className="py-2.5 px-4 text-zinc-600 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-violet-400 font-bold">
                        {log.adminUsername}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 bg-zinc-950 rounded border border-zinc-850 text-zinc-400 uppercase text-[9px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400 break-words">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER PROFILE SIDE DRAWER OVERLAY */}
      {selectedProfileId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end font-inter animate-fade-in select-none">
          <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 h-full flex flex-col justify-between shadow-2xl relative">
            <button
              onClick={() => { setSelectedProfileId(null); setProfileData(null); }}
              className="absolute top-4 right-4 p-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:text-zinc-200 rounded-full text-zinc-400 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {loadingProfile || !profileData ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-zinc-550 uppercase tracking-widest animate-pulse">Retrieving profile...</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Profile Header */}
                <div className="p-6 bg-zinc-950/80 border-b border-zinc-850 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-purple-650/15 border border-purple-500/20 rounded-2xl flex items-center justify-center text-xl text-purple-400 font-bold font-mono">
                      {profileData.profile.displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-zinc-150 flex items-center gap-2">
                        {profileData.profile.displayName}
                        {profileData.profile.isOnline ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Online"></span>
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-zinc-700" title="Offline"></span>
                        )}
                      </h3>
                      <p className="text-[10px] text-zinc-650 font-mono">User ID: {profileData.profile._id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                    <div className="p-2 bg-zinc-900/50 rounded-xl border border-zinc-855">
                      <span className="text-zinc-600 block uppercase tracking-wider font-bold">Join Date</span>
                      <span className="text-zinc-300 font-bold">{new Date(profileData.profile.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="p-2 bg-zinc-900/50 rounded-xl border border-zinc-855">
                      <span className="text-zinc-600 block uppercase tracking-wider font-bold">Last Active</span>
                      <span className="text-zinc-300 font-bold">{new Date(profileData.profile.lastActive).toLocaleTimeString([], { hour12: false })}</span>
                    </div>
                    <div className="p-2 bg-zinc-900/50 rounded-xl border border-zinc-855 col-span-2">
                      <span className="text-zinc-600 block uppercase tracking-wider font-bold">Browser Token</span>
                      <span className="text-zinc-350 font-mono">{profileData.profile.browserToken}</span>
                    </div>
                  </div>

                  {/* Profile Actions */}
                  <div className="flex gap-2">
                    {profileData.profile.isBanned ? (
                      <button
                        onClick={() => handleToggleUserBan(profileData.profile.browserToken)}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Unban Account
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleUserBan(profileData.profile.browserToken)}
                        className="flex-1 py-1.5 bg-red-650 hover:bg-red-550 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Ban Account
                      </button>
                    )}
                    {profileData.profile.mutedUntil && new Date(profileData.profile.mutedUntil) > new Date() ? (
                      <button
                        onClick={() => handleUnmuteUser(profileData.profile.browserToken)}
                        className="flex-1 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Unmute Account
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMuteUser(profileData.profile.browserToken)}
                        className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-yellow-600 hover:text-yellow-500 border border-zinc-800 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Mute Account
                      </button>
                    )}
                    <button
                      onClick={() => handleResetIdentity(profileData.profile._id)}
                      className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-teal-400 hover:text-teal-300 border border-zinc-800 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Reset Moniker
                    </button>
                    <button
                      onClick={() => handleSingleUserDelete(profileData.profile._id)}
                      className="px-3.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-500 border border-red-900/50 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Profile Tabs */}
                <div className="flex border-b border-zinc-850 px-6 gap-1 bg-zinc-950/40 text-[10px] select-none font-bold uppercase tracking-wider">
                  <button
                    onClick={() => setProfileTab('chats')}
                    className={`px-3 py-2 border-b-2 transition ${profileTab === 'chats' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-550'}`}
                  >
                    Chats ({profileData.chats.length})
                  </button>
                  <button
                    onClick={() => setProfileTab('confessions')}
                    className={`px-3 py-2 border-b-2 transition ${profileTab === 'confessions' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-555'}`}
                  >
                    Confessions ({profileData.confessions.length})
                  </button>
                  <button
                    onClick={() => setProfileTab('memes')}
                    className={`px-3 py-2 border-b-2 transition ${profileTab === 'memes' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-550'}`}
                  >
                    Memes ({profileData.memes.length})
                  </button>
                  <button
                    onClick={() => setProfileTab('polls')}
                    className={`px-3 py-2 border-b-2 transition ${profileTab === 'polls' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-550'}`}
                  >
                    Poll Votes ({profileData.polls.length})
                  </button>
                  <button
                    onClick={() => setProfileTab('reports')}
                    className={`px-3 py-2 border-b-2 transition ${profileTab === 'reports' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-550'}`}
                  >
                    Reports ({profileData.reports.length})
                  </button>
                  <button
                    onClick={() => setProfileTab('logs')}
                    className={`px-3 py-2 border-b-2 transition ${profileTab === 'logs' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-550'}`}
                  >
                    Timeline History ({profileData.logs.length})
                  </button>
                </div>

                {/* Profile Tab Contents */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  
                  {/* Chats */}
                  {profileTab === 'chats' && (
                    <div className="space-y-2">
                      {profileData.chats.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">No chat messages sent by this user.</p>
                      ) : (
                        profileData.chats.map(msg => (
                          <div key={msg._id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-550 block font-mono">{new Date(msg.createdAt).toLocaleString()}</span>
                              <p className="text-xs text-zinc-300 break-all">{msg.text}</p>
                            </div>
                            <button
                              onClick={() => handleContentDelete(msg._id, 'message')}
                              className="p-1 text-zinc-600 hover:text-red-500 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Confessions */}
                  {profileTab === 'confessions' && (
                    <div className="space-y-2">
                      {profileData.confessions.length === 0 ? (
                        <p className="text-xs text-zinc-650 italic">No confessions posted by this user.</p>
                      ) : (
                        profileData.confessions.map(c => (
                          <div key={c._id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-500 block font-mono">{new Date(c.createdAt).toLocaleString()}</span>
                              <p className="text-xs text-zinc-300 break-all">{c.text}</p>
                            </div>
                            <button
                              onClick={() => handleContentDelete(c._id, 'confession')}
                              className="p-1 text-zinc-600 hover:text-red-500 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Memes */}
                  {profileTab === 'memes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {profileData.memes.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic col-span-2">No memes uploaded by this user.</p>
                      ) : (
                        profileData.memes.map(m => (
                          <div key={m._id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl flex flex-col justify-between gap-3 overflow-hidden">
                            <div className="space-y-1.5">
                              <span className="text-[9px] text-zinc-550 block font-mono">{new Date(m.createdAt).toLocaleString()}</span>
                              <img src={m.imageUrl} alt={m.caption} className="w-full h-32 object-cover rounded-lg border border-zinc-900 bg-zinc-950" />
                              <p className="text-xs text-zinc-300 break-words">{m.caption}</p>
                            </div>
                            <button
                              onClick={() => handleContentDelete(m._id, 'meme')}
                              className="w-full py-1 bg-red-950/40 border border-red-900/50 hover:bg-red-950 text-red-500 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Meme
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Polls */}
                  {profileTab === 'polls' && (
                    <div className="space-y-2">
                      {profileData.polls.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">No poll votes registered by this user.</p>
                      ) : (
                        profileData.polls.map(p => (
                          <div key={p._id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl">
                            <span className="text-[9px] text-zinc-500 block font-mono">{new Date(p.createdAt).toLocaleString()}</span>
                            <h4 className="text-xs font-bold text-zinc-200 mt-1">{p.question}</h4>
                            <div className="mt-2 space-y-1">
                              {p.options.map((opt, idx) => {
                                const didVote = opt.votes.includes(profileData.profile.browserToken);
                                return (
                                  <div key={idx} className={`text-[10px] p-1.5 rounded-lg border flex justify-between ${didVote ? 'bg-purple-955/30 border-purple-800/40 text-purple-400 font-bold' : 'bg-zinc-950 border-zinc-900 text-zinc-500'}`}>
                                    <span>{opt.text}</span>
                                    <span>{opt.votes.length} votes {didVote && '✨ Your Vote'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Reports */}
                  {profileTab === 'reports' && (
                    <div className="space-y-2">
                      {profileData.reports.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">No reports submitted by this user.</p>
                      ) : (
                        profileData.reports.map(r => (
                          <div key={r._id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl space-y-2">
                            <div className="flex justify-between">
                              <span className="px-1.5 py-0.5 bg-red-950/40 border border-red-900/50 text-red-500 text-[8px] font-black uppercase rounded">
                                Reported {r.targetType}
                              </span>
                              <span className="text-[9px] text-zinc-550 font-mono">{new Date(r.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-zinc-400 break-words"><span className="font-bold text-zinc-550">Reason:</span> {r.reason}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Logs Timeline */}
                  {profileTab === 'logs' && (
                    <div className="space-y-2 font-mono text-[10px]">
                      {profileData.logs.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic font-sans">No admin log activities registered against this moniker.</p>
                      ) : (
                        profileData.logs.map(log => (
                          <div key={log._id} className="p-2.5 bg-zinc-955/60 border border-zinc-900 rounded-xl space-y-1">
                            <div className="flex justify-between items-center text-zinc-600">
                              <span>Admin: <span className="text-violet-400 font-bold">{log.adminUsername}</span></span>
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-zinc-350 break-words"><span className="px-1 py-0.2 bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-500 rounded mr-1.5">{log.action}</span>{log.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
