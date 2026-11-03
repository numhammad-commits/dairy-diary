import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  Phone, 
  MoreVertical, 
  Edit2, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  Share2, 
  Wallet, 
  Clock, 
  CalendarCheck, 
  Search, 
  SlidersHorizontal, 
  Sun, 
  Moon, 
  Printer, 
  Plus, 
  X, 
  Check, 
  Package,
  MessageCircle,
  FileSpreadsheet,
  AlertTriangle,
  Trash2,
  Navigation,
  Route
} from 'lucide-react';
import { Contact, LedgerEntry, ShiftType, MilkType, BusinessSettings, PaymentRecord, ProductType, PRODUCT_TYPE_LABELS } from '../types/dairy';
import { formatPKR, formatLiters, getMonthDisplay, shiftMonthKey, generateWhatsAppMessage, getDeviceTodayDate, getDeviceCurrentMonthKey, formatDairyReceiptText } from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';
import { generateSawaaPdfDocument } from '../utils/pdfGenerator';
import { EditCustomerScreen } from './EditCustomerScreen';
import { ReportPeriodBottomSheet } from './ReportPeriodBottomSheet';
import { EditEntryScreen } from './EditEntryScreen';
import { AddEntryScreen } from './AddEntryScreen';
import { BulkEntryModal } from './BulkEntryModal';
import { CustomerPaymentHistoryModal } from './CustomerPaymentHistoryModal';
import { CustomerReceivePaymentModal } from './CustomerReceivePaymentModal';
import { CustomerShareReceiptModal } from './CustomerShareReceiptModal';

// Shared hardware-back-button stack (same helper duplicated in App.tsx and
// EditEntryScreen.tsx). `editingEntry` deliberately does NOT push here —
// EditEntryScreen.tsx owns its own push/pop on mount/unmount instead, so it
// can respect its unsaved-changes "Discard changes?" prompt on back too.
function getBackStack(): Array<() => void> {
  const w = window as any;
  if (!w.__ddBackStack) w.__ddBackStack = [];
  return w.__ddBackStack;
}

type EntryFilterOption = 'all' | 'received' | 'cow' | 'buffalo' | 'goat' | 'paneer' | 'ghee' | 'mawa' | 'yogurt' | 'lassi' | 'other';

const ENTRY_FILTER_OPTIONS: { value: EntryFilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'cow', label: 'Cow Milk' },
  { value: 'buffalo', label: 'Buffalo Milk' },
  { value: 'goat', label: 'Goat Milk' },
  { value: 'paneer', label: 'Paneer / Cheese' },
  { value: 'ghee', label: 'Ghee / Butter' },
  { value: 'mawa', label: 'Mawa' },
  { value: 'yogurt', label: 'Yogurt / Dahi' },
  { value: 'lassi', label: 'Lassi / Chaach' },
  { value: 'other', label: 'Other' },
];

function matchesEntryFilter(e: LedgerEntry, filter: EntryFilterOption): boolean {
  if (filter === 'all') return true;
  if (filter === 'received') return e.dueAmount <= 0 && e.totalAmount > 0;
  const kind = e.entryType || 'milk';
  if (filter === 'cow') return kind === 'milk' && e.milkType === 'cow';
  if (filter === 'buffalo') return kind === 'milk' && e.milkType === 'buffalo';
  if (filter === 'goat') return kind === 'milk' && e.milkType === 'goat';
  if (filter === 'other') return (kind === 'milk' && ((e.milkType as string) === 'other' || e.milkType === 'mix')) || (kind === 'product' && e.productType === 'other');
  return kind === 'product' && e.productType === filter;
}

// Google Maps' simple "dir" URL scheme isn't meant for hundreds of points, so a raw
// GPS trail is down-sampled to ~10 evenly-spaced waypoints before building the link.
function downsampleRoute(route: { lat: number; lng: number }[], maxPoints: number): { lat: number; lng: number }[] {
  if (route.length <= maxPoints) return route;
  const step = (route.length - 1) / (maxPoints - 1);
  const result: { lat: number; lng: number }[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(route[Math.round(i * step)]);
  }
  return result;
}

function buildCustomRouteMapsUrl(route: { lat: number; lng: number }[]): string {
  const sampled = downsampleRoute(route, 10);
  const origin = sampled[0];
  const destination = sampled[sampled.length - 1];
  const waypoints = sampled.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
}

interface ContactDetailModalProps {
  contact: Contact;
  entries: LedgerEntry[];
  monthDisplay: string;
  currentMonthKey?: string;
  businessSettings?: BusinessSettings;
  paymentRecords?: PaymentRecord[];
  isPremium?: boolean;
  onOpenPremium?: () => void;
  onClose: () => void;
  onQuickAdd: (contact: Contact) => void;
  onSettlePayment: (contactId: string, amount: number, paymentDate?: string, paymentMethod?: string, notes?: string, targetMonth?: string) => void;
  onEditPayment?: (paymentId: string, updates: { amount: number; paymentMethod: string }) => void;
  onDeletePayment?: (paymentId: string) => void;
  onSaveNewEntry?: (entry: Omit<LedgerEntry, 'id'>) => void;
  onSaveBulkEntries?: (newEntries: Omit<LedgerEntry, 'id'>[]) => void;
  onUpdateContactRate?: (contactId: string, newRate: number) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onUpdateEntry?: (updatedEntry: LedgerEntry) => void;
  onDeleteEntry?: (entryId: string) => void;
  onDeleteContact?: (contactId: string) => void;
  onRecordCustomRoute?: (contactId: string) => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  entries,
  monthDisplay: initialMonthDisplay,
  currentMonthKey: initialCurrentMonthKey,
  businessSettings,
  paymentRecords = [],
  isPremium = false,
  onOpenPremium,
  onClose,
  onQuickAdd,
  onSettlePayment,
  onEditPayment,
  onDeletePayment,
  onSaveNewEntry,
  onSaveBulkEntries,
  onUpdateContactRate,
  onUpdateContact,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteContact,
  onRecordCustomRoute,
}) => {
  // Canonical contact state for instant reactive updates
  const [activeContact, setActiveContact] = useState<Contact>(contact);
  const [isEditingCustomer, setIsEditingCustomer] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    setActiveContact(contact);
  }, [contact]);

  // Calendar Navigation State
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(
    initialCurrentMonthKey || getDeviceCurrentMonthKey()
  );

  useEffect(() => {
    if (initialCurrentMonthKey) {
      setCurrentMonthKey(initialCurrentMonthKey);
    }
  }, [initialCurrentMonthKey]);
  const [viewAs, setViewAs] = useState<'Monthly' | 'Daily' | 'Weekly'>('Monthly');
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [entryFilter, setEntryFilter] = useState<EntryFilterOption>('all');
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);

  // Modals & Action Sheets State
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [showRateEditModal, setShowRateEditModal] = useState<boolean>(false);
  const [newRate, setNewRate] = useState<number>(contact.defaultRate || 240);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState<boolean>(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState<boolean>(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [showReportPeriodSheet, setShowReportPeriodSheet] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Hardware back button: closes the topmost internal modal, most-nested
  // first. Mirrors the combined-watcher pattern in App.tsx one level deeper.
  const closeTopInternalOverlay = () => {
    if (showDeleteConfirm) { setShowDeleteConfirm(false); return; }
    if (isEditingCustomer) { setIsEditingCustomer(false); return; }
    if (showReportPeriodSheet) { setShowReportPeriodSheet(false); return; }
    if (showBulkModal) { setShowBulkModal(false); return; }
    if (showPaymentHistory) { setShowPaymentHistory(false); return; }
    if (showReceiveModal) { setShowReceiveModal(false); return; }
    if (showRateEditModal) { setShowRateEditModal(false); return; }
    if (showAddEntryModal) { setShowAddEntryModal(false); return; }
    if (showShareModal) { setShowShareModal(false); return; }
  };

  const isAnyInternalOverlayOpen =
    showDeleteConfirm || isEditingCustomer || showReportPeriodSheet || showBulkModal ||
    showPaymentHistory || showReceiveModal || showRateEditModal || showAddEntryModal || showShareModal;

  const closeTopInternalOverlayRef = useRef(closeTopInternalOverlay);
  closeTopInternalOverlayRef.current = closeTopInternalOverlay;
  const stableBackHandlerRef = useRef(() => closeTopInternalOverlayRef.current());
  const wasInternalOverlayOpenRef = useRef(false);
  const isFirstInternalCheckRef = useRef(true);

  const popOwnBackEntry = () => {
    const stack = getBackStack();
    if (stack[stack.length - 1] === stableBackHandlerRef.current) {
      stack.pop();
      (window as any).__ddSyntheticBack = true;
      window.history.back();
    }
  };

  useEffect(() => {
    if (isFirstInternalCheckRef.current) {
      isFirstInternalCheckRef.current = false;
      wasInternalOverlayOpenRef.current = isAnyInternalOverlayOpen;
      return;
    }
    if (isAnyInternalOverlayOpen && !wasInternalOverlayOpenRef.current) {
      getBackStack().push(stableBackHandlerRef.current);
      window.history.pushState({ ddBack: true }, '');
    } else if (!isAnyInternalOverlayOpen && wasInternalOverlayOpenRef.current) {
      popOwnBackEntry();
    }
    wasInternalOverlayOpenRef.current = isAnyInternalOverlayOpen;
  }, [isAnyInternalOverlayOpen]);

  // Safety net: if this whole modal is unmounted abruptly (e.g. the parent
  // clears `selectedContact` as part of deleting this very customer) while
  // an internal overlay's entry is still on the stack, consume it here so a
  // later back-press doesn't land on a dead history slot.
  useEffect(() => {
    return () => popOwnBackEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single source of truth for this customer's payments from global paymentRecords
  const customerPayments = useMemo(() => {
    const list = (paymentRecords || []).filter(
      (p) => p.contactId === contact.id || p.contactName === contact.name
    );
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();
    return list.filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);

      const sig = `${p.contactId || p.contactName}_${p.date}_${p.timestamp || ''}_${p.amount}`;
      if (seenSignatures.has(sig)) return false;
      seenSignatures.add(sig);

      return true;
    });
  }, [paymentRecords, contact.id, contact.name]);

  // New entry form state for Quick Add FAB
  const [entryLiters, setEntryLiters] = useState<string>('2.0');
  const [entryRate, setEntryRate] = useState<number>(contact.defaultRate || 240);
  const [entryShift, setEntryShift] = useState<ShiftType>('morning');
  const [entryMilkType, setEntryMilkType] = useState<MilkType>('mix');
  const [entryDate, setEntryDate] = useState<string>(getDeviceTodayDate);

  // Trigger Toast Notification
  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  // Month navigation chevrons
  const handlePrevMonth = () => {
    setCurrentMonthKey((prev) => shiftMonthKey(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonthKey((prev) => shiftMonthKey(prev, 1));
  };

  // Month Display String (e.g., "October 2026")
  const activeMonthDisplay = useMemo(() => {
    const [yearStr, monthStr] = currentMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonthKey]);

  // Filter entries for this contact and current month
  const contactEntries = useMemo(() => {
    return entries.filter(
      (e) => e.contactId === contact.id && e.date.startsWith(currentMonthKey)
    );
  }, [entries, contact.id, currentMonthKey]);

  // Search filtered entries
  const displayedEntries = useMemo(() => {
    let result = contactEntries;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.date.includes(q) ||
          e.timestamp.toLowerCase().includes(q) ||
          e.shift.toLowerCase().includes(q) ||
          e.liters.toString().includes(q) ||
          e.totalAmount.toString().includes(q) ||
          (e.productQuantity !== undefined && e.productQuantity.toString().includes(q))
      );
    }

    if (entryFilter !== 'all') {
      result = result.filter((e) => matchesEntryFilter(e, entryFilter));
    }

    // Sort descending by date and time
    return result.sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp));
  }, [contactEntries, searchQuery, entryFilter]);

  // Reactive Month Financial Calculations (Single source of truth via getCustomerMonthDue)
  const metrics = useMemo(() => {
    const fin = getCustomerMonthDue(contact, currentMonthKey, entries, customerPayments);

    return {
      milk: fin.liters,
      amount: fin.amount,
      received: fin.received,
      due: fin.due,
      previousDue: fin.previousDue,
      totalOutstanding: fin.totalOutstanding,
      count: fin.entriesCount,
    };
  }, [contact, currentMonthKey, entries, customerPayments]);

  // Actions
  const handleCall = () => {
    window.location.href = `tel:${contact.phone}`;
  };

  // Shared current-month statement PDF, reused by the WhatsApp summary share and the
  // Payment Reminder share so both attach the same document.
  const buildStatementPdf = async () => {
    return generateSawaaPdfDocument(
      activeContact,
      contactEntries,
      activeMonthDisplay,
      businessSettings,
      {
        totalMilk: metrics.milk,
        totalAmount: metrics.amount,
        totalReceived: metrics.received,
        periodDue: metrics.due,
        previousDue: metrics.previousDue,
        totalOutstanding: metrics.totalOutstanding,
      },
      isPremium
    );
  };

  // Share the customer's statement: attach the PDF via the native share sheet (Web Share
  // API Level 2) when supported, falling back to downloading the PDF + opening WhatsApp
  // with the text summary, and to text-only WhatsApp if PDF generation itself fails.
  const handleShareWhatsApp = async () => {
    const msg = generateWhatsAppMessage(
      contact.name,
      contact.role,
      metrics.due,
      metrics.totalOutstanding,
      metrics.milk,
      activeMonthDisplay
    );
    try {
      const pdf = await buildStatementPdf();
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdf.file] })) {
        try {
          await navigator.share({
            files: [pdf.file],
            title: `Milk Bill — ${contact.name} — ${activeMonthDisplay}`,
            text: decodeURIComponent(msg),
          });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }
      const downloadLink = document.createElement('a');
      downloadLink.href = pdf.url;
      downloadLink.download = pdf.filename;
      downloadLink.click();
      window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
    } catch (err) {
      console.error('Share statement error:', err);
      window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
    }
  };

  // Payment Reminder: a formatted text nudge (not a line-item receipt), shared directly
  // as text — no PDF attached.
  const handlePaymentReminder = async () => {
    const text =
      `*DAIRY DIARY — PAYMENT REMINDER* 🔔\n` +
      `-------------------------\n` +
      `👤 *Customer:* ${contact.name}\n` +
      `📅 *Billing Period:* ${activeMonthDisplay}\n` +
      `💰 *Month Bill:* ${formatPKR(metrics.due)}\n` +
      `⚠️ *Previous Balance:* ${formatPKR(metrics.previousDue)}\n` +
      `-------------------------\n` +
      `*Total Outstanding Due: ${formatPKR(metrics.totalOutstanding)}*\n` +
      `-------------------------\n` +
      `Please clear your ledger account at your earliest convenience.\n` +
      `_${businessSettings?.businessName || 'SAWAA'} Dairy Diary_`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Payment Reminder — ${contact.name}`, text });
        triggerToast('Payment Reminder shared');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
    triggerToast('Payment Reminder sent via WhatsApp');
  };

  const handleDownloadPDF = () => {
    window.print();
    triggerToast('Preparing Statement PDF...');
  };

  const handlePrintRow = (entry: LedgerEntry) => {
    const qtyLabel = (entry.entryType || 'milk') === 'product'
      ? `${entry.productQuantity} ${entry.productUnit === 'kg' ? 'Kg' : 'L'}`
      : `${entry.liters} L`;
    triggerToast(`Printing Receipt for ${entry.date} (${qtyLabel})...`);
    window.print();
  };

  // Single-entry receipt share: the beautifully formatted text receipt for just this
  // delivery — no PDF attached. previousDue is the customer's real running balance
  // (from metrics), shown for context alongside this one entry's own due.
  const handleShareRow = async (entry: LedgerEntry) => {
    const text = formatDairyReceiptText({
      customerName: contact.name,
      date: `${entry.date}, ${entry.timestamp}`,
      milkLiters: entry.liters,
      ratePerLiter: entry.ratePerLiter,
      totalAmount: entry.totalAmount,
      received: entry.receivedAmount,
      due: entry.dueAmount,
      previousDue: metrics.previousDue,
      footerBusinessName: businessSettings?.businessName,
    });

    if (navigator.share) {
      try {
        await navigator.share({ title: `Milk Receipt — ${contact.name} — ${entry.date}`, text });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSavePayment = (data: {
    amount: number;
    month: string;
    date: string;
    paymentMethod: string;
    notes?: string;
  }) => {
    onSettlePayment(contact.id, data.amount, data.date, data.paymentMethod, data.notes, data.month);
    setShowReceiveModal(false);
    triggerToast(`Payment of Rs ${data.amount.toLocaleString('en-PK')} received.`);
  };

  const handleSaveRate = () => {
    if (onUpdateContactRate) {
      onUpdateContactRate(contact.id, newRate);
    }
    contact.defaultRate = newRate;
    setShowRateEditModal(false);
    triggerToast(`Rate updated to Rs${newRate}/L`);
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseFloat(entryLiters) || 1.0;
    const rate = entryRate || 240;
    const totalAmount = Math.round(liters * rate);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (onSaveNewEntry) {
      onSaveNewEntry({
        contactId: contact.id,
        contactName: contact.name,
        contactRole: contact.role,
        date: entryDate,
        timestamp: timeStr,
        shift: entryShift,
        milkType: entryMilkType,
        liters,
        ratePerLiter: rate,
        totalAmount,
        receivedAmount: 0,
        dueAmount: totalAmount,
        paymentMode: 'credit',
      });
    }

    setShowAddEntryModal(false);
    triggerToast(`Added ${liters} L entry for ${activeContact.name}`);
  };

  const handleSaveCustomer = (updatedContact: Contact) => {
    setActiveContact(updatedContact);
    if (onUpdateContact) {
      onUpdateContact(updatedContact);
    }
    setIsEditingCustomer(false);
    triggerToast('Customer details updated successfully.');
  };

  if (isEditingCustomer) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
        <div 
          className="w-full max-w-md h-full bg-[#f8faf9] shadow-2xl flex flex-col overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          <EditCustomerScreen
            contact={activeContact}
            onBack={() => setIsEditingCustomer(false)}
            onSave={handleSaveCustomer}
          />
        </div>
      </div>
    );
  }

  if (editingEntry) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
        <div 
          className="w-full max-w-md h-full bg-[#f8faf9] shadow-2xl flex flex-col overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          <EditEntryScreen
            entry={editingEntry}
            contact={activeContact}
            onUpdate={(updated) => {
              if (onUpdateEntry) onUpdateEntry(updated);
              setEditingEntry(null);
            }}
            onDelete={(id) => {
              if (onDeleteEntry) onDeleteEntry(id);
              setEditingEntry(null);
            }}
            onBack={() => setEditingEntry(null)}
            showToast={triggerToast}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="w-full max-w-md h-full bg-glass-gradient shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* 1. TOP HEADER APP BAR (Emerald Green Pinned Bar)                         */}
        {/* ========================================================================= */}
        <div className="relative bg-[#1B4332] text-white px-4 pt-3.5 pb-3 shrink-0 shadow-sm z-30">
          {/* Top Row: Back button, Name, PDF, Call, Options */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingCustomer(true)}
                className="text-left font-black tracking-tight text-white truncate hover:underline cursor-pointer focus:outline-none flex items-center gap-1.5 group max-w-full text-glass-lift"
                title="Tap to Edit Customer Profile"
              >
                <span className="text-lg font-black truncate text-[#FFFFFF]">{activeContact.name}</span>
              </button>
            </div>

            {/* Right Action Icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* PDF Document Download Button -> Opens Report Period Bottom Sheet */}
              <button
                onClick={() => setShowReportPeriodSheet(true)}
                className="h-9 px-2.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 text-white text-xs font-black flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer text-glass-lift"
                title="Select Report Period"
              >
                <FileText className="w-3.5 h-3.5 stroke-[2.2]" />
                <span className="text-[11px] font-bold">PDF</span>
              </button>

              {/* Call Shortcut Icon */}
              <button
                onClick={handleCall}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Call Contact"
              >
                <Phone className="w-4 h-4 stroke-[2.2]" />
              </button>

              {/* 3-Dot Options Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="More Options"
                >
                  <MoreVertical className="w-4 h-4 stroke-[2.2]" />
                </button>

                {showOptionsMenu && (
                  <div 
                    className="absolute right-0 mt-1 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs font-bold"
                    onClick={() => setShowOptionsMenu(false)}
                  >
                    <button 
                      onClick={() => setIsEditingCustomer(true)}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-[#163B32]"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#0B8F68]" />
                      <span>Edit Customer Profile</span>
                    </button>
                    <button 
                      onClick={() => setShowRateEditModal(true)}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit Price Rate</span>
                    </button>
                    <button 
                      onClick={handlePaymentReminder}
                      className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2 cursor-pointer text-rose-600"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send Due Reminder</span>
                    </button>
                    <button 
                      onClick={() => setShowReportPeriodSheet(true)}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-700"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                      <span>Export Period Statement</span>
                    </button>
                    <button 
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2 cursor-pointer text-rose-600 border-t border-slate-100 mt-1 pt-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Customer Profile</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Micro-Capsule Indicators Immediately Below Header */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px] font-extrabold">
            {/* Rate Metric Pill with Edit Pencil */}
            <button
              onClick={() => setShowRateEditModal(true)}
              className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center gap-1 transition-all cursor-pointer"
              title="Click to change rate"
            >
              <span>Rs{activeContact.defaultRate ? activeContact.defaultRate.toFixed(2) : '240.00'}/L</span>
              <Edit2 className="w-2.5 h-2.5 opacity-80" />
            </button>

            {/* Category Pill: OTHER / COW / BUFFALO */}
            <span className="px-2 py-0.5 rounded-full bg-black/25 text-white/90 uppercase tracking-wider text-[10px]">
              {activeContact.milkTypePref ? activeContact.milkTypePref.toUpperCase() : 'OTHER'}
            </span>

            {/* Transaction Role Pill: SELL MILK / BUY MILK */}
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-emerald-200 border border-white/20 uppercase tracking-wider text-[10px]">
              {activeContact.role === 'buyer' ? 'SELL MILK' : 'BUY MILK'}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN SCROLLABLE VIEWPORT                                                 */}
        {/* ========================================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
          <div className="p-3.5 space-y-3">
            
            {/* 2. Header Metrics Display & Calendar Navigator Card */}
            <div className="glass-card rounded-3xl p-4 shadow-xs border border-[#D6E9E1] space-y-3 text-[#163B32]">
              {/* Calendar Navigator Bar: < October 2026 > and VIEW AS Monthly ▾ */}
              <div className="flex items-center justify-between border-b border-[#D6E9E1] pb-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-full text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="font-black text-sm text-[#163B32] tracking-tight">
                    {activeMonthDisplay}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-full text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* View As Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider">
                    VIEW AS
                  </span>
                  <div className="relative">
                    <select
                      value={viewAs}
                      onChange={(e) => setViewAs(e.target.value as any)}
                      aria-label="View ledger as period"
                      className="bg-slate-100 text-[#163B32] font-bold text-xs px-2.5 py-1 rounded-full border border-[#D6E9E1] outline-none cursor-pointer appearance-none pr-5"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                    <span className="pointer-events-none absolute right-1.5 top-1 text-[#55756D] text-[10px]">▾</span>
                  </div>
                </div>
              </div>

              {/* Grid Metrics Array */}
              <div className="grid grid-cols-3 gap-2 text-left">
                {/* Milk */}
                <div>
                  <span className="text-[11px] font-bold text-[#55756D] block">Milk</span>
                  <span className="text-base font-black text-[#163B32] tracking-tight block mt-0.5">
                    {metrics.milk.toFixed(2)} L
                  </span>
                </div>

                {/* Amount */}
                <div>
                  <span className="text-[11px] font-bold text-[#55756D] block">Amount</span>
                  <span className="text-base font-black text-[#163B32] tracking-tight block mt-0.5">
                    Rs{Math.round(metrics.amount)}
                  </span>
                </div>

                {/* Due */}
                <div>
                  <span className="text-[11px] font-bold text-[#55756D] block">Due</span>
                  <span className="text-base font-black text-[#E5485D] tracking-tight block mt-0.5">
                    Rs{Math.round(metrics.due)}
                  </span>
                  {/* Carryover previous due metric under Due */}
                  <span className="text-[10px] font-bold text-rose-600 block leading-tight mt-0.5">
                    +{formatPKR(metrics.previousDue)} prev
                  </span>
                </div>
              </div>

              {/* Second Metrics Row: Received, Billing Pill, Outstanding Pill */}
              <div className="flex items-center justify-between pt-1 gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-[#55756D]">Received</span>
                  <span className="text-sm font-black text-[#0B9B72]">
                    Rs{Math.round(metrics.received)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Billing Pill Tag */}
                  <div className="bg-rose-50 text-[#E5485D] border border-rose-200 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold">
                    Billing: Monthly (1)
                  </div>

                  {/* Outstanding Pill Tag */}
                  <div className="bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1">
                    <Info className="w-3 h-3 text-[#0B8F68]" />
                    <span>Outstanding: {formatPKR(metrics.totalOutstanding)}</span>
                  </div>
                </div>
              </div>

              {/* Previous Due Subheading */}
              <div className="text-[11px] font-medium text-[#55756D] italic pt-1 border-t border-[#D6E9E1] flex items-center gap-1">
                <span>↺</span>
                <span>Previous balance carried forward: {formatPKR(metrics.previousDue)}</span>
              </div>
            </div>

            {/* Navigation & Custom Route */}
            <div className="glass-card rounded-3xl p-3.5 shadow-xs border border-[#D6E9E1] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#55756D] block">
                Navigation
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {activeContact.latitude != null && activeContact.longitude != null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeContact.latitude},${activeContact.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-[120px] py-2 px-3 bg-[#E1F3EA] hover:bg-[#d6ecdf] border border-[#D6E9E1] text-[#0B8F68] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Default Map</span>
                  </a>
                )}
                {activeContact.savedRoute && activeContact.savedRoute.length > 0 && (
                  <a
                    href={buildCustomRouteMapsUrl(activeContact.savedRoute)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-[120px] py-2 px-3 bg-[#0B8F68] hover:bg-[#087A5A] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Custom Route</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (onRecordCustomRoute) onRecordCustomRoute(activeContact.id);
                    onClose();
                  }}
                  className="flex-1 min-w-[120px] py-2 px-3 bg-white hover:bg-slate-50 border border-[#D6E9E1] text-[#163B32] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Route className="w-3.5 h-3.5 text-[#0B8F68]" />
                  <span>Record Custom Route</span>
                </button>
              </div>
            </div>

            {/* 3. Quick Action Row Controls (4 Action Capsule Nodes) */}
            <div className="grid grid-cols-4 gap-2">
              {/* Card 1: Share */}
              <button
                onClick={() => setShowShareModal(true)}
                className="glass-card hover:bg-slate-50 active:bg-slate-100 text-[#163B32] border border-[#D6E9E1] rounded-2xl py-2 px-1 text-center flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs group active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform text-[#0B8F68]">
                  <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold tracking-tight text-[#163B32]">Share</span>
              </button>

              {/* Card 2: Receive (Wallet) */}
              <button
                onClick={() => setShowReceiveModal(true)}
                className="glass-card hover:bg-slate-50 active:bg-slate-100 text-[#163B32] border border-[#D6E9E1] rounded-2xl py-2 px-1 text-center flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs group active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform text-teal-700">
                  <Wallet className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold tracking-tight text-[#163B32]">Receive</span>
              </button>

              {/* Card 3: History */}
              <button
                onClick={() => setShowPaymentHistory(true)}
                className="glass-card hover:bg-slate-50 active:bg-slate-100 text-[#163B32] border border-[#D6E9E1] rounded-2xl py-2 px-1 text-center flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs group active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform text-purple-700">
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold tracking-tight text-[#163B32]">History</span>
              </button>

              {/* Card 4: Bulk Entry */}
              <button
                onClick={() => setShowBulkModal(true)}
                className="glass-card hover:bg-slate-50 active:bg-slate-100 text-[#163B32] border border-[#D6E9E1] rounded-2xl py-2 px-1 text-center flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs group active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform text-[#0B8F68]">
                  <CalendarCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold tracking-tight text-[#163B32]">Bulk Entry</span>
              </button>
            </div>

            {/* 4. Search & Filter Bar Section */}
            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="flex-1 rounded-full px-3.5 py-2 flex items-center gap-2 shadow-xs bg-white border border-[#D6E9E1]">
                <Search className="w-4 h-4 text-[#55756D] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries..."
                  className="w-full text-xs font-semibold text-[#163B32] placeholder:text-[#7A8C84] outline-none bg-transparent"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-0.5 text-[#55756D] hover:text-[#163B32]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Secondary Adjustments: Filter Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0 border border-[#D6E9E1] ${
                    entryFilter !== 'all'
                      ? 'bg-[#0B8F68] text-white border-[#0B8F68]'
                      : 'bg-white text-[#55756D] hover:text-[#163B32]'
                  }`}
                  title="Filter Entries"
                >
                  <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
                </button>

                {showFilterDrawer && (
                  <div className="absolute right-0 mt-1 w-48 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs font-bold">
                    {ENTRY_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setEntryFilter(opt.value);
                          setShowFilterDrawer(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer ${
                          entryFilter === opt.value ? 'text-[#0B8F68]' : 'text-[#163B32]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {entryFilter === opt.value && <Check className="w-3.5 h-3.5 text-[#0B8F68]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Alert Box: Bold Red PAYMENT REMINDER button */}
              <button
                onClick={handlePaymentReminder}
                className="bg-rose-50 hover:bg-rose-100 text-[#E5485D] border border-rose-200 px-3 py-2 rounded-full text-[11px] font-black tracking-tight shrink-0 shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <span>PAYMENT REMINDER</span>
              </button>
            </div>

            {/* 5. "October 2026" Daily Collection Entry Log Checklist */}
            <div className="space-y-2 pt-1">
              {/* Sub-heading: Date frame group and volume counters */}
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black text-[#163B32] tracking-tight">
                  {activeMonthDisplay}
                </h2>
                <span className="bg-[#E1F3EA] text-[#0B8F68] font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-[#D6E9E1]">
                  {displayedEntries.length} {displayedEntries.length === 1 ? 'Entry' : 'Entries'}
                </span>
              </div>

              {/* Item Rows */}
              {displayedEntries.length === 0 ? (
                <div className="glass-card rounded-3xl p-8 text-center border border-[#D6E9E1]">
                  <Package className="w-8 h-8 text-[#7A8C84] mx-auto mb-2" />
                  <p className="text-xs font-bold text-[#163B32]">No collection entries for this period</p>
                  <p className="text-[11px] text-[#55756D] mt-1">Tap "+ Add Entry" below to record milk</p>
                </div>
              ) : (
                displayedEntries.map((entry) => {
                  const isMorning = entry.shift === 'morning';
                  const dateParts = entry.date.split('-');
                  const dayStr = dateParts[2] || '01';
                  const monthShort = activeMonthDisplay.split(' ')[0].substring(0, 3);
                  const displayDateStr = `${dayStr} ${monthShort}`;

                  return (
                    <div
                      key={entry.id}
                      className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs space-y-2.5 hover:bg-slate-50 transition-all cursor-pointer group"
                    >
                      {/* Top Row: Left Product Block, Central Timeline, Right Amount - Clickable to Edit Entry */}
                      <div 
                        onClick={() => setEditingEntry(entry)}
                        className="flex items-center justify-between gap-2"
                        title="Tap to edit this transaction"
                      >
                        {/* Left Column Product Block */}
                        {(entry.entryType || 'milk') === 'product' ? (
                          <div className="bg-[#E1F3EA] rounded-xl px-2.5 py-1.5 text-center border border-[#D6E9E1] min-w-[76px] shrink-0">
                            <span className="text-xs font-black text-[#163B32] block leading-tight">
                              {entry.productQuantity} {entry.productUnit === 'kg' ? 'Kg' : 'Ltr'}
                            </span>
                            <span className="text-[10px] font-semibold text-[#55756D] block leading-tight mt-0.5">
                              {PRODUCT_TYPE_LABELS[entry.productType || 'other']}
                            </span>
                            <span className="text-[10px] font-bold text-[#0B8F68] block leading-tight mt-0.5">
                              Rs{entry.productRate}/{entry.productUnit === 'kg' ? 'Kg' : 'L'}
                            </span>
                          </div>
                        ) : (
                          <div className="bg-[#E1F3EA] rounded-xl px-2.5 py-1.5 text-center border border-[#D6E9E1] min-w-[76px] shrink-0">
                            <span className="text-xs font-black text-[#163B32] block leading-tight">
                              {entry.liters} Ltr
                            </span>
                            <span className="text-[10px] font-semibold text-[#55756D] block leading-tight mt-0.5">
                              📦 Other
                            </span>
                            <span className="text-[10px] font-bold text-[#0B8F68] block leading-tight mt-0.5">
                              Rs{entry.ratePerLiter}/L
                            </span>
                          </div>
                        )}

                        {/* Central Column Timeline Block */}
                        <div className="flex-1 min-w-0 px-1">
                          <div className="font-extrabold text-sm text-[#163B32] tracking-tight group-hover:text-[#0B8F68] transition-colors">
                            {displayDateStr} <span className="text-[#D6E9E1] font-normal">|</span> <span className="text-xs text-[#55756D] font-medium">{entry.timestamp}</span>
                          </div>

                          {(entry.entryType || 'milk') === 'milk' && (
                            <div className="mt-1 flex items-center">
                              {isMorning ? (
                                <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                                  <Sun className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span>Morning</span>
                                </span>
                              ) : (
                                <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                                  <Moon className="w-3 h-3 text-indigo-500 fill-indigo-500" />
                                  <span>Evening</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right Column Financial Metrics */}
                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-[#163B32] tracking-tight block">
                            Rs{Math.round(entry.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Ribbon: [Print] [Share] */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#D6E9E1]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintRow(entry);
                          }}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-[#163B32] text-xs font-black border border-[#D6E9E1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareRow(entry);
                          }}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-[#163B32] text-xs font-black border border-[#D6E9E1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. STICKY FLOATING ACTION BUTTON (FAB)                                    */}
        {/* ========================================================================= */}
        <div className="absolute bottom-5 right-5 z-40">
          <button
            onClick={() => setShowAddEntryModal(true)}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:bg-emerald-900 text-white rounded-full px-5 py-3 font-black text-xs tracking-wide shadow-xl shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer group active:scale-95 border border-emerald-400/40 ring-4 ring-emerald-950/40 text-glass-lift"
            title="Add New Milk Collection Entry"
          >
            <Plus className="w-4 h-4 stroke-[3] group-hover:rotate-90 transition-transform" />
            <span>+ Add Entry</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* UNIFIED ADD ENTRY SCREEN                                                  */}
        {/* ========================================================================= */}
        {showAddEntryModal && (
          <AddEntryScreen
            customer={activeContact}
            source="customer-ledger"
            existingEntries={entries}
            onClose={() => setShowAddEntryModal(false)}
            onSave={(entry) => {
              if (onSaveNewEntry) onSaveNewEntry(entry);
              setShowAddEntryModal(false);
            }}
            showToast={triggerToast}
          />
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: RECEIVE PAYMENT                                                  */}
        {/* ========================================================================= */}
        {showReceiveModal && (
          <CustomerReceivePaymentModal
            contact={activeContact}
            currentOutstanding={metrics.totalOutstanding}
            currentMonthDue={metrics.due}
            currentMonthKey={currentMonthKey}
            onClose={() => setShowReceiveModal(false)}
            onSavePayment={handleSavePayment}
          />
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: EDIT RATE                                                        */}
        {/* ========================================================================= */}
        {showRateEditModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => setShowRateEditModal(false)}
          >
            <div 
              className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#1E5631]" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Edit Price Setting
                  </h3>
                </div>
                <button onClick={() => setShowRateEditModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agreed Rate (Rs. / Liter)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newRate}
                  onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-black text-base text-slate-900 focus:border-[#1E5631] outline-none"
                />
              </div>

              <button
                onClick={handleSaveRate}
                className="w-full py-3 bg-[#1E5631] hover:bg-emerald-800 text-white rounded-xl font-black text-xs shadow-md transition-all cursor-pointer"
              >
                Update Price
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: BULK ENTRY BATCH DIALOG (Reference Screenshot 2)                 */}
        {/* ========================================================================= */}
        {showBulkModal && (
          <BulkEntryModal
            contact={activeContact}
            entries={entries}
            initialMonthKey={currentMonthKey}
            onClose={() => setShowBulkModal(false)}
            onSaveEntries={(bulkEntries) => {
              if (onSaveBulkEntries) {
                onSaveBulkEntries(bulkEntries);
              } else if (onSaveNewEntry) {
                bulkEntries.forEach((e) => onSaveNewEntry(e));
              }
              setShowBulkModal(false);
            }}
            showToast={triggerToast}
          />
        )}

        {/* ========================================================================= */}
        {/* MODAL 5: PAYMENT HISTORY SUMMARY                                         */}
        {/* ========================================================================= */}
        {showPaymentHistory && (
          <CustomerPaymentHistoryModal
            contact={activeContact}
            entries={entries}
            paymentRecords={customerPayments}
            currentMonthKey={currentMonthKey}
            onClose={() => setShowPaymentHistory(false)}
            onEditPayment={onEditPayment}
            onDeletePayment={onDeletePayment}
          />
        )}

        {/* ========================================================================= */}
        {/* MODAL 6: SHARE STATEMENT & RECEIPT                                       */}
        {/* ========================================================================= */}
        {showShareModal && (
          <CustomerShareReceiptModal
            contact={activeContact}
            entries={entries}
            paymentRecords={customerPayments}
            metrics={metrics}
            activeMonthDisplay={activeMonthDisplay}
            businessSettings={businessSettings}
            onClose={() => setShowShareModal(false)}
            showToast={triggerToast}
          />
        )}

        {/* Select Report Period Modal Bottom Sheet */}
        {showReportPeriodSheet && (
          <ReportPeriodBottomSheet
            contact={activeContact}
            entries={entries}
            paymentRecords={customerPayments}
            currentMonthKey={currentMonthKey}
            activeMonthDisplay={activeMonthDisplay}
            businessSettings={businessSettings}
            isPremium={isPremium}
            onOpenPremium={onOpenPremium}
            onClose={() => setShowReportPeriodSheet(false)}
            showToast={triggerToast}
          />
        )}

        {/* Modal 7: Delete Customer Confirmation Dialog */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div 
              className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-rose-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Delete {activeContact.name}?
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Delete <span className="font-bold text-slate-800">{activeContact.name}</span>? This will remove all their entries, payments, and history. This cannot be undone.
                </p>

                {metrics.totalOutstanding > 0 && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-start gap-1.5">
                    <span className="shrink-0">⚠️</span>
                    <span>
                      This customer has an outstanding balance of {formatPKR(metrics.totalOutstanding)}. Delete anyway?
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (onDeleteContact) {
                      onDeleteContact(activeContact.id);
                    }
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {showToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
            {showToast}
          </div>
        )}
      </div>
    </div>
  );
};
