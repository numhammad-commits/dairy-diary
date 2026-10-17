import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Calendar, 
  Award, 
  Check, 
  Download, 
  Lock, 
  Unlock, 
  Sparkles,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { LedgerEntry, Contact } from '../types/dairy';
import { getDeviceTodayDate, shiftDateString } from '../utils/formatters';

interface ExportViewProps {
  entries: LedgerEntry[];
  contacts: Contact[];
  onBack: () => void;
  showToast?: (message: string) => void;
}

export const ExportView: React.FC<ExportViewProps> = ({
  entries,
  contacts,
  onBack,
  showToast,
}) => {
  // Default date range: Past 30 days ending today (current device date)
  const [endDate, setEndDate] = useState<string>(getDeviceTodayDate);
  const [startDate, setStartDate] = useState<string>(() => shiftDateString(getDeviceTodayDate(), -30));
  
  // Paywall state (defaults to locked to faithfully match Screen 1)
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Format date helper: "YYYY-MM-DD" -> "DD MMM, YYYY" (e.g., "03 Sep, 2026")
  const formatDateDisplay = (dateStr: string): string => {
    try {
      const [year, month, day] = dateStr.split('-');
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const mIdx = parseInt(month, 10) - 1;
      return `${day} ${monthNames[mIdx] || 'Sep'}, ${year}`;
    } catch {
      return dateStr;
    }
  };

  // Filter entries in range
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      return e.date >= startDate && e.date <= endDate;
    });
  }, [entries, startDate, endDate]);

  // Handle Upgrade CTA Click
  const handleUpgrade = () => {
    setIsProcessingUpgrade(true);
    setTimeout(() => {
      setIsProcessingUpgrade(false);
      setIsLocked(false);
      if (showToast) {
        showToast('Dairy Diary Pro Activated! Export unlocked.');
      }
    }, 700);
  };

  // Handle Export to CSV
  const handleExportCSV = () => {
    if (isLocked) return;

    setIsExporting(true);
    setTimeout(() => {
      // Build CSV Data
      const headers = [
        'Date',
        'Customer/Farmer Name',
        'Role',
        'Shift',
        'Milk Type',
        'Quantity (Liters)',
        'Fat %',
        'SNF %',
        'Rate per Liter (Rs)',
        'Total Amount (Rs)',
        'Received Amount (Rs)',
        'Due Amount (Rs)'
      ];

      const rows = filteredEntries.map((e) => {
        return [
          e.date,
          `"${e.contactName.replace(/"/g, '""')}"`,
          e.contactRole === 'buyer' ? 'Customer (Buyer)' : 'Farmer (Seller)',
          e.shift.toUpperCase(),
          e.milkType === 'buffalo' ? 'Buffalo' : 'Cow',
          e.liters.toFixed(1),
          e.fatPercentage?.toFixed(1) || '6.5',
          e.snfPercentage?.toFixed(1) || '9.0',
          e.ratePerLiter.toFixed(2),
          e.totalAmount.toFixed(2),
          e.receivedAmount.toFixed(2),
          e.dueAmount.toFixed(2)
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dairy-diary-entries-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      if (showToast) {
        showToast(`Successfully downloaded ${filteredEntries.length} entries as CSV!`);
      }
    }, 500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[#F4FBF7] relative select-none">
      {/* 1. Top Header App Bar - Greenish Theme (#1E5631) */}
      <div className="bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            title="Back to Home"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Excel/CSV Export
          </h1>
        </div>

        {/* Quick state toggle button for testing review */}
        <button
          onClick={() => {
            setIsLocked(!isLocked);
            if (showToast) {
              showToast(isLocked ? 'Unlocked Pro view preview' : 'Locked to Paywall view');
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer border border-white/20"
          title={isLocked ? 'Click to preview unlocked state' : 'Click to preview locked paywall'}
        >
          {isLocked ? (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-amber-200">Locked</span>
            </>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-emerald-200">Unlocked</span>
            </>
          )}
        </button>
      </div>

      {/* Main View Container */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-y-auto">
        {/* 2. Background Layer: "Export Your Data" Layout (Disabled/Blurred when locked) */}
        <div 
          className={`flex-1 flex flex-col p-5 max-w-md mx-auto w-full transition-all duration-300 ${
            isLocked ? 'filter blur-[1.5px] opacity-40 pointer-events-none select-none' : 'opacity-100'
          }`}
        >
          {/* Top Illustration: Modern minimalist spreadsheet placeholder icon */}
          <div className="flex flex-col items-center text-center mt-3 mb-6">
            <div className="w-20 h-20 rounded-3xl bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center shadow-xs mb-4">
              <FileSpreadsheet className="w-10 h-10 stroke-[1.8]" />
            </div>
            
            {/* Title Header */}
            <h2 className="text-2xl font-black text-[#163B32] tracking-tight">
              Export Your Data
            </h2>

            {/* Explanatory Subtext */}
            <p className="text-xs text-[#55756D] max-w-xs mt-2 leading-relaxed">
              Select a date range to download your milk entries as a CSV file, which can be opened in Excel, Google Sheets, or any other spreadsheet app.
            </p>
          </div>

          {/* Date Range Pickers (Side-by-side) */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Start Date Card */}
            <div className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs relative group text-[#163B32]">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#0B8F68]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55756D]">Start Date</span>
              </div>
              <div className="font-extrabold text-sm text-[#163B32] tracking-tight">
                {formatDateDisplay(startDate)}
              </div>
              {!isLocked && (
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-label="Select Start Date"
                />
              )}
            </div>

            {/* End Date Card */}
            <div className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs relative group text-[#163B32]">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#0B8F68]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55756D]">End Date</span>
              </div>
              <div className="font-extrabold text-sm text-[#163B32] tracking-tight">
                {formatDateDisplay(endDate)}
              </div>
              {!isLocked && (
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-label="Select End Date"
                />
              )}
            </div>
          </div>

          {/* Export Summary Box when Unlocked */}
          {!isLocked && (
            <div className="glass-card bg-[#E1F3EA] border border-[#0B8F68]/30 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-[#163B32]">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-[#0B8F68]" />
                <div>
                  <div className="text-xs font-bold text-[#163B32]">
                    {filteredEntries.length} Milk Entries Found
                  </div>
                  <div className="text-[10px] text-[#55756D]">
                    Ready to export in universal CSV format
                  </div>
                </div>
              </div>
              <span className="text-xs font-black text-[#0B8F68] bg-white px-2 py-1 rounded-lg border border-[#D6E9E1]">
                PRO ACTIVE
              </span>
            </div>
          )}

          {/* Action Button: Wide button reading "Export to CSV" */}
          <div className="mt-auto pb-4">
            <button
              onClick={handleExportCSV}
              disabled={isLocked || isExporting}
              className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                isLocked 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300' 
                  : 'bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white cursor-pointer shadow-md'
              }`}
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{isExporting ? 'Generating CSV...' : 'Export to CSV'}</span>
            </button>
          </div>
        </div>

        {/* 3. Foreground Layer: "Premium Feature" Paywall Overlay Card (Centered) */}
        {isLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div 
              className="w-full max-w-sm glass-card bg-[#1B4332]/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-6 text-center animate-in zoom-in-95 duration-200 relative text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ribbon Icon */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-100 text-emerald-950 flex items-center justify-center shadow-md mx-auto mb-3 border-2 border-white ring-4 ring-amber-400/30">
                <Award className="w-9 h-9 stroke-[2.2] text-emerald-950" />
              </div>

              {/* Section Header */}
              <h3 className="text-xl font-black text-white tracking-tight text-glass-lift">
                Premium Feature
              </h3>

              {/* Explanatory VIP Benefit Subtext */}
              <p className="text-xs text-[#C8E6C9] mt-2 px-1 leading-relaxed">
                Exporting data to Excel/CSV is a Dairy Diary Pro feature. Upgrade to unlock unlimited exports, WhatsApp billing, and automated backups.
              </p>

              {/* Feature Points in Greenish accents */}
              <div className="bg-white/10 rounded-2xl p-3 my-4 space-y-2 text-left border border-white/15 text-white backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <div className="w-4 h-4 rounded-full bg-white/15 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Unlimited Excel &amp; Google Sheets exports</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <div className="w-4 h-4 rounded-full bg-white/15 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Instant WhatsApp receipts with custom logo</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <div className="w-4 h-4 rounded-full bg-white/15 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Automatic lifetime cloud ledger sync</span>
                </div>
              </div>

              {/* Premium Upgrade Action Button */}
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={isProcessingUpgrade}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-2 group relative overflow-hidden text-glass-lift"
              >
                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>
                  {isProcessingUpgrade ? 'Unlocking Pro Access...' : 'Upgrade to Pro - Rs1,500/yr'}
                </span>
              </button>

              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[#C8E6C9] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>One-time annual activation · Cancel anytime</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
