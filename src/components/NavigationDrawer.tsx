import React from 'react';
import { 
  Home, 
  Calculator, 
  Settings, 
  Clock, 
  Wallet, 
  FileSpreadsheet, 
  Info, 
  MessageCircle, 
  Share2, 
  Star,
  Navigation
} from 'lucide-react';
import { ActiveNavTab } from '../types/dairy';
import { SawaaLogo } from './SawaaLogo';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNav: (tab: ActiveNavTab) => void;
  onOpenCalculator: () => void;
  onOpenReminder: () => void;
  onOpenPaymentHistory: () => void;
  onOpenExport: () => void;
  onOpenBackup: () => void;
  onOpenAbout: () => void;
  onShareApp: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  onSelectNav,
  onOpenCalculator,
  onOpenReminder,
  onOpenPaymentHistory,
  onOpenExport,
  onOpenBackup,
  onOpenAbout,
  onShareApp,
}) => {
  if (!isOpen) return null;

  const handleOpenWhatsAppChannel = () => {
    window.open('https://whatsapp.com/channel/0029Va8DairyDiaryUpdates', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel - Covers 78% screen width */}
      <div className="relative w-[78%] max-w-[320px] bg-[#1B4332]/95 backdrop-blur-2xl h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250 select-none border-r border-white/10 text-white">
        {/* Drawer Header - Matching Screen 1 in Greenish Theme */}
        <div className="bg-white/10 text-white p-5 pb-6 border-b border-white/10 backdrop-blur-sm">
          <SawaaLogo variant="stacked" theme="white" size="lg" showSubtitle={true} />
        </div>

        {/* Navigation ListTiles - Uniform Greenish Icon Palette */}
        <div className="py-2 overflow-y-auto flex-1">
          {/* 1. Home */}
          <button
            onClick={() => {
              onSelectNav('home');
              onClose();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Home className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Home</span>
          </button>

          {/* 1B. Delivery Tracker */}
          <button
            onClick={() => {
              onSelectNav('tracker');
              onClose();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Navigation className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Delivery Tracker (GPS)</span>
          </button>

          {/* 2. Calculator (SNF/Fat) */}
          <button
            onClick={() => {
              onClose();
              onOpenCalculator();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Calculator className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Calculator (SNF/Fat)</span>
          </button>

          {/* 3. Settings */}
          <button
            onClick={() => {
              onSelectNav('settings');
              onClose();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Settings className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Settings</span>
          </button>

          {/* 4. Daily Reminders */}
          <button
            onClick={() => {
              onClose();
              onOpenReminder();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Clock className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Daily Reminders</span>
          </button>

          {/* 5. Payment History */}
          <button
            onClick={() => {
              onClose();
              onOpenPaymentHistory();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Wallet className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Payment History</span>
          </button>

          {/* 6. Excel/CSV Export with Star */}
          <button
            onClick={() => {
              onClose();
              onOpenExport();
            }}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
                <FileSpreadsheet className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
              </div>
              <span className="text-sm font-semibold text-glass-lift">Excel/CSV Export</span>
            </div>
            <Star className="w-4 h-4 fill-amber-400 text-amber-300 text-glass-glow-gold" />
          </button>

          {/* 7. About */}
          <button
            onClick={() => {
              onClose();
              onOpenAbout();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Info className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">About</span>
          </button>

          {/* 8. Join WhatsApp Channel */}
          <button
            onClick={handleOpenWhatsAppChannel}
            className="w-full flex items-start gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full bg-white/20 text-emerald-300 border border-white/20 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-white block leading-tight text-glass-lift">
                Join WhatsApp Channel
              </span>
              <span className="text-[11px] text-[#C8E6C9] block mt-0.5">
                Updates &amp; More Apps
              </span>
            </div>
          </button>

          {/* 9. Share App */}
          <button
            onClick={() => {
              onClose();
              onShareApp();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 text-white transition-colors text-left cursor-pointer group"
          >
            <div className="w-6 h-6 flex items-center justify-center text-emerald-300">
              <Share2 className="w-5 h-5 stroke-[2] group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-sm font-semibold text-glass-lift">Share App</span>
          </button>
        </div>

        {/* Drawer Footer - Strictly Attributed to SAWAA Networking */}
        <div className="p-4 pt-3 border-t border-white/10 text-center text-xs text-[#C8E6C9] bg-white/5 backdrop-blur-sm">
          <p className="font-medium text-white/80">Version 1.11.31</p>
          <p className="mt-0.5 text-[11px]">
            Developed by <span className="font-bold text-white text-glass-lift">SAWAA Networking</span>
          </p>
        </div>
      </div>
    </div>
  );
};
