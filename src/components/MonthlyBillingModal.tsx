import React, { useState, useMemo } from 'react';
import {
  X,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2,
  FileText,
  User,
  Phone,
  Droplet,
  Send,
  Sparkles
} from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord, BusinessSettings } from '../types/dairy';
import { generateSawaaPdfDocument } from '../utils/pdfGenerator';
import { formatPKR } from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';

interface MonthlyBillingModalProps {
  isOpen: boolean;
  initialMode?: 'permission' | 'queue';
  contacts: Contact[];
  entries: LedgerEntry[];
  paymentRecords?: PaymentRecord[];
  currentMonthKey: string;
  activeMonthDisplay: string;
  businessSettings?: BusinessSettings;
  isPremium?: boolean;
  onClose: () => void;
  onMarkCustomerBilled: (contactId: string, monthKey: string) => void;
  showToast?: (message: string) => void;
}

export const MonthlyBillingModal: React.FC<MonthlyBillingModalProps> = ({
  isOpen,
  initialMode = 'permission',
  contacts,
  entries,
  paymentRecords = [],
  currentMonthKey,
  activeMonthDisplay,
  businessSettings,
  isPremium = false,
  onClose,
  onMarkCustomerBilled,
  showToast,
}) => {
  const [mode, setMode] = useState<'permission' | 'queue'>(initialMode);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [sentCount, setSentCount] = useState<number>(0);

  // Sync mode with initialMode prop when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setCurrentIndex(0);
      setSentCount(0);
    }
  }, [isOpen, initialMode]);

  // Clean phone number for international WhatsApp formatting
  const getCleanPhoneNumber = (rawPhone: string) => {
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('03')) {
      digits = '92' + digits.substring(1);
    }
    return digits;
  };

  // Find all active customers with a saved phone number who have NOT yet been billed for current month
  const pendingCustomers = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.status === 'active' &&
        c.phone &&
        c.phone.trim().length >= 7 &&
        c.lastBilledMonth !== currentMonthKey
    );
  }, [contacts, currentMonthKey]);

  // Total customers already billed this month
  const alreadyBilledCount = useMemo(() => {
    return contacts.filter((c) => c.lastBilledMonth === currentMonthKey).length;
  }, [contacts, currentMonthKey]);

  if (!isOpen) return null;

  // Handle "Not Now" in permission mode
  const handleNotNow = () => {
    try {
      localStorage.setItem('dairy_diary_last_monthly_billing_prompt', currentMonthKey);
    } catch (e) {
      console.warn('Storage write error:', e);
    }
    if (showToast) {
      showToast('Monthly billing postponed. You can trigger it anytime from Settings.');
    }
    onClose();
  };

  // Handle "Send Bills" in permission mode
  const handleApproveSendBills = () => {
    try {
      localStorage.setItem('dairy_diary_last_monthly_billing_prompt', currentMonthKey);
    } catch (e) {
      console.warn('Storage write error:', e);
    }
    setMode('queue');
    setCurrentIndex(0);
  };

  // Current customer in the billing queue
  const currentCustomer = pendingCustomers[currentIndex];

  // Calculate month metrics for the current customer
  const currentCustomerMetrics = () => {
    if (!currentCustomer) {
      return { totalMilk: 0, totalAmount: 0, totalReceived: 0, periodDue: 0, previousDue: 0, totalOutstanding: 0, customerEntries: [] };
    }
    const customerEntries = entries.filter(
      (e) => e.contactId === currentCustomer.id && e.date.startsWith(currentMonthKey)
    );
    const fin = getCustomerMonthDue(currentCustomer, currentMonthKey, entries, paymentRecords);

    return {
      totalMilk: fin.liters,
      totalAmount: fin.amount,
      totalReceived: fin.received,
      periodDue: fin.due,
      previousDue: fin.previousDue,
      totalOutstanding: fin.totalOutstanding,
      customerEntries,
    };
  };

  const { totalMilk, totalAmount, totalReceived, periodDue, previousDue, totalOutstanding, customerEntries } = currentCustomerMetrics();

  // Send WhatsApp bill for current customer
  const handleSendCurrentBill = async () => {
    if (!currentCustomer) return;
    setIsGenerating(true);

    try {
      // 1. Generate customer's monthly PDF bill
      const pdfRes = await generateSawaaPdfDocument(
        currentCustomer,
        customerEntries,
        activeMonthDisplay,
        businessSettings,
        {
          totalMilk,
          totalAmount,
          totalReceived,
          periodDue,
          previousDue,
          totalOutstanding,
        },
        isPremium
      );

      // 2. Prepare short WhatsApp message
      const shortMsg = `Dear ${currentCustomer.name}, please find your monthly milk bill for ${activeMonthDisplay}.\n\nTotal Volume: ${totalMilk.toFixed(2)} Liters\nTotal Bill: Rs ${Math.round(totalAmount).toLocaleString('en-PK')}\nTotal Due: Rs ${Math.round(totalOutstanding).toLocaleString('en-PK')}\nPayment Due By: ${pdfRes.dueDateStr}\n\nThank you!\n- ${businessSettings?.businessName || 'Dairy Diary'}`;

      // 3. Prefer attaching the PDF directly via the native share sheet (Web Share API
      // Level 2). Falls back to downloading the PDF + opening WhatsApp with the text
      // when file sharing isn't supported.
      let sharedViaFile = false;
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfRes.file] })) {
        try {
          await navigator.share({
            files: [pdfRes.file],
            title: `Milk Bill — ${currentCustomer.name} — ${activeMonthDisplay}`,
            text: shortMsg,
          });
          sharedViaFile = true;
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            // User cancelled the native share sheet — don't mark as billed or advance the queue.
            setIsGenerating(false);
            return;
          }
          // otherwise fall through to the download + WhatsApp fallback below
        }
      }

      if (!sharedViaFile) {
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfRes.url;
        downloadLink.download = pdfRes.filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        const cleanPhone = getCleanPhoneNumber(currentCustomer.phone);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shortMsg)}`;
        window.open(waUrl, '_blank');
      }

      // 4. Mark customer as billed for current month
      onMarkCustomerBilled(currentCustomer.id, currentMonthKey);
      setSentCount((prev) => prev + 1);

      if (showToast) {
        showToast(
          sharedViaFile
            ? `Bill shared for ${currentCustomer.name}`
            : `Bill opened in WhatsApp for ${currentCustomer.name}`
        );
      }

      // 5. Move to next customer
      if (currentIndex + 1 < pendingCustomers.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Queue completed!
        setCurrentIndex(pendingCustomers.length);
      }
    } catch (err) {
      console.error('Failed to generate or send bill:', err);
      if (showToast) showToast('Failed to generate PDF bill for this customer');
    } finally {
      setIsGenerating(false);
    }
  };

  // Skip current customer without marking as billed
  const handleSkipCurrentCustomer = () => {
    if (currentIndex + 1 < pendingCustomers.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(pendingCustomers.length);
    }
  };

  const isCompleted = currentIndex >= pendingCustomers.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#F4FBF7] rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* MODE 1: PERMISSION PROMPT                                                 */}
        {/* ========================================================================= */}
        {mode === 'permission' && (
          <div className="p-6 space-y-5 text-center bg-[#F4FBF7]">
            {/* Top Icon */}
            <div className="w-16 h-16 rounded-3xl bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center mx-auto shadow-xs">
              <MessageCircle className="w-8 h-8 stroke-[2.2]" />
            </div>

            {/* Prompt Heading */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-[#163B32] tracking-tight">
                Send Monthly Milk Bills?
              </h3>
              <p className="text-xs sm:text-sm text-[#55756D] leading-relaxed font-medium px-2">
                Send monthly milk bills to all customers now? Bills will be sent via WhatsApp to their saved numbers.
              </p>
            </div>

            {/* Overview Badge */}
            <div className="bg-white rounded-2xl p-3 border border-[#D6E9E1] shadow-xs text-xs font-bold flex items-center justify-around">
              <div>
                <span className="block text-[#55756D] text-[10px] uppercase tracking-wider font-semibold">Active Period</span>
                <span className="text-[#163B32] font-black">{activeMonthDisplay}</span>
              </div>
              <div className="h-6 w-px bg-[#D6E9E1]" />
              <div>
                <span className="block text-[#55756D] text-[10px] uppercase tracking-wider font-semibold">Pending Customers</span>
                <span className="text-[#0B8F68] font-black">{pendingCustomers.length} Ready</span>
              </div>
            </div>

            {/* Two Action Buttons: Not Now | Send Bills */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleNotNow}
                className="w-full py-3.5 bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-[#D6E9E1] text-[#55756D] hover:text-[#163B32] rounded-2xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={handleApproveSendBills}
                className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A58] active:bg-[#066347] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Send Bills</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 2: STEP-BY-STEP BILLING QUEUE                                       */}
        {/* ========================================================================= */}
        {mode === 'queue' && (
          <div className="flex flex-col bg-[#F4FBF7]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#006B52] to-[#1B4332] text-white px-5 py-4 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="text-base font-black tracking-tight text-white">Monthly Milk Billing</h3>
                <p className="text-[11px] text-[#A9DFBF] font-medium mt-0.5">
                  {activeMonthDisplay} · WhatsApp Dispatch
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Pause and close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Queue Content */}
            {!isCompleted && currentCustomer ? (
              <div className="p-5 space-y-4">
                {/* Progress Indicator */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#55756D] mb-1.5">
                    <span>Sending {currentIndex + 1} of {pendingCustomers.length}</span>
                    <span className="text-[#0B8F68] font-black">
                      {Math.round(((currentIndex) / pendingCustomers.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#E1F3EA] h-2 rounded-full overflow-hidden border border-[#D6E9E1]">
                    <div
                      className="bg-[#0B8F68] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${((currentIndex) / pendingCustomers.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Customer Details Card */}
                <div className="bg-white rounded-2xl p-4 space-y-3 border border-[#D6E9E1] shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center font-black text-lg shrink-0 shadow-inner">
                      {currentCustomer.name ? currentCustomer.name.substring(0, 2).toUpperCase() : 'CU'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-[#163B32] truncate">
                        {currentCustomer.name}
                      </h4>
                      <p className="text-xs text-[#55756D] font-semibold flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-[#0B8F68]" />
                        <span>{currentCustomer.phone}</span>
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-[#F4FBF7] rounded-xl p-2 border border-[#D6E9E1] text-center">
                      <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-tight block">Milk</span>
                      <span className="text-xs font-black text-[#163B32] block mt-0.5">{totalMilk.toFixed(1)} L</span>
                    </div>
                    <div className="bg-[#F4FBF7] rounded-xl p-2 border border-[#D6E9E1] text-center">
                      <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-tight block">Bill</span>
                      <span className="text-xs font-black text-[#0B8F68] block mt-0.5">Rs {Math.round(totalAmount).toLocaleString()}</span>
                    </div>
                    <div className="bg-[#F4FBF7] rounded-xl p-2 border border-red-200 text-center">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-tight block">Due</span>
                      <span className="text-xs font-black text-[#E5485D] block mt-0.5">Rs {Math.round(totalOutstanding).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Advisory Notice */}
                <div className="text-[11px] text-[#55756D] bg-[#E1F3EA]/70 border border-[#D6E9E1] rounded-xl p-2.5 flex items-center gap-2 font-medium">
                  <FileText className="w-4 h-4 text-[#0B8F68] shrink-0" />
                  <span>
                    Tap <strong className="text-[#163B32]">Send via WhatsApp</strong> to download the PDF bill and open the chat with pre-filled details.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleSendCurrentBill}
                    className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A58] active:bg-[#066347] disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating Bill...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                        <span>Send via WhatsApp</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={handleSkipCurrentCustomer}
                      className="w-full py-2.5 bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-[#D6E9E1] text-[#55756D] hover:text-[#163B32] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                    >
                      Skip Customer
                    </button>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={onClose}
                      className="w-full py-2.5 border border-[#D6E9E1] bg-white hover:bg-emerald-50 text-[#55756D] hover:text-[#163B32] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                    >
                      Pause &amp; Resume
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* All Caught Up / Queue Finished Screen */
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-[#163B32] tracking-tight">
                    All Bills Processed!
                  </h4>
                  <p className="text-xs text-[#55756D] mt-1 max-w-xs mx-auto font-medium">
                    {sentCount > 0
                      ? `Successfully sent ${sentCount} monthly bills for ${activeMonthDisplay}.`
                      : `All active customers are already marked as billed for ${activeMonthDisplay}.`}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A58] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                  >
                    DONE
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
