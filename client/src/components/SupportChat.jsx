import React, { useState, useEffect, useRef, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { UserContext } from '../context/UserContext';
import { Send, Image, MessageSquare, Clock, ShieldAlert } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function SupportChat() {
  const { user, openLoginModal } = useContext(UserContext);
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch support message history and setup socket bindings
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/support/history`, {
          headers: { 'x-anonymous-token': user?.browserToken || '' }
        });
        if (res.ok) {
          const list = await res.json();
          setMessages(list);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (user?.browserToken) {
      fetchHistory();
    }

    if (socket && user?.browserToken) {
      // Register identity mapping on socket
      socket.emit('register-identity', user.browserToken);

      // Listen for incoming messages
      socket.on('support-message', (msg) => {
        setMessages((prev) => [...prev, msg]);
        // Auto mark as seen if message is from admin
        if (msg.senderType === 'admin') {
          socket.emit('support-seen');
        }
      });

      // Listen for admin typing indicators
      socket.on('support-admin-typing', (data) => {
        setAdminTyping(data.isTyping);
      });

      // Listen for seen receipts
      socket.on('support-messages-seen', () => {
        setMessages((prev) =>
          prev.map((m) => (m.senderType === 'user' ? { ...m, isSeen: true } : m))
        );
      });

      // Fetch admin presence status from public settings periodically
      const checkAdminPresence = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/settings`);
          if (res.ok) {
            const settings = await res.json();
            setAdminOnline(settings.professor_presence === 'online');
          }
        } catch (err) {
          // ignore
        }
      };
      
      checkAdminPresence();
      socket.on('settings-updated', checkAdminPresence);
      socket.on('online-stealth-update', checkAdminPresence);

      // Notify seen upon load
      socket.emit('support-seen');

      return () => {
        socket.off('support-message');
        socket.off('support-admin-typing');
        socket.off('support-messages-seen');
        socket.off('settings-updated');
        socket.off('online-stealth-update');
      };
    }
  }, [socket, user?.browserToken]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, adminTyping]);

  // Typing status sync
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socket) {
      socket.emit('support-typing', { isTyping: e.target.value.trim() !== '' });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('File size exceeds the 10 MB limit.', 'warning');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveAttachment = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const performSendSupportMessage = async () => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('text', inputText);
      if (selectedFile) {
        formData.append('attachment', selectedFile);
      }

      const res = await fetch(`${API_BASE}/api/support/message`, {
        method: 'POST',
        headers: {
          'x-anonymous-token': user?.browserToken || ''
        },
        body: formData
      });

      if (res.ok) {
        setInputText('');
        handleRemoveAttachment();
        if (socket) {
          socket.emit('support-typing', { isTyping: false });
        }
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to send message.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not deliver message.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessageSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    if (!user || (!user.isRegistered && user.role !== 'admin')) {
      openLoginModal(() => {
        performSendSupportMessage();
      });
      return;
    }

    await performSendSupportMessage();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 rounded-[24px] border border-slate-200/80 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80 bg-white flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-purple-105 rounded-xl flex items-center justify-center text-purple-650 font-bold">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-850">Oversight Helpdesk</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${adminOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350'}`}></span>
              <span className="text-[10px] text-slate-455 font-medium">
                {adminOnline ? 'Professor (ADMIN) is online' : 'Professor is currently offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f8fafc]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 select-none">
            <span className="text-3xl">💬</span>
            <p className="text-xs text-slate-450 font-bold uppercase tracking-wider max-w-xs leading-relaxed">
              Send a message to Professor. Help desk is active.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.senderType === 'admin';
            return (
              <div key={msg._id} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'} space-y-1`}>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono px-1">
                  {msg.senderName}
                </span>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm border ${
                  isAdmin 
                    ? 'bg-white border-slate-200 text-black rounded-tl-none font-medium' 
                    : 'bg-[#E9D5FF] border-[#D8B4FE] text-black rounded-tr-none'
                }`}>
                  {msg.imageUrl && (
                    <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="block mb-1.5 rounded-lg overflow-hidden border border-slate-250 bg-slate-50">
                      <img src={msg.imageUrl} alt="Support attachment" className="w-full max-h-48 object-cover hover:scale-105 transition" />
                    </a>
                  )}
                  {msg.text && <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                </div>
                <div className="flex items-center gap-1.5 px-1 select-none">
                  <span className="text-[9px] text-slate-400 font-mono">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!isAdmin && (
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      {msg.isSeen ? '• Seen' : '• Sent'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        {adminTyping && (
          <div className="flex items-center gap-1.5 text-xs text-slate-450 italic px-2">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
              <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Professor is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview bar */}
      {previewUrl && (
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={previewUrl} alt="Attachment" className="h-10 w-10 object-cover rounded-xl border border-slate-300" />
            <span className="text-[10px] text-slate-400 font-mono">({Math.round(selectedFile.size / 1024)} KB)</span>
          </div>
          <button onClick={handleRemoveAttachment} className="text-xs text-red-500 hover:text-red-400 font-bold px-3 py-1.5 bg-red-55 hover:bg-red-105 rounded-xl border border-red-200 cursor-pointer transition">Remove</button>
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSendMessageSubmit} className="p-4 border-t border-slate-200/80 bg-white flex gap-3 items-center">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-450 hover:text-slate-700 rounded-xl cursor-pointer border border-slate-200 transition"
          title="Attach image"
        >
          <Image className="h-4.5 w-4.5" />
        </button>
        
        <input
          type="text"
          placeholder="Type your message to Professor..."
          value={inputText}
          onChange={handleInputChange}
          disabled={uploading}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-black placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
        />
        
        <button
          type="submit"
          disabled={uploading || (!inputText.trim() && !selectedFile)}
          className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl transition cursor-pointer shadow-md shadow-purple-600/10"
        >
          {uploading ? (
            <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="h-4.5 w-4.5" />
          )}
        </button>
      </form>
    </div>
  );
}
