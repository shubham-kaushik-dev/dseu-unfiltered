import React, { useContext, useState } from 'react';
import { UserContext } from '../context/UserContext';
import { SocketContext } from '../context/SocketContext';
import Logo from '../components/Logo';
import { Users, ShieldAlert, Sparkles } from 'lucide-react';

export default function LandingPage({ onEnter }) {
  const { user, loading, showIdentityReveal, isBanned, bannedReason } = useContext(UserContext);
  const { onlineCount } = useContext(SocketContext);
  const [clickedEnter, setClickedEnter] = useState(false);

  const handleEnter = () => {
    setClickedEnter(true);
    // Introduce a tiny delay if user is already loaded to let them see "generating"
    setTimeout(() => {
      if (user && !showIdentityReveal) {
        onEnter();
      }
    }, 1200);
  };

  // If user is loaded and identity reveal is finished while clickedEnter is true, enter
  React.useEffect(() => {
    if (clickedEnter && user && !showIdentityReveal && !loading) {
      onEnter();
    }
  }, [clickedEnter, user, showIdentityReveal, loading]);

  if (isBanned) {
    return (
      <div className="min-height-100vh flex flex-col items-center justify-center p-4 bg-zinc-950 text-zinc-100">
        <div className="max-w-md w-full glass-panel-glow border-red-500/30 p-8 rounded-2xl text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-red-950/40 rounded-full border border-red-500/50 text-red-400">
              <ShieldAlert className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-red-500">Access Denied</h1>
          <p className="text-zinc-400 leading-relaxed text-sm">
            {bannedReason || 'Your browser identity has been permanently banned from this platform for violating community guidelines.'}
          </p>
          <div className="text-xs text-zinc-600 border-t border-zinc-800 pt-4">
            Delhi Skill and Entrepreneurship University • Student Community
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-950 overflow-hidden px-4">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Main container */}
      <div className="max-w-2xl w-full text-center space-y-12 z-10">
        
        {/* Reveal Overlay Animation */}
        {(clickedEnter && (loading || showIdentityReveal)) ? (
          <div className="glass-panel p-10 rounded-3xl space-y-8 max-w-md mx-auto shadow-2xl transition-all duration-500 scale-100">
            {loading || (clickedEnter && !user) ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h2 className="text-lg font-semibold text-zinc-300">Generating your anonymous identity...</h2>
                <p className="text-xs text-zinc-500">Allocating a secure token and random handle.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-center">
                  <div className="p-3 bg-violet-500/10 rounded-full border border-violet-500/30 text-violet-400 animate-bounce">
                    <Sparkles className="h-8 w-8" />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Welcome to the Shadows</span>
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                    {user?.displayName}
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed px-4">
                  Keep this handle! Your browser token is saved in a secure browser cookie.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Static Hero Section */
          <div className="space-y-8 animate-fade-in">
            {/* Logo and Tagline */}
            <div className="flex flex-col items-center justify-center space-y-6">
              <Logo className="h-28 w-28" showText={false} />
              
              <div className="space-y-3">
                <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-indigo-200 to-cyan-400 bg-clip-text text-transparent uppercase">
                  DSEU Unfiltered
                </h1>
                <p className="text-lg md:text-xl text-zinc-400 font-medium">
                  The campus talks. <span className="text-violet-400 font-bold">You stay anonymous.</span>
                </p>
              </div>
            </div>

            {/* Live Count Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>🟢 <strong className="text-zinc-200 font-semibold">{onlineCount || 1}</strong> students online right now</span>
            </div>

            {/* CTA Button */}
            <div className="flex flex-col items-center justify-center gap-4">
              <button
                onClick={handleEnter}
                disabled={clickedEnter}
                className="glow-btn px-8 py-4 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-extrabold text-lg rounded-xl transition duration-300 transform active:scale-95 disabled:opacity-50 select-none cursor-pointer"
              >
                Enter Community
              </button>
              <span className="text-xs text-zinc-600 font-medium">
                No sign up • No credentials • Ad-free MVP
              </span>
            </div>
          </div>
        )}

        {/* Disclaimer Footer */}
        <div className="pt-12 text-zinc-600 text-xs border-t border-zinc-900/80 max-w-md mx-auto space-y-2">
          <p>
            DSEU Unfiltered is an independent, student-led public anonymous board.
          </p>
          <p className="font-semibold text-zinc-700">
            This platform is NOT officially affiliated with or operated by the Delhi Skill and Entrepreneurship University.
          </p>
        </div>
      </div>
    </div>
  );
}
