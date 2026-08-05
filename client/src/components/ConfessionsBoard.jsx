import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { UserContext } from '../context/UserContext';
import ConfessionCard from './ConfessionCard';
import { HelpCircle, PenSquare, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function ConfessionsBoard({ isAdmin }) {
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const { adminCsrfToken, adminFetch } = useContext(UserContext);
  const [confessions, setConfessions] = useState([]);
  const [newConfessionText, setNewConfessionText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch confessions history
  const fetchConfessions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/confessions`);
      if (res.ok) {
        const data = await res.json();
        setConfessions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfessions();
  }, []);

  // Listen for real-time WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleNewConfession = (newConf) => {
      setConfessions(prev => [newConf, ...prev]);
    };

    const handleConfessionUpdated = (updatedConf) => {
      setConfessions(prev =>
        prev.map(conf => (conf._id === updatedConf._id ? updatedConf : conf))
      );
    };

    const handleConfessionDeleted = (id) => {
      setConfessions(prev => prev.filter(conf => conf._id !== id));
    };

    socket.on('new-confession', handleNewConfession);
    socket.on('confession-updated', handleConfessionUpdated);
    socket.on('confession-deleted', handleConfessionDeleted);

    return () => {
      socket.off('new-confession', handleNewConfession);
      socket.off('confession-updated', handleConfessionUpdated);
      socket.off('confession-deleted', handleConfessionDeleted);
    };
  }, [socket]);

  const handlePostConfession = async (e) => {
    e.preventDefault();
    if (newConfessionText.trim() === '' || submitting) return;

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/confessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: newConfessionText })
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to post confession.', 'error');
      } else {
        setNewConfessionText('');
        showToast('Confession posted anonymously.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not post confession.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = async (id, emoji) => {
    try {
      await fetch(`${API_BASE}/api/confessions/${id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (id, text) => {
    try {
      const response = await fetch(`${API_BASE}/api/confessions/${id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        const err = await response.json();
        showToast(err.message || 'Failed to comment.', 'error');
      } else {
        showToast('Comment added anonymously.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not post comment.', 'error');
    }
  };

  const handleReport = async (id, reason) => {
    try {
      const response = await fetch(`${API_BASE}/api/confessions/${id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) {
        const err = await response.json();
        showToast(err.message || 'Failed to report.', 'error');
      } else {
        showToast('Confession reported for admin review.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not submit report.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this confession?')) return;
    try {
      const response = await adminFetch(`/api/admin/confession/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'Failed to delete confession.', 'error');
      } else {
        showToast('Confession deleted successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Could not delete confession.', 'error');
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-2xl mx-auto">
      {/* Page Title & Intro */}
      <div className="text-center md:text-left space-y-2 select-none">
        <h2 className="text-[28px] font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase leading-tight">
          🤫 Campus Confessions
        </h2>
        <p className="text-[15px] font-semibold text-slate-400">
          Got something to get off your chest? Share it anonymously. No names, no records, 100% unfiltered college life.
        </p>
      </div>

      {/* Post confession form */}
      <form onSubmit={handlePostConfession} className="bg-white border border-slate-200/80 rounded-[20px] p-6 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.05)]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 tracking-wider select-none">
            <PenSquare className="h-4 w-4 text-purple-600" />
            <span>WRITE A NEW ANONYMOUS CONFESSION</span>
          </div>

          <textarea
            value={newConfessionText}
            onChange={(e) => setNewConfessionText(e.target.value)}
            placeholder="What is your secret? e.g. 'I still haven't cleared my first-year minor project and it's submission week...'"
            required
            maxLength={2000}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-[16px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white min-h-[120px] resize-y transition"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold select-none uppercase tracking-wide">
              {newConfessionText.length}/2000 characters
            </span>
            
            <button
              type="submit"
              disabled={newConfessionText.trim() === '' || submitting}
              className="glow-btn px-6 py-3 text-white text-[16px] font-semibold rounded-xl shadow-md cursor-pointer transition"
            >
              {submitting ? 'Posting...' : 'Confess Anonymously'}
            </button>
          </div>
        </div>
      </form>

      {/* Confessions List */}
      <div className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : confessions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-slate-200/50 rounded-[20px] p-6 shadow-sm">
            <HelpCircle className="h-8 w-8 text-slate-350 mx-auto mb-2" />
            <p className="text-xs text-slate-450 font-bold">No confessions found. Be the first to share one!</p>
          </div>
        ) : (
          confessions.map(conf => (
            <ConfessionCard
              key={conf._id}
              confession={conf}
              onReact={handleReact}
              onAddComment={handleAddComment}
              onReport={handleReport}
              isAdmin={isAdmin}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
