import React from 'react';
import dseuLogo from '../assets/dseu.jpg';

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
      <img
        src={dseuLogo}
        alt="DSEU Logo"
        className={`${className} object-contain rounded-md`}
      />

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
