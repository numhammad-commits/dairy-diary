import React from 'react';

export interface SawaaLogoProps {
  variant?: 'icon' | 'full' | 'stacked' | 'watermark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'color' | 'white' | 'dark' | 'monochrome';
  className?: string;
  showSubtitle?: boolean;
}

export const SawaaLogo: React.FC<SawaaLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'color',
  className = '',
  showSubtitle = true,
}) => {
  // Dimensions based on size
  const iconDimensions: Record<string, { width: number; height: number; strokeWidth: number }> = {
    xs: { width: 20, height: 20, strokeWidth: 1.5 },
    sm: { width: 28, height: 28, strokeWidth: 1.8 },
    md: { width: 36, height: 36, strokeWidth: 2 },
    lg: { width: 48, height: 48, strokeWidth: 2.2 },
    xl: { width: 64, height: 64, strokeWidth: 2.5 },
  };

  const currentDim = iconDimensions[size] || iconDimensions.md;

  // Colors based on theme
  const isWhite = theme === 'white';
  const isDark = theme === 'dark';
  const isMonochrome = theme === 'monochrome';

  const primaryColor = isWhite ? '#FFFFFF' : isDark ? '#0F291E' : isMonochrome ? '#334155' : '#1E5631';
  const secondaryColor = isWhite ? '#A7F3D0' : isDark ? '#1E5631' : isMonochrome ? '#64748B' : '#27AE60';
  const accentColor = isWhite ? '#FDE68A' : isDark ? '#D97706' : isMonochrome ? '#94A3B8' : '#F59E0B';
  const milkWhite = isWhite ? '#FFFFFF' : '#FFFFFF';

  // Standalone Master Brandmark SVG (Logo A: The Ledger Droplet)
  const LogoIcon = (
    <svg
      width={currentDim.width}
      height={currentDim.height}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform select-none"
    >
      <defs>
        <linearGradient id={`aPillar_${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isWhite ? '#FFFFFF' : '#1B4332'} />
          <stop offset="100%" stopColor={isWhite ? '#E8F5E9' : '#0F281E'} />
        </linearGradient>

        <linearGradient id={`aSwoosh_${theme}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isWhite ? '#10B981' : '#1B5E20'} />
          <stop offset="50%" stopColor={isWhite ? '#34D399' : '#2D6A4F'} />
          <stop offset="100%" stopColor={isWhite ? '#6EE7B7' : '#34D399'} />
        </linearGradient>

        <linearGradient id={`aGloss_${theme}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={isWhite ? '0.9' : '0.85'} />
          <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0.2" />
        </linearGradient>

        <filter id={`aShadow_${theme}`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#051810" floodOpacity={isWhite ? '0.3' : '0.2'} />
        </filter>
      </defs>

      {/* Left: The Solid Ledger Pillar (Grounded Stability & Bookkeeping Records) */}
      <path
        d="M 256,48 C 218,135 116,238 116,338 C 116,420 178,464 252,464 C 218,460 174,424 174,342 C 174,262 226,162 256,48 Z"
        fill={`url(#aPillar_${theme})`}
        filter={`url(#aShadow_${theme})`}
      />

      {/* Right: The Dynamic Milk Checkmark / Growth Swoosh (Fresh Dairy & Financial Accuracy) */}
      <path
        d="M 194,366 C 226,408 250,432 268,432 C 326,432 396,386 396,322 C 396,242 328,152 256,48 C 298,156 342,242 342,312 C 342,352 298,382 252,364 C 230,355 210,354 194,366 Z"
        fill={`url(#aSwoosh_${theme})`}
        filter={`url(#aShadow_${theme})`}
      />

      {/* Accent: The Golden Ledger Pip (Accounting Checkpoint / Cream Quality) */}
      <circle cx="212" cy="386" r="14" fill={accentColor} opacity="0.95" />

      {/* Upper-Left Gloss Highlight (Fresh Morning Milk Specular Luster) */}
      <path
        d="M 182,185 C 160,230 152,275 158,318 C 165,278 178,238 198,198 Z"
        fill={`url(#aGloss_${theme})`}
      />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{LogoIcon}</div>;
  }

  if (variant === 'watermark') {
    return (
      <div className={`pointer-events-none select-none flex flex-col items-center justify-center ${className}`}>
        <svg
          width={180}
          height={180}
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-10"
        >
          <path
            d="M 256,48 C 218,135 116,238 116,338 C 116,420 178,464 252,464 C 218,460 174,424 174,342 C 174,262 226,162 256,48 Z"
            fill="#1E5631"
          />
          <path
            d="M 194,366 C 226,408 250,432 268,432 C 326,432 396,386 396,322 C 396,242 328,152 256,48 C 298,156 342,242 342,312 C 342,352 298,382 252,364 C 230,355 210,354 194,366 Z"
            fill="#10B981"
          />
          <circle cx="212" cy="386" r="14" fill="#F59E0B" />
        </svg>
        <span className="text-xl font-black uppercase tracking-widest text-[#1E5631]/15 mt-2">
          Dairy Diary
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400/20">
          FREE VERSION · DEVELOPED BY SAWAA NETWORKING
        </span>
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {LogoIcon}
        <div className="mt-1.5">
          <span
            className={`text-lg font-black tracking-tight leading-none ${
              isWhite ? 'text-white' : 'text-[#1E5631]'
            }`}
          >
            Dairy Diary
          </span>
          {showSubtitle && (
            <span
              className={`block text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${
                isWhite ? 'text-emerald-200' : 'text-slate-500'
              }`}
            >
              Milk Ledger &amp; Billing
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: Full Horizontal Layout
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {LogoIcon}
      <div className="flex flex-col justify-center min-w-0">
        <span
          className={`text-base font-black tracking-tight leading-none ${
            isWhite ? 'text-white' : 'text-[#1E5631]'
          }`}
        >
          Dairy Diary
        </span>
        {showSubtitle && (
          <span
            className={`text-[10px] font-semibold tracking-wide leading-tight truncate mt-0.5 ${
              isWhite ? 'text-emerald-200' : 'text-slate-500'
            }`}
          >
            Milk Ledger &amp; Billing
          </span>
        )}
      </div>
    </div>
  );
};
