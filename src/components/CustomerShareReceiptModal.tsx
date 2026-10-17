import React, { useState, useMemo } from 'react';
import { ArrowLeft, X, Share2, Download, Eye, Check, FileText, Calendar, Clock, DollarSign, Smartphone } from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord, BusinessSettings } from '../types/dairy';
import { formatPKR, formatLiters, getDeviceTodayDate } from '../utils/formatters';
import { generateSawaaPdfDocument } from '../utils/pdfGenerator';
import { SawaaLogo } from './SawaaLogo';

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

  const businessName = businessSettings?.businessName || 'Dairy Diary';

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

  // Text message payload for sharing
  const shareTextPayload = useMemo(() => {
    if (activeTab === 'due') {
      return `*${businessName} — Due Statement*\n\n` +
        `Customer: *${contact.name}*\n` +
        `Billing Period: *${activeMonthDisplay}*\n` +
        `Date: ${currentTodayStr} | ${currentTimeStr}\n\n` +
        `🥛 Milk Delivered: ${formatLiters(metrics.milk)}\n` +
        `💵 Month Bill: ${formatPKR(metrics.amount)}\n` +
        `✅ Month Received: ${formatPKR(metrics.received)}\n` +
        `📌 Month Balance: ${formatPKR(metrics.due)}\n` +
        `↺ Previous Due: ${formatPKR(metrics.previousDue)}\n` +
        `-------------------------\n` +
        `*TOTAL OUTSTANDING: ${formatPKR(metrics.totalOutstanding)}*\n\n` +
        `Thank you — ${businessName}`;
    } else {
      const amt = latestPayment ? latestPayment.amount : metrics.received;
      const pDate = latestPayment ? latestPayment.date : currentTodayStr;
      const pMethod = latestPayment?.paymentMethod || 'Cash';
      return `*${businessName} — Payment Receipt*\n\n` +
        `Customer: *${contact.name}*\n` +
        `Receipt Date: ${pDate}\n` +
        `Payment Method: ${pMethod}\n\n` +
        `✅ Amount Received: ${formatPKR(amt)}\n` +
        `📌 Remaining Outstanding: ${formatPKR(metrics.totalOutstanding)}\n\n` +
        `Thank you — ${businessName}`;
    }
  }, [activeTab, businessName, contact.name, activeMonthDisplay, currentTodayStr, currentTimeStr, metrics, latestPayment]);

  // Handle Share (Navigator share sheet or WhatsApp fallback)
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${businessName} Receipt - ${contact.name}`,
          text: shareTextPayload,
        });
        if (showToast) showToast('Shared successfully!');
        return;
      } catch (err) {
        // Fall through to WhatsApp / clipboard if share sheet canceled or unsupported
      }
    }

    // Direct WhatsApp share
    const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareTextPayload)}`;
    window.open(url, '_blank');
    if (showToast) showToast('Receipt opened in WhatsApp');
  };

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const monthEntries = entries.filter(
        (e) => e.contactId === contact.id && e.date.startsWith(activeMonthDisplay.substring(0, 7))
      );

      const pdf = await generateSawaaPdfDocument(
        contact,
        monthEntries.length > 0 ? monthEntries : entries.filter((e) => e.contactId === contact.id),
        activeMonthDisplay,
        businessSettings,
        {
          totalMilk: metrics.milk,
          totalAmount: metrics.amount,
          totalReceived: metrics.received,
          periodDue: metrics.due,
          previousDue: metrics.previousDue,
          totalOutstanding: metrics.totalOutstanding,
        }
      );

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

                  {/* Highlighted Total Outstanding Row */}
                  <div className="p-3 bg-[#E8F5E9] rounded-xl border border-[#C8E6C9] flex items-center justify-between mt-3">
                    <span className="font-black text-xs text-[#1B5E20]">Total Outstanding Due</span>
                    <span className="font-black text-base text-[#E57373]">
                      {formatPKR(metrics.totalOutstanding)}
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
                          {formatPKR(metrics.totalOutstanding)}
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
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Share via Sheet / WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Share</span>
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
      </div>
    </div>
  );
};
