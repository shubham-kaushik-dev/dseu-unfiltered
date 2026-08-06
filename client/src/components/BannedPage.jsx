import React, { useState, useEffect, useRef, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { UserContext } from '../context/UserContext';
import { ShieldAlert, Send, Image, Smile, Clock, Eye } from 'lucide-react';
import Logo from './Logo';

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function BannedPage() {
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
          headers: { 'x-anonymous-token': user.browserToken }
        });
        if (res.ok) {
          const list = await res.json();
          setMessages(list);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchHistory();

    if (socket) {
      // Register ban identity mapping on socket
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
  }, [socket, user.browserToken]);

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

    if (!user || !user.isRegistered) {
      openLoginModal(() => {
        performSendSupportMessage();
      });
      return;
    }

    await performSendSupportMessage();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0b0c10] text-[#c5c6c7] font-inter">
      {/* Ban notice card */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 border-b md:border-b-0 md:border-r border-[#1f2833]/80 bg-zinc-950/40 relative overflow-hidden select-none">
        <div className="absolute inset-0 radial-grid opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1f2833 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-md w-full text-center space-y-6 z-10 relative">
          <div className="mx-auto h-16 w-16 bg-red-950/40 border border-red-900/50 rounded-3xl flex items-center justify-center text-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <ShieldAlert className="h-9 w-9" />
          </div>

          <div className="space-y-2">
            <Logo size="sm" showText={false} className="mx-auto h-10 w-10 opacity-70" />
            <h1 className="text-[36px] font-black tracking-tight text-red-500 uppercase leading-none mt-2">
              YOU ARE BANNED
            </h1>
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
              Access to DSEU Unfiltered has been suspended
            </p>
          </div>

          <div className="p-5 bg-[#121214] border border-[#1f2833] rounded-2xl text-left space-y-3 shadow-2xl">
            <div>
              <span className="text-[10px] text-zinc-650 font-bold block uppercase tracking-wider">BAN REASON</span>
              <p className="text-zinc-200 text-sm font-semibold mt-0.5 leading-relaxed">
                {user.banReason || 'Your anonymous moniker violated community guidelines.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-900/80">
              <div>
                <span className="text-[10px] text-zinc-650 font-bold block uppercase tracking-wider">BANNED BY</span>
                <span className="text-zinc-300 text-xs font-semibold">{user.bannedBy || 'Professor'}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-650 font-bold block uppercase tracking-wider">BAN DATE</span>
                <span className="text-zinc-300 text-xs font-mono">
                  {user.banDate ? new Date(user.banDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-600 font-extrabold uppercase tracking-widest mt-6">
            DSEU Student Surveillance System
          </div>
        </div>
      </div>

      {/* Support chat messenger */}
      <div className="w-full md:w-[500px] flex flex-col h-[50vh] md:h-screen bg-[#111115] relative shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[#1f2833] bg-zinc-950/80 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-purple-650/15 border border-purple-500/20 rounded-xl flex items-center justify-center text-sm font-bold text-purple-400">
              PR
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-200">Support Chat with Professor</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${adminOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {adminOnline ? 'Professor (ADMIN) is online' : 'Professor is currently offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 select-none">
              <span className="text-3xl">💬</span>
              <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider max-w-xs leading-relaxed">
                Send a message to Professor explaining your ban appeal. Support is active.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.senderType === 'admin';
              return (
                <div key={msg._id} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'} space-y-1`}>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider font-mono px-1">
                    {msg.senderName}
                  </span>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md border ${
                    isAdmin 
                      ? 'bg-white border-zinc-200 text-black rounded-tl-sm' 
                      : 'bg-[#e9d5ff] border-purple-300 text-black rounded-tr-sm'
                  }`}>
                    {msg.imageUrl && (
                      <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="block mb-1.5 rounded-lg overflow-hidden border border-zinc-200 bg-slate-50">
                        <img src={msg.imageUrl} alt="Support attachment" className="w-full max-h-48 object-cover hover:scale-105 transition duration-200" />
                      </a>
                    )}
                    {msg.text && <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                  </div>
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isAdmin && (
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                        {msg.isSeen ? '• Seen' : '• Sent'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {adminTyping && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 italic px-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                <span className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce delay-100"></span>
                <span className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce delay-200"></span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Professor is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment preview bar */}
        {previewUrl && (
          <div className="p-2 border-t border-[#1f2833] bg-zinc-950 flex items-center justify-between">
            <div className="flex items-center gap-2 relative">
              <img src={previewUrl} alt="Attachment Preview" className="h-12 w-12 object-cover rounded border border-zinc-800" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Image selected ({Math.round(selectedFile.size / 1024)} KB)</span>
            </div>
            <button onClick={handleRemoveAttachment} className="text-xs text-red-500 hover:text-red-400 font-bold px-2 py-1 bg-red-950/40 rounded border border-red-900/50 cursor-pointer">
              Remove
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessageSubmit} className="p-3 border-t border-[#1f2833] bg-zinc-950 flex gap-2 items-center">
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
            className="p-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-xl transition cursor-pointer"
            title="Attach image appeals"
          >
            <Image className="h-4.5 w-4.5" />
          </button>
          
          <input
            type="text"
            placeholder="Type your appeal details..."
            value={inputText}
            onChange={handleInputChange}
            disabled={uploading}
            className="flex-1 bg-white border border-zinc-350 rounded-xl px-4 py-2.5 text-xs text-black placeholder-black/60 focus:outline-none focus:border-purple-600 transition"
          />
          
          <button
            type="submit"
            disabled={uploading || (!inputText.trim() && !selectedFile)}
            className="p-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl transition cursor-pointer"
          >
            {uploading ? (
              <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="h-4.5 w-4.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
