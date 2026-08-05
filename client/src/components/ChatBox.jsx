import React, { useState, useEffect, useRef, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { playNotificationChime } from '../utils/sound';
import professorAvatar from '../assets/professor-avatar.png';
import { 
  Send, Smile, Trash2, Edit2, Check, X, Volume2, VolumeX, 
  AlertTriangle, Pin, Reply, HelpCircle, ShieldAlert
} from 'lucide-react';

export default function ChatBox({ isAdmin, adminToken }) {
  const { user, adminCsrfToken, adminFetch } = useContext(UserContext);
  const { socket, onlineCount, slowModeSeconds } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [cooldown, setCooldown] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem('dseu_sound_enabled') !== 'false'
  );
  
  // Message edit state hooks
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  // Pin state hooks
  const [pinnedMessage, setPinnedMessage] = useState(null);

  // Replies state hooks
  const [replyTarget, setReplyTarget] = useState(null);

  // Official Notice type flag
  const [sendAsNotice, setSendAsNotice] = useState(false);

  // Professor Presence
  const [professorOnline, setProfessorOnline] = useState(false);

  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const adjustHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const getAvatarUrl = (userObj) => {
    if (!userObj) return '';
    if (userObj.role === 'admin' || userObj.isAdmin === true || userObj.displayName === 'Professor (ADMIN)') {
      return professorAvatar;
    }
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(userObj.browserToken || userObj._id || 'default')}`;
  };

  // Load chat, pin status, and presence status on startup
  const fetchSettingsAndPinned = async () => {
    try {
      // 1. Fetch pinned
      const pinRes = await fetch('/api/chat/pinned');
      if (pinRes.ok) {
        const pinData = await pinRes.json();
        setPinnedMessage(pinData);
      }
      
      // 2. Fetch presence settings
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const config = await settingsRes.json();
        setProfessorOnline(config.professor_presence === 'online');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const res = await fetch('/api/chat');
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    fetchChatHistory();
    fetchSettingsAndPinned();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.sender?.browserToken !== user?.browserToken) {
        playNotificationChime();
      }
    };

    const handleMessageUpdated = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
      );
    };

    const handleMessageDeleted = (messageId) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      setPinnedMessage((prev) => (prev?._id === messageId ? null : prev));
    };

    const handleUserTyping = (data) => {
      setTypingUsers((prev) => {
        if (data.isTyping) {
          if (!prev.includes(data.displayName)) {
            return [...prev, data.displayName];
          }
        } else {
          return prev.filter((name) => name !== data.displayName);
        }
        return prev;
      });
    };

    const handleChatError = (data) => {
      showToast(data.message || 'An error occurred with chat.', 'error');
    };

    const handlePinnedMessage = (msg) => {
      setPinnedMessage(msg);
      if (msg) {
        showToast('A new chat message has been pinned!', 'success');
      } else {
        showToast('The pinned message was removed.', 'info');
      }
    };

    const handleUserWarned = (data) => {
      if (data.browserToken === user?.browserToken) {
        alert(`⚠️ WARNING FROM ADMINISTRATOR:\n\nReason: "${data.reason}"\nTotal Warnings: ${data.warningsCount}`);
      }
    };

    socket.on('new-chat-message', handleNewMessage);
    socket.on('chat-message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('user-typing', handleUserTyping);
    socket.on('chat-error', handleChatError);
    socket.on('chat-pinned-message', handlePinnedMessage);
    socket.on('user-warned', handleUserWarned);
    socket.on('settings-updated', fetchSettingsAndPinned);
    socket.on('online-stealth-update', fetchSettingsAndPinned);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
      socket.off('chat-message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('user-typing', handleUserTyping);
      socket.off('chat-error', handleChatError);
      socket.off('chat-pinned-message', handlePinnedMessage);
      socket.off('user-warned', handleUserWarned);
      socket.off('settings-updated', fetchSettingsAndPinned);
      socket.off('online-stealth-update', fetchSettingsAndPinned);
    };
  }, [socket, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Cooldown timer logic
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleInputChange = (e) => {
    const text = e.target.value;
    if (text.length <= 500) {
      setInputText(text);
    }
    adjustHeight();

    if (!isTyping && text.trim() !== '') {
      setIsTyping(true);
      socket.emit('typing', { isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing', { isTyping: false });
    }, 1500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputText.trim() === '' || cooldown > 0) return;

    // Send payload supporting replies and notice types
    socket.emit('send-chat-message', {
      text: inputText,
      replyTo: replyTarget?._id || null,
      messageType: sendAsNotice ? 'notice' : 'normal'
    });

    if (slowModeSeconds > 0 && user?.role !== 'admin') {
      setCooldown(slowModeSeconds);
    }

    setInputText('');
    setReplyTarget(null);
    setSendAsNotice(false);
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing', { isTyping: false });

    if (inputRef.current) {
      inputRef.current.style.height = '48px';
    }
  };

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('dseu_sound_enabled', String(newVal));
  };

  const reactToMessage = (messageId, emoji) => {
    socket.emit('react-chat-message', { messageId, emoji });
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      const response = await adminFetch(`/api/admin/message/${messageId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'Failed to delete message.', 'error');
      } else {
        showToast('Message deleted successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not delete message.', 'error');
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      const res = await adminFetch(`/api/admin/chat/pin/${messageId}`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Message pinned successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnpinMessage = async () => {
    try {
      const res = await adminFetch('/api/admin/chat/unpin', {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Message unpinned.', 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg._id);
    setEditText(msg.text);
  };

  const handleSaveEdit = (msgId) => {
    if (editText.trim() === '') return;
    socket.emit('edit-chat-message', { messageId: msgId, text: editText });
    setEditingMessageId(null);
    setEditText('');
  };

  const handleDeleteOwnMessage = (msgId) => {
    if (!window.confirm('Are you sure you want to delete your message?')) return;
    socket.emit('delete-chat-message', msgId);
  };

  return (
    <div className="flex flex-col h-[82vh] bg-white border border-slate-200/80 rounded-[20px] overflow-hidden shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)] font-inter">
      
      {/* Chat header */}
      <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between select-none">
        <div>
          <h2 className="text-[30px] font-black tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase leading-tight">
            💬 Global Live Chat
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full ${professorOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
            <span className="text-[14px] text-slate-500 font-semibold">
              {professorOnline ? 'Professor (ADMIN) is online' : 'Professor is currently offline'}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[14px] font-semibold text-slate-400">
              Slow Mode: {slowModeSeconds > 0 ? `${slowModeSeconds}s` : 'Disabled'} • {onlineCount} online
            </span>
          </div>
        </div>

        <button
          onClick={toggleSound}
          className="p-2.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition duration-300 cursor-pointer"
          title={soundEnabled ? 'Mute chime' : 'Unmute chime'}
        >
          {soundEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5 text-red-500" />}
        </button>
      </div>

      {/* Pinned Message alert bar */}
      {pinnedMessage && (
        <div className="bg-amber-50/70 border-b border-amber-100 px-6 py-3 flex items-center justify-between text-xs z-10 select-none">
          <div className="flex items-center gap-2.5 truncate">
            <Pin className="h-4 w-4 text-amber-500 shrink-0 rotate-45" />
            <div className="truncate">
              <span className="font-extrabold text-amber-800 uppercase tracking-wider block">PINNED MESSAGE</span>
              <p className="text-amber-900 font-medium truncate mt-0.5">
                <span className="font-bold">{pinnedMessage.sender?.displayName}:</span> {pinnedMessage.text}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button 
              onClick={handleUnpinMessage}
              className="text-amber-800 hover:text-red-500 font-bold px-2.5 py-1 bg-amber-100 hover:bg-red-50 rounded-lg transition cursor-pointer"
            >
              Unpin
            </button>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[300px] bg-slate-50/20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 select-none">
            <Smile className="h-10 w-10 opacity-30 animate-pulse" />
            <p className="text-xs font-semibold">The chat is quiet. Say something anonymous...</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender?.browserToken === user?.browserToken;
            const messageReactions = msg.reactions || {};
            const isEditable = isMe && (Date.now() - new Date(msg.createdAt).getTime() < 5 * 60 * 1000);
            
            // Check admin checks
            const isSenderAdmin = msg.sender?.role === 'admin' || msg.sender?.displayName === 'Professor (ADMIN)';

            // Render Official Notice cards
            if (msg.messageType === 'notice') {
              return (
                <div key={msg._id} className="w-full flex justify-center py-2 animate-message-arrive select-none">
                  <div className="max-w-md w-full bg-gradient-to-r from-purple-900/10 via-amber-900/10 to-purple-900/10 border border-purple-500/30 p-5 rounded-2xl shadow-xl flex flex-col items-center text-center space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-amber-500 to-purple-500"></div>
                    <div className="flex items-center gap-1.5 text-purple-400 font-black tracking-widest text-[11px] uppercase">
                      <ShieldAlert className="h-4 w-4" />
                      OFFICIAL NOTICE
                    </div>
                    <p className="text-zinc-200 text-sm font-bold leading-relaxed">{msg.text}</p>
                    <span className="text-[10px] text-zinc-500 font-mono font-bold mt-1 uppercase">
                      Issued by Professor • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMessage(msg._id)}
                        className="absolute bottom-2 right-2 p-1.5 bg-zinc-950/60 hover:bg-red-950 text-zinc-500 hover:text-red-500 rounded-lg border border-zinc-800 transition cursor-pointer"
                        title="Delete notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg._id}
                className={`group flex flex-col max-w-[85%] md:max-w-[70%] animate-message-arrive ${
                  isMe ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'
                }`}
              >
                {/* Reply preview indicator */}
                {msg.replyTo && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1 select-none font-bold">
                    <Reply className="h-3 w-3 rotate-180 text-purple-400" />
                    <span>Replying to: {msg.replyTo.sender?.displayName || 'Anonymous'}</span>
                    <span className="italic opacity-60 truncate max-w-[150px]"> - "{msg.replyTo.text}"</span>
                  </div>
                )}

                {/* Sender details with avatars */}
                <div className="flex items-center gap-2 mb-1.5 px-1 select-none">
                  <img 
                    src={getAvatarUrl(msg.sender)} 
                    alt="Avatar" 
                    className={`${
                      isSenderAdmin ? 'h-10 w-10' : 'h-6.5 w-6.5'
                    } rounded-full border border-slate-200 bg-slate-50 object-cover`} 
                  />
                  
                  {isSenderAdmin ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[17px] font-black text-purple-700 tracking-tight">Professor</span>
                      <span className="text-[10px] font-black bg-gradient-to-r from-purple-600 to-amber-600 bg-clip-text text-transparent px-1.5 py-0.2 border border-purple-500/30 rounded uppercase tracking-wider">
                        ADMIN
                      </span>
                    </div>
                  ) : (
                    <span className={`text-[16px] font-bold tracking-tight ${isMe ? 'text-purple-650' : 'text-blue-600'}`}>
                      {msg.sender?.displayName || 'Anonymous'}
                    </span>
                  )}

                  <span className="text-[12px] text-slate-400 font-semibold uppercase">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Actions (Edit/Delete/Reply) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-2">
                    <button
                      onClick={() => setReplyTarget(msg)}
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-650 rounded-lg transition cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                    {isEditable && editingMessageId !== msg._id && (
                      <>
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-purple-600 rounded-lg transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteOwnMessage(msg._id)}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handlePinMessage(msg._id)}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-500 rounded-lg transition cursor-pointer"
                          title="Pin Message (Admin)"
                        >
                          <Pin className="h-3.5 w-3.5 rotate-45" />
                        </button>
                        {!isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg._id)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition duration-200 cursor-pointer"
                            title="Delete Message (Admin)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bubble content */}
                {editingMessageId === msg._id ? (
                  <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 p-4 rounded-[20px] w-full min-w-[280px]">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingMessageId(null)} className="px-2.5 py-1 text-[11px] bg-slate-200 rounded-lg cursor-pointer">Cancel</button>
                      <button onClick={() => handleSaveEdit(msg._id)} className="px-2.5 py-1 text-[11px] bg-purple-650 text-white rounded-lg cursor-pointer">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className={`rounded-2xl px-4 py-2.5 text-[16px] shadow-sm border ${
                      isSenderAdmin
                        ? 'bg-gradient-to-r from-purple-900/10 via-amber-900/5 to-purple-900/10 border-purple-500/30 text-slate-900 rounded-tl-sm shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:scale-[1.01] transition-transform duration-200 font-bold'
                        : isMe 
                          ? 'bg-purple-600 border-purple-700 text-white rounded-tr-sm' 
                          : 'bg-slate-100 border-slate-200/80 text-slate-800 rounded-tl-sm'
                    }`}>
                      {msg.isShadowBanned && <span className="text-[9px] font-black uppercase text-red-500 bg-red-100 border border-red-200 px-1 rounded mr-1.5 tracking-wider select-none animate-pulse">Shadow Banned</span>}
                      <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing indicators list */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 italic select-none">
            <div className="flex gap-1.5">
              <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
              <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
            </div>
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Reply target preview bar */}
      {replyTarget && (
        <div className="px-6 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2 truncate">
            <Reply className="h-3.5 w-3.5 text-purple-600 rotate-180" />
            <div className="truncate">
              <span className="font-extrabold text-purple-700 block uppercase tracking-wider text-[10px]">REPLYING TO: {replyTarget.sender?.displayName}</span>
              <p className="text-slate-500 truncate text-[11px]">{replyTarget.text}</p>
            </div>
          </div>
          <button onClick={() => setReplyTarget(null)} className="text-xs text-slate-400 hover:text-slate-700 font-bold px-2 py-0.5 rounded cursor-pointer">✕ Cancel</button>
        </div>
      )}

      {/* Chat Input form */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white flex flex-col gap-2">
        {isAdmin && (
          <div className="flex items-center gap-2 select-none px-2">
            <input
              type="checkbox"
              id="notice-checkbox"
              checked={sendAsNotice}
              onChange={(e) => setSendAsNotice(e.target.checked)}
              className="h-4.5 w-4.5 accent-purple-650 rounded border-slate-350"
            />
            <label htmlFor="notice-checkbox" className="text-xs font-bold text-purple-700 uppercase tracking-wider cursor-pointer">
              📢 Broadcast as Official Notice
            </label>
          </div>
        )}

        <div className="flex gap-2.5 items-end">
          <textarea
            ref={inputRef}
            rows="1"
            value={inputText}
            onChange={handleInputChange}
            placeholder={cooldown > 0 ? `Cooldown active. Wait ${cooldown}s...` : "Type a message in the global lounge..."}
            disabled={cooldown > 0}
            className="flex-1 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200/80 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-purple-500 placeholder-slate-400 transition-colors resize-none overflow-hidden max-h-[120px]"
            style={{ height: '48px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={inputText.trim() === '' || cooldown > 0}
            className="p-3 bg-purple-600 hover:bg-purple-550 disabled:opacity-40 disabled:hover:bg-purple-650 text-white rounded-2xl shadow-[0_4px_12px_-2px_rgba(139,92,246,0.2)] transition cursor-pointer shrink-0"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
