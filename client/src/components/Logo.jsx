import React from 'react';

export default function Logo({ className = "h-8 w-8", showText = true, size = "md" }) {
  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl"
  };

  const tagSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm"
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Handcrafted Startup-style Minimalist SVG Symbol */}
      <svg
        className={className}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoPremiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" /> {/* Primary Purple */}
            <stop offset="100%" stopColor="#2563EB" /> {/* Primary Blue */}
          </linearGradient>
          <filter id="premiumShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#7C3AED" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Speech bubble 1 (Left / Back) */}
        <path
          d="M20 50 C20 36.19 31.19 25 45 25 H55 C68.81 25 80 36.19 80 50 C80 63.81 68.81 75 55 75 H35 L20 85 V75 C20 75 20 75 20 50Z"
          fill="url(#logoPremiumGrad)"
          filter="url(#premiumShadow)"
        />

        {/* Minimal nested U-shape (representing Unfiltered community dialogue) in clean White */}
        <path
          d="M38 44 C38 52 43 56 50 56 C57 56 62 52 62 44"
          stroke="#FFFFFF"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Modern talk bubble overlap accent in White */}
        <circle cx="50" cy="35" r="4" fill="#FFFFFF" />
      </svg>

      {showText && (
        <div className="flex flex-col items-start leading-tight">
          <span className={`${textSizes[size] || "text-lg"} font-black tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent`}>
            DSEU Unfiltered
          </span>
          {size !== "sm" && (
            <span className={`${tagSizes[size] || "text-[10px]"} text-zinc-400 font-bold tracking-normal uppercase`}>
              The campus talks. You stay anonymous.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
