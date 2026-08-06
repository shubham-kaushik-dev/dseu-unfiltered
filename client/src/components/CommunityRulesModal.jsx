import React, { useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function CommunityRulesModal({ isOpen, onAccept }) {
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#000000]/50 backdrop-blur-[3px] overflow-hidden">
      {/* Modal Container */}
      <div className="w-full max-w-[760px] bg-[#16181D] border border-[#2A2F3A] rounded-[12px] shadow-2xl flex flex-col max-h-[72vh] overflow-hidden select-none">
        
        {/* Header (Fixed) */}
        <div className="p-6 border-b border-[#2A2F3A] text-center shrink-0">
          <div className="mx-auto h-10 w-10 bg-purple-950/20 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 mb-2">
            <Shield className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Community Rules
          </h2>
          <p className="text-xs text-zinc-400 font-bold tracking-wide mt-1">
            Welcome to DSEU Unfiltered
          </p>
        </div>

        {/* Rules Content (Scrollable Only) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-left divide-y divide-[#2A2F3A]/30 scrollbar-thin">
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
              desc: "The administrator may warn, delete content, remove, temporarily suspend or permanently ban accounts that violate these rules."
            }
          ].map((rule) => (
            <div key={rule.num} className="pt-4 first:pt-0 flex gap-4 items-start">
              <div className="h-6 w-6 bg-purple-950/20 border border-purple-500/20 rounded flex items-center justify-center text-purple-400 text-xs font-black shrink-0">
                {rule.num}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-wide">{rule.title}</h4>
                <p className="text-[12px] text-[#D1D5DB] leading-relaxed font-normal">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer (Fixed containing Button) */}
        <div className="p-6 border-t border-[#2A2F3A] bg-black/10 text-center shrink-0 space-y-4">
          <p className="text-[11px] text-zinc-400 leading-relaxed max-w-2xl mx-auto font-medium">
            By using DSEU Unfiltered, you agree to follow these Community Rules. Repeated violations may result in warnings, content removal, temporary suspension or permanent bans.
          </p>

          <button
            type="button"
            onClick={onAccept}
            className="w-full max-w-[220px] py-2.5 px-6 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition duration-150 cursor-pointer shadow-md inline-flex items-center justify-center"
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}
