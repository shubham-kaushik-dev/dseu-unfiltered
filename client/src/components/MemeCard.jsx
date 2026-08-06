import React, { useState, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { MessageSquare, Smile, Flag, CornerDownRight, Trash2, Download } from 'lucide-react';
import professorAvatar from '../assets/professor-avatar.png';
import berlinAvatar from '../assets/images/admins/berlin.jpg';

const POPULAR_EMOJIS = ['😂', '🔥', '❤️', '💀', '🤡', '😭', '😮', '💯', '👍'];

export default function MemeCard({ meme, onReact, onAddComment, onReport, isAdmin, onDelete }) {
  const { user } = useContext(UserContext);
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const reactionsMap = meme.reactions || {};
  const reactionsList = Object.entries(reactionsMap)
    .map(([emoji, tokens]) => ({
      emoji,
      tokens,
      count: tokens.length,
      hasReacted: tokens.includes(user?.browserToken)
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (commentText.trim() === '') return;
    onAddComment(meme._id, commentText);
    setCommentText('');
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (reportReason.trim() === '') return;
    onReport(meme._id, reportReason);
    setReportReason('');
    setShowReportModal(false);
  };

  const handleDownload = () => {
    // Basic download trigger for meme image
    const link = document.createElement('a');
    link.href = meme.imageUrl;
    link.download = `dseu-unfiltered-meme-${meme._id.slice(-6)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-[20px] p-5 shadow-[0_4px_10px_-2px_rgba(148,163,184,0.02)] transition duration-300 relative flex flex-col space-y-4 max-w-md mx-auto w-full break-inside-avoid mb-6 hover:shadow-md">
      {/* Header info */}
      <div className="flex items-center justify-between select-none">
        <span className="text-[9px] text-slate-400 font-extrabold tracking-wider">
          MEME BY: <span className="text-purple-600 font-black">{meme.sender?.displayName || 'Anonymous'}</span>
        </span>
        <span className="text-[9px] text-slate-400 font-bold uppercase">
          {new Date(meme.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Meme Image Box */}
      <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-200/50 aspect-auto flex items-center justify-center">
        <img
          src={meme.imageUrl}
          alt={meme.caption || 'Campus Meme'}
          className="w-full h-auto object-cover hover:scale-[1.025] transition duration-500 cursor-zoom-in"
          loading="lazy"
        />
      </div>

      {/* Caption */}
      {meme.caption && (
        <p className="text-slate-700 text-xs italic font-semibold leading-relaxed">
          "{meme.caption}"
        </p>
      )}

      {/* Reactions displaying */}
      <div className="flex flex-wrap items-center gap-2 select-none">
        {reactionsList.map(({ emoji, count, hasReacted }) => (
          <button
            key={emoji}
            onClick={() => onReact(meme._id, emoji)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition cursor-pointer ${
              hasReacted
                ? 'bg-purple-50 border-purple-200/60 text-purple-700 font-bold'
                : 'bg-slate-50 border-slate-200/50 text-slate-400 hover:text-slate-700 hover:bg-slate-100/60'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-extrabold text-[10px]">{count}</span>
          </button>
        ))}

        {/* Emoji picker */}
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition cursor-pointer"
            title="Add Reaction"
          >
            <Smile className="h-4 w-4" />
          </button>

          {showPicker && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowPicker(false)}></div>
              <div className="absolute left-0 mt-2 p-2 bg-white border border-slate-200/85 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-30 w-32 animate-slide-in">
                {POPULAR_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(meme._id, emoji);
                      setShowPicker(false);
                    }}
                    className="p-1.5 text-base hover:bg-slate-100 rounded-lg transition text-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action panel */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2 select-none">
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 text-xs font-bold transition cursor-pointer ${
            showComments ? 'text-purple-650' : 'text-slate-450 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Comments ({meme.comments?.length || 0})</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-purple-600 rounded-lg transition cursor-pointer"
            title="Download Meme"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-red-500 text-[10px] font-bold transition cursor-pointer"
            title="Report Meme"
          >
            <Flag className="h-3.5 w-3.5" />
            <span>Report</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onDelete(meme._id)}
              className="flex items-center gap-1 text-slate-400 hover:text-red-500 text-[10px] font-bold transition cursor-pointer"
              title="Delete Meme"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Comments view */}
      {showComments && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
            {meme.comments?.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic">No comments yet. Be the first to reply...</p>
            ) : (
              meme.comments.map(comment => (
                <div key={comment._id} className="flex gap-2 text-xs bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/55">
                  <CornerDownRight className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <img 
                        src={(() => {
                          const sender = comment.sender;
                          if (!sender) return '';
                          if (sender.role === 'admin' || sender.isAdmin === true || sender.displayName === 'Professor (ADMIN)' || sender.displayName === 'Berlin') {
                            if (sender.displayName === 'Berlin' || sender.displayName?.toLowerCase().includes('berlin')) {
                              return berlinAvatar;
                            }
                            return professorAvatar;
                          }
                          return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(sender.browserToken || sender.displayName || 'default')}`;
                        })()}
                        alt="Commenter Avatar" 
                        className="h-6 w-6 rounded-full border border-slate-200 bg-slate-50 object-cover" 
                      />
                      {(() => {
                        const name = comment.sender?.displayName || '';
                        const isAdminUser = comment.sender?.role === 'admin' || comment.sender?.isAdmin === true || name === 'Professor (ADMIN)' || name === 'Berlin';
                        if (isAdminUser) {
                          if (name === 'Berlin' || name.toLowerCase().includes('berlin')) {
                            return (
                              <div className="flex items-center gap-1">
                                <span className="font-extrabold text-purple-750">Berlin</span>
                                <span className="text-[8px] font-black bg-gradient-to-r from-purple-600 to-amber-600 bg-clip-text text-transparent px-1 py-0.1 border border-purple-500/30 rounded uppercase tracking-wider font-mono">
                                  SUB ADMIN
                                </span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center gap-1">
                                <span className="font-extrabold text-purple-750">Professor</span>
                                <span className="text-[8px] font-black bg-gradient-to-r from-purple-600 to-amber-600 bg-clip-text text-transparent px-1 py-0.1 border border-purple-500/30 rounded uppercase tracking-wider font-mono">
                                  ADMIN
                                </span>
                              </div>
                            );
                          }
                        } else {
                          return (
                            <span className="font-extrabold text-blue-605">
                              {name || 'Anonymous'}
                            </span>
                          );
                        }
                      })()}
                      <span className="text-[9px] text-slate-400 font-semibold">
                        {new Date(comment.createdAt).toLocaleDateString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-650 leading-relaxed font-semibold">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add an anonymous reply..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500/50 transition"
            />
            <button
              type="submit"
              disabled={commentText.trim() === ''}
              className="py-2 px-4 bg-slate-200 hover:bg-slate-350 text-slate-600 hover:text-slate-850 text-xs font-black rounded-xl transition disabled:opacity-40 cursor-pointer"
            >
              Post
            </button>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 border border-slate-250 rounded-3xl max-w-sm w-full space-y-4 shadow-xl animate-slide-in">
            <h3 className="text-sm font-black text-red-500 flex items-center gap-2 select-none uppercase tracking-wide">
              <Flag className="h-4 w-4" /> Report Meme
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold select-none">
              State the reason for reporting this meme. Administrators will review it.
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g. Inappropriate content, hate speech, spam..."
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-red-500 h-20 resize-none transition"
              />
              <div className="flex justify-end gap-2 text-xs select-none">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-505 hover:bg-slate-200 rounded-xl cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl cursor-pointer font-bold shadow-md shadow-red-600/10"
                >
                  Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
