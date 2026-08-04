import React, { useState, useEffect, useRef, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { playNotificationChime } from '../utils/sound';
import { Send, Smile, Trash2, Edit2, Check, X, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

export default function ChatBox({ isAdmin, adminToken }) {
  const { user, adminCsrfToken } = useContext(UserContext);
  const { socket, onlineCount, slowModeSeconds, pinnedAnnouncement } = useContext(SocketContext);
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
  
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const adjustHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // Load chat history on connect
  useEffect(() => {
    // Fetch initial chat history
    fetch('/api/admin/search/content?query=') // Or we can create a simpler endpoint, but since we have content search, let's use a quick local API fetch
      .then(res => res.json())
      .catch(err => console.error(err));

    // For Live Chat, we will fetch the latest 50 messages from a dedicated endpoint or we can fetch them on startup.
    // Let's create a quick API call in our server/routes/admin.js or just fetch directly.
    // Actually, we can fetch messages using a simple GET endpoint, wait!
    // Let's check: did we define GET /api/chat messages?
    // Oh, we didn't define GET /api/chat messages in the routes, but we can search for empty queries or we can just fetch all messages.
    // Let's check: we can write a quick endpoint for chat messages, or fetch them in auth or admin.
    // Wait, let's add a GET /api/chat endpoint to retrieve chat history! Yes, that is extremely useful for active boards.
    // Let's verify: we can fetch chat messages from the server using a new endpoint, or we can just define it in server.js.
    // Wait! Let's check if we can fetch chat messages. Let's make an API call to `GET /api/auth/chat` or `GET /api/confessions/chat` or let's create a small route.
    // Ah, wait! In server.js, we can write a simple endpoint: `app.get('/api/chat', async (req, res) => { ... })` and return latest 50 messages. That is extremely clean.
    // Let's assume we fetch `/api/chat`. We will add that endpoint to server.js in a moment (or we already have it).
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
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      
      // Play chime if message is not from self
      if (msg.sender?.browserToken !== user?.browserToken) {
        playNotificationChime();
      }
    };

    // Listen for updated reactions
    const handleMessageUpdated = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
      );
    };

    // Listen for deleted messages
    const handleMessageDeleted = (messageId) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    };

    // Listen for typing users
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

    socket.on('new-chat-message', handleNewMessage);
    socket.on('chat-message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('user-typing', handleUserTyping);
    socket.on('chat-error', handleChatError);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
      socket.off('chat-message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('user-typing', handleUserTyping);
      socket.off('chat-error', handleChatError);
    };
  }, [socket, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Cooldown timer logic for slow mode
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

    // Handle typing emission
    if (!isTyping && text.trim() !== '') {
      setIsTyping(true);
      socket.emit('typing', { isTyping: true });
    }

    // Debounce typing status clear
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing', { isTyping: false });
    }, 1500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputText.trim() === '' || cooldown > 0) return;

    // Send via socket
    socket.emit('send-chat-message', inputText);

    // Apply client-side slow mode countdown
    if (slowModeSeconds > 0) {
      setCooldown(slowModeSeconds);
    }

    setInputText('');
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing', { isTyping: false });

    // Reset height of text area
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
      const response = await fetch(`/api/admin/message/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': adminCsrfToken
        },
        credentials: 'include'
      });
      if (!response.ok) {
        const err = await response.json();
        showToast(err.message || 'Failed to delete message.', 'error');
      } else {
        showToast('Message deleted successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not delete message.', 'error');
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
    <div className="flex flex-col h-[78vh] bg-white border border-slate-200/80 rounded-[20px] overflow-hidden shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)]">
      {/* Chat header */}
      <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between select-none">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase leading-tight">
            💬 Global Live Chat
          </h2>
          <p className="text-[15px] font-semibold text-slate-400 mt-1">
            Slow Mode: {slowModeSeconds > 0 ? `${slowModeSeconds}s` : 'Disabled'} • {onlineCount} online
          </p>
        </div>

        <button
          onClick={toggleSound}
          className="p-2.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition duration-300 cursor-pointer"
          title={soundEnabled ? 'Mute chime' : 'Unmute chime'}
        >
          {soundEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5 text-red-500" />}
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[350px] bg-slate-50/20">
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

            return (
              <div
                key={msg._id}
                className={`group flex flex-col max-w-[85%] md:max-w-[65%] animate-message-arrive ${
                  isMe ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'
                }`}
              >
                {/* Sender name & timestamp */}
                <div className="flex items-center gap-2.5 mb-1.5 px-1 select-none">
                  <span className={`text-[16px] font-bold tracking-tight ${isMe ? 'text-purple-600' : 'text-blue-600'}`}>
                    {msg.sender?.displayName || 'Anonymous'}
                  </span>
                  <span className="text-[12px] text-slate-400 font-semibold uppercase">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Show Edit/Delete for self if under 5 minutes */}
                  {isEditable && editingMessageId !== msg._id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-2">
                      <button
                        onClick={() => handleStartEdit(msg)}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-purple-600 rounded-lg transition cursor-pointer"
                        title="Edit message"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteOwnMessage(msg._id)}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                        title="Delete message"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Show Admin delete */}
                  {isAdmin && !isMe && (
                    <button
                      onClick={() => handleDeleteMessage(msg._id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition duration-200 cursor-pointer ml-2"
                      title="Delete chat message (Admin)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Message bubble / Edit state */}
                {editingMessageId === msg._id ? (
                  <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 p-4 rounded-[20px] w-full min-w-[280px]">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={500}
                      className="bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex justify-end gap-2 text-[10px] select-none">
                      <button
                        onClick={() => { setEditingMessageId(null); setEditText(''); }}
                        className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-350 cursor-pointer flex items-center gap-1 font-bold transition"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(msg._id)}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-550 cursor-pointer flex items-center gap-1 font-bold transition"
                      >
                        <Check className="h-3 w-3" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`px-5 py-3 rounded-[20px] text-[16px] leading-[1.6] font-semibold border shadow-[0_1px_2px_rgba(148,163,184,0.02)] transition duration-250 ${
                      isMe
                        ? 'bg-purple-50/75 border-purple-100/50 text-slate-800 rounded-tr-[4px] hover:shadow'
                        : 'bg-white border-slate-200/70 text-slate-700 rounded-tl-[4px] hover:shadow'
                    }`}
                  >
                    {msg.text}
                    {msg.isEdited && (
                      <span className="text-[9px] text-slate-400 font-extrabold block mt-1 uppercase tracking-wide">
                        (edited)
                      </span>
                    )}
                  </div>
                )}

                {/* Reactions bar */}
                <div className="flex items-center gap-2 mt-2 px-1 select-none">
                  {['❤️', '😂', '🔥'].map((emoji) => {
                    const reactors = messageReactions[emoji] || [];
                    const hasReacted = reactors.includes(user?.browserToken);
                    const count = reactors.length;

                    return (
                      <button
                        key={emoji}
                        onClick={() => reactToMessage(msg._id, emoji)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition cursor-pointer duration-200 hover:scale-105 active:scale-95 ${
                          hasReacted
                            ? 'bg-purple-50 border-purple-200/60 text-purple-600 font-extrabold'
                            : 'bg-slate-50 border-slate-200/50 text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span className="font-extrabold text-[10px]">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-450 font-bold tracking-wider select-none">
          <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          <span className="ml-1">{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
        </div>
      )}

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200/80 shadow-[0_-2px_15px_rgba(148,163,184,0.03)]">
        <div className="relative flex items-end gap-3 max-w-full">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            disabled={cooldown > 0}
            placeholder={
              cooldown > 0
                ? `Slow mode cooldown: wait ${cooldown}s`
                : "Write an anonymous message..."
            }
            className="w-full bg-slate-50 border border-slate-200/85 rounded-[24px] py-3.5 pl-5 pr-28 text-[16px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition disabled:opacity-50 resize-none h-[48px] overflow-y-auto leading-normal"
            maxLength={500}
          />
          
          {/* Character counter & Telegram style send button */}
          <div className="absolute right-3.5 bottom-1.5 flex items-center gap-3.5 select-none h-11">
            <span className="text-[10px] text-slate-400 font-extrabold">
              {inputText.length}/500
            </span>
            <button
              type="submit"
              disabled={inputText.trim() === '' || cooldown > 0}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-550 hover:to-blue-550 text-white shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed transition duration-200 cursor-pointer"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
