import React from 'react';
import { X, ShieldCheck, Heart } from 'lucide-react';
import { SawaaLogo } from './SawaaLogo';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-[#F4FBF7] rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006B52] to-[#1B4332] text-white p-5 text-center relative shadow-sm">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex justify-center mb-1">
            <SawaaLogo variant="stacked" theme="white" size="lg" showSubtitle={true} />
          </div>

          <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold text-white border border-white/20">
            Version 2.4.0 · Commercial Release
          </span>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-xs text-[#55756D] bg-[#F4FBF7]">
          <p className="leading-relaxed font-medium">
            <strong className="text-[#163B32]">Dairy Diary</strong> is a professional milk collection, billing, customer ledger, and financial management application engineered for dairy farms, commercial milk distribution centers, and chilling plants.
          </p>

          <div className="p-3 rounded-2xl bg-white border border-[#D6E9E1] shadow-xs space-y-1">
            <h4 className="font-bold text-[#163B32] text-xs">Core Capabilities</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#55756D]">
              <li>Morning &amp; Evening shift volume records (Liters)</li>
              <li>Customer dues &amp; seller purchasing management</li>
              <li>Dynamic 7-day payment notices &amp; QR scan-to-pay</li>
              <li>Professional A4 PDF statements &amp; Excel sheets</li>
              <li>Offline database with Cloud Drive backup</li>
            </ul>
          </div>

          <div className="pt-2 text-center border-t border-[#D6E9E1]">
            <p className="text-[11px] font-bold text-[#163B32]">
              Developed by SAWAA Networking
            </p>
            <p className="text-[10px] text-[#7A8C84] mt-0.5">
              All Rights Reserved © 2026 Dairy Diary
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-[#D6E9E1] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0B8F68] hover:bg-[#087A58] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
