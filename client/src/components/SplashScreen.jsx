import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { Sparkles, Terminal } from 'lucide-react';

export default function SplashScreen({ user, loading, onComplete }) {
  const [statusText, setStatusText] = useState('Connecting to campus nodes...');
  const [revealTriggered, setRevealTriggered] = useState(false);

  useEffect(() => {
    if (loading) {
      const texts = [
        'Establishing secure socket tunnels...',
        'Allocating temporary memory storage...',
        'Generating a unique anonymous moniker...',
        'Sealing browser credentials...'
      ];
      let idx = 0;
      const interval = setInterval(() => {
        setStatusText(texts[idx % texts.length]);
        idx++;
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && user) {
      setRevealTriggered(true);
      // Wait for 2.2 seconds then automatically transition to the dashboard
      const timer = setTimeout(() => {
        onComplete();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [loading, user, onComplete]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-white px-4 select-none overflow-hidden">
      {/* Premium blurred blobs in background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vh] bg-indigo-50/40 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vh] bg-sky-50/40 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* Floating abstract decorative shapes */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 border border-slate-100 rounded-full pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 left-1/4 w-48 h-48 border border-slate-100/80 rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '1.5s' }}></div>

      <div className="max-w-md w-full text-center space-y-12 z-10">
        
        {/* Animated Brand Logo Container */}
        <div className="flex justify-center transform hover:scale-105 transition-transform duration-500">
          <div className="p-6 bg-slate-50/50 border border-slate-100/80 rounded-[32px] shadow-sm backdrop-blur-sm relative">
            {/* Soft pulsing halo ring */}
            <div className="absolute inset-0 rounded-[32px] border-2 border-indigo-500/10 animate-ping opacity-75"></div>
            <Logo className="h-20 w-20" showText={false} />
          </div>
        </div>

        {/* Brand Information Section */}
        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase font-sans">
            DSEU Unfiltered
          </h1>
          <p className="text-sm font-semibold text-slate-400 tracking-wide uppercase">
            The campus talks. <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">You stay anonymous.</span>
          </p>
        </div>

        {/* Dynamic State Overlay Card */}
        <div className="glass-panel-glow border-indigo-500/15 p-8 rounded-[24px] shadow-sm min-h-[140px] flex flex-col justify-center items-center">
          {loading || !user ? (
            <div className="space-y-4 animate-pulse">
              <div className="flex justify-center">
                <div className="h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">{statusText}</p>
            </div>
          ) : (
            <div className="space-y-5 animate-slide-in">
              <div className="flex justify-center">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100/50 rounded-full text-purple-600">
                  <Sparkles className="h-6 w-6 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">IDENTITY ESTABLISHED</span>
                <h2 className="text-2xl font-black text-slate-800 font-sans">
                  You are <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{user?.displayName}</span>
                </h2>
              </div>
            </div>
          )}
        </div>

        {/* Minimal Footer Info */}
        <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 opacity-60">
          <Terminal className="h-3.5 w-3.5" />
          <span>DECRYPTED END-TO-END COMMUNITY PROTOCOL</span>
        </div>

      </div>
    </div>
  );
}
