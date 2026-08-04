import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { UserContext } from '../context/UserContext';
import PollCard from './PollCard';
import { BarChart3, HelpCircle, PlusCircle, Trash2 } from 'lucide-react';

export default function PollsBoard({ isAdmin }) {
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const { adminCsrfToken } = useContext(UserContext);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin Create Poll form state
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']); // Start with 2 empty options

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/polls');
      if (res.ok) {
        const data = await res.json();
        setPolls(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  // Listen to live socket.io updates
  useEffect(() => {
    if (!socket) return;

    const handleNewPoll = (newPoll) => {
      setPolls(prev => [newPoll, ...prev]);
    };

    const handlePollUpdated = (updatedPoll) => {
      setPolls(prev =>
        prev.map(p => (p._id === updatedPoll._id ? updatedPoll : p))
      );
    };

    const handlePollDeleted = (id) => {
      setPolls(prev => prev.filter(p => p._id !== id));
    };

    socket.on('new-poll', handleNewPoll);
    socket.on('poll-updated', handlePollUpdated);
    socket.on('poll-deleted', handlePollDeleted);

    return () => {
      socket.off('new-poll', handleNewPoll);
      socket.off('poll-updated', handlePollUpdated);
      socket.off('poll-deleted', handlePollDeleted);
    };
  }, [socket]);

  const handleVote = async (pollId, optionId) => {
    try {
      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optionId })
      });
      if (!response.ok) {
        const err = await response.json();
        showToast(err.message || 'Failed to submit vote.', 'error');
      } else {
        showToast('Vote submitted successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not register vote.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this poll?')) return;
    try {
      const response = await fetch(`/api/admin/poll/${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': adminCsrfToken
        },
        credentials: 'include'
      });
      if (!response.ok) {
        const err = await response.json();
        showToast(err.message || 'Failed to delete poll.', 'error');
      } else {
        showToast('Poll deleted successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not delete poll.', 'error');
    }
  };

  const handleAddOptionField = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOptionField = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, idx) => idx !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    const filteredOptions = options.filter(opt => opt.trim() !== '');
    if (question.trim() === '' || filteredOptions.length < 2) {
      showToast('Please fill out the question and at least 2 options.', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/admin/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          question,
          options: filteredOptions
        })
      });

      if (!response.ok) {
        const err = await response.json();
        showToast(err.message || 'Failed to create poll.', 'error');
      } else {
        setQuestion('');
        setOptions(['', '']);
        showToast('Poll created successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not create poll.', 'error');
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-2xl mx-auto">
      {/* Title */}
      <div className="text-center md:text-left space-y-2 select-none">
        <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase">
          📊 Campus Polls
        </h2>
        <p className="text-xs font-semibold text-slate-400">
          Cast your vote on current campus issues. Admin-created polls only, updating in real time. Single vote per poll.
        </p>
      </div>

      {/* Admin Poll Creator Form (visible to logged-in admins only) */}
      {isAdmin && (
        <form onSubmit={handleCreatePollSubmit} className="bg-white border border-slate-200/80 rounded-[20px] p-5 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.05)]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 tracking-wider">
              <PlusCircle className="h-4 w-4 text-purple-600" />
              <span>CREATE A NEW POLL (ADMIN ONLY)</span>
            </div>

            {/* Question Input */}
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which semester exams schedule is better?"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
            />

            {/* Options list */}
            <div className="space-y-2">
              <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wide">POLL OPTIONS (MAX 6)</span>
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    required
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 placeholder-slate-450 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOptionField(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 transition text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center select-none">
              <button
                type="button"
                onClick={handleAddOptionField}
                disabled={options.length >= 6}
                className="text-xs font-bold text-purple-600 hover:text-purple-550 disabled:opacity-40 cursor-pointer"
              >
                + Add Option
              </button>

              <button
                type="submit"
                className="glow-btn px-5 py-2.5 text-white text-[11px] font-extrabold rounded-xl shadow-md cursor-pointer transition"
              >
                Create Poll
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Polls Listing */}
      <div className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : polls.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-slate-200/50 rounded-[20px] p-6 shadow-sm">
            <HelpCircle className="h-8 w-8 text-slate-350 mx-auto mb-2" />
            <p className="text-xs text-slate-450 font-bold">No active polls found.</p>
          </div>
        ) : (
          polls.map(poll => (
            <PollCard
              key={poll._id}
              poll={poll}
              onVote={handleVote}
              isAdmin={isAdmin}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
