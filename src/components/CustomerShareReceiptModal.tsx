import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, X, Share2, Download, Eye, Check, FileText, Calendar, Clock, DollarSign, Smartphone, Loader2 } from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord, BusinessSettings } from '../types/dairy';
import { formatPKR, formatLiters, getDeviceTodayDate, formatDairyReceiptText } from '../utils/formatters';
import { generateReceiptPdf, receiptTemplateFromLabel } from '../utils/pdfGenerator';
import { SawaaLogo } from './SawaaLogo';
import { ReceiptTemplate } from './ReceiptTemplate';

// Days Taken / Days Missed — a small, self-contained display-only computation (duplicated
// here rather than imported from pdfGenerator.ts, which isn't in this task's write-access
// scope). For a plain "Month YYYY" period, the full calendar month is used; otherwise the
// actual date span covered by the entries themselves is used.
function tryParseMonthTitle(title: string): { year: number; month: number } | null {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const match = title.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const monthIdx = months.indexOf(match[1]);
  if (monthIdx === -1) return null;
  return { year: parseInt(match[2], 10), month: monthIdx + 1 };
}

function computeDeliveryDayStats(entries: LedgerEntry[], periodTitle: string): { daysTaken: number; missedDaysLabel: string } {
  if (entries.length === 0) {
    return { daysTaken: 0, missedDaysLabel: 'None' };
  }

  const takenDates = Array.from(new Set(entries.map((e) => e.date))).sort();
  const daysTaken = takenDates.length;

  let rangeStart: Date;
  let rangeEnd: Date;

  const monthMatch = tryParseMonthTitle(periodTitle);
  if (monthMatch) {
    rangeStart = new Date(monthMatch.year, monthMatch.month - 1, 1);
    rangeEnd = new Date(monthMatch.year, monthMatch.month, 0);
  } else {
    const [fy, fm, fd] = takenDates[0].split('-').map(Number);
    const [ly, lm, ld] = takenDates[takenDates.length - 1].split('-').map(Number);
    rangeStart = new Date(fy, fm - 1, fd);
    rangeEnd = new Date(ly, lm - 1, ld);
  }

  const takenSet = new Set(takenDates);
  const missedDayNumbers: number[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    if (!takenSet.has(`${y}-${m}-${d}`)) {
      missedDayNumbers.push(cursor.getDate());
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  let missedDaysLabel: string;
  if (missedDayNumbers.length === 0) {
    missedDaysLabel = 'None';
  } else if (missedDayNumbers.length > 8) {
    missedDaysLabel = `${missedDayNumbers.slice(0, 6).join(', ')} +${missedDayNumbers.length - 6} more`;
  } else {
    missedDaysLabel = missedDayNumbers.join(', ');
  }

  return { daysTaken, missedDaysLabel };
}

interface CustomerShareReceiptModalProps {
  contact: Contact;
  entries: LedgerEntry[];
  paymentRecords: PaymentRecord[];
  metrics: {
    milk: number;
    amount: number;
    received: number;
    due: number;
    previousDue: number;
    totalOutstanding: number;
  };
  activeMonthDisplay: string;
  businessSettings?: BusinessSettings;
  onClose: () => void;
  showToast?: (message: string) => void;
}

export const CustomerShareReceiptModal: React.FC<CustomerShareReceiptModalProps> = ({
  contact,
  entries,
  paymentRecords,
  metrics,
  activeMonthDisplay,
  businessSettings,
  onClose,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'due' | 'payment'>('due');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const businessName = businessSettings?.businessName || 'Dairy Diary';
  const templateVariant = receiptTemplateFromLabel(businessSettings?.receiptTemplate);

  // Hidden receipt card, captured via html2canvas when the Due Receipt is shared.
  const receiptRef = useRef<HTMLDivElement>(null);

  const monthEntriesForReceipt = useMemo(() => {
    // activeMonthDisplay looks like "October 2026" — derive its real YYYY-MM key via
    // tryParseMonthTitle rather than a raw substring (which doesn't match a date prefix).
    const monthInfo = tryParseMonthTitle(activeMonthDisplay);
    const monthKey = monthInfo ? `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}` : null;
    const filtered = entries.filter(
      (e) => e.contactId === contact.id && (monthKey ? e.date.startsWith(monthKey) : true)
    );
    return filtered.length > 0 ? filtered : entries.filter((e) => e.contactId === contact.id);
  }, [entries, contact.id, activeMonthDisplay]);

  const dayStats = useMemo(
    () => computeDeliveryDayStats(monthEntriesForReceipt, activeMonthDisplay),
    [monthEntriesForReceipt, activeMonthDisplay]
  );

  const avgRate = metrics.milk > 0 ? metrics.amount / metrics.milk : 0;

  // Find most recent payment for this contact
  const latestPayment = useMemo(() => {
    const list = (paymentRecords || []).filter(
      (p) => p.contactId === contact.id || p.contactName === contact.name
    );
    if (list.length === 0) return null;
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp))[0];
  }, [paymentRecords, contact.id, contact.name]);

  const currentTodayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const currentTimeStr = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Text message payload for sharing — the beautifully formatted emoji receipt, built
  // straight from the already-computed metrics (never recalculated here).
  const shareTextPayload = useMemo(() => {
    if (activeTab === 'due') {
      return formatDairyReceiptText({
        customerName: contact.name,
        date: `${currentTodayStr}, ${currentTimeStr}`,
        milkLiters: metrics.milk,
        ratePerLiter: metrics.milk > 0 ? metrics.amount / metrics.milk : undefined,
        totalAmount: metrics.amount,
        received: metrics.received,
        due: metrics.due,
        previousDue: metrics.previousDue,
        footerBusinessName: businessName,
      });
    } else {
      const amt = latestPayment ? latestPayment.amount : metrics.received;
      const pDate = latestPayment ? latestPayment.date : currentTodayStr;
      const pMethod = latestPayment?.paymentMethod || 'Cash';
      return `*DAIRY DIARY — PAYMENT RECEIPT* 🧾\n` +
        `-------------------------\n` +
        `👤 *Customer:* ${contact.name}\n` +
        `📅 *Date:* ${pDate}\n` +
        `💳 *Method:* ${pMethod}\n` +
        `✅ *Amount Received:* ${formatPKR(amt)}\n` +
        `⚠️ *Remaining Due:* ${formatPKR(metrics.due + metrics.previousDue)}\n` +
        `-------------------------\n` +
        `Thank you for your business!\n` +
        `_${businessName} Dairy Diary_`;
    }
  }, [activeTab, businessName, contact.name, activeMonthDisplay, currentTodayStr, currentTimeStr, metrics, latestPayment]);

  // PDF generation for the standalone "Download PDF" button (unaffected by this task —
  // Share now uses the html2canvas image receipt below instead of this PDF).
  const buildReceiptPdf = async () => {
    // Reuses the same monthEntriesForReceipt filter fix as the new receipt image, so the
    // PDF's own transaction/day-stats data is scoped to this month too, not all-time
    // (it already has its own all-time fallback for contacts with no entries this month).
    // generateReceiptPdf dispatches to the Modern/Thermal/Ledger generator based on the
    // business's selected template (businessSettings.receiptTemplate).
    return generateReceiptPdf(
      contact,
      monthEntriesForReceipt,
      activeMonthDisplay,
      businessSettings,
      {
        totalMilk: metrics.milk,
        totalAmount: metrics.amount,
        totalReceived: metrics.received,
        periodDue: metrics.due,
        previousDue: metrics.previousDue,
        // Bill documents must show the FULL amount owed (current month + carryover),
        // unlike the Home/ContactDetail "Outstanding" badge which is current-month-only
        // by design (Bug Fix #2) — metrics.totalOutstanding is that current-month-only
        // figure, so it's deliberately not reused here.
        totalOutstanding: metrics.due + metrics.previousDue,
      },
      false,
      templateVariant
    );
  };

  // Handle Share (Due Receipt tab): capture the hidden ReceiptTemplate card as a real
  // image via html2canvas and attach it via the native share sheet (Web Share API Level
  // 2), with the formatted text as the companion caption. Falls back to downloading the
  // image + opening WhatsApp with the text when file sharing isn't supported, and to
  // text-only WhatsApp if the image capture itself fails.
  const handleShareDueReceiptImage = async () => {
    if (!receiptRef.current) {
      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareTextPayload)}`, '_blank');
      return;
    }

    try {
      // html2canvas-pro (not the plain html2canvas also present in node_modules as a
      // jsPDF sub-dependency) — the plain version's CSS parser can't read Tailwind v4's
      // oklch() color values used throughout this app's compiled stylesheet, and throws
      // on every capture regardless of what this component itself uses. -pro is a
      // purpose-built fork with native oklch support.
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (!blob) throw new Error('Failed to create image blob from canvas');

      const filename = `Dairy_Diary_Receipt_${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}_${activeMonthDisplay.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${businessName} Receipt - ${contact.name}`,
            text: shareTextPayload,
          });
          if (showToast) showToast('Shared successfully!');
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return; // user cancelled the native share sheet
          // otherwise fall through to the download + WhatsApp fallback below
        }
      }

      // Fallback: download the image so it's ready on-device, then open WhatsApp with the text
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareTextPayload)}`, '_blank');
      if (showToast) showToast('Receipt image downloaded — opening WhatsApp');
    } catch (err) {
      console.error('Receipt image share error:', err);
      // Last resort if the image capture itself fails: text-only WhatsApp
      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareTextPayload)}`, '_blank');
      if (showToast) showToast('Receipt opened in WhatsApp');
    }
  };

  // Handle Share (Payment Receipt tab): no image template has been designed for a payment
  // confirmation yet, so this tab keeps the existing text-only share.
  const handleSharePaymentText = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${businessName} Receipt - ${contact.name}`, text: shareTextPayload });
        if (showToast) showToast('Shared successfully!');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareTextPayload)}`, '_blank');
    if (showToast) showToast('Receipt opened in WhatsApp');
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      if (activeTab === 'due') {
        await handleShareDueReceiptImage();
      } else {
        await handleSharePaymentText();
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdf = await buildReceiptPdf();

      // Trigger download
      const link = document.createElement('a');
      link.href = pdf.url;
      link.download = pdf.filename;
      link.click();

      if (showToast) showToast(`Downloaded ${pdf.filename}`);
    } catch (err) {
      if (showToast) showToast('Generated statement ready');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md h-full bg-glass-gradient shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* TOP HEADER: Emerald Green Theme                                           */}
        {/* ========================================================================= */}
        <div className="relative bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold tracking-tight text-white leading-tight truncate">
                Share — {contact.name}
              </h1>
              <p className="text-xs text-white/80 font-medium leading-tight">
                Customer Statement &amp; Receipt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TOP SEGMENTED TABS                                                        */}
        {/* ========================================================================= */}
        <div className="p-3 shrink-0">
          <div className="bg-slate-100 p-1 rounded-2xl border border-[#D6E9E1] flex gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('due')}
              className={`flex-1 py-2 px-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'due'
                  ? 'bg-[#0B8F68] text-white shadow-xs'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              Share Due Receipt
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payment')}
              className={`flex-1 py-2 px-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'payment'
                  ? 'bg-[#0B8F68] text-white shadow-xs'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              Share Payment Receipt
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RECEIPT PREVIEW BODY (Consistent with PDF statement design language)       */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
          <div className="bg-white rounded-2xl border border-[#C8E6C9] shadow-xs overflow-hidden">
            {/* Dark green header of the receipt */}
            <div className="bg-[#1B5E20] text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs border border-white/20">
                    {businessSettings?.logoUrl ? (
                      <img src={businessSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <SawaaLogo variant="icon" size="sm" theme="color" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200 block truncate">
                      {businessName} {businessSettings?.phone ? `· ${businessSettings.phone}` : ''}
                    </span>
                    <h2 className="text-base font-black tracking-tight leading-tight truncate">
                      {activeTab === 'due' ? 'Customer Due Statement' : 'Official Payment Receipt'}
                    </h2>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-white/15 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-white/70 block">Billed To:</span>
                  <span className="font-extrabold text-white">{contact.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/70 block">Contact:</span>
                  <span className="font-bold text-white/90">{contact.phone}</span>
                </div>
              </div>
            </div>

            {/* Receipt Body Info */}
            <div className="p-4 space-y-3 text-xs bg-white">
              {/* Date & Time Row */}
              <div className="flex items-center justify-between text-[#757575] pb-2 border-b border-emerald-50">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span>{currentTodayStr}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span>{currentTimeStr}</span>
                </div>
              </div>

              {/* Tab 1: Share Due Receipt */}
              {activeTab === 'due' ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[#757575] font-semibold">Billing Period</span>
                    <span className="font-black text-slate-800">{activeMonthDisplay}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[#757575] font-semibold">Milk Delivered</span>
                    <span className="font-black text-slate-800">{formatLiters(metrics.milk)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[#757575] font-semibold">Month Bill</span>
                    <span className="font-black text-[#1B5E20]">{formatPKR(metrics.amount)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[#757575] font-semibold">Month Received</span>
                    <span className="font-black text-[#1B5E20]">{formatPKR(metrics.received)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[#757575] font-semibold">Current Month Balance</span>
                    <span className="font-black text-[#E57373]">{formatPKR(metrics.due)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[#757575] font-semibold">Previous Balance Carried</span>
                    <span className="font-black text-[#E57373]">+{formatPKR(metrics.previousDue)}</span>
                  </div>

                  {/* Highlighted Total Outstanding Row — current month + previous carryover
                      combined, matching the shared receipt image/PDF below (not the
                      current-month-only Outstanding badge used on Home/ContactDetail). */}
                  <div className="p-3 bg-[#E8F5E9] rounded-xl border border-[#C8E6C9] flex items-center justify-between mt-3">
                    <span className="font-black text-xs text-[#1B5E20]">Total Outstanding Due</span>
                    <span className="font-black text-base text-[#E57373]">
                      {formatPKR(metrics.due + metrics.previousDue)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Tab 2: Share Payment Receipt */
                <div className="space-y-2 pt-1">
                  {latestPayment ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-[#757575] font-semibold">Payment Date</span>
                        <span className="font-black text-slate-800">{latestPayment.date}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-[#757575] font-semibold">Payment Method</span>
                        <span className="font-black text-slate-800">
                          {latestPayment.paymentMethod || 'Cash'}
                        </span>
                      </div>

                      {latestPayment.notes && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-[#757575] font-semibold">Reference Notes</span>
                          <span className="font-medium text-slate-800">{latestPayment.notes}</span>
                        </div>
                      )}

                      {/* Highlighted Received Amount */}
                      <div className="p-3 bg-[#E8F5E9] rounded-xl border border-[#C8E6C9] flex items-center justify-between mt-2">
                        <span className="font-black text-xs text-[#1B5E20]">Amount Received</span>
                        <span className="font-black text-base text-[#1B5E20]">
                          +Rs{latestPayment.amount.toLocaleString('en-PK')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 px-1 mt-2">
                        <span className="text-[#757575] font-semibold">Remaining Balance</span>
                        <span className="font-black text-[#E57373]">
                          {formatPKR(metrics.due + metrics.previousDue)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-emerald-50/50 rounded-xl text-center space-y-1">
                      <span className="font-bold text-xs text-[#1B5E20] block">
                        No Recent Payment Record Logged
                      </span>
                      <span className="text-[11px] text-[#757575] block">
                        Total payments received for {activeMonthDisplay}: {formatPKR(metrics.received)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Footer */}
              <div className="pt-3 border-t border-[#C8E6C9] text-center">
                <p className="font-extrabold text-xs text-[#1B5E20]">
                  Thank you — {businessName}
                </p>
                <p className="text-[10px] text-[#757575] mt-0.5">
                  Automated Digital Receipt • Dairy Diary App
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM ACTION BUTTONS                                                     */}
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* BOTTOM ACTION BUTTONS                                                     */}
        {/* ========================================================================= */}
        <div className="p-3.5 bg-[#1B4332]/90 backdrop-blur-md border-t border-white/10 flex items-center gap-2 shrink-0">
          {/* 1. Preview Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreenPreview(true)}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/15 active:bg-white/20 text-[#C8E6C9] border border-white/15 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm"
            title="Full Screen Preview"
          >
            <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Preview</span>
          </button>

          {/* 2. Share Sheet / WhatsApp Button */}
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
            title="Share via Sheet / WhatsApp"
          >
            {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{isSharing ? 'Preparing...' : 'Share'}</span>
          </button>

          {/* 3. Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="py-2.5 px-3 bg-emerald-800/80 hover:bg-emerald-700/80 active:bg-emerald-900/80 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm border border-emerald-500/20"
            title="Download PDF Statement"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{isGeneratingPdf ? 'PDF...' : 'PDF'}</span>
          </button>
        </div>

        {/* Fullscreen Overlay Modal if Preview clicked */}
        {isFullscreenPreview && (
          <div 
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-3 animate-in fade-in"
            onClick={() => setIsFullscreenPreview(false)}
          >
            <div 
              className="bg-[#1B4332]/95 backdrop-blur-xl border border-white/20 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-black text-sm text-white">Receipt Full View</span>
                <button
                  type="button"
                  onClick={() => setIsFullscreenPreview(false)}
                  className="p-1 text-[#C8E6C9] hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="text-xs bg-white/10 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap font-sans text-[#E8F5E9] leading-relaxed border border-white/15">
                {shareTextPayload}
              </pre>
              <button
                type="button"
                onClick={() => setIsFullscreenPreview(false)}
                className="w-full py-2.5 bg-white/15 hover:bg-white/25 active:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/20 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}

        {/* Hidden receipt card, always mounted (off-screen) so html2canvas has real
            layout/paint to capture the instant Share is tapped on the Due Receipt tab. */}
        <div style={{ position: 'fixed', top: 0, left: '-9999px', zIndex: -1 }} aria-hidden="true">
          <ReceiptTemplate
            ref={receiptRef}
            variant={templateVariant}
            entries={monthEntriesForReceipt}
            businessName={businessName}
            businessPhone={businessSettings?.phone}
            businessLocation={businessSettings?.location}
            logoUrl={businessSettings?.logoUrl}
            customerName={contact.name}
            customerAddress={contact.address}
            periodTitle={activeMonthDisplay}
            totalMilk={metrics.milk}
            avgRate={avgRate}
            daysTaken={dayStats.daysTaken}
            missedDaysLabel={dayStats.missedDaysLabel}
            totalAmount={metrics.amount}
            totalReceived={metrics.received}
            // Same reasoning as the PDF financials above: the receipt card must show
            // current month + previous carryover combined, not the current-month-only
            // Outstanding figure.
            totalOutstanding={metrics.due + metrics.previousDue}
            currencySymbol={businessSettings?.currencySymbol}
          />
        </div>
      </div>
    </div>
  );
};
