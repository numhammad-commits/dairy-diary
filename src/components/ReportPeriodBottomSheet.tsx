import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  FileSpreadsheet, 
  Calendar, 
  Infinity, 
  CalendarRange, 
  Check, 
  Loader2, 
  AlertCircle,
  Share2,
  Printer,
  ExternalLink,
  ChevronRight,
  Download,
  QrCode,
  MessageCircle,
  Mail,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord, BusinessSettings } from '../types/dairy';
import { formatPKR, getDeviceTodayDate } from '../utils/formatters';
import { generateSawaaPdfDocument, GeneratedPdfResult } from '../utils/pdfGenerator';
import { getCustomerMonthDue } from '../utils/calculations';
import { getEnabledPaymentAccounts } from '../utils/paymentAccounts';
import { SawaaLogo } from './SawaaLogo';

export type ReportFormat = 'pdf' | 'excel';
export type ReportPeriodType = 'selected_month' | 'last_3_months' | 'all_time' | 'custom_range';

interface ReportPeriodBottomSheetProps {
  contact: Contact;
  entries: LedgerEntry[];
  paymentRecords?: PaymentRecord[];
  currentMonthKey: string; // e.g. "2026-10"
  activeMonthDisplay: string; // e.g. "October 2026"
  businessSettings?: BusinessSettings;
  isPremium?: boolean;
  onOpenPremium?: () => void;
  onClose: () => void;
  showToast?: (message: string) => void;
}

export const ReportPeriodBottomSheet: React.FC<ReportPeriodBottomSheetProps> = ({
  contact,
  entries,
  paymentRecords = [],
  currentMonthKey,
  activeMonthDisplay,
  businessSettings,
  isPremium = false,
  onOpenPremium,
  onClose,
  showToast,
}) => {
  // Step State: 'select_period' | 'report_ready'
  const [currentStep, setCurrentStep] = useState<'select_period' | 'report_ready'>('select_period');

  // Format Selection: 'pdf' (selected by default) or 'excel'
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf');
  
  // Period Selection: 'selected_month' | 'last_3_months' | 'all_time' | 'custom_range'
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriodType>('selected_month');

  // Custom Range Dates
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentMonthKey}-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(getDeviceTodayDate);

  // Loading & Error States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PDF Preview Document View State (when user clicks "Open PDF")
  const [showFullPdfPreview, setShowFullPdfPreview] = useState<boolean>(false);

  // Sub-view for sharing options (WhatsApp, Email, SMS, Device Share)
  const [showSharePicker, setShowSharePicker] = useState<boolean>(false);

  // Stored Generated Data & Binary PDF File Result
  const [generatedPdfResult, setGeneratedPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [reportData, setReportData] = useState<{
    periodTitle: string;
    periodEntries: LedgerEntry[];
    totalMilk: number;
    totalAmount: number;
    totalReceived: number;
    periodDue: number;
    previousDue: number;
    totalOutstanding: number;
    billDateStr: string;
    dueDateStr: string;
  } | null>(null);

  // Compute 3 Calendar Months Start Date dynamically based on active month
  const last3MonthsRange = useMemo(() => {
    const [yearStr, monthStr] = currentMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    let startMonth = month - 2;
    let startYear = year;
    if (startMonth <= 0) {
      startMonth += 12;
      startYear -= 1;
    }
    const startStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    const endStr = `${currentMonthKey}-31`;
    return { startStr, endStr };
  }, [currentMonthKey]);

  // Filter entries for this customer across the selected period
  const filterEntriesForPeriod = () => {
    const customerAllEntries = entries.filter((e) => e.contactId === contact.id);

    if (selectedPeriod === 'selected_month') {
      return customerAllEntries.filter((e) => e.date.startsWith(currentMonthKey));
    }
    if (selectedPeriod === 'last_3_months') {
      return customerAllEntries.filter(
        (e) => e.date >= last3MonthsRange.startStr && e.date <= last3MonthsRange.endStr
      );
    }
    if (selectedPeriod === 'all_time') {
      return customerAllEntries;
    }
    if (selectedPeriod === 'custom_range') {
      return customerAllEntries.filter(
        (e) => e.date >= customStartDate && e.date <= customEndDate
      );
    }
    return customerAllEntries;
  };

  // Filter this customer's standalone payments (Receive Payment records) for the selected
  // period, so PDF/WhatsApp/SMS/report totals include them the same way getCustomerMonthDue does.
  const filterPaymentsForPeriod = () => {
    const customerAllPayments = paymentRecords || [];

    if (selectedPeriod === 'selected_month') {
      return customerAllPayments.filter((p) =>
        p.billingMonth ? p.billingMonth === currentMonthKey : p.date.startsWith(currentMonthKey)
      );
    }
    if (selectedPeriod === 'all_time') {
      return customerAllPayments;
    }
    // last_3_months & custom_range: compare by date range. When a payment carries a
    // billingMonth, use that month's first day as its effective date (same precedence
    // as the canonical billingMonth rule) so a payment is placed by the month it was
    // billed for, not the day it happened to be recorded.
    const rangeStart = selectedPeriod === 'last_3_months' ? last3MonthsRange.startStr : customStartDate;
    const rangeEnd = selectedPeriod === 'last_3_months' ? last3MonthsRange.endStr : customEndDate;
    return customerAllPayments.filter((p) => {
      const effectiveDate = p.billingMonth ? `${p.billingMonth}-01` : p.date;
      return effectiveDate >= rangeStart && effectiveDate <= rangeEnd;
    });
  };

  // Generate Report Action
  const handleGenerate = () => {
    setErrorMessage(null);

    // Validate Custom Range if chosen
    if (selectedPeriod === 'custom_range') {
      if (!customStartDate || !customEndDate || customStartDate > customEndDate) {
        setErrorMessage('Please select a valid date range (Start Date must be before or equal to End Date).');
        return;
      }
    }

    const filtered = filterEntriesForPeriod();
    if (filtered.length === 0) {
      setErrorMessage('No transactions found for the selected period. Please change period or add entries.');
      return;
    }

    setIsGenerating(true);

    setTimeout(async () => {
      setIsGenerating(false);

      // Period Title
      let periodTitle = activeMonthDisplay;
      if (selectedPeriod === 'last_3_months') periodTitle = 'Last 3 Months';
      if (selectedPeriod === 'all_time') periodTitle = 'All Time History';
      if (selectedPeriod === 'custom_range') periodTitle = `${customStartDate} to ${customEndDate}`;

      // Carryover previous due, computed dynamically from entries & payments. This call also
      // supplies the exact selected_month totals below, so it's the only call site needed.
      const fin = getCustomerMonthDue(contact, currentMonthKey, entries, paymentRecords || []);
      const previousDue = fin.previousDue;

      // Financial calculations preserving historical entry rates.
      // For "selected_month" (the common case), reuse getCustomerMonthDue's own totals so this
      // report can never drift from Home / ContactDetail / MonthlyBilling for the same customer
      // + month. The other periods span multiple months, which getCustomerMonthDue doesn't
      // support, so they're computed from the period-filtered entries and payments using the
      // same billingMonth-aware rule and the same Math.max(0, ...) floor.

      let totalMilk: number;
      let totalAmount: number;
      let totalReceived: number;
      let periodDue: number;

      if (selectedPeriod === 'selected_month') {
        totalMilk = fin.liters;
        totalAmount = fin.amount;
        totalReceived = fin.received;
        periodDue = fin.due;
      } else {
        const periodPayments = filterPaymentsForPeriod();
        const paymentsReceived = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        totalMilk = filtered.reduce((sum, e) => sum + e.liters, 0);
        totalAmount = filtered.reduce((sum, e) => sum + e.totalAmount, 0);
        totalReceived = filtered.reduce((sum, e) => sum + e.receivedAmount, 0) + paymentsReceived;
        periodDue = Math.max(0, totalAmount - totalReceived);
      }

      const totalOutstanding = Math.max(0, periodDue + previousDue);

      if (selectedFormat === 'excel') {
        // Generate real CSV / XLSX spreadsheet download
        const headers = [
          'Date',
          'Timestamp',
          'Customer Name',
          'Role',
          'Shift',
          'Milk Category',
          'Quantity (L)',
          'Rate (Rs/L)',
          'Total Amount (Rs)',
          'Received (Rs)',
          'Due (Rs)'
        ];

        const rows = filtered.map((e) => [
          e.date,
          e.timestamp,
          `"${contact.name.replace(/"/g, '""')}"`,
          contact.role === 'buyer' ? 'Customer (Sell Milk)' : 'Farmer (Buy Milk)',
          e.shift.toUpperCase(),
          e.milkType || 'Other',
          e.liters.toFixed(2),
          e.ratePerLiter.toFixed(2),
          e.totalAmount,
          e.receivedAmount,
          e.dueAmount
        ]);

        const summaryRows = [
          [],
          ['FINANCIAL SUMMARY'],
          ['Customer Name', `"${contact.name}"`],
          ['Report Period', `"${periodTitle}"`],
          ['Total Volume (L)', totalMilk.toFixed(2)],
          ['Total Amount (Rs)', totalAmount],
          ['Total Received (Rs)', totalReceived],
          ['Period Due (Rs)', periodDue],
          ['Previous Carryover Balance (Rs)', previousDue],
          ['Total Outstanding (Rs)', totalOutstanding]
        ];

        const csvContent =
          'data:text/csv;charset=utf-8,' +
          [headers.join(','), ...rows.map((r) => r.join(',')), ...summaryRows.map((r) => r.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute(
          'download',
          `Dairy_Diary_${contact.name.replace(/\s+/g, '_')}_${periodTitle.replace(/\s+/g, '_')}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (showToast) {
          showToast(`Excel report generated for ${contact.name}!`);
        }
        onClose();
      } else {
        // Generate actual jsPDF binary file document with real scan-ready QR code
        try {
          const pdfRes = await generateSawaaPdfDocument(
            contact,
            filtered,
            periodTitle,
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

          setGeneratedPdfResult(pdfRes);
          setReportData({
            periodTitle,
            periodEntries: filtered,
            totalMilk,
            totalAmount,
            totalReceived,
            periodDue,
            previousDue,
            totalOutstanding,
            billDateStr: pdfRes.billDateStr,
            dueDateStr: pdfRes.dueDateStr,
          });

          // Transition smoothly to Step 2: "PDF Report Ready" bottom sheet!
          setCurrentStep('report_ready');
        } catch (err) {
          console.error('PDF generation error:', err);
          if (showToast) showToast('Failed to generate PDF document');
        }
      }
    }, 450);
  };

  // Step 2 Actions
  // Helper to trigger direct local download of the generated PDF file
  const triggerPdfDownload = () => {
    if (!generatedPdfResult) return;
    try {
      const downloadLink = document.createElement('a');
      downloadLink.href = generatedPdfResult.url;
      downloadLink.download = generatedPdfResult.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.warn('PDF auto-download error:', e);
    }
  };

  const getCleanPhoneNumber = (rawPhone: string) => {
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('03')) {
      digits = '92' + digits.substring(1);
    }
    return digits;
  };

  // WhatsApp Share Handler: Pre-selects number, attaches PDF, pre-fills message
  const handleShareWhatsApp = async () => {
    if (!reportData || !generatedPdfResult) return;

    // Auto-trigger PDF download so customer has the bill file ready on device
    triggerPdfDownload();

    const shortMsg = `Dear ${contact.name}, please find your milk bill for ${reportData.periodTitle}.\n\nTotal Volume: ${reportData.totalMilk.toFixed(2)} Liters\nTotal Bill: Rs ${Math.round(reportData.totalAmount).toLocaleString('en-PK')}\nTotal Outstanding Due: Rs ${Math.round(reportData.totalOutstanding).toLocaleString('en-PK')}\nPayment Due By: ${reportData.dueDateStr}\n\nThank you!\n- ${businessSettings?.businessName || 'Dairy Diary'}`;

    // On mobile devices where Web Share API Level 2 is supported with file sharing
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [generatedPdfResult.file] })) {
      try {
        await navigator.share({
          files: [generatedPdfResult.file],
          title: `Milk Bill — ${contact.name} — ${reportData.periodTitle}`,
          text: shortMsg,
        });
        if (showToast) showToast('Statement shared via device share sheet');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Direct WhatsApp Web / App intent
    const cleanPhone = getCleanPhoneNumber(contact.phone || '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shortMsg)}`;
    window.open(waUrl, '_blank');
    if (showToast) {
      showToast(`Opening WhatsApp for ${contact.name} (PDF downloaded)`);
    }
  };

  // Email Share Handler: Pre-fills email, attaches PDF, pre-fills subject and body
  const handleShareEmail = async () => {
    if (!reportData || !generatedPdfResult) return;

    triggerPdfDownload();

    const subject = `Milk Bill — ${contact.name} — ${reportData.periodTitle}`;
    const emailBody = `Dear ${contact.name},\n\nPlease find attached your milk bill for ${reportData.periodTitle}.\n\nAccount Summary:\n- Customer Name: ${contact.name}\n- Period: ${reportData.periodTitle}\n- Total Milk Volume: ${reportData.totalMilk.toFixed(2)} Liters\n- Period Amount: Rs ${Math.round(reportData.totalAmount).toLocaleString('en-PK')}\n- Previous Balance: Rs ${Math.round(reportData.previousDue).toLocaleString('en-PK')}\n- Total Outstanding Due: Rs ${Math.round(reportData.totalOutstanding).toLocaleString('en-PK')}\n- Due Date: ${reportData.dueDateStr}\n\nThank you for your business!\n${businessSettings?.businessName || 'Dairy Diary'}`;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [generatedPdfResult.file] })) {
      try {
        await navigator.share({
          files: [generatedPdfResult.file],
          title: subject,
          text: emailBody,
        });
        if (showToast) showToast('Statement shared successfully');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    const mailtoUrl = `mailto:${contact.email ? encodeURIComponent(contact.email) : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');
    if (showToast) {
      showToast(contact.email ? `Opening email to ${contact.email}` : 'Opening email client (PDF downloaded)');
    }
  };

  // SMS Share Handler: Pre-fills phone number and short message
  const handleShareSms = () => {
    if (!reportData) return;

    const smsPhone = contact.phone ? contact.phone.replace(/[^0-9+]/g, '') : '';
    const smsBody = `Dear ${contact.name}, your milk bill for ${reportData.periodTitle} is Rs ${Math.round(reportData.totalOutstanding).toLocaleString('en-PK')} (Milk: ${reportData.totalMilk.toFixed(2)}L). Due by ${reportData.dueDateStr}. Thank you! - ${businessSettings?.businessName || 'Dairy Diary'}`;

    const smsUrl = `sms:${smsPhone}?body=${encodeURIComponent(smsBody)}`;
    window.open(smsUrl, '_blank');
    if (showToast) {
      showToast(`Opening SMS for ${contact.name}`);
    }
  };

  // Generic Device Share Sheet Handler
  const handleShareDevice = async () => {
    if (!reportData || !generatedPdfResult) return;

    const summaryText = `*DAIRY DIARY — CUSTOMER STATEMENT*\nCustomer: ${contact.name}\nPeriod: ${reportData.periodTitle}\nTotal Milk: ${reportData.totalMilk.toFixed(2)} L\nTotal Outstanding: Rs ${Math.round(reportData.totalOutstanding).toLocaleString('en-PK')}\nDue Date: ${reportData.dueDateStr}`;

    if (navigator.share) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [generatedPdfResult.file] })) {
          await navigator.share({
            files: [generatedPdfResult.file],
            title: `Dairy Diary Statement - ${contact.name}`,
            text: summaryText,
          });
          if (showToast) showToast('Shared via device share sheet');
          return;
        } else {
          await navigator.share({
            title: `Dairy Diary Statement - ${contact.name}`,
            text: summaryText,
          });
          if (showToast) showToast('Shared successfully');
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    triggerPdfDownload();
    if (showToast) showToast('PDF downloaded to your device');
  };

  const handlePrintPdf = () => {
    if (!generatedPdfResult) {
      window.print();
      return;
    }
    if (showToast) showToast('Opening system print dialog...');
    // Create dedicated print frame for PDF document
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = generatedPdfResult.url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
    };
  };

  const handleOpenPdf = () => {
    setShowFullPdfPreview(true);
  };

  return (
    <>
      {/* Dimmed Background Overlay */}
      <div 
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
        onClick={onClose}
      >
        {/* ========================================================================= */}
        {/* STAGE 1: "SELECT REPORT PERIOD" BOTTOM SHEET                              */}
        {/* ========================================================================= */}
        {currentStep === 'select_period' && (
          <div 
            className="w-full max-w-md bg-white rounded-t-[32px] shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200 border-t border-slate-100 flex flex-col max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-0.5" />

            {/* Sheet Title: Centered, Large, Bold, Dark Charcoal */}
            <div className="text-center pt-1 pb-1">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Select Report Period
              </h2>
            </div>

            {/* PDF / Excel Format Switch (Segmented Pills) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* PDF Button */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedFormat === 'pdf'
                    ? 'bg-[#e1f0fe] border-2 border-[#a4cdfe] text-[#0066cc] font-black shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50'
                }`}
              >
                <FileText className="w-5 h-5 stroke-[2.2]" />
                <span className="text-sm">PDF</span>
              </button>

              {/* Excel Button */}
              <button
                type="button"
                onClick={() => setSelectedFormat('excel')}
                className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedFormat === 'excel'
                    ? 'bg-[#e1f0fe] border-2 border-[#a4cdfe] text-[#0066cc] font-black shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
                <span className="text-sm">Excel</span>
              </button>
            </div>

            {/* Thin Horizontal Divider */}
            <div className="border-t border-slate-100 my-1" />

            {/* Error Banner if invalid selection */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2 text-xs font-bold text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Four Selectable Report Period Rows */}
            <div className="space-y-2.5">
              {/* 1. Selected Month (Dynamic: e.g. October 2026) */}
              <div
                onClick={() => setSelectedPeriod('selected_month')}
                className={`p-3.5 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
                  selectedPeriod === 'selected_month'
                    ? 'bg-[#f0f7ff] border-blue-400 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
                    <Calendar className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block leading-tight">
                      Selected Month ({activeMonthDisplay})
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                      Current active monthly ledger log
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  selectedPeriod === 'selected_month' 
                    ? 'bg-blue-600 text-white' 
                    : 'border-2 border-slate-300 bg-white'
                }`}>
                  {selectedPeriod === 'selected_month' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 2. Last 3 Months */}
              <div
                onClick={() => setSelectedPeriod('last_3_months')}
                className={`p-3.5 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
                  selectedPeriod === 'last_3_months'
                    ? 'bg-[#f0f7ff] border-blue-400 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                    <Calendar className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block leading-tight">
                      Last 3 Months
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                      Comprehensive 90-day seasonal accounting
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  selectedPeriod === 'last_3_months' 
                    ? 'bg-blue-600 text-white' 
                    : 'border-2 border-slate-300 bg-white'
                }`}>
                  {selectedPeriod === 'last_3_months' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 3. All Time */}
              <div
                onClick={() => setSelectedPeriod('all_time')}
                className={`p-3.5 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
                  selectedPeriod === 'all_time'
                    ? 'bg-[#f0f7ff] border-blue-400 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 shrink-0">
                    <Infinity className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block leading-tight">
                      All Time
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                      Complete customer transaction history
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  selectedPeriod === 'all_time' 
                    ? 'bg-blue-600 text-white' 
                    : 'border-2 border-slate-300 bg-white'
                }`}>
                  {selectedPeriod === 'all_time' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 4. Custom Range */}
              <div
                onClick={() => setSelectedPeriod('custom_range')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedPeriod === 'custom_range'
                    ? 'bg-[#f0f7ff] border-blue-400 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600 shrink-0">
                      <CalendarRange className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block leading-tight">
                        Custom Range
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                        Select specific start and end dates
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    selectedPeriod === 'custom_range' 
                      ? 'bg-blue-600 text-white' 
                      : 'border-2 border-slate-300 bg-white'
                  }`}>
                    {selectedPeriod === 'custom_range' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Date Inputs when Custom Range is active */}
                {selectedPeriod === 'custom_range' && (
                  <div className="grid grid-cols-2 gap-2.5 pt-3 mt-2 border-t border-teal-200/60" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="block text-[10px] font-bold text-teal-800 uppercase tracking-wider mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-teal-800 uppercase tracking-wider mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Final Action Button: GENERATE PDF / GENERATE EXCEL */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="w-full py-3.5 bg-[#1E5631] hover:bg-emerald-800 active:bg-emerald-950 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm tracking-wider uppercase shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating {selectedFormat.toUpperCase()}...</span>
                  </>
                ) : (
                  <span>GENERATE {selectedFormat.toUpperCase()}</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: "PDF REPORT READY" BOTTOM SHEET (Screenshot 131724.jpg)           */}
        {/* ========================================================================= */}
        {currentStep === 'report_ready' && (
          <div 
            className="w-full max-w-md bg-white rounded-t-[32px] shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200 border-t border-slate-100 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-2" />

            {!showSharePicker ? (
              <>
                {/* Sheet Title: PDF Report Ready */}
                <div className="text-center pt-0 pb-1">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    PDF Report Ready
                  </h2>
                </div>

                {/* 3 Action Rows exactly matching reference screenshot */}
                <div className="divide-y divide-slate-100">
                  {/* 1. Share PDF */}
                  <button
                    type="button"
                    onClick={() => setShowSharePicker(true)}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shrink-0">
                      <Share2 className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-extrabold text-slate-900 block">
                        Share PDF
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Send statement via WhatsApp, Email, or SMS
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 2. Print PDF */}
                  <button
                    type="button"
                    onClick={handlePrintPdf}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shrink-0">
                      <Printer className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-extrabold text-slate-900 block">
                        Print PDF
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Send to connected printer or save as PDF
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 3. Open PDF */}
                  <button
                    type="button"
                    onClick={handleOpenPdf}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shrink-0">
                      <ExternalLink className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-extrabold text-slate-900 block">
                        Open PDF
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        View complete statement on device
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Premium Watermark Status / Upgrade Banner */}
                {!isPremium ? (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <span>👑 Upgrade to Premium</span>
                      </span>
                      <span className="text-[11px] text-amber-800/90 font-medium block mt-0.5 leading-tight">
                        Remove watermark from your PDFs and unlock clean, unbranded statements.
                      </span>
                    </div>
                    {onOpenPremium && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenPremium();
                        }}
                        className="px-3 py-1.5 bg-[#1E5631] hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow-2xs cursor-pointer active:scale-95 transition-all"
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center text-xs font-bold text-emerald-900 flex items-center justify-center gap-1.5">
                    <span>★ Premium License Active · Watermark Removed</span>
                  </div>
                )}

                {/* Bottom Button: CLOSE */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-2xl font-extrabold text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    CLOSE
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Sub-Header: Back + Title */}
                <div className="flex items-center justify-between pt-0 pb-1">
                  <button
                    type="button"
                    onClick={() => setShowSharePicker(false)}
                    className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="Back to options"
                  >
                    <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex-1 text-center pr-6">
                    Share Milk Bill
                  </h2>
                </div>
                <p className="text-xs text-slate-500 text-center -mt-2">
                  Send statement directly to <strong className="text-slate-800 font-bold">{contact.name}</strong>
                </p>

                {/* 4 Direct Share Options */}
                <div className="divide-y divide-slate-100">
                  {/* Option 1: WhatsApp */}
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shrink-0">
                      <MessageCircle className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-extrabold text-slate-900 block truncate">
                        WhatsApp
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block truncate">
                        {contact.phone ? `Send to ${contact.phone}` : 'Open WhatsApp with pre-filled bill'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>

                  {/* Option 2: Email */}
                  <button
                    type="button"
                    onClick={handleShareEmail}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shrink-0">
                      <Mail className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-extrabold text-slate-900 block truncate">
                        Email
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block truncate">
                        {contact.email ? `Send to ${contact.email}` : 'Open email client with bill & PDF'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>

                  {/* Option 3: SMS */}
                  <button
                    type="button"
                    onClick={handleShareSms}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shrink-0">
                      <MessageSquare className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-extrabold text-slate-900 block truncate">
                        SMS
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block truncate">
                        {contact.phone ? `Send SMS summary to ${contact.phone}` : 'Open SMS app with bill summary'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>

                  {/* Option 4: Generic Share */}
                  <button
                    type="button"
                    onClick={handleShareDevice}
                    className="w-full py-3.5 px-2 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform shrink-0">
                      <Share2 className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-extrabold text-slate-900 block truncate">
                        Device Share Sheet
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block truncate">
                        Use system menu or nearby sharing
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                </div>

                {/* Back Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSharePicker(false)}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-2xl font-extrabold text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    BACK TO OPTIONS
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FULL PROFESSIONAL A4 INVOICE DOCUMENT VIEWER (FOR "OPEN PDF" & PRINTING)  */}
      {/* ========================================================================= */}
      {showFullPdfPreview && reportData && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm select-none"
          onClick={() => setShowFullPdfPreview(false)}
        >
          <div 
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Toolbar */}
            <div className="bg-[#1E5631] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-sm tracking-tight truncate">
                  Dairy Diary Statement · {contact.name} ({reportData.periodTitle})
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {generatedPdfResult && (
                  <a
                    href={generatedPdfResult.url}
                    download={generatedPdfResult.filename}
                    className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Download Official PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save PDF</span>
                  </a>
                )}
                <button
                  onClick={handlePrintPdf}
                  className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowFullPdfPreview(false)}
                  className="p-1 hover:bg-emerald-800 rounded-xl cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Content View: High-Resolution A4 Statement */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-slate-800 space-y-4 bg-[#f8faf9] text-xs relative">
              
              {/* Free Version Watermark */}
              {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                  <SawaaLogo variant="watermark" />
                </div>
              )}

              {/* 1. Company Header Banner with Logo */}
              <div className="relative z-10 bg-[#1E5631] text-white p-4 rounded-2xl flex items-start justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs border border-white/20">
                    {businessSettings?.logoUrl ? (
                      <img src={businessSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white flex items-center justify-center text-xl">🥛</div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight leading-none uppercase">
                      {businessSettings?.businessName || 'Dairy Farm'}
                    </h2>
                    <p className="text-xs font-bold text-emerald-200 mt-1">
                      Fresh Milk Distribution
                    </p>
                    <p className="text-[10px] text-emerald-300/80 font-medium">
                      Dairy Diary · Developed by SAWAA Networking
                    </p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-emerald-100 space-y-0.5 font-medium">
                  {businessSettings?.phone && (
                    <p className="font-bold text-white">Phone: {businessSettings.phone}</p>
                  )}
                  {businessSettings?.location && (
                    <p>{businessSettings.location}</p>
                  )}
                  <p className="text-[10px] text-emerald-300">Generated: {reportData.billDateStr}</p>
                  {isPremium ? (
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[9px] font-black uppercase">
                      ★ Premium Licensed
                    </span>
                  ) : (
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded bg-white/10 text-emerald-200 text-[9px] font-bold uppercase">
                      Free Edition
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Customer Metadata Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    {contact.role === 'seller' ? 'Seller Account' : 'Customer Account'}
                  </span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">
                    {contact.name}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold block">
                    Phone: {contact.phone || 'N/A'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Address: {contact.address || 'Local Distribution'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Statement Details
                  </span>
                  <span className="text-xs font-black text-[#1E5631] uppercase block mt-0.5">
                    {contact.role === 'seller' ? 'Milk Purchase' : 'Milk Sale'}
                  </span>
                  <span className="text-xs font-bold text-slate-700 block mt-0.5">
                    Period: {reportData.periodTitle}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Category: {contact.milkTypePref?.toUpperCase() || 'OTHER'} · Rate: {businessSettings?.currencySymbol || 'Rs.'}{contact.defaultRate || 240}/L
                  </span>
                </div>
              </div>

              {/* 3. 4 Account Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Total Milk</span>
                  <span className="text-sm sm:text-base font-black text-emerald-950 block mt-0.5">
                    {reportData.totalMilk.toFixed(2)} L
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Total Amount</span>
                  <span className="text-sm sm:text-base font-black text-emerald-950 block mt-0.5">
                    {businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="bg-teal-50/70 p-3 rounded-2xl border border-teal-200 text-center">
                  <span className="text-[10px] font-extrabold text-teal-800 uppercase block">Total Received</span>
                  <span className="text-sm sm:text-base font-black text-teal-950 block mt-0.5">
                    {businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalReceived).toLocaleString()}
                  </span>
                </div>
                <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 text-center">
                  <span className="text-[10px] font-extrabold text-rose-800 uppercase block">Remaining Due</span>
                  <span className="text-sm sm:text-base font-black text-rose-600 block mt-0.5">
                    {businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalOutstanding).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 4. Itemized Transaction Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black text-slate-800 px-1">
                  <span>Transaction Ledger ({reportData.periodTitle})</span>
                  <span>{reportData.periodEntries.length} Records</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#1E5631] text-white font-bold">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-2">Time</th>
                        <th className="py-2.5 px-2">Shift</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-2 text-right">Milk (L)</th>
                        <th className="py-2.5 px-2 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.periodEntries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-900">{e.date}</td>
                          <td className="py-2 px-2 text-slate-500 font-medium">{e.timestamp || '-'}</td>
                          <td className="py-2 px-2 uppercase text-[10px] font-bold text-slate-600">{e.shift}</td>
                          <td className="py-2 px-2 text-slate-600 font-semibold">{e.milkType || 'Other'}</td>
                          <td className="py-2 px-2 text-right font-black text-slate-900">{e.liters.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right text-slate-600">{businessSettings?.currencySymbol || 'Rs.'}{e.ratePerLiter}</td>
                          <td className="py-2 px-3 text-right font-black text-[#1E5631]">{businessSettings?.currencySymbol || 'Rs.'}{Math.round(e.totalAmount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50/80 border-t-2 border-emerald-300 font-black text-xs text-emerald-950">
                        <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wide">Period Total</td>
                        <td className="py-2.5 px-2 text-right">{reportData.totalMilk.toFixed(2)} L</td>
                        <td className="py-2.5 px-2 text-right">-</td>
                        <td className="py-2.5 px-3 text-right">{businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalAmount).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 5. Carryover & Balance Reconciliation */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Previous Carryover Debt:</span>
                  <span className="font-bold text-slate-900">+{businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.previousDue).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Current Period Bill:</span>
                  <span className="font-bold text-slate-900">+{businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Payments Cleared:</span>
                  <span className="font-bold text-emerald-700">-{businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalReceived).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-black text-sm text-rose-600">
                  <span>TOTAL OUTSTANDING BALANCE:</span>
                  <span>{businessSettings?.currencySymbol || 'Rs.'} {Math.round(reportData.totalOutstanding).toLocaleString()}</span>
                </div>
              </div>

              {/* 6. Payment Details & QR Code Section (Enabled Accounts Only) */}
              {(() => {
                const previewEnabledAccounts = getEnabledPaymentAccounts(businessSettings);
                if (previewEnabledAccounts.length === 0) {
                  return (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                      <h4 className="text-xs font-black text-[#1E5631] uppercase tracking-wide">
                        PAYMENT DETAILS (RECEIVING ACCOUNTS)
                      </h4>
                      <p className="text-[11px] text-slate-500 italic mt-1 font-medium">
                        No payment account has been enabled for this business.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h4 className="text-xs font-black text-[#1E5631] uppercase tracking-wide">
                        PAYMENT DETAILS (RECEIVING ACCOUNTS)
                      </h4>
                      <div className="space-y-1">
                        {previewEnabledAccounts.map((acc) => (
                          <div key={acc.id} className="text-[11px] text-slate-700">
                            <span className="font-extrabold text-[#1E5631]">{acc.name}:</span>{' '}
                            <span className="font-semibold">{acc.accountTitle}</span>
                            <span className="text-slate-600 font-mono ml-1.5">
                              ({acc.primaryDetail}{acc.secondaryDetail ? ` · ${acc.secondaryDetail}` : ''})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* QR Code Container matching enabled account */}
                    <div className="bg-slate-50 border border-emerald-200 p-2.5 rounded-2xl text-center flex flex-col items-center shrink-0">
                      <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-200 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full fill-[#1E5631]">
                          <rect x="5" y="5" width="26" height="26" rx="2" />
                          <rect x="9" y="9" width="18" height="18" fill="white" />
                          <rect x="13" y="13" width="10" height="10" />
                          <rect x="69" y="5" width="26" height="26" rx="2" />
                          <rect x="73" y="9" width="18" height="18" fill="white" />
                          <rect x="77" y="13" width="10" height="10" />
                          <rect x="5" y="69" width="26" height="26" rx="2" />
                          <rect x="9" y="73" width="18" height="18" fill="white" />
                          <rect x="13" y="77" width="10" height="10" />
                          <rect x="36" y="8" width="6" height="6" />
                          <rect x="46" y="14" width="8" height="6" />
                          <rect x="58" y="8" width="6" height="8" />
                          <rect x="36" y="24" width="8" height="6" />
                          <rect x="48" y="24" width="6" height="6" />
                          <rect x="8" y="38" width="6" height="8" />
                          <rect x="20" y="42" width="8" height="6" />
                          <rect x="34" y="36" width="10" height="8" />
                          <rect x="50" y="36" width="8" height="8" />
                          <rect x="64" y="38" width="10" height="6" />
                          <rect x="80" y="38" width="12" height="6" />
                          <rect x="8" y="52" width="8" height="6" />
                          <rect x="22" y="54" width="6" height="8" />
                          <rect x="34" y="48" width="8" height="10" />
                          <rect x="48" y="50" width="10" height="8" />
                          <rect x="64" y="50" width="8" height="8" />
                          <rect x="78" y="48" width="8" height="12" />
                          <rect x="36" y="66" width="8" height="8" />
                          <rect x="48" y="66" width="8" height="6" />
                          <rect x="62" y="64" width="10" height="8" />
                          <rect x="78" y="66" width="10" height="8" />
                          <rect x="36" y="78" width="6" height="12" />
                          <rect x="48" y="80" width="8" height="10" />
                          <rect x="62" y="78" width="8" height="8" />
                          <rect x="76" y="80" width="14" height="8" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-black text-[#1E5631] uppercase mt-1">
                        {previewEnabledAccounts.length === 1
                          ? `Scan to Pay (${previewEnabledAccounts[0].name.toUpperCase()})`
                          : 'Scan to Pay'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* 7. 7-Day Payment Terms Notice Box */}
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-black text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[10px] uppercase tracking-wider">
                    Notice
                  </span>
                  <span>PAYMENT TERMS</span>
                </div>
                <p className="text-xs font-semibold">
                  After the bill is generated, the customer has 7 days to pay the outstanding dues.
                </p>
                <div className="flex items-center gap-4 text-[11px] font-extrabold pt-1 text-amber-800">
                  <span>Bill Generated: {reportData.billDateStr}</span>
                  <span>·</span>
                  <span>Payment Due By: {reportData.dueDateStr} (7 Days)</span>
                </div>
              </div>

              {/* 8. Dual Signatures Section */}
              <div className="grid grid-cols-2 gap-8 pt-4 pb-2">
                <div className="text-center space-y-1">
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto pb-6" />
                  <span className="text-xs font-extrabold text-slate-800 block">Authorized Signature</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {businessSettings?.businessName || 'Authorized Distributor'}
                  </span>
                </div>
                <div className="text-center space-y-1">
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto pb-6" />
                  <span className="text-xs font-extrabold text-slate-800 block">Customer Signature</span>
                  <span className="text-[10px] text-slate-500 font-medium">{contact.name}</span>
                </div>
              </div>

              {/* 9. Footer */}
              <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400 font-medium">
                {businessSettings?.businessName || 'Dairy Farm'} — Fresh Milk Distribution · Page 1 of 1 · Generated by Dairy Diary · Developed by SAWAA Networking
              </div>

            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowFullPdfPreview(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
              {generatedPdfResult && (
                <a
                  href={generatedPdfResult.url}
                  download={generatedPdfResult.filename}
                  className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </a>
              )}
              <button
                onClick={handlePrintPdf}
                className="flex-1 py-3 rounded-2xl bg-[#1E5631] hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
