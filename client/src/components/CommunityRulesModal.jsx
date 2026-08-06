import React, { useEffect, useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';

const RULES_VERSION = '1.0';

export default function CommunityRulesModal({ isOpen, onAccept }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger smooth fade + scale animation
      const timer = setTimeout(() => setAnimate(true), 50);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [isOpen]);

  // Intercept Escape key to prevent closing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAgree = () => {
    localStorage.setItem('dseu_rules_accepted', RULES_VERSION);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      {/* Modal Container */}
      <div 
        className={`w-full max-w-[680px] bg-[#111111] border border-purple-600/50 rounded-[20px] shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col max-h-[90vh] transition-all duration-300 transform select-none ${
          animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 text-center relative shrink-0">
          <div className="mx-auto h-12 w-12 bg-purple-950/40 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 mb-3 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Community Rules
          </h2>
          <p className="text-sm font-black text-purple-400 uppercase tracking-widest mt-1">
            Welcome to DSEU Unfiltered
          </p>
          <p className="text-xs text-zinc-400 mt-2 font-medium">
            Please read and agree to the following rules before continuing.
          </p>
        </div>

        {/* Rules Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-left divide-y divide-zinc-900">
          {[
            {
              num: 1,
              title: "Respect Everyone",
              desc: "Treat every member with respect. Healthy discussions are welcome, but harassment, bullying, or personal attacks are not."
            },
            {
              num: 2,
              title: "No Hate Speech",
              desc: "Do not post content targeting anyone based on religion, caste, race, gender, sexuality, disability, or nationality."
            },
            {
              num: 3,
              title: "No Threats or Violence",
              desc: "Threatening, encouraging violence, or promoting physical harm is strictly prohibited."
            },
            {
              num: 4,
              title: "Protect Privacy",
              desc: "Do not share someone's personal information including phone numbers, addresses, IDs, private photos or social media without permission."
            },
            {
              num: 5,
              title: "Keep Confessions Anonymous",
              desc: "Never reveal the real identity of anyone mentioned in confessions."
            },
            {
              num: 6,
              title: "No Spam or Advertising",
              desc: "No spam, repeated messages, scams, fake giveaways or advertisements."
            },
            {
              num: 7,
              title: "Respect Copyright",
              desc: "Only upload content that you own or have permission to share."
            },
            {
              num: 8,
              title: "Follow Campus Decorum",
              desc: "Constructive criticism is welcome, but false accusations, defamation and targeted harassment are not allowed."
            },
            {
              num: 9,
              title: "Report Problems Responsibly",
              desc: "Use the Report feature or Contact Professor if you encounter abusive content."
            },
            {
              num: 10,
              title: "Admin Decisions",
              desc: "The administrator may warn, mute, remove content, temporarily suspend or permanently ban accounts that violate these rules."
            }
          ].map((rule) => (
            <div key={rule.num} className={`pt-3 first:pt-0 flex gap-3.5`}>
              <div className="h-6 w-6 bg-purple-950/30 border border-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 text-xs font-black shrink-0">
                {rule.num}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black uppercase text-zinc-150 tracking-wide">{rule.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800/80 bg-zinc-950/20 text-center shrink-0 space-y-4">
          <p className="text-[10px] text-zinc-550 leading-relaxed font-semibold max-w-lg mx-auto">
            By using DSEU Unfiltered, you agree to follow these Community Rules. Repeated violations may result in warnings, content removal, temporary suspension or permanent bans.
          </p>

          <button
            type="button"
            onClick={handleAgree}
            className="w-full max-w-xs py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>I Agree</span>
          </button>
        </div>
      </div>
    </div>
  );
}
