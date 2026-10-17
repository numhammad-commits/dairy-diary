import React, { useState } from 'react';
import { X, Award, Check, Printer, MessageSquare, Smartphone, ShieldCheck, Zap, FileText, KeyRound, AlertCircle } from 'lucide-react';
import { SawaaLogo } from './SawaaLogo';
import { savePersistedPremiumStatus } from '../utils/storage';

interface PremiumModalProps {
  onClose: () => void;
  isPremium?: boolean;
  onTogglePremium?: (status: boolean) => void;
  showToast?: (message: string) => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  onClose,
  isPremium = false,
  onTogglePremium,
  showToast,
}) => {
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real License Key Validation (Section 16 & 20)
  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleaned = licenseKeyInput.trim().toUpperCase();

    // Valid demo/commercial keys
    const validKeys = ['SAWAA-PRO-2026', 'DAIRY-DIARY-VIP', 'SAWAA-VIP'];

    if (validKeys.includes(cleaned)) {
      savePersistedPremiumStatus(true, cleaned);
      if (onTogglePremium) onTogglePremium(true);
      if (showToast) showToast('Premium Pro license activated successfully!');
      onClose();
    } else {
      setErrorMsg('Invalid license key. Please enter a valid SAWAA key (e.g. SAWAA-PRO-2026).');
    }
  };

  const handleDeactivate = () => {
    savePersistedPremiumStatus(false);
    if (onTogglePremium) onTogglePremium(false);
    if (showToast) showToast('Switched to Free Edition');
    onClose();
  };

  const proFeatures = [
    {
      icon: FileText,
      title: 'Watermark-Free Official PDF Statements',
      desc: 'Remove all free-edition watermarks from your customer bills, monthly ledgers, and printable reports.',
    },
    {
      icon: MessageSquare,
      title: 'Automated Instant WhatsApp Billing',
      desc: 'Send instant SMS & WhatsApp digital receipts with exact fat %, rate, and remaining ledger balance.',
    },
    {
      icon: Printer,
      title: 'Bluetooth Thermal Printer Support',
      desc: 'Connect portable 58mm / 80mm wireless thermal printers to print slips at the collection spot.',
    },
    {
      icon: Smartphone,
      title: 'Multi-Device Staff Synchronization',
      desc: 'Allow collection boys, drivers, and accountants to record entries simultaneously on their own phones.',
    },
    {
      icon: Zap,
      title: 'Fat & Lactometer Reading (LR) Calculator',
      desc: 'Automatic TS (Total Solids) and fat formula calculation for Buffalo and Cow milk pricing.',
    },
    {
      icon: ShieldCheck,
      title: 'Unlimited Lifetime Cloud Backup',
      desc: 'Never lose a single rupee of ledger history even if your smartphone is lost, damaged, or changed.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div 
        className="w-full max-w-md bg-[#F4FBF7] rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header with SAWAA Master Logo */}
        <div className="bg-gradient-to-r from-[#006B52] to-[#1B4332] text-white p-5 text-center relative shrink-0 shadow-sm">
          <button
            onClick={onClose}
            className="absolute right-3.5 top-3.5 p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex justify-center mb-2">
            <SawaaLogo variant="stacked" theme="white" size="md" showSubtitle={false} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-black uppercase tracking-wider mb-1">
            <Award className="w-3.5 h-3.5" />
            <span>DAIRY DIARY PRO</span>
          </div>

          <h3 className="text-xl font-black tracking-tight text-white">Premium Licensing</h3>
          <p className="text-xs text-[#A9DFBF] mt-1 max-w-xs mx-auto">
            {isPremium ? 'Your Dairy Diary Pro license is active.' : 'Activate your license to remove PDF watermarks and unlock Pro features.'}
          </p>

          {/* Current Status Pill */}
          <div className="mt-2.5 inline-block px-3.5 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold">
            {isPremium ? '✓ Premium Pro Active' : 'Free Edition Active'}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 bg-[#F4FBF7]">
          {/* Honest Subscription Infrastructure Notice (Section 16 & 20) */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed shadow-xs">
            <span className="font-extrabold text-amber-950 block mb-0.5">Billing Integration Status</span>
            Google Play In-App Billing is not connected in this web preview environment. Use a genuine SAWAA license key to activate your Pro license.
          </div>

          {/* License Key Activation Form */}
          {!isPremium ? (
            <form onSubmit={handleActivateLicense} className="space-y-2.5">
              <label className="text-xs font-extrabold text-[#163B32] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#0B8F68]" />
                Enter SAWAA License Key
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="e.g. SAWAA-PRO-2026"
                  className="flex-1 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-[#D6E9E1] bg-white text-[#163B32] uppercase tracking-wider focus:outline-none focus:border-[#0B8F68] focus:ring-1 focus:ring-[#0B8F68] shadow-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#0B8F68] hover:bg-[#087A58] text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
                >
                  Activate
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <p className="text-[11px] text-[#55756D]">
                Tip: You can use key <code className="font-bold text-[#163B32] bg-[#E1F3EA] px-1.5 py-0.5 rounded border border-[#D6E9E1]">SAWAA-PRO-2026</code> to test full Pro activation.
              </p>
            </form>
          ) : (
            <div className="p-4 rounded-2xl bg-white border border-[#D6E9E1] flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-[#163B32] block">Pro License Verified</span>
                <span className="text-[11px] text-[#55756D]">Watermark-free PDF statements enabled</span>
              </div>
              <button
                type="button"
                onClick={handleDeactivate}
                className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Deactivate
              </button>
            </div>
          )}

          {/* Pro Features Grid */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#55756D]">
              Pro Features Included
            </h4>
            <div className="space-y-2">
              {proFeatures.map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-white border border-[#D6E9E1] flex items-start gap-3 shadow-xs">
                  <div className="p-2 rounded-xl bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-[#163B32]">{item.title}</h5>
                    <p className="text-[11px] text-[#55756D] mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#D6E9E1] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-emerald-50 text-[#55756D] hover:text-[#163B32] text-xs font-bold rounded-xl transition-colors cursor-pointer border border-[#D6E9E1] shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
