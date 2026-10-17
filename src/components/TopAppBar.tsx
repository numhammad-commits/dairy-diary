import React from 'react';
import { Menu, Bell, Crown } from 'lucide-react';
import { SawaaLogo } from './SawaaLogo';

interface TopAppBarProps {
  onOpenDrawer: () => void;
  onOpenReminder: () => void;
  onOpenBackup: () => void;
  onOpenPremium: () => void;
  isPremium?: boolean;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  onOpenDrawer,
  onOpenReminder,
  onOpenBackup: _onOpenBackup,
  onOpenPremium,
  isPremium = false,
}) => {
  return (
    <header className="relative bg-[#006B52] text-white px-4 pt-3 pb-3 flex items-center justify-between shrink-0 select-none z-20 overflow-hidden shadow-xs">
      {/* Subtle Milk Splash Graphic on the Top-Right Shoulder */}
      <div className="absolute right-14 -top-1 pointer-events-none opacity-30 select-none">
        <svg width="74" height="46" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M15 52 C22 36, 28 14, 38 18 C46 21, 44 36, 54 28 C62 21, 68 4, 76 10 C84 16, 78 38, 88 35 C94 33, 98 44, 96 52 Z"
            fill="white"
          />
          <circle cx="37" cy="11" r="3.2" fill="white" />
          <circle cx="75" cy="5" r="2.5" fill="white" />
          <circle cx="56" cy="18" r="2" fill="white" />
          <circle cx="92" cy="24" r="1.8" fill="white" />
        </svg>
      </div>

      {/* Left: Logo A (The Ledger Droplet) in Frosted Glass Circle + Brand Title & Subtitle */}
      <div className="flex items-center gap-3 min-w-0 z-10">
        {/* Brandmark emblem inside frosted glass badge */}
        <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0 ring-1 ring-emerald-400/20">
          <SawaaLogo variant="icon" size="sm" theme="white" />
        </div>

        {/* Title and Subtitle */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">
              Dairy Diary
            </h1>
            {isPremium && (
              <span
                onClick={onOpenPremium}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-[9px] font-black text-amber-300 cursor-pointer"
                title="Dairy Diary PRO"
              >
                <Crown className="w-2.5 h-2.5 fill-amber-300" />
                PRO
              </span>
            )}
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium tracking-tight leading-tight mt-0.5">
            Milk Ledger & Billing
          </p>
        </div>
      </div>

      {/* Right: Glass Action Buttons (Premium, Reminders Bell, Menu Drawer) */}
      <div className="flex items-center gap-1.5 sm:gap-2 z-10 shrink-0">
        <button
          onClick={onOpenPremium}
          className="h-10 min-h-[44px] px-2.5 rounded-full bg-amber-400/15 hover:bg-amber-400/25 active:bg-amber-400/35 backdrop-blur-md border border-amber-300/40 flex items-center justify-center gap-1.5 text-amber-300 transition-all shadow-sm active:scale-95 cursor-pointer text-glass-glow-gold"
          title={isPremium ? 'Dairy Diary PRO Active' : 'Upgrade to Premium'}
          aria-label={isPremium ? 'Dairy Diary PRO Active' : 'Upgrade to Premium'}
        >
          <Crown className="w-4 h-4 stroke-[2.2] fill-amber-300 text-amber-300 shrink-0" />
          <span className="text-xs font-black tracking-tight text-amber-300">
            {isPremium ? 'PRO' : 'Premium'}
          </span>
        </button>

        <button
          onClick={onOpenReminder}
          className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          title="Reminders & Notifications"
          aria-label="Reminders"
        >
          <Bell className="w-4.5 h-4.5 stroke-[2.2]" />
        </button>

        <button
          onClick={onOpenDrawer}
          className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          title="Open Menu Drawer"
          aria-label="Open Menu"
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>
    </header>
  );
};
