import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Droplet,
  Tag,
  Banknote,
  FileText,
  Sun,
  Moon,
  Calendar,
  Search,
  Share2,
  TrendingUp,
  CreditCard,
  Receipt,
  Eye,
  EyeOff,
  Loader2,
  ListChecks,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
  PieChart,
} from 'lucide-react';
import { Contact, LedgerEntry, ExpenseItem, PaymentRecord } from '../types/dairy';
import {
  formatReportDateDisplay,
  shiftDateString,
  getFullMonthDisplay,
  shiftMonthKey,
  formatPKR,
  getDeviceTodayDate,
  getDeviceCurrentMonthKey,
} from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';
import { generateReportsPdf, ReportsPdfLineItem } from '../utils/pdfGenerator';

interface ReportsViewProps {
  currentMonthKey: string;
  contacts: Contact[];
  entries: LedgerEntry[];
  expenses: ExpenseItem[];
  paymentRecords?: PaymentRecord[];
}

type ReportMode = 'buy_sell' | 'profit_loss';
type ReportTimeFrame = 'daily' | 'monthly' | 'yearly';
type ItemTypeFilter = 'all' | 'milk' | 'payment' | 'expense';

type ReportItem =
  | { kind: 'milk'; id: string; sortKey: string; entry: LedgerEntry }
  | { kind: 'payment'; id: string; sortKey: string; payment: PaymentRecord }
  | { kind: 'expense'; id: string; sortKey: string; expense: ExpenseItem };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Converts "07:13 AM" / "Today, 03:07 PM" (or empty) into a sortable 24h "HH:MM" string.
function timeToSortable(timeStr?: string): string {
  if (!timeStr) return '00:00';
  const cleaned = timeStr.replace(/^(Today|Yesterday),\s*/i, '').trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])?$/);
  if (!match) return '00:00';
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function formatShortDay(dateStr: string): string {
  const [, monthStr, dayStr] = dateStr.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return `${day} ${MONTH_NAMES[monthIdx] || ''}`;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  currentMonthKey,
  contacts,
  entries,
  expenses,
  paymentRecords = [],
}) => {
  // 1. Top-Level Mode: Buy & Sell (operational ledger view) vs Profit & Loss (accounting view)
  const [activeMode, setActiveMode] = useState<ReportMode>('buy_sell');

  // 2. Time Frame & Navigation State
  const [timeFrame, setTimeFrame] = useState<ReportTimeFrame>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getDeviceTodayDate);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey || getDeviceCurrentMonthKey());
  const [selectedYear, setSelectedYear] = useState<string>(() => (currentMonthKey || getDeviceCurrentMonthKey()).substring(0, 4));

  React.useEffect(() => {
    if (currentMonthKey) {
      setSelectedMonth(currentMonthKey);
    }
  }, [currentMonthKey]);

  // 3. Dropdown Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'sell' | 'buy'>('all');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [plFilter, setPlFilter] = useState<'all' | 'sell' | 'buy'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 4. Chart visibility + PDF generation state
  const [showChart, setShowChart] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Date/Period Navigation
  const handlePrevTime = () => {
    if (timeFrame === 'daily') setSelectedDate((prev) => shiftDateString(prev, -1));
    else if (timeFrame === 'monthly') setSelectedMonth((prev) => shiftMonthKey(prev, -1));
    else setSelectedYear((prev) => String(parseInt(prev, 10) - 1));
  };

  const handleNextTime = () => {
    if (timeFrame === 'daily') setSelectedDate((prev) => shiftDateString(prev, 1));
    else if (timeFrame === 'monthly') setSelectedMonth((prev) => shiftMonthKey(prev, 1));
    else setSelectedYear((prev) => String(parseInt(prev, 10) + 1));
  };

  const periodLabel =
    timeFrame === 'daily'
      ? formatReportDateDisplay(selectedDate)
      : timeFrame === 'monthly'
      ? getFullMonthDisplay(selectedMonth)
      : selectedYear;

  const plPeriodBadgeLabel =
    timeFrame === 'daily'
      ? `Daily (${formatShortDay(selectedDate)})`
      : timeFrame === 'monthly'
      ? `Monthly (${periodLabel})`
      : `Yearly (${periodLabel})`;

  // Does a raw YYYY-MM-DD date string fall within the currently selected period?
  const dateInPeriod = (dateStr: string): boolean => {
    if (timeFrame === 'daily') return dateStr === selectedDate;
    if (timeFrame === 'monthly') return dateStr.startsWith(selectedMonth);
    return dateStr.startsWith(selectedYear);
  };

  // 5. Period-scoped milk entries (Type + Shift filters apply here — Item Type is a display-layer filter below)
  const periodMilkEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!dateInPeriod(entry.date)) return false;
      if (typeFilter === 'buy' && entry.contactRole !== 'seller') return false;
      if (typeFilter === 'sell' && entry.contactRole !== 'buyer') return false;
      if (shiftFilter === 'morning' && entry.shift !== 'morning') return false;
      if (shiftFilter === 'evening' && entry.shift !== 'evening') return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, timeFrame, selectedDate, selectedMonth, selectedYear, typeFilter, shiftFilter]);

  // Same date/shift scoping as periodMilkEntries, but never excluded by the
  // Buy/Sell typeFilter tab — Profit & Loss must always see both sides of
  // the ledger regardless of which tab happens to be active.
  const periodMilkEntriesForPL = useMemo(() => {
    return entries.filter((entry) => {
      if (!dateInPeriod(entry.date)) return false;
      if (shiftFilter === 'morning' && entry.shift !== 'morning') return false;
      if (shiftFilter === 'evening' && entry.shift !== 'evening') return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, timeFrame, selectedDate, selectedMonth, selectedYear, shiftFilter]);

  // 6. Period-scoped payments (same billingMonth-aware rule as every other screen, extended to monthly/yearly)
  const periodPayments = useMemo(() => {
    return (paymentRecords || []).filter((p) => {
      let matchesPeriod: boolean;
      if (timeFrame === 'daily') {
        const dailyMonthKey = selectedDate.substring(0, 7);
        matchesPeriod = p.billingMonth ? p.billingMonth === dailyMonthKey : p.date === selectedDate;
      } else if (timeFrame === 'monthly') {
        matchesPeriod = p.billingMonth ? p.billingMonth === selectedMonth : p.date.startsWith(selectedMonth);
      } else {
        matchesPeriod = p.billingMonth ? p.billingMonth.startsWith(selectedYear) : p.date.startsWith(selectedYear);
      }
      if (!matchesPeriod) return false;

      if (typeFilter !== 'all') {
        const contact = contacts.find((c) => c.id === p.contactId || c.name === p.contactName);
        if (typeFilter === 'buy' && contact?.role !== 'seller') return false;
        if (typeFilter === 'sell' && contact?.role !== 'buyer') return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRecords, timeFrame, selectedDate, selectedMonth, selectedYear, typeFilter, contacts]);

  // 7. Period-scoped expenses (shift/type filters don't apply — expenses aren't buy/sell milk or shift-based)
  const periodExpenses = useMemo(() => {
    return expenses.filter((ex) => dateInPeriod(ex.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, timeFrame, selectedDate, selectedMonth, selectedYear]);

  // 8. Summary Metrics (Buy & Sell tab) — Single source of truth for Due via getCustomerMonthDue
  const metrics = useMemo(() => {
    const totalMilk = periodMilkEntries.reduce((sum, e) => sum + e.liters, 0);
    const totalAmount = periodMilkEntries.reduce((sum, e) => sum + e.totalAmount, 0);
    const entriesReceived = periodMilkEntries.reduce((sum, e) => sum + e.receivedAmount, 0);
    const paymentsReceived = periodPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalReceived = entriesReceived + paymentsReceived;

    const targetContacts = contacts.filter((c) => {
      if (typeFilter === 'buy') return c.role === 'seller';
      if (typeFilter === 'sell') return c.role === 'buyer';
      return true;
    });

    let totalDue = 0;

    if (timeFrame === 'monthly' && shiftFilter === 'all') {
      // Full month view: reuse getCustomerMonthDue for each customer and sum individual dues
      for (const contact of targetContacts) {
        const fin = getCustomerMonthDue(contact, selectedMonth, entries, paymentRecords);
        totalDue += fin.due;
      }
    } else if (timeFrame === 'yearly' && shiftFilter === 'all') {
      // Yearly view: sum getCustomerMonthDue across each of the year's 12 month keys per customer.
      // Still the single canonical function, just invoked once per month rather than hand-rolled.
      for (const contact of targetContacts) {
        for (let m = 1; m <= 12; m++) {
          const monthKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
          totalDue += getCustomerMonthDue(contact, monthKey, periodMilkEntries, periodPayments).due;
        }
      }
    } else {
      // Scoped timeframe (daily, or any shift filter active): delegate to getCustomerMonthDue so
      // this path uses the exact same due formula, payment-matching rule, and zero-floor as every
      // other screen — just fed the period's own filtered entries/payments instead of a full month.
      const scopedMonthKey = timeFrame === 'daily' ? selectedDate.substring(0, 7) : selectedMonth;

      const customerIds = new Set<string>();
      targetContacts.forEach((c) => customerIds.add(c.id));
      periodMilkEntries.forEach((e) => {
        if (e.contactId) customerIds.add(e.contactId);
      });
      periodPayments.forEach((p) => {
        if (p.contactId) customerIds.add(p.contactId);
      });

      customerIds.forEach((cId) => {
        const contactObj = contacts.find((c) => c.id === cId);
        if (!contactObj) return;

        const fin = getCustomerMonthDue(contactObj, scopedMonthKey, periodMilkEntries, periodPayments);
        totalDue += fin.due;
      });
    }

    return {
      milk: totalMilk,
      amount: totalAmount,
      received: totalReceived,
      due: totalDue,
      count: periodMilkEntries.length,
    };
  }, [periodMilkEntries, periodPayments, contacts, typeFilter, shiftFilter, timeFrame, selectedMonth, selectedYear, selectedDate, entries, paymentRecords]);

  // 9. Profit & Loss Metrics — Sell Revenue − Buy Cost − Expenses for the selected period.
  // This is a distinct accounting metric, not a customer-due calculation, so it does not go
  // through getCustomerMonthDue (which only ever answers "what does one customer owe").
  const plMetrics = useMemo(() => {
    const revenue = periodMilkEntriesForPL
      .filter((e) => e.contactRole === 'buyer')
      .reduce((sum, e) => sum + e.totalAmount, 0);
    const cost = periodMilkEntriesForPL
      .filter((e) => e.contactRole === 'seller')
      .reduce((sum, e) => sum + e.totalAmount, 0);
    const expensesTotal = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - cost - expensesTotal;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    return { revenue, cost, expensesTotal, netProfit, margin };
  }, [periodMilkEntriesForPL, periodExpenses]);

  // Previous period's Net Profit (yesterday / last month / last year), for the "vs prev" badge.
  const prevPeriodNetProfit = useMemo(() => {
    let matchFn: (d: string) => boolean;
    if (timeFrame === 'daily') {
      const prevDate = shiftDateString(selectedDate, -1);
      matchFn = (d) => d === prevDate;
    } else if (timeFrame === 'monthly') {
      const prevMonth = shiftMonthKey(selectedMonth, -1);
      matchFn = (d) => d.startsWith(prevMonth);
    } else {
      const prevYear = String(parseInt(selectedYear, 10) - 1);
      matchFn = (d) => d.startsWith(prevYear);
    }
    const prevEntries = entries.filter((e) => matchFn(e.date) && (shiftFilter === 'all' || e.shift === shiftFilter));
    const prevExpenses = expenses.filter((ex) => matchFn(ex.date));
    const revenue = prevEntries.filter((e) => e.contactRole === 'buyer').reduce((s, e) => s + e.totalAmount, 0);
    const cost = prevEntries.filter((e) => e.contactRole === 'seller').reduce((s, e) => s + e.totalAmount, 0);
    const expensesTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);
    return revenue - cost - expensesTotal;
  }, [entries, expenses, timeFrame, selectedDate, selectedMonth, selectedYear, shiftFilter]);

  // 10. Unified Entry List: Milk + Payment + Expense, filtered by Item Type and search, newest first
  const unifiedItems = useMemo(() => {
    const items: ReportItem[] = [];

    if (itemTypeFilter === 'all' || itemTypeFilter === 'milk') {
      periodMilkEntries.forEach((entry) => {
        items.push({ kind: 'milk', id: entry.id, entry, sortKey: `${entry.date}T${timeToSortable(entry.timestamp)}` });
      });
    }
    if (itemTypeFilter === 'all' || itemTypeFilter === 'payment') {
      periodPayments.forEach((payment) => {
        items.push({ kind: 'payment', id: payment.id, payment, sortKey: `${payment.date}T${timeToSortable(payment.timestamp)}` });
      });
    }
    if (itemTypeFilter === 'all' || itemTypeFilter === 'expense') {
      periodExpenses.forEach((expense) => {
        items.push({ kind: 'expense', id: expense.id, expense, sortKey: `${expense.date}T${timeToSortable(expense.time)}` });
      });
    }

    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) => {
          if (item.kind === 'milk') return item.entry.contactName.toLowerCase().includes(q);
          if (item.kind === 'payment') return (item.payment.contactName || '').toLowerCase().includes(q);
          return (
            item.expense.title.toLowerCase().includes(q) ||
            (item.expense.paidTo || '').toLowerCase().includes(q)
          );
        })
      : items;

    return filtered.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [periodMilkEntries, periodPayments, periodExpenses, itemTypeFilter, searchQuery]);

  // 11. 7-Day Buy/Sell Trend — always the 7 calendar days ending today, independent of the date
  // navigator above, so the trend widget always reads as "recent activity" at a glance.
  const sevenDayTrend = useMemo(() => {
    const today = getDeviceTodayDate();
    const days: { date: string; label: string; buy: number; sell: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDateString(today, -i);
      const dayEntries = entries.filter((e) => e.date === d);
      const buy = dayEntries.filter((e) => e.contactRole === 'seller').reduce((s, e) => s + e.totalAmount, 0);
      const sell = dayEntries.filter((e) => e.contactRole === 'buyer').reduce((s, e) => s + e.totalAmount, 0);
      days.push({ date: d, label: formatShortDay(d), buy, sell });
    }
    return days;
  }, [entries]);

  const trendTotals = useMemo(() => {
    const sellTotal = sevenDayTrend.reduce((s, d) => s + d.sell, 0);
    const buyTotal = sevenDayTrend.reduce((s, d) => s + d.buy, 0);
    return { sellTotal, buyTotal, grandTotal: sellTotal + buyTotal };
  }, [sevenDayTrend]);

  const maxTrendValue = useMemo(() => {
    const vals = sevenDayTrend.flatMap((d) => [d.buy, d.sell]);
    const max = Math.max(0, ...vals);
    return max > 0 ? max : 1;
  }, [sevenDayTrend]);

  // 7-Day Financial Trend (Profit & Loss tab only) — Sell / Buy / Expenses per day.
  const financialTrendPL = useMemo(() => {
    const today = getDeviceTodayDate();
    const days: { date: string; label: string; buy: number; sell: number; exp: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDateString(today, -i);
      const dayEntries = entries.filter((e) => e.date === d);
      const buy = dayEntries.filter((e) => e.contactRole === 'seller').reduce((s, e) => s + e.totalAmount, 0);
      const sell = dayEntries.filter((e) => e.contactRole === 'buyer').reduce((s, e) => s + e.totalAmount, 0);
      const exp = expenses.filter((ex) => ex.date === d).reduce((s, ex) => s + ex.amount, 0);
      days.push({ date: d, label: formatShortDay(d), buy, sell, exp });
    }
    return days;
  }, [entries, expenses]);

  const financialTrendMax = useMemo(() => {
    const vals = financialTrendPL.flatMap((d) => [d.buy, d.sell, d.exp]);
    const max = Math.max(0, ...vals);
    return max > 0 ? max : 1;
  }, [financialTrendPL]);

  const netProfitVsPrev = plMetrics.netProfit - prevPeriodNetProfit;

  // 12. Share & PDF Actions
  const buildReportSummaryText = () => {
    const lines = [
      '*Dairy Diary — Report*',
      periodLabel,
      '',
      `Milk: ${metrics.milk.toFixed(2)} L`,
      `Buy & Sell: ${formatPKR(metrics.amount)}`,
      `Paid / Received: ${formatPKR(metrics.received)}`,
      `Entries: ${metrics.count}`,
    ];
    if (metrics.due > 0) lines.push(`Outstanding Due: ${formatPKR(metrics.due)}`);
    return lines.join('\n');
  };

  // Shared PDF generation, reused by both the Share and PDF buttons so they always
  // attach/download the exact same document.
  const buildReportsPdfFile = async () => {
    const pdfItems: ReportsPdfLineItem[] = unifiedItems.map((item) => {
      if (item.kind === 'milk') {
        return {
          date: item.entry.date,
          time: item.entry.timestamp,
          typeLabel: 'Milk',
          label: item.entry.contactName,
          detail: `${item.entry.liters.toFixed(2)} L @ Rs${item.entry.ratePerLiter.toFixed(1)}/L`,
          amount: item.entry.totalAmount,
        };
      }
      if (item.kind === 'payment') {
        return {
          date: item.payment.date,
          time: item.payment.timestamp,
          typeLabel: 'Payment',
          label: item.payment.contactName,
          detail: item.payment.paymentMethod || 'Received',
          amount: item.payment.amount,
        };
      }
      return {
        date: item.expense.date,
        time: item.expense.time,
        typeLabel: 'Expense',
        label: item.expense.title,
        detail: item.expense.paidTo || '',
        amount: item.expense.amount,
      };
    });

    return generateReportsPdf(
      {
        periodTitle: periodLabel,
        milkLiters: metrics.milk,
        buySellAmount: metrics.amount,
        paidReceived: metrics.received,
        entriesCount: metrics.count,
        due: metrics.due,
      },
      pdfItems
    );
  };

  // Share: generate the PDF report and attach it via the native share sheet (Web Share
  // API Level 2). Falls back to downloading the PDF + opening WhatsApp with the text
  // summary when file sharing isn't supported, and to text-only WhatsApp if PDF
  // generation itself fails.
  const handleShare = async () => {
    setIsSharing(true);
    const summaryText = buildReportSummaryText();
    try {
      const pdfRes = await buildReportsPdfFile();

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfRes.file] })) {
        try {
          await navigator.share({
            files: [pdfRes.file],
            title: `Dairy Diary Report — ${periodLabel}`,
            text: summaryText,
          });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return; // user cancelled the native share sheet
          // otherwise fall through to the download + WhatsApp fallback below
        }
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = pdfRes.url;
      downloadLink.download = pdfRes.filename;
      downloadLink.click();
      window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank');
    } catch (err) {
      console.error('Reports share error:', err);
      // Last resort if PDF generation itself fails: original text-only behavior
      window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank');
    } finally {
      setIsSharing(false);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdfRes = await buildReportsPdfFile();

      const downloadLink = document.createElement('a');
      downloadLink.href = pdfRes.url;
      downloadLink.download = pdfRes.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Reports PDF generation error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-transparent select-none">
      {/* 1. Top Header: Title + Buy & Sell / Profit & Loss Mode Toggle */}
      <div className="bg-white px-4 pt-3 pb-2.5 flex items-center justify-between shrink-0 border-b border-[#D6E9E1] z-20">
        <h1 className="text-xl font-black text-[#163B32] tracking-tight shrink-0">Reports</h1>

        <div className="bg-slate-100 p-1 rounded-full flex items-center border border-[#D6E9E1] shadow-xs ml-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveMode('buy_sell')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeMode === 'buy_sell'
                ? 'bg-[#1597E5] text-white shadow-xs'
                : 'text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            Buy &amp; Sell
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('profit_loss')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeMode === 'profit_loss'
                ? 'bg-[#0B8F68] text-white shadow-xs'
                : 'text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Profit &amp; Loss
          </button>
        </div>
      </div>

      {/* 2. Pinned Control Section: Date Navigator, Daily/Monthly/Yearly, Filters, Cards */}
      <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0 bg-transparent">
        {/* Row 1: Date Navigator Capsule & Daily/Monthly/Yearly Segment Controller */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white rounded-full px-3 py-1.5 flex items-center justify-between border border-[#D6E9E1] shadow-xs relative min-w-0">
            <button
              type="button"
              onClick={handlePrevTime}
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-full text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer shrink-0"
              title="Previous Period"
              aria-label="Previous Period"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>

            <label className="font-extrabold text-xs sm:text-sm text-[#163B32] tracking-tight select-none cursor-pointer flex items-center gap-1 truncate px-1">
              <span className="truncate">{periodLabel}</span>
              <Calendar className="w-3.5 h-3.5 text-[#0B8F68] ml-0.5 opacity-90 shrink-0" />
              {timeFrame !== 'yearly' && (
                <input
                  type={timeFrame === 'daily' ? 'date' : 'month'}
                  value={timeFrame === 'daily' ? selectedDate : selectedMonth}
                  onChange={(e) => {
                    if (timeFrame === 'daily') setSelectedDate(e.target.value);
                    else setSelectedMonth(e.target.value);
                  }}
                  className="sr-only"
                />
              )}
            </label>

            <button
              type="button"
              onClick={handleNextTime}
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-full text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer shrink-0"
              title="Next Period"
              aria-label="Next Period"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Time Frame Toggle: [ Daily | Monthly | Yearly ] Segment Controller */}
          <div className="bg-slate-100 p-1 rounded-full flex items-center border border-[#D6E9E1] shadow-xs shrink-0">
            {(['daily', 'monthly', 'yearly'] as ReportTimeFrame[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeFrame(tf)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer capitalize ${
                  timeFrame === tf
                    ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                    : 'text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {activeMode === 'buy_sell' ? (
          <>
            {/* Row 2: Three Filter Selectors — Type, Shift, Item Type */}
            <div className="grid grid-cols-3 gap-2">
              <div className="relative bg-white rounded-full border border-[#D6E9E1] shadow-xs px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#55756D] mr-1">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="text-xs font-bold text-[#163B32] bg-transparent outline-none cursor-pointer w-full text-right appearance-none pr-3"
                >
                  <option value="all">All</option>
                  <option value="sell">Sell</option>
                  <option value="buy">Buy</option>
                </select>
                <div className="pointer-events-none absolute right-2 text-[#55756D] text-[10px]">▼</div>
              </div>

              <div className="relative bg-white rounded-full border border-[#D6E9E1] shadow-xs px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#55756D] mr-1">Shift:</span>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value as any)}
                  className="text-xs font-bold text-[#163B32] bg-transparent outline-none cursor-pointer w-full text-right appearance-none pr-3"
                >
                  <option value="all">All</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
                <div className="pointer-events-none absolute right-2 text-[#55756D] text-[10px]">▼</div>
              </div>

              <div className="relative bg-white rounded-full border border-[#D6E9E1] shadow-xs px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#55756D] mr-1">Item:</span>
                <select
                  value={itemTypeFilter}
                  onChange={(e) => setItemTypeFilter(e.target.value as ItemTypeFilter)}
                  className="text-xs font-bold text-[#163B32] bg-transparent outline-none cursor-pointer w-full text-right appearance-none pr-3"
                >
                  <option value="all">All</option>
                  <option value="milk">Milk</option>
                  <option value="payment">Payment</option>
                  <option value="expense">Expense</option>
                </select>
                <div className="pointer-events-none absolute right-2 text-[#55756D] text-[10px]">▼</div>
              </div>
            </div>

            {/* Row 3: 4 Summary Cards (live calculations, independent of Item Type / search) */}
            <div className="grid grid-cols-4 gap-2 pt-0.5">
              <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
                <div className="text-[#1597E5] mb-1">
                  <Droplet className="w-4 h-4 fill-sky-100 stroke-[#1597E5] stroke-[2]" />
                </div>
                <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
                  {metrics.milk.toFixed(2)} L
                </span>
                <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">Milk</span>
              </div>

              <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
                <div className="text-[#7B2CBF] mb-1">
                  <Tag className="w-4 h-4 stroke-[#7B2CBF] stroke-[2]" />
                </div>
                <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
                  Rs{Math.round(metrics.amount).toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">Buy &amp; Sell</span>
              </div>

              <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
                <div className="text-[#0B9B72] mb-1">
                  <Banknote className="w-4 h-4 stroke-[#0B9B72] stroke-[2]" />
                </div>
                <span className="text-xs sm:text-sm font-black text-[#0B9B72] tracking-tight leading-none">
                  Rs{Math.round(metrics.received).toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">Paid/Received</span>
              </div>

              <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
                <div className="text-amber-600 mb-1">
                  <ListChecks className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
                  {metrics.count}
                </span>
                <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">Entries</span>
              </div>
            </div>

            {/* Due Balance Status Strip */}
            {metrics.due > 0 && (
              <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold">
                <span className="text-[11px] text-rose-800">
                  Period Outstanding Due ({typeFilter === 'buy' ? 'Payable' : 'Receivable'}):
                </span>
                <span className="font-black text-[#E5485D]">Rs {Math.round(metrics.due).toLocaleString()}</span>
              </div>
            )}
          </>
        ) : (
          /* Profit & Loss Panel */
          <div className="space-y-2.5">
            {/* Filter Pills: All / Sales (Sell) / Purchases (Buy) */}
            <div className="grid grid-cols-3 gap-2">
              {(['all', 'sell', 'buy'] as const).map((f) => {
                const cfg = {
                  all: { label: 'All', Icon: PieChart, bg: 'bg-[#E9F3FF]', border: 'border-[#1597E5]', text: 'text-[#1597E5]' },
                  sell: { label: 'Sales (Sell)', Icon: ArrowUp, bg: 'bg-[#E1F3EA]', border: 'border-[#0B8F68]', text: 'text-[#0B8F68]' },
                  buy: { label: 'Purchases (Buy)', Icon: ShoppingCart, bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700' },
                }[f];
                const Icon = cfg.Icon;
                const active = plFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPlFilter(f)}
                    className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-full border text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      active ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'bg-white border-[#D6E9E1] text-[#55756D]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Net Profit Card */}
            <div
              className={`rounded-2xl p-4 border shadow-xs ${
                plMetrics.netProfit >= 0 ? 'bg-[#E1F3EA] border-[#B8E0CC]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded-full bg-white/70 border border-[#D6E9E1] text-[10px] font-bold text-[#163B32]">
                  {plPeriodBadgeLabel}
                </span>
                <span
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black ${
                    plMetrics.netProfit >= 0
                      ? 'bg-white border-[#0B8F68] text-[#0B8F68]'
                      : 'bg-white border-[#E5485D] text-[#E5485D]'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {plMetrics.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
                </span>
              </div>

              <div className="text-center py-1">
                <span
                  className={`block text-[11px] font-black uppercase tracking-wider ${
                    plMetrics.netProfit >= 0 ? 'text-[#0B8F68]' : 'text-[#E5485D]'
                  }`}
                >
                  Total Net Profit
                </span>
                <span
                  className={`block text-3xl font-black tracking-tight mt-1 ${
                    plMetrics.netProfit >= 0 ? 'text-[#0B8F68]' : 'text-[#E5485D]'
                  }`}
                >
                  {plMetrics.netProfit >= 0 ? '+' : '-'}Rs{Math.abs(Math.round(plMetrics.netProfit)).toLocaleString()}
                </span>

                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/70 border border-[#B8E0CC] text-[10px] font-bold text-[#0B8F68]">
                    Profit Margin: {plMetrics.margin.toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#55756D]">
                    {netProfitVsPrev >= 0 ? (
                      <ArrowUp className="w-3 h-3 text-[#0B8F68]" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-[#E5485D]" />
                    )}
                    Rs{Math.abs(Math.round(netProfitVsPrev)).toLocaleString()} vs prev
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div
                  className={`rounded-xl p-2 text-center bg-white/60 border ${
                    plFilter === 'sell' ? 'border-[#0B8F68] ring-1 ring-[#0B8F68]' : 'border-transparent'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-[#0B8F68]">
                    <ArrowUp className="w-3 h-3" /> Sales (Sell)
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-[#0B8F68] mt-1">
                    +Rs{Math.round(plMetrics.revenue).toLocaleString()}
                  </span>
                </div>
                <div
                  className={`rounded-xl p-2 text-center bg-white/60 border ${
                    plFilter === 'buy' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-transparent'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700">
                    <ShoppingCart className="w-3 h-3" /> Purchases (Buy)
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-amber-700 mt-1">
                    -Rs{Math.round(plMetrics.cost).toLocaleString()}
                  </span>
                </div>
                <div className="rounded-xl p-2 text-center bg-white/60 border border-transparent">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-[#E5485D]">
                    <ArrowDown className="w-3 h-3" /> Expenses
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-[#E5485D] mt-1">
                    -Rs{Math.round(plMetrics.expensesTotal).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Scrollable Content: Trend Chart (Buy & Sell only) + Search/Share/PDF + Entry List */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-1 overflow-y-auto pb-24">
        {activeMode === 'buy_sell' && (
          <>
            {/* Buy & Sell Trend (7 Days) Chart Card */}
            <div className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs mb-3 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-[#163B32] flex items-center gap-1.5">
                  📊 Buy &amp; Sell Trend (7 Days)
                </span>
                <button
                  type="button"
                  onClick={() => setShowChart((s) => !s)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[#55756D] text-[10px] font-bold transition-colors cursor-pointer"
                >
                  {showChart ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showChart ? 'Hide' : 'Show'}
                </button>
              </div>

              {showChart && (
                <>
                  <div className="flex items-center gap-3 text-[11px] font-bold mb-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[#1597E5]">
                      <span className="w-2 h-2 rounded-full bg-[#1597E5] inline-block" /> Sell: Rs{Math.round(trendTotals.sellTotal).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Buy: Rs{Math.round(trendTotals.buyTotal).toLocaleString()}
                    </span>
                    <span className="text-[#55756D] font-semibold ml-auto">
                      Total: Rs{Math.round(trendTotals.grandTotal).toLocaleString()}
                    </span>
                  </div>

                  <div className="h-28 flex items-end gap-1.5 px-0.5">
                    {sevenDayTrend.map((d) => {
                      const sellPct = Math.max(d.sell > 0 ? 6 : 0, (d.sell / maxTrendValue) * 100);
                      const buyPct = Math.max(d.buy > 0 ? 6 : 0, (d.buy / maxTrendValue) * 100);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div className="flex items-end gap-0.5 h-full w-full justify-center">
                            <div
                              style={{ height: `${sellPct}%` }}
                              className="w-2.5 sm:w-3 rounded-t bg-[#1597E5] transition-all"
                              title={`Sell: Rs${Math.round(d.sell).toLocaleString()}`}
                            />
                            <div
                              style={{ height: `${buyPct}%` }}
                              className="w-2.5 sm:w-3 rounded-t bg-amber-500 transition-all"
                              title={`Buy: Rs${Math.round(d.buy).toLocaleString()}`}
                            />
                          </div>
                          <span className="text-[9px] text-[#55756D] font-bold mt-1 whitespace-nowrap">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Search + Share + PDF Row */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="flex-1 flex items-center gap-1.5 bg-white rounded-full border border-[#D6E9E1] shadow-xs px-3 py-2 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#55756D] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search seller..."
                  className="text-xs font-medium text-[#163B32] bg-transparent outline-none w-full min-w-0 placeholder:text-[#9AAFA8]"
                />
              </div>

              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-1 px-3 py-2 rounded-full bg-[#E1F3EA] hover:bg-[#d6ecdf] active:bg-[#c9e4d5] text-[#0B8F68] border border-[#B8E0CC] text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-60"
                title="Share report PDF"
              >
                {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                Share
              </button>

              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1 px-3 py-2 rounded-full bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 border border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-60 shrink-0"
                title="Generate period PDF report"
              >
                {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                PDF
              </button>
            </div>

            {/* Entry Details Header */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-base font-black text-[#163B32] tracking-tight">Entry Details</h2>
              {periodPayments.length > 0 && (
                <span className="text-[11px] font-bold text-[#0B8F68] bg-[#E1F3EA] px-2.5 py-0.5 rounded-full border border-[#D6E9E1]">
                  {periodPayments.length} payment{periodPayments.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Unified Scrollable Entry List */}
            <div className="space-y-2">
              {unifiedItems.length === 0 ? (
                <div className="p-8 text-center glass-card rounded-2xl border border-[#D6E9E1] my-2">
                  <Droplet className="w-8 h-8 text-[#55756D]/60 mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#163B32]">No records found</p>
                  <p className="text-xs text-[#55756D] mt-1">
                    Zero records for {periodLabel} under the current filters.
                  </p>
                </div>
              ) : (
                unifiedItems.map((item) => {
                  if (item.kind === 'milk') {
                    const entry = item.entry;
                    const isMorning = entry.shift === 'morning';
                    return (
                      <div
                        key={`milk-${item.id}`}
                        className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center justify-between hover:border-[#1597E5]/30 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-sky-50 text-[#1597E5] flex items-center justify-center shrink-0 border border-sky-100">
                            <Droplet className="w-5 h-5 fill-sky-100 stroke-[#1597E5] stroke-[2]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-sm text-[#163B32] truncate">
                                {entry.contactName}
                              </span>
                              {isMorning ? (
                                <span
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700"
                                  title="Morning Shift"
                                >
                                  <Sun className="w-3 h-3 fill-amber-500 text-amber-500" />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700"
                                  title="Evening Shift"
                                >
                                  <Moon className="w-3 h-3 fill-indigo-500 text-indigo-500" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#55756D] font-medium mt-0.5">
                              {entry.liters.toFixed(2)} L @ Rs{entry.ratePerLiter.toFixed(1)}/L
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <div className="text-sm font-black text-[#1597E5] tracking-tight">
                            Rs{Math.round(entry.totalAmount).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-[#7A8C84] font-medium mt-0.5">
                            {entry.timestamp || '-'}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === 'payment') {
                    const payment = item.payment;
                    return (
                      <div
                        key={`payment-${item.id}`}
                        className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center justify-between hover:border-[#0B9B72]/30 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#0B9B72] flex items-center justify-center shrink-0 border border-emerald-100">
                            <CreditCard className="w-5 h-5 stroke-[2]" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-sm text-[#163B32] truncate block">
                              {payment.contactName}
                            </span>
                            <div className="text-xs text-[#55756D] font-medium mt-0.5">
                              Payment Received{payment.paymentMethod ? ` · ${payment.paymentMethod}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <div className="text-sm font-black text-[#0B9B72] tracking-tight">
                            +Rs{Math.round(payment.amount).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-[#7A8C84] font-medium mt-0.5">
                            {payment.timestamp || '-'}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const expense = item.expense;
                  return (
                    <div
                      key={`expense-${item.id}`}
                      className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center justify-between hover:border-[#E5485D]/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-rose-50 text-[#E5485D] flex items-center justify-center shrink-0 border border-rose-100">
                          <Receipt className="w-5 h-5 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-sm text-[#163B32] truncate block">
                            {expense.title}
                          </span>
                          <div className="text-xs text-[#55756D] font-medium mt-0.5 truncate">
                            {expense.paidTo || 'Expense'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <div className="text-sm font-black text-[#E5485D] tracking-tight">
                          -Rs{Math.round(expense.amount).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-[#7A8C84] font-medium mt-0.5">
                          {expense.time || '-'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeMode === 'profit_loss' && (
          <div className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs mb-3 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-[#163B32] flex items-center gap-1.5">
                📊 Financial Trend ({financialTrendPL[0].label} - {financialTrendPL[6].label})
              </span>
              <button
                type="button"
                onClick={() => setShowChart((s) => !s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[#55756D] text-[10px] font-bold transition-colors cursor-pointer"
              >
                {showChart ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showChart ? 'Hide' : 'Show'}
              </button>
            </div>

            {showChart && (
              <>
                <div className="flex items-center gap-3 text-[11px] font-bold mb-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[#1597E5]">
                    <span className="w-2 h-2 rounded-full bg-[#1597E5] inline-block" /> Sell
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Buy
                  </span>
                  <span className="flex items-center gap-1 text-[#E5485D]">
                    <span className="w-2 h-2 rounded-full bg-[#E5485D] inline-block" /> Exp
                  </span>
                </div>

                <div className="h-28 flex items-end gap-1.5 px-0.5">
                  {financialTrendPL.map((d) => {
                    const sellPct = plFilter === 'buy' ? 0 : Math.max(d.sell > 0 ? 6 : 0, (d.sell / financialTrendMax) * 100);
                    const buyPct = plFilter === 'sell' ? 0 : Math.max(d.buy > 0 ? 6 : 0, (d.buy / financialTrendMax) * 100);
                    const expPct = Math.max(d.exp > 0 ? 6 : 0, (d.exp / financialTrendMax) * 100);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div className="flex items-end gap-0.5 h-full w-full justify-center">
                          {plFilter !== 'buy' && (
                            <div
                              style={{ height: `${sellPct}%` }}
                              className="w-2 sm:w-2.5 rounded-t bg-[#1597E5] transition-all"
                              title={`Sell: Rs${Math.round(d.sell).toLocaleString()}`}
                            />
                          )}
                          {plFilter !== 'sell' && (
                            <div
                              style={{ height: `${buyPct}%` }}
                              className="w-2 sm:w-2.5 rounded-t bg-amber-500 transition-all"
                              title={`Buy: Rs${Math.round(d.buy).toLocaleString()}`}
                            />
                          )}
                          <div
                            style={{ height: `${expPct}%` }}
                            className="w-2 sm:w-2.5 rounded-t bg-[#E5485D] transition-all"
                            title={`Expenses: Rs${Math.round(d.exp).toLocaleString()}`}
                          />
                        </div>
                        <span className="text-[9px] text-[#55756D] font-bold mt-1 whitespace-nowrap">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
