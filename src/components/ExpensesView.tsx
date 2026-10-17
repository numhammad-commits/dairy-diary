import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Tag, 
  Truck, 
  Pill, 
  Wheat, 
  Fuel, 
  X, 
  Check, 
  Edit3, 
  Trash2, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  FileText,
  MessageCircle,
  FileDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Search,
  LayoutGrid,
  MoreVertical
} from 'lucide-react';
import { ExpenseItem, LedgerEntry, BusinessSettings } from '../types/dairy';
import { formatPKR, shiftMonthKey, getFullMonthDisplay, getDeviceTodayDate, getDeviceCurrentMonthKey } from '../utils/formatters';

interface ExpensesViewProps {
  expenses: ExpenseItem[];
  entries?: LedgerEntry[];
  businessSettings?: BusinessSettings;
  onAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (expense: ExpenseItem) => void;
  onDeleteExpense?: (expenseId: string) => void;
  currentMonthKey?: string;
  onMonthChange?: (newMonth: string) => void;
  showToast?: (message: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  entries = [],
  businessSettings,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  currentMonthKey = getDeviceCurrentMonthKey(),
  onMonthChange,
  showToast,
}) => {
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Three-dot popover menu active state (Piece 3️⃣)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Search & Category Filter States (Features 4️⃣ & 5️⃣)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Granularity Period State (Monthly / Weekly / Daily) (Fix 4)
  const [granularity, setGranularity] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [isGranularityMenuOpen, setIsGranularityMenuOpen] = useState(false);

  // Form Fields (Piece 4️⃣)
  const [category, setCategory] = useState<string>('feed_wanda');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [paidTo, setPaidTo] = useState('');

  // Delete confirmation modal state
  const [deletingExpense, setDeletingExpense] = useState<ExpenseItem | null>(null);

  // Quick categories matching farm needs & reference structure
  const quickCategories = [
    { id: 'feed_wanda', label: 'Feed / Wanda', icon: Wheat, defaultTitle: 'Cattle Feed' },
    { id: 'chokar', label: 'Chokar', icon: Wheat, defaultTitle: 'Wheat Chokar' },
    { id: 'green_grass', label: 'Green Grass', icon: Wheat, defaultTitle: 'Green Grass / Chara' },
    { id: 'transport', label: 'Transport', icon: Truck, defaultTitle: 'Vehicle Transport' },
    { id: 'medicine', label: 'Medicine', icon: Pill, defaultTitle: 'Veterinary Medicine' },
    { id: 'fuel', label: 'Fuel', icon: Fuel, defaultTitle: 'Milk Van Fuel' },
    { id: 'labor', label: 'Labor', icon: Tag, defaultTitle: 'Farm Labor / Wages' },
    { id: 'other', label: 'Other', icon: Tag, defaultTitle: 'General Farm Expense' },
  ];

  // Helper to format date + time subtitle: e.g. "07 Oct, 11:52 AM"
  const formatItemDateSubtitle = (dateStr: string, timeStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const monthName = months[monthIdx] || parts[1];
      const formattedDate = `${day} ${monthName}`;
      return timeStr ? `${formattedDate}, ${timeStr}` : formattedDate;
    }
    return timeStr ? `${dateStr}, ${timeStr}` : dateStr;
  };

  // Helper to get Category Icon
  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'feed_wanda':
        return { label: 'Feed / Wanda', icon: Wheat };
      case 'chokar':
        return { label: 'Chokar', icon: Wheat };
      case 'green_grass':
        return { label: 'Green Grass', icon: Wheat };
      case 'transport':
        return { label: 'Transport', icon: Truck };
      case 'medicine':
        return { label: 'Medicine', icon: Pill };
      case 'fuel':
        return { label: 'Fuel', icon: Fuel };
      case 'labor':
        return { label: 'Labor', icon: Tag };
      default:
        return { label: 'Other', icon: Tag };
    }
  };

  // Filter expenses strictly by the selected month and granularity period (Fix 4)
  const periodExpenses = useMemo(() => {
    const todayStr = getDeviceTodayDate();
    return expenses
      .filter((item) => {
        // Must belong to the selected month
        if (!item.date.startsWith(currentMonthKey)) return false;

        if (granularity === 'monthly') return true;

        if (granularity === 'daily') {
          const isCurrentMonth = currentMonthKey === todayStr.slice(0, 7);
          if (isCurrentMonth) {
            return item.date === todayStr;
          }
          const monthDates = expenses
            .filter((e) => e.date.startsWith(currentMonthKey))
            .map((e) => e.date)
            .sort();
          const targetDate = monthDates.length > 0 ? monthDates[monthDates.length - 1] : `${currentMonthKey}-01`;
          return item.date === targetDate;
        }

        if (granularity === 'weekly') {
          const isCurrentMonth = currentMonthKey === todayStr.slice(0, 7);
          if (isCurrentMonth) {
            const d = new Date(todayStr);
            d.setDate(d.getDate() - 6);
            const sevenDaysAgo = d.toISOString().slice(0, 10);
            return item.date >= sevenDaysAgo && item.date <= todayStr;
          }
          const monthDates = expenses
            .filter((e) => e.date.startsWith(currentMonthKey))
            .map((e) => e.date)
            .sort();
          if (monthDates.length > 0) {
            const maxDate = monthDates[monthDates.length - 1];
            const d = new Date(maxDate);
            d.setDate(d.getDate() - 6);
            const minDate = d.toISOString().slice(0, 10);
            return item.date >= minDate && item.date <= maxDate;
          }
          return true;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, currentMonthKey, granularity]);

  // Dynamic Category List derived from actual expense records (Feature 5️⃣)
  const dynamicCategories = useMemo(() => {
    const baseList = [
      { id: 'all', label: 'All' },
      { id: 'khal', label: 'Khal' },
      { id: 'chokar', label: 'Chokar' },
      { id: 'green_grass', label: 'Green Grass' },
      { id: 'feed_wanda', label: 'Feed / Wanda' },
      { id: 'transport', label: 'Transport / Fuel' },
      { id: 'medicine', label: 'Medicine' },
      { id: 'labor', label: 'Labor' },
      { id: 'other', label: 'Other' },
    ];

    // Read unique recorded categories from existing expense data
    const recordedCatIds = Array.from(new Set(expenses.map((e) => e.category).filter(Boolean)));
    const customCats = recordedCatIds
      .filter((cId) => !baseList.some((b) => b.id.toLowerCase() === cId.toLowerCase()))
      .map((cId) => ({
        id: cId,
        label: cId.charAt(0).toUpperCase() + cId.slice(1).replace(/_/g, ' '),
      }));

    return [...baseList, ...customCats];
  }, [expenses]);

  // Filtered expenses based on active Search and Category Filter (Features 4️⃣ & 5️⃣)
  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return periodExpenses.filter((item) => {
      // Category Filter
      if (selectedCategory !== 'all') {
        const itemCat = (item.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const selectedCat = selectedCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!itemCat.includes(selectedCat) && !selectedCat.includes(itemCat)) {
          return false;
        }
      }

      // Search Query Filter: searches title, notes, category, paymentMethod, paidTo
      if (query) {
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchNotes = item.notes?.toLowerCase().includes(query);
        const matchCategory = item.category?.toLowerCase().includes(query);
        const matchPayment = item.paymentMethod?.toLowerCase().includes(query);
        const matchPaidTo = item.paidTo?.toLowerCase().includes(query);
        return matchTitle || matchNotes || matchCategory || matchPayment || matchPaidTo;
      }

      return true;
    });
  }, [periodExpenses, selectedCategory, searchQuery]);

  // Dynamically calculate total strictly from active filtered expenses (respects month, category, and search)
  const totalMonthlyExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  // Dynamically calculate Milk Sales for the active period from ledger entries
  const milkSales = useMemo(() => {
    if (!entries) return 0;
    const todayStr = getDeviceTodayDate();
    return entries
      .filter((e) => {
        if (!e.date.startsWith(currentMonthKey)) return false;
        if (e.contactRole !== 'buyer' && e.contactRole !== undefined) return false;

        if (granularity === 'monthly') return true;

        if (granularity === 'daily') {
          const isCurrentMonth = currentMonthKey === todayStr.slice(0, 7);
          const targetDate = isCurrentMonth ? todayStr : `${currentMonthKey}-01`;
          return e.date === targetDate;
        }

        if (granularity === 'weekly') {
          const isCurrentMonth = currentMonthKey === todayStr.slice(0, 7);
          if (isCurrentMonth) {
            const d = new Date(todayStr);
            d.setDate(d.getDate() - 6);
            const sevenDaysAgo = d.toISOString().slice(0, 10);
            return e.date >= sevenDaysAgo && e.date <= todayStr;
          }
          return true;
        }

        return true;
      })
      .reduce((sum, e) => sum + e.totalAmount, 0);
  }, [entries, currentMonthKey, granularity]);

  // Net Profit & Loss = Milk Sales − Expenses
  const netPnL = milkSales - totalMonthlyExpenses;

  // Helper to build the Expenses PDF document, Blob, and File for sharing & downloading
  const buildExpensesPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;

    // Header Banner in Dark Forest Green (#1B5E20)
    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, pageWidth, 26, 'F');

    let textStartX = margin;
    if (businessSettings?.logoUrl) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 4, 18, 18, 3, 3, 'F');
        const imgFmt =
          businessSettings.logoUrl.startsWith('data:image/jpeg') ||
          businessSettings.logoUrl.startsWith('data:image/jpg')
            ? 'JPEG'
            : 'PNG';
        doc.addImage(businessSettings.logoUrl, imgFmt, margin + 1, 5, 16, 16);
        textStartX = margin + 22;
      } catch (e) {
        textStartX = margin;
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(businessSettings?.businessName?.trim() || 'Dairy Diary', textStartX, 11);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`EXPENSES DIARY · ${getFullMonthDisplay(currentMonthKey).toUpperCase()}`, textStartX, 19);

    if (businessSettings?.phone) {
      doc.setFontSize(8);
      doc.text(`Phone: ${businessSettings.phone}`, pageWidth - margin, 11, { align: 'right' });
    }
    if (businessSettings?.location) {
      doc.setFontSize(7.5);
      doc.text(businessSettings.location, pageWidth - margin, 18, { align: 'right' });
    }

    // Financial Summary Box
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(200, 230, 210);
    doc.roundedRect(margin, 32, pageWidth - margin * 2, 22, 2, 2, 'FD');

    doc.setTextColor(117, 117, 117);
    doc.setFontSize(7.5);
    doc.text('TOTAL EXPENSES', margin + 6, 39);
    doc.text('MILK SALES', margin + 65, 39);
    doc.text('NET P&L', margin + 125, 39);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(229, 115, 115);
    doc.text(`-Rs ${Math.round(totalMonthlyExpenses).toLocaleString('en-PK')}`, margin + 6, 48);
    doc.setTextColor(46, 125, 50);
    doc.text(`+Rs ${Math.round(milkSales).toLocaleString('en-PK')}`, margin + 65, 48);
    doc.setTextColor(netPnL >= 0 ? 46 : 229, netPnL >= 0 ? 125 : 115, netPnL >= 0 ? 50 : 115);
    doc.text(`${netPnL >= 0 ? '+' : '-'}Rs ${Math.abs(Math.round(netPnL)).toLocaleString('en-PK')}`, margin + 125, 48);

    // Table Header Row
    let yPos = 60;
    doc.setFillColor(232, 245, 233);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7.5, 'F');
    doc.setTextColor(27, 94, 32);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', margin + 2, yPos + 5);
    doc.text('TITLE / CATEGORY', margin + 28, yPos + 5);
    doc.text('PAYMENT', margin + 105, yPos + 5);
    doc.text('AMOUNT', pageWidth - margin - 2, yPos + 5, { align: 'right' });

    yPos += 11;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const itemsToExport = filteredExpenses.length > 0 ? filteredExpenses : periodExpenses;

    itemsToExport.forEach((item) => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(7.5);
      doc.text(item.date, margin + 2, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(item.title.substring(0, 38), margin + 28, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(117, 117, 117);
      doc.text(item.paymentMethod || 'Cash', margin + 105, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 115, 115);
      doc.text(`-Rs ${item.amount.toLocaleString('en-PK')}`, pageWidth - margin - 2, yPos, { align: 'right' });
      doc.setTextColor(30, 41, 59);

      yPos += 7;
    });

    const filename = `Dairy_Diary_Expenses_${currentMonthKey}.pdf`;
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    return { doc, blob, file, filename };
  };

  // WhatsApp Share Handler for Expense Diary (Feature 1️⃣ & Fix 2)
  const handleShareWhatsAppExpenseReport = async () => {
    const summaryText = `*DAIRY DIARY — EXPENSES DIARY*\n*Period:* ${getFullMonthDisplay(currentMonthKey)}\n\n*Total Expenses:* -Rs ${Math.round(totalMonthlyExpenses).toLocaleString('en-PK')} (${filteredExpenses.length} transactions)\n*Milk Sales:* +Rs ${Math.round(milkSales).toLocaleString('en-PK')}\n*Net P&L:* ${netPnL >= 0 ? '+' : '-'}Rs ${Math.abs(Math.round(netPnL)).toLocaleString('en-PK')}\n\n_Generated via Dairy Diary_`;

    try {
      // 1. Generate PDF file for attachment
      const { file, blob, filename } = await buildExpensesPdf();

      // 2. On devices supporting Web Share API with file attachments (e.g., mobile WhatsApp)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Dairy Diary — Expenses Diary (${getFullMonthDisplay(currentMonthKey)})`,
            text: summaryText,
          });
          if (showToast) showToast('Expenses report shared via share sheet');
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      // 3. Fallback: Web Share API text sharing
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Dairy Diary — Expenses Diary`,
            text: summaryText,
          });
          if (showToast) showToast('Expenses summary shared');
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      // 4. Fallback: Direct WhatsApp URL + Auto-download PDF
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
      const opened = window.open(waUrl, '_blank');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = waUrl;
      }
      if (showToast) showToast('Opening WhatsApp with expenses summary (PDF downloaded)...');
    } catch (err) {
      console.error('WhatsApp share error:', err);
      const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
      window.open(waUrl, '_blank');
      if (showToast) showToast('Opening WhatsApp with expenses summary...');
    }
  };

  // PDF Export / Download Handler for Expense Diary (Feature 1️⃣ & Fix 3)
  const handleExportPdfExpenseReport = async () => {
    try {
      if (showToast) showToast('Generating Expense Diary PDF...');
      const { file, blob, filename } = await buildExpensesPdf();

      // 1. On mobile devices supporting Web Share API with files: open system save/share sheet
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Dairy Diary — Expenses Diary (${getFullMonthDisplay(currentMonthKey)})`,
          });
          if (showToast) showToast('Expense Diary PDF opened in share sheet!');
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      // 2. Direct browser download trigger via Blob URL
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      downloadLink.target = '_blank';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

      if (showToast) showToast('Expense Diary PDF downloaded!');
    } catch (err) {
      console.error('PDF export error:', err);
      if (showToast) showToast('Failed to generate Expense PDF');
    }
  };

  // Open modal for NEW expense
  const handleOpenAddModal = () => {
    const now = new Date();
    const todayStr = getDeviceTodayDate();
    const timeStr = now.toTimeString().substring(0, 5); // "HH:MM"

    setEditingExpenseId(null);
    setCategory('feed_wanda');
    setTitle('');
    setAmount('');
    setPaymentMethod('Cash');
    setDate(todayStr);
    setTime(timeStr);
    setNotes('');
    setPaidTo('');
    setShowModal(true);
  };

  // Open modal for EDITING existing expense (Section 10)
  const handleOpenEditModal = (item: ExpenseItem) => {
    setEditingExpenseId(item.id);
    setCategory(item.category || 'other');
    setTitle(item.title);
    setAmount(item.amount.toString());
    setPaymentMethod(item.paymentMethod || 'Cash');
    setDate(item.date);
    setTime(item.time || '12:00');
    setNotes(item.notes || '');
    setPaidTo(item.paidTo || '');
    setShowModal(true);
  };

  // Quick Category selection handler (Section 2)
  const handleSelectQuickCategory = (catId: string, defaultTitle: string) => {
    setCategory(catId);
    if (!title.trim()) {
      setTitle(defaultTitle);
    }
  };

  // Submit Handler (Add or Edit)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0 || !date.trim()) {
      return;
    }

    if (editingExpenseId && onUpdateExpense) {
      // Edit existing expense
      onUpdateExpense({
        id: editingExpenseId,
        title: title.trim(),
        category,
        amount: numAmount,
        date: date.trim(),
        time: time.trim() || undefined,
        paidTo: paidTo.trim() || 'Farm Expense',
        paymentMethod: paymentMethod || 'Cash',
        notes: notes.trim() || undefined,
      });
    } else {
      // Create new expense
      onAddExpense({
        title: title.trim(),
        category,
        amount: numAmount,
        date: date.trim(),
        time: time.trim() || undefined,
        paidTo: paidTo.trim() || 'Farm Expense',
        paymentMethod: paymentMethod || 'Cash',
        notes: notes.trim() || undefined,
      });
    }

    setShowModal(false);
  };

  // Delete Handler (Section 11)
  const handleConfirmDelete = () => {
    if (deletingExpense && onDeleteExpense) {
      onDeleteExpense(deletingExpense.id);
      setDeletingExpense(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-transparent overflow-y-auto pb-24">
      <div className="p-4 space-y-4 max-w-md mx-auto w-full">
        {/* 1️⃣ HEADER WITH ACTIONS */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-xl font-black text-[#163B32] tracking-tight">
              Expenses Diary
            </h1>
            <p className="text-xs text-[#55756D] font-medium mt-0.5">
              Track feed, medicine &amp; farm costs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsAppExpenseReport}
              className="w-10 h-10 rounded-2xl bg-white hover:bg-slate-50 active:scale-95 text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center transition-all cursor-pointer shadow-xs"
              title="Share on WhatsApp"
            >
              <MessageCircle className="w-5 h-5 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={handleExportPdfExpenseReport}
              className="w-10 h-10 rounded-2xl bg-white hover:bg-slate-50 active:scale-95 text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center transition-all cursor-pointer shadow-xs"
              title="Export PDF"
            >
              <FileDown className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* 2️⃣ MONTH SELECTOR */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center bg-white rounded-2xl p-1 border border-[#D6E9E1] shadow-xs flex-1">
            <button
              type="button"
              onClick={() => onMonthChange && onMonthChange(shiftMonthKey(currentMonthKey, -1))}
              className="p-2 text-[#55756D] hover:text-[#163B32] hover:bg-slate-50 active:scale-95 rounded-xl transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <div className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 bg-slate-50 border border-[#D6E9E1]/50 rounded-xl text-[#163B32] font-black text-xs tracking-tight">
              <Calendar className="w-4 h-4 text-[#0B8F68] shrink-0" />
              <span>{getFullMonthDisplay(currentMonthKey)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#55756D] shrink-0" />
            </div>
            <button
              type="button"
              onClick={() => onMonthChange && onMonthChange(shiftMonthKey(currentMonthKey, 1))}
              className="p-2 text-[#55756D] hover:text-[#163B32] hover:bg-slate-50 active:scale-95 rounded-xl transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Granularity Dropdown Pill (Monthly / Weekly / Daily) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsGranularityMenuOpen(!isGranularityMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-[#D6E9E1] rounded-2xl text-xs font-bold text-[#163B32] shadow-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer focus:outline-none"
              aria-label="Select Period Granularity"
              aria-expanded={isGranularityMenuOpen}
            >
              <span>{granularity === 'monthly' ? 'Monthly' : granularity === 'weekly' ? 'Weekly' : 'Daily'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#55756D] transition-transform duration-150 ${
                  isGranularityMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isGranularityMenuOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsGranularityMenuOpen(false)}
                />

                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-2xl shadow-xl border border-[#D6E9E1] py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 select-none text-[#163B32]">
                  <div className="px-2.5 py-1 border-b border-[#D6E9E1]">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#55756D]">
                      Period View
                    </span>
                  </div>

                  {(['monthly', 'weekly', 'daily'] as const).map((opt) => {
                    const isSelected = granularity === opt;
                    const label = opt === 'monthly' ? 'Monthly' : opt === 'weekly' ? 'Weekly' : 'Daily';
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setGranularity(opt);
                          setIsGranularityMenuOpen(false);
                          if (showToast) showToast(`Switched to ${label} view`);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#E1F3EA] text-[#0B8F68] font-black'
                            : 'text-[#163B32] hover:bg-slate-50'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#0B8F68] stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3️⃣ TOTAL EXPENSES CARD (WITH 3 MINI STATS) */}
        <div className="glass-card rounded-3xl p-4.5 border border-[#D6E9E1] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-[#55756D] uppercase tracking-wider block">
              TOTAL EXPENSES
            </span>
            <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-[#55756D] rounded-full border border-[#D6E9E1]">
              {filteredExpenses.length} transactions
            </span>
          </div>

          <div>
            <span className="text-3xl font-black text-[#E5485D] tracking-tight block">
              -Rs {totalMonthlyExpenses.toLocaleString('en-PK')}
            </span>
          </div>

          {/* 3 Mini Stats: Milk Sales | Expenses | Net P&L */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#D6E9E1]">
            {/* Milk Sales */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#55756D]">
                <ArrowUp className="w-3 h-3 text-[#0B9B72]" />
                <span>Milk Sales</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-[#0B9B72] block tracking-tight">
                +Rs {Math.round(milkSales).toLocaleString('en-PK')}
              </span>
            </div>

            {/* Expenses */}
            <div className="space-y-0.5 border-x border-[#D6E9E1] px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#55756D]">
                <ArrowDown className="w-3 h-3 text-[#E5485D]" />
                <span>Expenses</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-[#E5485D] block tracking-tight">
                -Rs {Math.round(totalMonthlyExpenses).toLocaleString('en-PK')}
              </span>
            </div>

            {/* Net P&L */}
            <div className="space-y-0.5 text-right">
              <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-[#55756D]">
                <TrendingUp className={`w-3 h-3 ${netPnL >= 0 ? 'text-[#0B9B72]' : 'text-[#E5485D]'}`} />
                <span>Net P&amp;L</span>
              </div>
              <span className={`text-xs sm:text-sm font-black tracking-tight block ${netPnL >= 0 ? 'text-[#0B9B72]' : 'text-[#E5485D]'}`}>
                {netPnL >= 0 ? '+Rs ' : '-Rs '}{Math.abs(Math.round(netPnL)).toLocaleString('en-PK')}
              </span>
            </div>
          </div>
        </div>

        {/* 4️⃣ SEARCH BAR */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-[#0B8F68]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, note, category or payment..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#D6E9E1] rounded-2xl text-xs font-semibold text-[#163B32] placeholder:text-[#7A8C84] focus:outline-none focus:border-[#0B8F68] focus:ring-1 focus:ring-[#0B8F68] shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#55756D] hover:text-[#163B32] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 5️⃣ CATEGORY FILTER CHIPS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {dynamicCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  isSelected
                    ? 'bg-[#0B8F68] text-white border border-[#0B8F68] font-black'
                    : 'bg-white text-[#55756D] border border-[#D6E9E1] hover:text-[#163B32]'
                }`}
              >
                {cat.id === 'all' && <LayoutGrid className="w-3.5 h-3.5" />}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expense Log (Section 9) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#163B32]">
              Expense Log · {filteredExpenses.length} Items
            </h3>
            <span className="text-[11px] text-[#55756D] font-semibold">
              {selectedCategory !== 'all' ? `Category: ${selectedCategory}` : `Filter: ${currentMonthKey}`}
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center glass-card rounded-3xl border border-[#D6E9E1] shadow-xs space-y-2">
              <FileText className="w-8 h-8 text-[#55756D]/60 mx-auto" />
              <p className="text-xs text-[#163B32] font-black">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No matching expenses found.'
                  : `No expenses logged for ${getFullMonthDisplay(currentMonthKey)}.`}
              </p>
              <p className="text-[11px] text-[#55756D]">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search query or category filter.'
                  : 'Tap "+" below to log feed, diesel, medicine or repair costs.'}
              </p>
            </div>
          ) : (
            filteredExpenses.map((item) => {
              const catDetails = getCategoryDetails(item.category);
              const CatIcon = catDetails.icon;

              return (
                <div 
                  key={item.id} 
                  className="glass-card rounded-3xl p-4 border border-[#D6E9E1] shadow-xs hover:border-[#0B8F68]/40 transition-all flex flex-col gap-2 relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1]">
                        <CatIcon className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-sm text-[#163B32] tracking-tight truncate">
                            {item.title}
                          </h4>
                        </div>
                        {item.notes && (
                          <p className="text-[11px] text-[#55756D] font-medium line-clamp-1 mt-0.5">
                            {item.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-[#55756D] font-semibold mt-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#55756D] shrink-0" />
                            <span>{formatItemDateSubtitle(item.date, item.time)}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#55756D] border border-[#D6E9E1]">
                            {item.paymentMethod || 'Cash'}
                          </span>
                          {item.paidTo && (
                            <span className="text-[#7A8C84] text-[10px] truncate">
                              · {item.paidTo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount & Three-Dot Popover Menu */}
                    <div className="flex items-center gap-1 shrink-0 self-start">
                      <span className="font-black text-[#E5485D] text-sm sm:text-base tracking-tight">
                        -Rs {item.amount.toLocaleString('en-PK')}
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                          className="p-1.5 text-[#55756D] hover:text-[#163B32] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === item.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-20" 
                              onClick={() => setActiveMenuId(null)} 
                            />
                            <div className="absolute right-0 top-8 z-30 w-32 bg-white rounded-2xl shadow-xl border border-[#D6E9E1] py-1.5 animate-in fade-in zoom-in-95 text-[#163B32]">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleOpenEditModal(item);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#163B32] hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 stroke-[2.2] text-[#0B8F68]" />
                                <span>Edit</span>
                              </button>
                              {onDeleteExpense && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeletingExpense(item);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#E5485D] hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Action Button (+) (Piece 4️⃣) */}
      <button
        type="button"
        onClick={handleOpenAddModal}
        className="fixed sm:absolute bottom-20 right-4 z-30 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-95 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all cursor-pointer border border-white/30"
        title="Add Farm Expense"
      >
        <Plus className="w-6 h-6 stroke-[2.8]" />
      </button>

      {/* Add / Edit Expense Modal (Matching Reference Screen Structure) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#C8E6C9] flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1B5E20] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-extrabold text-base tracking-tight text-white">
                {editingExpenseId ? 'Edit Farm Expense' : 'Add Farm Expense'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="p-1 hover:bg-[#144717] rounded-xl text-emerald-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* 1. Expense Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800 tracking-tight">
                  Expense Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {quickCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = category === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectQuickCategory(cat.id, cat.defaultTitle)}
                        className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#1B5E20] text-white border-[#1B5E20] shadow-2xs font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-[#2E7D32] font-semibold'
                        }`}
                      >
                        <CatIcon className={`w-4 h-4 ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`} />
                        <span className="text-[10px] leading-tight line-clamp-1">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Expense Title / Item Name */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 tracking-tight">
                  <span className="text-red-500">*</span> Expense Title / Item Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cattle Feed (Wanda 5 Bags)"
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                />
              </div>

              {/* 3. Amount (Rs) */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 tracking-tight">
                  <span className="text-red-500">*</span> Amount (Rs)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-slate-400">Rs</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 19500"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm font-black bg-white border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                  />
                </div>
              </div>

              {/* 4. Payment Method (Feature 4️⃣) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800 tracking-tight">
                  Payment Method
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Cash', 'Bank', 'Easypaisa', 'JazzCash', 'Other'].map((method) => {
                    const isSelected = paymentMethod.toLowerCase() === method.toLowerCase();
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1B5E20] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Editable Date & Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-800 tracking-tight flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#1B5E20]" />
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-800 tracking-tight flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#1B5E20]" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                  />
                </div>
              </div>

              {/* 6. Paid To / Vendor (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 tracking-tight">
                  Paid To / Vendor (Optional)
                </label>
                <input
                  type="text"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="e.g. Punjab Feed Mills Mandra"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:border-[#1B5E20]"
                />
              </div>

              {/* 7. Notes (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 tracking-tight">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Purchased 5 bags of Wanda feed for buffalo lactation herd."
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:border-[#1B5E20] leading-relaxed resize-none"
                />
              </div>

              {/* Modal Save Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-3 px-4 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-[#1B5E20] text-white text-xs font-black uppercase tracking-wider hover:bg-[#144717] transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingExpenseId ? 'Update Expense' : 'Save Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Section 11) */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-rose-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900">Delete Expense?</h4>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <span className="font-bold text-slate-800">{deletingExpense.title}</span> ({formatPKR(deletingExpense.amount)})?
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
