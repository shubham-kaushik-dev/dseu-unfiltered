import React, { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { CheckCircle2, Trash2 } from 'lucide-react';

export default function PollCard({ poll, onVote, isAdmin, onDelete }) {
  const { user } = useContext(UserContext);
  const userToken = user?.browserToken;

  // Calculate total votes across all options
  const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);

  // Check if current user has voted in this poll
  const hasVoted = poll.options.some(opt => opt.votes?.includes(userToken));
  const votedOptionId = poll.options.find(opt => opt.votes?.includes(userToken))?._id;

  return (
    <div className="bg-white border border-slate-200/80 rounded-[20px] p-6 hover:shadow-md transition duration-300 relative flex flex-col space-y-4 shadow-[0_4px_10px_-2px_rgba(148,163,184,0.02)] select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-400 font-extrabold tracking-wider">
          POLL #{poll._id.slice(-6).toUpperCase()}
        </span>
        <span className="text-[9px] text-slate-405 font-bold uppercase">
          {totalVotes} total votes
        </span>
      </div>

      {/* Question */}
      <h3 className="text-slate-800 font-bold text-sm leading-snug">
        {poll.question}
      </h3>

      {/* Options List */}
      <div className="space-y-3">
        {poll.options.map(option => {
          const voteCount = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = option._id === votedOptionId;

          return (
            <button
              key={option._id}
              onClick={() => onVote(poll._id, option._id)}
              className={`w-full relative overflow-hidden rounded-xl py-3 px-4 text-xs font-bold text-left transition border cursor-pointer ${
                isSelected
                  ? 'bg-purple-50/70 border-purple-300 text-purple-750'
                  : 'bg-slate-50/50 border-slate-200/60 text-slate-500 hover:bg-slate-100/60 hover:text-slate-805'
              }`}
            >
              {/* Progress bar fill background */}
              {hasVoted && (
                <div
                  className={`absolute top-0 left-0 bottom-0 transition-all duration-500 ease-out ${
                    isSelected ? 'bg-purple-600/15' : 'bg-slate-200/40'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />}
                  <span>{option.text}</span>
                </div>
                {hasVoted && (
                  <span className="font-extrabold text-[10px] text-slate-450">
                    {percentage}% ({voteCount})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Admin control */}
      {isAdmin && (
        <div className="flex justify-end border-t border-slate-100 pt-4 mt-2">
          <button
            onClick={() => onDelete(poll._id)}
            className="flex items-center gap-1 text-slate-400 hover:text-red-500 text-[10px] font-bold transition cursor-pointer"
            title="Delete Poll"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Poll</span>
          </button>
        </div>
      )}
    </div>
  );
}
