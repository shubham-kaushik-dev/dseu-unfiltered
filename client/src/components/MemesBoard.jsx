import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { ToastContext } from '../context/ToastContext';
import { UserContext } from '../context/UserContext';
import { applyMemeWatermark } from '../utils/watermark';
import MemeCard from './MemeCard';
import { Image, HelpCircle, FileWarning, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function MemesBoard({ isAdmin }) {
  const { socket } = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const { adminCsrfToken, adminFetch } = useContext(UserContext);
  const [memes, setMemes] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchMemes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/memes`);
      if (res.ok) {
        const data = await res.json();
        setMemes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemes();
  }, []);

  // Listen to socket.io events
  useEffect(() => {
    if (!socket) return;

    const handleNewMeme = (newMeme) => {
      setMemes(prev => [newMeme, ...prev]);
    };

    const handleMemeUpdated = (updatedMeme) => {
      setMemes(prev =>
        prev.map(m => (m._id === updatedMeme._id ? updatedMeme : m))
      );
    };

    const handleMemeDeleted = (id) => {
      setMemes(prev => prev.filter(m => m._id !== id));
    };

    socket.on('new-meme', handleNewMeme);
    socket.on('meme-updated', handleMemeUpdated);
    socket.on('meme-deleted', handleMemeDeleted);

    return () => {
      socket.off('new-meme', handleNewMeme);
      socket.off('meme-updated', handleMemeUpdated);
      socket.off('meme-deleted', handleMemeDeleted);
    };
  }, [socket]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setUploadError('');
    if (!selectedFile) return;

    // Validate size (max 10 MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10 MB. Please select a smaller file.');
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handlePostMeme = async (e) => {
    e.preventDefault();
    if (!file || uploading) return;

    try {
      setUploading(true);
      setUploadError('');

      // Apply watermark client-side using canvas
      let watermarkedBlob;
      try {
        watermarkedBlob = await applyMemeWatermark(file);
      } catch (err) {
        console.error('Watermarking failed:', err);
        setUploadError('Failed to process image watermark. Try a different file.');
        setUploading(false);
        return;
      }

      // Construct a file from the blob
      const watermarkedFile = new File([watermarkedBlob], file.name, {
        type: file.type
      });

      // Prepare multi-part form data
      const formData = new FormData();
      formData.append('meme', watermarkedFile);
      formData.append('caption', caption);

      const response = await fetch(`${API_BASE}/api/memes`, {
        method: 'POST',
        body: formData
      });

      const responseData = await response.json();

      if (!response.ok) {
        // If Cloudinary error or uploads disabled in production
        setUploadError(responseData.message || 'Meme upload failed.');
      } else {
        // Clear uploader state
        setFile(null);
        setPreviewUrl('');
        setCaption('');
      }
    } catch (err) {
      console.error(err);
      setUploadError('Server connection lost during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleReact = async (id, emoji) => {
    try {
      await fetch(`${API_BASE}/api/memes/${id}/react`, {
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
      const response = await fetch(`${API_BASE}/api/memes/${id}/comment`, {
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
      const response = await fetch(`${API_BASE}/api/memes/${id}/report`, {
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
        showToast('Meme reported for admin moderation.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Could not submit report.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this meme?')) return;
    try {
      const response = await adminFetch(`/api/admin/meme/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'Failed to delete meme.', 'error');
      } else {
        showToast('Meme deleted successfully.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Could not delete meme.', 'error');
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-2xl mx-auto">
      {/* Title */}
      <div className="text-center md:text-left space-y-2 select-none">
        <h2 className="text-[28px] font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase leading-tight">
          🖼️ Campus Memes
        </h2>
        <p className="text-[15px] font-semibold text-slate-400">
          Share humorous student struggles. Only JPG, PNG, and WEBP supported. Max size 10 MB. All memes automatically receive a watermark.
        </p>
      </div>

      {/* Upload Box Form */}
      <form onSubmit={handlePostMeme} className="bg-white border border-slate-200/80 rounded-[20px] p-6 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.05)]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 tracking-wider select-none">
            <Image className="h-4 w-4 text-purple-600" />
            <span>UPLOAD A CAMPUS MEME</span>
          </div>

          {/* Error display */}
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl text-xs flex items-start gap-2">
              <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{uploadError}</span>
            </div>
          )}

          {/* File input / preview area */}
          <div className="flex items-center justify-center w-full">
            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-200 p-2 max-w-xs mx-auto">
                <img src={previewUrl} alt="Preview" className="h-48 w-full object-contain rounded-lg" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl('');
                  }}
                  className="absolute top-4 right-4 bg-black/80 hover:bg-black p-1.5 rounded-full text-slate-200 hover:text-white transition text-xs font-bold cursor-pointer"
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Image className="h-8 w-8 text-slate-400 mb-2 animate-bounce" style={{ animationDuration: '3s' }} />
                  <p className="text-xs text-slate-500 font-bold">Select Meme Image (JPG, PNG, WEBP)</p>
                  <p className="text-[10px] text-slate-405 font-medium">Max size: 10 MB</p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Optional Caption input */}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add an optional caption (max 200 chars)..."
            maxLength={200}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-[16px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500/50 focus:bg-white transition"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!file || uploading}
              className="glow-btn px-6 py-3 text-white text-[16px] font-semibold rounded-xl shadow-md cursor-pointer transition"
            >
              {uploading ? 'Uploading & Watermarking...' : 'Upload Meme'}
            </button>
          </div>
        </div>
      </form>

      {/* Memes List in columns layout */}
      <div className="columns-1 md:columns-2 gap-6 space-y-6 [column-fill:_balance]">
        {loading ? (
          <div className="flex justify-center py-10 col-span-full">
            <div className="h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : memes.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-slate-200/50 rounded-[20px] p-6 shadow-sm col-span-full">
            <HelpCircle className="h-8 w-8 text-slate-350 mx-auto mb-2" />
            <p className="text-xs text-slate-450 font-bold">No memes uploaded yet. Share the first laugh!</p>
          </div>
        ) : (
          memes.map(meme => (
            <MemeCard
              key={meme._id}
              meme={meme}
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
