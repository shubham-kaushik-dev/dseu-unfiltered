import React, { useState, useEffect, useRef, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { 
  Users, AlertTriangle, FileText, Settings, ShieldCheck, 
  Trash2, Undo, Check, X, ShieldAlert, Ban, Clock, 
  Settings2, Plus, Edit, Send, Image, Smile, Search, 
  ArrowLeft, ArrowRight, Eye, ShieldAlert as StealthIcon, RefreshCw, Pin
} from 'lucide-react';
import Logo from './Logo';

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function AdminPanel({ onAdminStateChange }) {
  const { user, adminCsrfToken, refreshProfile, setAdminCsrfToken, adminJwt, setAdminJwt, adminFetch } = useContext(UserContext);
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);

  // Tabs: 'analytics', 'users', 'reports', 'support', 'settings', 'trash', 'history', 'announcements', 'logs'
  const [activeTab, setActiveTab] = useState('analytics');

  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users management state
  const [usersList, setUsersList] = useState([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersFilter, setUsersFilter] = useState('all');
  const [usersSort, setUsersSort] = useState('newest');
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit, setUsersLimit] = useState(10);
  const [usersPagination, setUsersPagination] = useState({});
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // User Profile Drawer state
  const [drawerUserId, setDrawerUserId] = useState(null);
  const [drawerData, setDrawerData] = useState(null);
  const [newWarningText, setNewWarningText] = useState('');
  const [adminNoteText, setAdminNoteText] = useState('');
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Reports state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Support Inbox state
  const [conversations, setConversations] = useState([]);
  const [selectedConversationToken, setSelectedConversationToken] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [supportSearch, setSupportSearch] = useState('');
  const [supportFilter, setSupportFilter] = useState('all'); // 'all', 'unread'
  const [supportPage, setSupportPage] = useState(1);
  const [supportPagination, setSupportPagination] = useState({});
  const [supportLoading, setSupportLoading] = useState(false);
  
  // Support reply form state
  const [supportReplyText, setSupportReplyText] = useState('');
  const [supportAttachment, setSupportAttachment] = useState(null);
  const [supportPreviewUrl, setSupportPreviewUrl] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportUserTyping, setSupportUserTyping] = useState(false);
  const fileInputRef = useRef(null);

  // Settings State
  const [settings, setSettings] = useState({
    website_name: '',
    website_logo: '',
    website_tagline: '',
    primary_theme_color: '#8b5cf6',
    maintenance_message: '',
    support_welcome_message: '',
    max_upload_size: 10,
    slow_mode_seconds: 0,
    enable_notifications: true,
    stealth_mode: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Trash Bin State
  const [trashItems, setTrashItems] = useState({ messages: [], confessions: [], memes: [], polls: [] });
  const [trashLoading, setTrashLoading] = useState(false);

  // Session History State
  const [sessionLogs, setSessionLogs] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Announcements CRUD State
  const [announcementHistory, setAnnouncementHistory] = useState([]);
  const [announcementFilter, setAnnouncementFilter] = useState('all'); // 'all', 'active', 'scheduled', 'expired', 'deleted'
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [announcementPagination, setAnnouncementPagination] = useState({});
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // CRUD Announcement form
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    type: 'homepage',
    scheduledStart: '',
    expiresAt: '',
    bgColor: '#f3e8ff',
    textColor: '#6b21a8'
  });
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Auto check and login if token is authenticated on mount
  useEffect(() => {
    const jwtToken = localStorage.getItem('dseu_admin_jwt') || '';
    if (!jwtToken) return;

    fetch(`${API_BASE}/api/admin/check`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    })
      .then(async (res) => {
        if (res.ok) {
          const check = await res.json();
          setCsrfToken(check.csrfToken);
          setAdminCsrfToken(check.csrfToken);
          setAdminLoggedIn(true);
          onAdminStateChange(true);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch data depending on active tab
  useEffect(() => {
    if (!adminLoggedIn) return;

    if (activeTab === 'analytics') fetchStats();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'reports') fetchReports();
    else if (activeTab === 'support') fetchConversations();
    else if (activeTab === 'settings') fetchSettings();
    else if (activeTab === 'trash') fetchTrash();
    else if (activeTab === 'history') fetchSessions();
    else if (activeTab === 'announcements') fetchAnnouncementsHistory();
    else if (activeTab === 'logs') fetchAuditLogs();
  }, [activeTab, adminLoggedIn, usersPage, usersFilter, usersSort, supportPage, supportFilter, announcementPage, announcementFilter]);

  // Sync users list whenever search query changes (debounced)
  useEffect(() => {
    if (!adminLoggedIn || activeTab !== 'users') return;
    const timer = setTimeout(() => {
      setUsersPage(1);
      fetchUsers();
    }, 400);
    return () => clearTimeout(timer);
  }, [usersSearch]);

  // Debounce search inside support
  useEffect(() => {
    if (!adminLoggedIn || activeTab !== 'support') return;
    const timer = setTimeout(() => {
      setSupportPage(1);
      fetchConversations();
    }, 450);
    return () => clearTimeout(timer);
  }, [supportSearch]);

  // Debounce search inside announcements
  useEffect(() => {
    if (!adminLoggedIn || activeTab !== 'announcements') return;
    const timer = setTimeout(() => {
      setAnnouncementPage(1);
      fetchAnnouncementsHistory();
    }, 400);
    return () => clearTimeout(timer);
  }, [announcementSearch]);

  // Setup sockets updates for Dashboard metrics
  useEffect(() => {
    if (!socket || !adminLoggedIn) return;

    // Listen for live counts changes
    socket.on('admin-stats-update', (data) => {
      setStats((prev) => prev ? { ...prev, ...data } : null);
    });

    // Listen for live warnings
    socket.on('moderation-activity', (log) => {
      setAuditLogs((prev) => [log, ...prev].slice(0, 150));
      // Reload stats for today updates
      fetchStats();
    });

    // Support chat typing indicators from user
    socket.on('support-user-typing', (data) => {
      if (selectedConversationToken === data.browserToken) {
        setSupportUserTyping(data.isTyping);
      }
    });

    // Support chat messaging receipts
    socket.on('support-message', (msg) => {
      // Reload conversation row counts
      fetchConversations();
      if (selectedConversationToken === msg.browserToken) {
        setConversationHistory((prev) => [...prev, msg]);
        // Update seen status automatically
        socket.emit('support-seen', { token: msg.browserToken });
        adminFetch(`/api/admin/support/seen/${msg.browserToken}`, {
          method: 'POST'
        }).catch(console.error);
      }
    });

    socket.on('support-messages-seen', (data) => {
      if (selectedConversationToken === data.token) {
        setConversationHistory((prev) =>
          prev.map((m) => (m.senderType === 'admin' ? { ...m, isSeen: true } : m))
        );
      }
    });

    // Reload directory tables when user registers
    socket.on('new-user-registered', () => {
      fetchUsers();
    });

    return () => {
      socket.off('admin-stats-update');
      socket.off('moderation-activity');
      socket.off('support-user-typing');
      socket.off('support-message');
      socket.off('support-messages-seen');
      socket.off('new-user-registered');
    };
  }, [socket, adminLoggedIn, selectedConversationToken, csrfToken]);

  // Handle support message scrolling
  const supportBottomRef = useRef(null);
  useEffect(() => {
    supportBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, supportUserTyping]);

  // Admin login authentication handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;

    try {
      setIsAuthenticating(true);
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      const data = await res.json();
      if (res.ok) {
        setCsrfToken(data.csrfToken);
        setAdminCsrfToken(data.csrfToken);
        setAdminJwt(data.token);
        setAdminLoggedIn(true);
        onAdminStateChange(true);
        showToast('Successfully logged in as administrator.', 'success');
        refreshProfile(); // refresh parent profile context
      } else {
        showToast(data.message || 'Invalid administrator credentials.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error during login authentication.', 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      const jwtToken = localStorage.getItem('dseu_admin_jwt') || '';
      await fetch(`${API_BASE}/api/admin/logout`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      setAdminCsrfToken('');
      setCsrfToken('');
      setAdminJwt('');
      setAdminLoggedIn(false);
      onAdminStateChange(false);
      setUsernameInput('');
      setPasswordInput('');
      showToast('Logged out of administrator panel.', 'info');
      refreshProfile(); // refresh parent profile context
    } catch (err) {
      console.error(err);
    }
  };

  // REST GET functions
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await adminFetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const queryParams = new URLSearchParams({
        page: usersPage,
        limit: usersLimit,
        search: usersSearch,
        filter: usersFilter,
        sort: usersSort
      });
      const res = await adminFetch(`/api/admin/users?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users);
        setUsersPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const res = await adminFetch('/api/admin/reports');
      if (res.ok) {
        const list = await res.json();
        setReports(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setSupportLoading(true);
      const params = new URLSearchParams({
        page: supportPage,
        search: supportSearch,
        filter: supportFilter
      });
      const res = await adminFetch(`/api/admin/support/conversations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
        setSupportPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSupportLoading(false);
    }
  };

  const fetchConversationMessages = async (token) => {
    try {
      const res = await adminFetch(`/api/admin/support/conversation/${token}`);
      if (res.ok) {
        const list = await res.json();
        setConversationHistory(list);
        
        // Notify seen status
        if (socket) {
          socket.emit('support-seen', { token });
        }
        await adminFetch(`/api/admin/support/seen/${token}`, {
          method: 'POST'
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchTrash = async () => {
    try {
      setTrashLoading(true);
      const res = await adminFetch('/api/admin/trash');
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTrashLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await adminFetch('/api/admin/sessions');
      if (res.ok) {
        const list = await res.json();
        setSessionLogs(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchAnnouncementsHistory = async () => {
    try {
      setAnnouncementsLoading(true);
      const params = new URLSearchParams({
        page: announcementPage,
        filter: announcementFilter,
        search: announcementSearch
      });
      const res = await adminFetch(`/api/admin/announcements/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncementHistory(data.history);
        setAnnouncementPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await adminFetch('/api/admin/logs');
      if (res.ok) {
        const list = await res.json();
        setAuditLogs(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Moderation Handlers
  const handleUserSelectToggle = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedUserIds.length === usersList.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(usersList.map((u) => u._id));
    }
  };

  const handleBulkAction = async (action, duration = 60) => {
    if (selectedUserIds.length === 0) return;
    const confirmMsg = `Perform bulk action "${action}" on ${selectedUserIds.length} user(s)?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await adminFetch('/api/admin/user/bulk-action', {
        method: 'POST',
        body: JSON.stringify({
          userIds: selectedUserIds,
          action,
          durationMinutes: duration,
          banReason: 'Bulk moderation action'
        })
      });

      if (res.ok) {
        showToast('Bulk action completed successfully.', 'success');
        setSelectedUserIds([]);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Bulk action failed.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // User Profile drawer loader
  const handleOpenUserDrawer = async (id) => {
    try {
      setDrawerLoading(true);
      setDrawerUserId(id);
      const res = await adminFetch(`/api/admin/user/${id}/profile`);
      if (res.ok) {
        const data = await res.json();
        setDrawerData(data);
        setAdminNoteText(data.profile.adminNotes || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleAddWarning = async () => {
    if (!newWarningText.trim()) return;
    try {
      const res = await adminFetch(`/api/admin/user/${drawerUserId}/warn`, {
        method: 'POST',
        body: JSON.stringify({ reason: newWarningText })
      });
      if (res.ok) {
        setNewWarningText('');
        showToast('Warning issued successfully.', 'success');
        handleOpenUserDrawer(drawerUserId); // reload profiles
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveWarning = async (warningId) => {
    if (!window.confirm('Remove this warning?')) return;
    try {
      const res = await adminFetch(`/api/admin/user/${drawerUserId}/unwarn`, {
        method: 'POST',
        body: JSON.stringify({ warningId })
      });
      if (res.ok) {
        showToast('Warning removed.', 'success');
        handleOpenUserDrawer(drawerUserId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNotes = async () => {
    try {
      const res = await adminFetch(`/api/admin/user/${drawerUserId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ notes: adminNoteText })
      });
      if (res.ok) {
        showToast('Private admin notes saved successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Report actions
  const handleReportAction = async (reportId, action, duration = 60) => {
    const reason = window.prompt('Specify action reason (optional):');
    try {
      const res = await adminFetch(`/api/admin/report/${reportId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, durationMinutes: duration, banReason: reason })
      });
      if (res.ok) {
        showToast('Report action recorded.', 'success');
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Support Reply upload files
  const handleSupportFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('Attachment exceeds 10 MB size limit.', 'warning');
        return;
      }
      setSupportAttachment(file);
      setSupportPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveSupportAttachment = () => {
    setSupportAttachment(null);
    setSupportPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendSupportReply = async (e) => {
    e.preventDefault();
    if (!supportReplyText.trim() && !supportAttachment) return;

    try {
      setSupportSending(true);
      const formData = new FormData();
      formData.append('token', selectedConversationToken);
      formData.append('text', supportReplyText);
      if (supportAttachment) {
        formData.append('attachment', supportAttachment);
      }

      const res = await adminFetch('/api/admin/support/reply', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setSupportReplyText('');
        handleRemoveSupportAttachment();
        if (socket) {
          socket.emit('support-typing', { token: selectedConversationToken, isTyping: false });
        }
        fetchConversationMessages(selectedConversationToken);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to deliver reply.', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSupportSending(false);
    }
  };

  // Settings Save
  const handleSettingsSave = async (e) => {
    e.preventDefault();
    try {
      setSettingsLoading(true);
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast('Global settings updated in real time.', 'success');
        fetchSettings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Trash actions
  const handleRestoreTrash = async (targetId, targetType) => {
    try {
      const res = await adminFetch('/api/admin/trash/restore', {
        method: 'POST',
        body: JSON.stringify({ targetId, targetType })
      });
      if (res.ok) {
        showToast('Item restored successfully.', 'success');
        fetchTrash();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDeleteTrash = async (targetId, targetType) => {
    if (!window.confirm('WARNING: This will permanently delete the item. Confirm?')) return;
    try {
      const res = await adminFetch('/api/admin/trash/delete', {
        method: 'POST',
        body: JSON.stringify({ targetId, targetType })
      });
      if (res.ok) {
        showToast('Item permanently deleted.', 'success');
        fetchTrash();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Announcements CRUD Handlers
  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) return;

    try {
      const method = editingAnnouncementId ? 'PUT' : 'POST';
      const endpoint = editingAnnouncementId ? `/api/admin/announcement/${editingAnnouncementId}` : '/api/admin/announcement';

      const res = await adminFetch(endpoint, {
        method,
        body: JSON.stringify(newAnnouncement)
      });

      if (res.ok) {
        showToast(editingAnnouncementId ? 'Announcement edited successfully.' : 'Announcement scheduled.', 'success');
        setNewAnnouncement({
          title: '',
          content: '',
          type: 'homepage',
          scheduledStart: '',
          expiresAt: '',
          bgColor: '#f3e8ff',
          textColor: '#6b21a8'
        });
        setEditingAnnouncementId(null);
        fetchAnnouncementsHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditAnnouncementSelect = (ann) => {
    setEditingAnnouncementId(ann._id);
    setNewAnnouncement({
      title: ann.title,
      content: ann.content,
      type: ann.type,
      scheduledStart: ann.scheduledStart ? ann.scheduledStart.substring(0, 16) : '',
      expiresAt: ann.expiresAt ? ann.expiresAt.substring(0, 16) : '',
      bgColor: ann.bgColor || '#f3e8ff',
      textColor: ann.textColor || '#6b21a8'
    });
  };

  const handleSoftDeleteAnnouncement = async (id) => {
    if (!window.confirm('Soft delete this announcement?')) return;
    try {
      const res = await adminFetch(`/api/admin/announcement/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Announcement moved to trash.', 'success');
        fetchAnnouncementsHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Render Login state if not authenticated
  if (!adminLoggedIn) {
    return (
      <div className="w-full max-w-sm mx-auto p-4 select-none font-inter">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
              <ShieldAlert className="h-8 w-8 text-purple-650" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Admin Moderation Portal</h3>
            <p className="text-xs font-semibold text-slate-450 mt-1 uppercase tracking-wider">Access strictly restricted</p>
          </div>
        </div>

        <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Username</label>
            <input
              type="text"
              placeholder="Enter administrator username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none transition"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Password</label>
            <input
              type="password"
              placeholder="Enter administrator password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-3 bg-purple-600 hover:bg-purple-550 disabled:opacity-40 text-white text-[16px] font-bold uppercase tracking-widest rounded-xl transition cursor-pointer"
          >
            {isAuthenticating ? 'Authorizing Session...' : 'Authenticate Login'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-300 font-inter flex flex-col">
      {/* Navbar header */}
      <div className="border-b border-zinc-800 bg-[#0e0f14] px-8 py-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <Logo size="sm" showText={false} className="h-9 w-9" />
          <div>
            <h1 className="text-md font-black tracking-tight text-white uppercase leading-none">
              Professor Moderation Terminal
            </h1>
            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block mt-0.5">DSEU Unfiltered Oversight</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLogoutClick} 
            className="px-3.5 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 hover:text-red-300 text-xs font-bold uppercase rounded-lg border border-red-900/50 cursor-pointer"
          >
            Terminate Session
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#0e0f14] border-b border-zinc-800/80 flex overflow-x-auto select-none">
        {[
          { id: 'analytics', label: 'Dashboard', icon: ShieldCheck },
          { id: 'users', label: 'Directory', icon: Users },
          { id: 'reports', label: 'Reports', icon: AlertTriangle },
          { id: 'support', label: 'Support Inbox', icon: Send },
          { id: 'settings', label: 'Custom Settings', icon: Settings },
          { id: 'trash', label: 'Trash Bin', icon: Trash2 },
          { id: 'announcements', label: 'Announcements', icon: Pin },
          { id: 'history', label: 'Login History', icon: Clock },
          { id: 'logs', label: 'Audit Trail', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 cursor-pointer transition whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-purple-650 text-purple-400 bg-purple-950/5' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main body area */}
      <div className="flex-1 p-8 overflow-y-auto bg-[#07080b]">
        
        {/* Tab 1: Analytics Dashboard */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <h2 className="text-[28px] font-black uppercase text-white tracking-tight">Oversight Overview</h2>
            
            {statsLoading ? (
              <p className="text-zinc-500 font-medium">Recalculating global statistics...</p>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: "Today's Active Users", value: stats.todayActiveUsers, color: 'text-purple-400' },
                  { label: "Online Users (Stealth-excl.)", value: stats.onlineUsers, color: 'text-emerald-400' },
                  { label: "Banned Visitors", value: stats.bannedUsers, color: 'text-red-400' },
                  { label: "Reports Queue", value: stats.totalReportsPending, color: 'text-amber-400' },
                  { label: "Today's Messages", value: stats.today.chatMessages, color: 'text-zinc-300' },
                  { label: "Today's Confessions", value: stats.today.confessions, color: 'text-zinc-300' },
                  { label: "Today's Memes", value: stats.today.memes, color: 'text-zinc-300' },
                  { label: "Today's Polls", value: stats.today.polls, color: 'text-zinc-300' }
                ].map((card, i) => (
                  <div key={i} className="p-5 bg-[#0e0f14] border border-zinc-800/80 rounded-2xl shadow-2xl">
                    <span className="text-[11px] text-zinc-650 font-bold uppercase tracking-wider block">{card.label}</span>
                    <span className={`text-3xl font-black block mt-2 ${card.color}`}>{card.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {stats && (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Service Status Logs</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { service: 'Express Server', status: stats.systems.server, statusColor: 'bg-emerald-500' },
                    { service: 'MongoDB Node', status: stats.systems.db, statusColor: 'bg-emerald-500' },
                    { service: 'Cloudinary CDN', status: stats.systems.cloudinary, statusColor: 'bg-emerald-500' },
                    { service: 'Socket.IO Core', status: stats.systems.sockets, statusColor: 'bg-emerald-500' }
                  ].map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[#0e0f14] border border-zinc-800/80 rounded-xl">
                      <span className="text-xs font-bold text-zinc-400">{s.service}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${s.statusColor}`}></span>
                        <span className="text-xs font-mono text-zinc-300">{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: User Directory */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-[28px] font-black uppercase text-white tracking-tight">User Directory</h2>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                  <input
                    type="text"
                    placeholder="Search by nickname/token..."
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    className="bg-[#0e0f14] border border-zinc-850 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-purple-650"
                  />
                </div>

                <select
                  value={usersFilter}
                  onChange={(e) => { setUsersFilter(e.target.value); setUsersPage(1); }}
                  className="bg-[#0e0f14] border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Users</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="muted">Muted</option>
                  <option value="banned">Banned</option>
                </select>

                <select
                  value={usersSort}
                  onChange={(e) => { setUsersSort(e.target.value); setUsersPage(1); }}
                  className="bg-[#0e0f14] border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest Join</option>
                  <option value="oldest">Oldest Join</option>
                  <option value="most_active">Most Active</option>
                </select>
              </div>
            </div>

            {/* Bulk options bar */}
            {selectedUserIds.length > 0 && (
              <div className="p-4 bg-purple-950/15 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs select-none">
                <span className="font-bold text-purple-400 uppercase tracking-widest">{selectedUserIds.length} users selected</span>
                <div className="flex gap-2">
                  <button onClick={() => handleBulkAction('ban')} className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg border border-red-900/50 cursor-pointer uppercase font-black">Ban</button>
                  <button onClick={() => handleBulkAction('unban')} className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-900/50 cursor-pointer uppercase font-black">Unban</button>
                  <button onClick={() => handleBulkAction('mute', 60)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-850 cursor-pointer uppercase font-black">Mute 1h</button>
                  <button onClick={() => handleBulkAction('unmute')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-850 cursor-pointer uppercase font-black">Unmute</button>
                  <button onClick={() => handleBulkAction('shadow-ban')} className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/40 text-amber-400 rounded-lg border border-amber-900/50 cursor-pointer uppercase font-black">Shadow Ban</button>
                  <button onClick={() => handleBulkAction('unshadow-ban')} className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/40 text-amber-400 rounded-lg border border-amber-900/50 cursor-pointer uppercase font-black">Unshadow</button>
                  <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg border border-red-900/50 cursor-pointer uppercase font-black">Delete Accounts</button>
                </div>
              </div>
            )}

            {/* Users Directory Table */}
            {usersLoading ? (
              <p className="text-zinc-500 font-medium">Scanning network database...</p>
            ) : (
              <div className="bg-[#0e0f14] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 select-none bg-zinc-950/50 font-bold uppercase tracking-wider">
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.length === usersList.length && usersList.length > 0}
                          onChange={handleSelectAllToggle}
                          className="h-4 w-4 cursor-pointer accent-purple-650"
                        />
                      </th>
                      <th className="p-4">Anonymous Nickname</th>
                      <th className="p-4">Oversight Status</th>
                      <th className="p-4">Last Seen Address</th>
                      <th className="p-4 text-center">Messages</th>
                      <th className="p-4 text-center">Confessions</th>
                      <th className="p-4 text-center">Memes</th>
                      <th className="p-4 text-center">Warnings</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-8 text-center text-zinc-650 font-semibold uppercase tracking-wider">No users matching search filters found.</td>
                      </tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u._id} className="border-b border-zinc-850 hover:bg-zinc-900/30 transition duration-150">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u._id)}
                              onChange={() => handleUserSelectToggle(u._id)}
                              className="h-4 w-4 cursor-pointer accent-purple-650"
                            />
                          </td>
                          <td className="p-4 font-bold text-zinc-200">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${u.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`}></span>
                              <span>{u.displayName}</span>
                              {u.isShadowBanned && (
                                <span className="text-[9px] font-black uppercase text-red-500 bg-red-950/40 border border-red-900/50 px-1 rounded">Shadow</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {u.isBanned ? (
                              <span className="text-red-400 font-bold uppercase tracking-wider block text-[10px]">BANNED</span>
                            ) : u.mutedUntil && new Date(u.mutedUntil) > new Date() ? (
                              <span className="text-amber-500 font-bold uppercase tracking-wider block text-[10px]">MUTED</span>
                            ) : (
                              <span className="text-emerald-500 font-bold uppercase tracking-wider block text-[10px]">ACTIVE</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-[10px] text-zinc-500 max-w-[150px] truncate">
                            IP: {u.ip || 'Unknown'}
                          </td>
                          <td className="p-4 text-center font-semibold text-zinc-400">{u.chatCount}</td>
                          <td className="p-4 text-center font-semibold text-zinc-400">{u.confessionCount}</td>
                          <td className="p-4 text-center font-semibold text-zinc-400">{u.memeCount}</td>
                          <td className="p-4 text-center font-bold text-zinc-400">
                            {u.warnings?.length > 0 ? (
                              <span className="text-red-400">{u.warnings.length}</span>
                            ) : '-'}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleOpenUserDrawer(u._id)}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-850 cursor-pointer"
                            >
                              Oversight Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                
                {/* Pagination */}
                {usersPagination.totalPages > 1 && (
                  <div className="p-4 bg-zinc-950/50 border-t border-zinc-850 flex items-center justify-between select-none">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                      Page {usersPagination.currentPage} of {usersPagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPagination.currentPage === 1}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-400 rounded-lg cursor-pointer"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setUsersPage((p) => Math.min(usersPagination.totalPages, p + 1))}
                        disabled={usersPagination.currentPage === usersPagination.totalPages}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-400 rounded-lg cursor-pointer"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h2 className="text-[28px] font-black uppercase text-white tracking-tight">Oversight Reports Queue</h2>

            {reportsLoading ? (
              <p className="text-zinc-500 font-medium">Scanning incoming reports...</p>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center bg-[#0e0f14] border border-zinc-800/80 rounded-2xl text-zinc-500 uppercase tracking-widest font-bold">
                Oversight Reports Queue is currently empty.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reports.map((rep) => (
                  <div key={rep._id} className="p-5 bg-[#0e0f14] border border-zinc-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.2 rounded tracking-widest">
                          REPORTED {rep.targetType}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-650">ID: {rep.targetId}</span>
                      </div>
                      <p className="text-zinc-200 text-xs font-semibold leading-relaxed pt-1">
                        Report Reason: <span className="text-amber-400 italic">"{rep.reason}"</span>
                      </p>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider pt-1">
                        Target details: {rep.targetDetails}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleReportAction(rep._id, 'ignore')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-850 rounded-lg cursor-pointer uppercase font-bold text-[10px]">Ignore</button>
                      <button onClick={() => handleReportAction(rep._id, 'delete_content')} className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg border border-red-900/50 cursor-pointer uppercase font-bold text-[10px]">Delete post</button>
                      <button onClick={() => handleReportAction(rep._id, 'ban_user')} className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg border border-red-900/50 cursor-pointer uppercase font-bold text-[10px]">Ban author</button>
                      <button onClick={() => handleReportAction(rep._id, 'mute_user', 60)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-850 cursor-pointer uppercase font-bold text-[10px]">Mute author 1h</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Support Inbox Messenger */}
        {activeTab === 'support' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[72vh] overflow-hidden">
            {/* List side */}
            <div className="bg-[#0e0f14] border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/50 flex flex-col gap-3">
                <div className="relative select-none">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-700" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={supportSearch}
                    onChange={(e) => setSupportSearch(e.target.value)}
                    className="w-full bg-[#121318] border border-zinc-850 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-purple-650"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSupportFilter('all'); setSupportPage(1); }} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border cursor-pointer ${supportFilter === 'all' ? 'bg-purple-650 border-purple-600 text-white' : 'bg-zinc-900 border-zinc-850 text-zinc-500'}`}>All</button>
                  <button onClick={() => { setSupportFilter('unread'); setSupportPage(1); }} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border cursor-pointer ${supportFilter === 'unread' ? 'bg-purple-650 border-purple-600 text-white' : 'bg-zinc-900 border-zinc-850 text-zinc-500'}`}>Unread</button>
                </div>
              </div>

              {/* Conversations Feed */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {supportLoading ? (
                  <p className="text-zinc-650 text-xs font-semibold p-4 text-center">Loading threads...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-zinc-650 text-xs font-semibold p-4 text-center select-none uppercase tracking-wide">No conversations found.</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.user.browserToken}
                      onClick={() => {
                        setSelectedConversationToken(c.user.browserToken);
                        fetchConversationMessages(c.user.browserToken);
                      }}
                      className={`w-full p-3 rounded-xl flex items-center justify-between text-left cursor-pointer transition ${
                        selectedConversationToken === c.user.browserToken 
                          ? 'bg-[#1b1230] border border-purple-900/30' 
                          : 'hover:bg-zinc-900/40 border border-transparent'
                      }`}
                    >
                      <div className="truncate space-y-0.5">
                        <span className="text-xs font-bold text-zinc-200 block truncate">{c.user.displayName}</span>
                        <span className="text-[10px] text-zinc-550 block truncate font-mono">
                          {c.lastMessage ? c.lastMessage.text || '[Attachment Image]' : 'appeal started'}
                        </span>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="h-5 w-5 bg-purple-600 border border-purple-700 text-white rounded-full flex items-center justify-center font-bold text-[10px]">
                          {c.unreadCount}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Conversational Screen */}
            <div className="md:col-span-2 bg-[#0e0f14] border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden relative">
              {selectedConversationToken ? (
                <>
                  {/* Header details */}
                  <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between select-none">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-zinc-200 block">Conversation with Appeal User</span>
                      <span className="text-[10px] text-purple-400 font-mono tracking-widest uppercase block">Token: {selectedConversationToken.substring(0, 15)}...</span>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          const userObj = conversations.find(c => c.user.browserToken === selectedConversationToken)?.user;
                          if (!userObj) return;
                          const action = userObj.isBanned ? 'unban' : 'ban';
                          if (window.confirm(`${action === 'ban' ? 'Ban' : 'Unban'} this user appeal?`)) {
                            await adminFetch('/api/admin/user/bulk-action', {
                              method: 'POST',
                              body: JSON.stringify({ userIds: [userObj.id], action })
                            });
                            showToast(`User ${action === 'ban' ? 'banned' : 'unbanned'} successfully.`, 'success');
                            fetchConversations();
                            fetchConversationMessages(selectedConversationToken);
                          }
                        }}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-850 cursor-pointer text-[10px] uppercase font-bold"
                      >
                        Toggle Ban Status
                      </button>
                    </div>
                  </div>

                  {/* Thread messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/15">
                    {conversationHistory.map((m) => {
                      const isAdmin = m.senderType === 'admin';
                      return (
                        <div key={m._id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`}>
                          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider font-mono">
                            {m.senderName}
                          </span>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-md border ${
                            isAdmin 
                              ? 'bg-purple-600 border-purple-700 text-white rounded-tr-sm'
                              : 'bg-[#1b1230] border-purple-900/40 text-zinc-200 rounded-tl-sm'
                          }`}>
                            {m.imageUrl && (
                              <a href={m.imageUrl} target="_blank" rel="noreferrer" className="block mb-1.5 rounded-lg overflow-hidden border border-zinc-950 bg-zinc-950">
                                <img src={m.imageUrl} alt="Support attachment" className="w-full max-h-48 object-cover hover:scale-105 transition" />
                              </a>
                            )}
                            {m.text && <p className="break-words leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 px-1 select-none">
                            <span className="text-[9px] text-zinc-650 font-mono">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isAdmin && (
                              <span className="text-[9px] text-zinc-650 font-bold uppercase tracking-wider">
                                {m.isSeen ? '• Read' : '• Sent'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {supportUserTyping && (
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic animate-pulse">User is typing appeal...</p>
                    )}
                    <div ref={supportBottomRef} />
                  </div>

                  {/* Attachment review bar */}
                  {supportPreviewUrl && (
                    <div className="p-2 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={supportPreviewUrl} alt="Attachment" className="h-10 w-10 object-cover rounded border border-zinc-800" />
                        <span className="text-[10px] text-zinc-600 font-mono">({Math.round(supportAttachment.size / 1024)} KB)</span>
                      </div>
                      <button onClick={handleRemoveSupportAttachment} className="text-xs text-red-500 hover:text-red-400 font-bold px-2 py-1 bg-red-950/40 rounded border border-red-900/50 cursor-pointer">Remove</button>
                    </div>
                  )}

                  {/* Input bar */}
                  <form onSubmit={handleSendSupportReply} className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 flex gap-2 items-center">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleSupportFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-500 hover:text-zinc-300 rounded-xl cursor-pointer border border-zinc-800"
                    >
                      <Image className="h-4.5 w-4.5" />
                    </button>
                    
                    <input
                      type="text"
                      placeholder="Type reply to appeal visitor..."
                      value={supportReplyText}
                      onChange={(e) => {
                        setSupportReplyText(e.target.value);
                        if (socket) {
                          socket.emit('support-typing', { token: selectedConversationToken, isTyping: e.target.value.trim() !== '' });
                        }
                      }}
                      className="flex-1 bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650"
                    />
                    
                    <button
                      type="submit"
                      disabled={supportSending || (!supportReplyText.trim() && !supportAttachment)}
                      className="p-2.5 bg-purple-600 hover:bg-purple-550 disabled:opacity-40 text-white rounded-xl cursor-pointer"
                    >
                      {supportSending ? (
                        <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center p-8 select-none text-zinc-600 uppercase tracking-widest font-black">
                  Select a Conversation from list to reply
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Settings Customizer */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-[28px] font-black uppercase text-white tracking-tight">Global Configurations</h2>

            {settingsLoading ? (
              <p className="text-zinc-500 font-medium">Writing updates to configurations database...</p>
            ) : (
              <form onSubmit={handleSettingsSave} className="bg-[#0e0f14] border border-zinc-800/80 p-6 rounded-2xl space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Website Name</label>
                    <input
                      type="text"
                      value={settings.website_name}
                      onChange={(e) => setSettings({ ...settings, website_name: e.target.value })}
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tagline</label>
                    <input
                      type="text"
                      value={settings.website_tagline}
                      onChange={(e) => setSettings({ ...settings, website_tagline: e.target.value })}
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Primary Color Hex Accent</label>
                    <input
                      type="color"
                      value={settings.primary_theme_color}
                      onChange={(e) => setSettings({ ...settings, primary_theme_color: e.target.value })}
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl h-10 px-2 py-1 focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Chat Slow Mode (seconds)</label>
                    <input
                      type="number"
                      value={settings.slow_mode_seconds}
                      onChange={(e) => setSettings({ ...settings, slow_mode_seconds: parseInt(e.target.value) || 0 })}
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Maintenance mode description</label>
                  <textarea
                    rows="3"
                    value={settings.maintenance_message}
                    onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                    className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Support screen welcome details</label>
                  <textarea
                    rows="2"
                    value={settings.support_welcome_message}
                    onChange={(e) => setSettings({ ...settings, support_welcome_message: e.target.value })}
                    className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-zinc-850 rounded-xl bg-zinc-950/20">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-zinc-300 block">Surveillance Stealth Mode</span>
                    <span className="text-[10px] text-zinc-550 block leading-tight">Completely hides Professor online flags and counters from public visitors.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.stealth_mode}
                    onChange={(e) => setSettings({ ...settings, stealth_mode: e.target.checked })}
                    className="h-5 w-5 accent-purple-650 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-purple-600 hover:bg-purple-550 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition cursor-pointer"
                >
                  Apply System Configurations
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 6: Trash Bin */}
        {activeTab === 'trash' && (
          <div className="space-y-6">
            <h2 className="text-[28px] font-black uppercase text-white tracking-tight">Soft-Deleted Trash Bin</h2>

            {trashLoading ? (
              <p className="text-zinc-500 font-medium">Emptying search queries...</p>
            ) : (
              <div className="space-y-8">
                {/* Chat Messages trash */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">Trash Chat Messages</h3>
                  {trashItems.messages.length === 0 ? (
                    <p className="text-zinc-650 text-xs font-semibold p-4 bg-[#0e0f14] border border-zinc-850 rounded-2xl select-none">No messages in trash.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {trashItems.messages.map((m) => (
                        <div key={m._id} className="p-4 bg-[#0e0f14] border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                          <div className="truncate">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{m.sender?.displayName || 'Anonymous'} • {new Date(m.deletedAt || m.updatedAt).toLocaleDateString()}</span>
                            <p className="text-zinc-200 text-xs mt-1 truncate max-w-xl font-medium">"{m.text}"</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleRestoreTrash(m._id, 'message')} className="p-2 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-xl cursor-pointer" title="Restore"><Undo className="h-4.5 w-4.5" /></button>
                            <button onClick={() => handlePermanentDeleteTrash(m._id, 'message')} className="p-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl cursor-pointer" title="Permanent Delete"><Trash2 className="h-4.5 w-4.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confessions Trash */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">Trash Confessions</h3>
                  {trashItems.confessions.length === 0 ? (
                    <p className="text-zinc-650 text-xs font-semibold p-4 bg-[#0e0f14] border border-zinc-850 rounded-2xl select-none">No confessions in trash.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {trashItems.confessions.map((m) => (
                        <div key={m._id} className="p-4 bg-[#0e0f14] border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                          <div className="truncate">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{m.sender?.displayName || 'Anonymous'} • {new Date(m.deletedAt || m.updatedAt).toLocaleDateString()}</span>
                            <p className="text-zinc-200 text-xs mt-1 truncate max-w-xl font-medium">"{m.text}"</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleRestoreTrash(m._id, 'confession')} className="p-2 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-xl cursor-pointer" title="Restore"><Undo className="h-4.5 w-4.5" /></button>
                            <button onClick={() => handlePermanentDeleteTrash(m._id, 'confession')} className="p-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl cursor-pointer" title="Permanent Delete"><Trash2 className="h-4.5 w-4.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Memes Trash */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">Trash Memes</h3>
                  {trashItems.memes.length === 0 ? (
                    <p className="text-zinc-650 text-xs font-semibold p-4 bg-[#0e0f14] border border-zinc-850 rounded-2xl select-none">No memes in trash.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {trashItems.memes.map((m) => (
                        <div key={m._id} className="p-4 bg-[#0e0f14] border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 truncate">
                            <img src={m.imageUrl} alt="Trash meme" className="h-10 w-10 object-cover rounded bg-zinc-950 border border-zinc-850" />
                            <div className="truncate">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{m.sender?.displayName || 'Anonymous'} • {new Date(m.deletedAt || m.updatedAt).toLocaleDateString()}</span>
                              <p className="text-zinc-200 text-xs mt-0.5 truncate max-w-xl font-medium">"{m.caption || 'No caption'}"</p>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleRestoreTrash(m._id, 'meme')} className="p-2 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-xl cursor-pointer" title="Restore"><Undo className="h-4.5 w-4.5" /></button>
                            <button onClick={() => handlePermanentDeleteTrash(m._id, 'meme')} className="p-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl cursor-pointer" title="Permanent Delete"><Trash2 className="h-4.5 w-4.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Polls Trash */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">Trash Polls</h3>
                  {trashItems.polls.length === 0 ? (
                    <p className="text-zinc-650 text-xs font-semibold p-4 bg-[#0e0f14] border border-zinc-850 rounded-2xl select-none">No polls in trash.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {trashItems.polls.map((m) => (
                        <div key={m._id} className="p-4 bg-[#0e0f14] border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                          <div className="truncate">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{m.sender?.displayName || 'Anonymous'} • {new Date(m.deletedAt || m.updatedAt).toLocaleDateString()}</span>
                            <p className="text-zinc-200 text-xs mt-1 truncate max-w-xl font-medium">"{m.question}"</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleRestoreTrash(m._id, 'poll')} className="p-2 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-xl cursor-pointer" title="Restore"><Undo className="h-4.5 w-4.5" /></button>
                            <button onClick={() => handlePermanentDeleteTrash(m._id, 'poll')} className="p-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl cursor-pointer" title="Permanent Delete"><Trash2 className="h-4.5 w-4.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Announcements Scheduled & Notices History */}
        {activeTab === 'announcements' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CRUD Form */}
              <div className="space-y-4">
                <h3 className="text-md font-bold uppercase text-white tracking-tight select-none">
                  {editingAnnouncementId ? 'Edit Announcement' : 'Schedule Announcement'}
                </h3>
                <form onSubmit={handleAnnouncementSubmit} className="p-5 bg-[#0e0f14] border border-zinc-800/80 rounded-2xl space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Notice Title</label>
                    <input
                      type="text"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      placeholder="e.g. Server Maintenance Notice"
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Content Description</label>
                    <textarea
                      rows="4"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      placeholder="Write announcement details..."
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650 resize-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Scheduled Start</label>
                      <input
                        type="datetime-local"
                        value={newAnnouncement.scheduledStart}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, scheduledStart: e.target.value })}
                        className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-400 focus:outline-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Expires At (Optional)</label>
                      <input
                        type="datetime-local"
                        value={newAnnouncement.expiresAt}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, expiresAt: e.target.value })}
                        className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-400 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Alert Color Theme</label>
                      <input
                        type="color"
                        value={newAnnouncement.bgColor}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, bgColor: e.target.value })}
                        className="w-full bg-[#121318] border border-zinc-850 rounded-xl h-10 px-2 py-1 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Text Color Accent</label>
                      <input
                        type="color"
                        value={newAnnouncement.textColor}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, textColor: e.target.value })}
                        className="w-full bg-[#121318] border border-zinc-850 rounded-xl h-10 px-2 py-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Display Layout Area</label>
                    <select
                      value={newAnnouncement.type}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
                      className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-400 focus:outline-none cursor-pointer"
                    >
                      <option value="sticky">Top Sticky Bar</option>
                      <option value="popup">Middle Popup Overlay</option>
                      <option value="homepage">Lounge Card Panel</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    {editingAnnouncementId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnnouncementId(null);
                          setNewAnnouncement({
                            title: '',
                            content: '',
                            type: 'homepage',
                            scheduledStart: '',
                            expiresAt: '',
                            bgColor: '#f3e8ff',
                            textColor: '#6b21a8'
                          });
                        }}
                        className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold uppercase tracking-widest rounded-xl transition cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-purple-650 hover:bg-purple-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition cursor-pointer"
                    >
                      {editingAnnouncementId ? 'Save Changes' : 'Schedule Broadcast'}
                    </button>
                  </div>
                </form>
              </div>

              {/* History Search Logs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold uppercase text-white tracking-tight select-none">Notice History Log</h3>
                  <div className="flex gap-2 select-none">
                    <select
                      value={announcementFilter}
                      onChange={(e) => { setAnnouncementFilter(e.target.value); setAnnouncementPage(1); }}
                      className="bg-[#0e0f14] border border-zinc-850 rounded-xl px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-400 focus:outline-none cursor-pointer"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="expired">Expired</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </div>
                </div>

                {announcementsLoading ? (
                  <p className="text-zinc-650 text-xs font-medium">Scanning notices history database...</p>
                ) : announcementHistory.length === 0 ? (
                  <p className="text-zinc-650 text-xs font-semibold p-4 bg-[#0e0f14] border border-zinc-850 rounded-2xl select-none">No notices found.</p>
                ) : (
                  <div className="space-y-3">
                    {announcementHistory.map((ann) => (
                      <div key={ann._id} className="p-4 bg-[#0e0f14] border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                        <div className="truncate space-y-0.5">
                          <span className="text-[10px] font-bold text-purple-400 block uppercase tracking-wide">
                            {ann.title} ({ann.status === 'trash' ? 'deleted' : 'active'})
                          </span>
                          <span className="text-[9px] text-zinc-550 block font-mono">Starts: {new Date(ann.scheduledStart).toLocaleString()}</span>
                          <p className="text-zinc-300 text-xs truncate max-w-sm font-medium">"{ann.content}"</p>
                        </div>

                        {ann.status !== 'trash' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleEditAnnouncementSelect(ann)} className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-850 rounded-lg cursor-pointer" title="Edit"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => handleSoftDeleteAnnouncement(ann._id)} className="p-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg cursor-pointer" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: Login History */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <h2 className="text-[28px] font-black uppercase text-white tracking-tight">Admin Authentication History Logs</h2>

            {sessionsLoading ? (
              <p className="text-zinc-500 font-medium">Scanning session history...</p>
            ) : sessionLogs.length === 0 ? (
              <p className="text-zinc-650 text-xs font-semibold p-4 bg-[#0e0f14] border border-zinc-850 rounded-2xl select-none">No logged sessions.</p>
            ) : (
              <div className="bg-[#0e0f14] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full border-collapse text-left text-xs select-none">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 bg-zinc-950/50 font-bold uppercase tracking-wider">
                      <th className="p-4">Login Time</th>
                      <th className="p-4">Logout Time</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Oversight IP Address</th>
                      <th className="p-4">User Agent Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionLogs.map((s) => (
                      <tr key={s._id} className="border-b border-zinc-850 hover:bg-zinc-900/30 transition">
                        <td className="p-4 font-mono text-zinc-300">{new Date(s.loginTime).toLocaleString()}</td>
                        <td className="p-4 font-mono text-zinc-300">
                          {s.logoutTime ? new Date(s.logoutTime).toLocaleString() : (
                            <span className="text-emerald-500 font-bold uppercase tracking-wider text-[9px] animate-pulse">Active Session</span>
                          )}
                        </td>
                        <td className="p-4 text-zinc-400 font-semibold">
                          {s.durationSeconds ? `${Math.floor(s.durationSeconds / 60)}m ${s.durationSeconds % 60}s` : '-'}
                        </td>
                        <td className="p-4 font-mono text-[10px] text-purple-400">{s.ip}</td>
                        <td className="p-4 font-mono text-[10px] text-zinc-550 max-w-[200px] truncate" title={s.browser}>
                          {s.browser}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 9: Audit Logs Trail */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <h2 className="text-[28px] font-black uppercase text-white tracking-tight">Oversight Audit Trail</h2>

            {logsLoading ? (
              <p className="text-zinc-500 font-medium">Scanning logs trail...</p>
            ) : (
              <div className="bg-[#0e0f14] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/50 flex justify-between select-none">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Administrative Logs Trail</span>
                  <button 
                    onClick={async () => {
                      if (window.confirm('WARNING: Trigger raw database backup?')) {
                        await adminFetch('/api/admin/backup', { method: 'POST' });
                        showToast('Database backup triggered successfully.', 'success');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-purple-650 hover:bg-purple-600 text-white rounded-lg cursor-pointer text-[10px] font-bold uppercase tracking-wider border border-purple-500/30"
                  >
                    Trigger DB Backup
                  </button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                  {auditLogs.length === 0 ? (
                    <p className="text-zinc-650 text-xs font-semibold p-4 text-center select-none uppercase tracking-wide">Audit Trail is empty.</p>
                  ) : (
                    auditLogs.map((log, idx) => (
                      <div key={idx} className="p-3 bg-[#07080b] border border-zinc-850 rounded-xl flex items-center justify-between text-xs gap-4 hover:border-zinc-800 transition">
                        <div>
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">{log.action || 'ACTIVITY'}</span>
                          <p className="text-zinc-200 font-medium mt-1 leading-relaxed">"{log.text || log.details}"</p>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-600 font-bold shrink-0">{new Date(log.createdAt || log.timestamp).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* User Profile Oversight Drawer overlay */}
      {drawerUserId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex justify-end animate-fade-in select-none">
          <div className="w-full max-w-lg bg-[#0e0f14] border-l border-zinc-800 h-screen flex flex-col p-6 space-y-6 shadow-2xl relative animate-slide-left overflow-y-auto">
            <button 
              onClick={() => { setDrawerUserId(null); setDrawerData(null); }}
              className="absolute top-4 right-4 text-zinc-550 hover:text-white text-sm font-bold cursor-pointer font-mono"
            >
              ✕ Close
            </button>

            {drawerLoading ? (
              <p className="text-zinc-500 font-medium pt-8">Decrypting identity database logs...</p>
            ) : drawerData ? (
              <>
                <div>
                  <h3 className="text-lg font-black text-white uppercase leading-none">{drawerData.profile.displayName}</h3>
                  <span className="text-[9px] font-mono text-purple-400 block mt-1 uppercase tracking-widest">Oversight ID: {drawerData.profile._id}</span>
                </div>

                {/* Account Actions */}
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-3">
                  <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider block">Oversight Status Actions</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        const action = drawerData.profile.isBanned ? 'unban' : 'ban';
                        await adminFetch('/api/admin/user/bulk-action', {
                          method: 'POST',
                          body: JSON.stringify({ userIds: [drawerUserId], action })
                        });
                        showToast(`User ${action === 'ban' ? 'banned' : 'unbanned'}.`, 'success');
                        handleOpenUserDrawer(drawerUserId);
                        fetchUsers();
                      }}
                      className="flex-1 py-2.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl cursor-pointer text-xs font-bold uppercase tracking-wider"
                    >
                      {drawerData.profile.isBanned ? 'Unban User' : 'Ban User'}
                    </button>
                    <button 
                      onClick={async () => {
                        const action = drawerData.profile.isShadowBanned ? 'unshadow-ban' : 'shadow-ban';
                        await adminFetch('/api/admin/user/bulk-action', {
                          method: 'POST',
                          body: JSON.stringify({ userIds: [drawerUserId], action })
                        });
                        showToast(`User shadow-ban ${action === 'shadow-ban' ? 'enabled' : 'disabled'}.`, 'success');
                        handleOpenUserDrawer(drawerUserId);
                        fetchUsers();
                      }}
                      className="flex-1 py-2.5 bg-amber-950/40 hover:bg-amber-900/40 text-amber-400 border border-amber-900/50 rounded-xl cursor-pointer text-xs font-bold uppercase tracking-wider"
                    >
                      {drawerData.profile.isShadowBanned ? 'Unshadow' : 'Shadow Ban'}
                    </button>
                  </div>
                </div>

                {/* Add Warning */}
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Issue Formal Warning</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Spamming links in lobby"
                      value={newWarningText}
                      onChange={(e) => setNewWarningText(e.target.value)}
                      className="flex-1 bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650"
                    />
                    <button onClick={handleAddWarning} className="px-4 py-2.5 bg-purple-650 hover:bg-purple-600 text-white text-xs font-bold uppercase rounded-xl cursor-pointer">Issue</button>
                  </div>
                </div>

                {/* Warning History Logs */}
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">Warning History Logs</span>
                  {drawerData.profile.warnings?.length === 0 ? (
                    <p className="text-zinc-650 text-xs font-semibold italic">No warnings issued to this user nickname.</p>
                  ) : (
                    <div className="space-y-2">
                      {drawerData.profile.warnings.map((w) => (
                        <div key={w._id} className="p-3 bg-zinc-950/50 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <p className="text-zinc-300 font-medium">"{w.reason}"</p>
                            <span className="text-[9px] text-zinc-600 font-mono mt-0.5 block">{new Date(w.date).toLocaleString()}</span>
                          </div>
                          <button onClick={() => handleRemoveWarning(w._id)} className="text-[10px] text-red-500 hover:text-red-400 font-bold px-2 py-0.5 rounded cursor-pointer border border-transparent hover:border-red-900/50 hover:bg-red-950/20">Clear</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Private Admin Notes */}
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">Oversight Private Notes (Admin Only)</span>
                  <textarea
                    rows="3"
                    value={adminNoteText}
                    onChange={(e) => setAdminNoteText(e.target.value)}
                    placeholder="Write private notes on this identity profile..."
                    className="w-full bg-[#121318] border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-650 resize-none"
                  />
                  <button onClick={handleSaveNotes} className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 text-xs font-bold uppercase cursor-pointer">Save Notes</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
}
