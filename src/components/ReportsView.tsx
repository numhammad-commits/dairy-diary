import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  ChevronLeft, 
  ChevronRight, 
  Droplet, 
  Tag, 
  Banknote, 
  FileText, 
  Sun, 
  Moon, 
  X, 
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { Contact, LedgerEntry, ExpenseItem, PaymentRecord } from '../types/dairy';
import { 
  formatReportDateDisplay, 
  shiftDateString, 
  getFullMonthDisplay, 
  shiftMonthKey, 
  formatPKR,
  getDeviceTodayDate,
  getDeviceCurrentMonthKey
} from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';

interface ReportsViewProps {
  currentMonthKey: string;
  contacts: Contact[];
  entries: LedgerEntry[];
  expenses: ExpenseItem[];
  paymentRecords?: PaymentRecord[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  currentMonthKey,
  contacts,
  entries,
  expenses,
  paymentRecords = [],
}) => {
  // 1. Time Frame & Navigation State (defaults to 'daily' and current device date)
  const [timeFrame, setTimeFrame] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getDeviceTodayDate);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey || getDeviceCurrentMonthKey());

  React.useEffect(() => {
    if (currentMonthKey) {
      setSelectedMonth(currentMonthKey);
    }
  }, [currentMonthKey]);

  // 2. Dropdown Filters (Sections 3, 4, 5: All, Sell, Buy)
  const [typeFilter, setTypeFilter] = useState<'all' | 'sell' | 'buy'>('all');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [milkFilter, setMilkFilter] = useState<'all' | 'cow' | 'buffalo'>('all');

  // 3. Sales Graph Modal State
  const [showGraphModal, setShowGraphModal] = useState<boolean>(false);
  const [graphMetric, setGraphMetric] = useState<'liters' | 'amount'>('liters');

  // Date Shift Navigation
  const handlePrevTime = () => {
    if (timeFrame === 'daily') {
      setSelectedDate((prev) => shiftDateString(prev, -1));
    } else {
      setSelectedMonth((prev) => shiftMonthKey(prev, -1));
    }
  };

  const handleNextTime = () => {
    if (timeFrame === 'daily') {
      setSelectedDate((prev) => shiftDateString(prev, 1));
    } else {
      setSelectedMonth((prev) => shiftMonthKey(prev, 1));
    }
  };

  // 4. Reactive Filter Pipeline (100% Real Live Data, Section 1, 2, 3, 4, 5, 6, 7)
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Time Filter: Daily vs Monthly
      if (timeFrame === 'daily') {
        if (entry.date !== selectedDate) return false;
      } else {
        if (!entry.date.startsWith(selectedMonth)) return false;
      }

      // Type Filter: All vs Buy (sellers) vs Sell (buyers)
      if (typeFilter === 'buy' && entry.contactRole !== 'seller') return false;
      if (typeFilter === 'sell' && entry.contactRole !== 'buyer') return false;

      // Shift Filter: All vs Morning vs Evening
      if (shiftFilter === 'morning' && entry.shift !== 'morning') return false;
      if (shiftFilter === 'evening' && entry.shift !== 'evening') return false;

      // Milk Category Filter: All vs Cow vs Buffalo
      if (milkFilter === 'cow' && entry.milkType !== 'cow') return false;
      if (milkFilter === 'buffalo' && entry.milkType !== 'buffalo') return false;

      return true;
    });
  }, [entries, timeFrame, selectedDate, selectedMonth, typeFilter, shiftFilter, milkFilter]);

  // 5. Grid Summary Metrics Calculations (Per-customer due sum, zero global netting)
  const metrics = useMemo(() => {
    const totalMilk = filteredEntries.reduce((sum, e) => sum + e.liters, 0);
    const totalAmount = filteredEntries.reduce((sum, e) => sum + e.totalAmount, 0);
    const entriesReceived = filteredEntries.reduce((sum, e) => sum + e.receivedAmount, 0);

    const matchingPayments = (paymentRecords || []).filter((p) => {
      if (timeFrame === 'daily') {
        // A payment carrying a billingMonth belongs to the month it was billed for, not the
        // day it happened to be recorded, so match on that month rather than the exact date.
        const dailyMonthKey = selectedDate.substring(0, 7); // YYYY-MM
        return p.billingMonth
          ? p.billingMonth === dailyMonthKey
          : p.date === selectedDate;
      }
      return p.billingMonth ? p.billingMonth === selectedMonth : p.date.startsWith(selectedMonth);
    });
    const paymentsReceived = matchingPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalReceived = entriesReceived + paymentsReceived;

    // Filter contacts according to active typeFilter
    const targetContacts = contacts.filter((c) => {
      if (typeFilter === 'buy') return c.role === 'seller';
      if (typeFilter === 'sell') return c.role === 'buyer';
      return true;
    });

    let totalDue = 0;

    if (timeFrame === 'monthly' && shiftFilter === 'all' && milkFilter === 'all') {
      // Full month view: reuse getCustomerMonthDue for each customer and sum individual dues
      for (const contact of targetContacts) {
        const fin = getCustomerMonthDue(contact, selectedMonth, entries, paymentRecords);
        totalDue += fin.due;
      }
    } else {
      // Scoped timeframe (daily/shift/milk filter): delegate to getCustomerMonthDue so this
      // path uses the exact same due formula, payment-matching rule, and zero-floor as every
      // other screen — just fed the period's own filtered entries/payments instead of a full
      // month. (Daily mode has no monthKey of its own, so derive one from selectedDate; it only
      // narrows the internal date-prefix check, which filteredEntries/matchingPayments already
      // satisfy by construction.)
      const scopedMonthKey = timeFrame === 'daily' ? selectedDate.substring(0, 7) : selectedMonth;

      const customerIds = new Set<string>();
      targetContacts.forEach((c) => customerIds.add(c.id));
      filteredEntries.forEach((e) => {
        if (e.contactId) customerIds.add(e.contactId);
      });
      matchingPayments.forEach((p) => {
        if (p.contactId) customerIds.add(p.contactId);
      });

      customerIds.forEach((cId) => {
        const contactObj = contacts.find((c) => c.id === cId);
        if (!contactObj) return;

        const fin = getCustomerMonthDue(contactObj, scopedMonthKey, filteredEntries, matchingPayments);
        totalDue += fin.due;
      });
    }

    const totalCount = filteredEntries.length;

    return {
      milk: totalMilk,
      amount: totalAmount,
      received: totalReceived,
      due: totalDue,
      count: totalCount,
    };
  }, [
    filteredEntries,
    paymentRecords,
    timeFrame,
    selectedDate,
    selectedMonth,
    contacts,
    typeFilter,
    shiftFilter,
    milkFilter,
    entries,
  ]);

  // 6. Analytics for Graph Modal (Real dynamic data)
  const analytics = useMemo(() => {
    const morningEntries = filteredEntries.filter((e) => e.shift === 'morning');
    const eveningEntries = filteredEntries.filter((e) => e.shift === 'evening');
    const buffaloEntries = filteredEntries.filter((e) => e.milkType === 'buffalo');
    const cowEntries = filteredEntries.filter((e) => e.milkType === 'cow');

    const morningLiters = morningEntries.reduce((s, e) => s + e.liters, 0);
    const eveningLiters = eveningEntries.reduce((s, e) => s + e.liters, 0);
    const morningAmount = morningEntries.reduce((s, e) => s + e.totalAmount, 0);
    const eveningAmount = eveningEntries.reduce((s, e) => s + e.totalAmount, 0);

    const buffaloLiters = buffaloEntries.reduce((s, e) => s + e.liters, 0);
    const cowLiters = cowEntries.reduce((s, e) => s + e.liters, 0);

    return {
      morningLiters,
      eveningLiters,
      morningAmount,
      eveningAmount,
      buffaloLiters,
      cowLiters,
      morningCount: morningEntries.length,
      eveningCount: eveningEntries.length,
    };
  }, [filteredEntries]);

  // 7. Monthly Daily Timeline Data for Graph (Sections 8 & 9)
  const monthlyTimelineData = useMemo(() => {
    if (timeFrame !== 'monthly') return [];

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayEntries = filteredEntries.filter((e) => e.date === dayStr);
      const liters = dayEntries.reduce((s, e) => s + e.liters, 0);
      const amount = dayEntries.reduce((s, e) => s + e.totalAmount, 0);
      days.push({
        day,
        date: dayStr,
        liters,
        amount,
        count: dayEntries.length,
      });
    }
    return days;
  }, [timeFrame, selectedMonth, filteredEntries]);

  // Max value for monthly chart scaling
  const maxMonthlyValue = useMemo(() => {
    if (monthlyTimelineData.length === 0) return 1;
    const values = monthlyTimelineData.map((d) => (graphMetric === 'liters' ? d.liters : d.amount));
    const max = Math.max(...values);
    return max > 0 ? max : 1;
  }, [monthlyTimelineData, graphMetric]);

  // Type labels according to Section 3, 4, 5
  const typeDisplayTitle = typeFilter === 'buy' ? 'Buying' : typeFilter === 'sell' ? 'Selling' : 'Total';
  const typeFinancialLabel = typeFilter === 'buy' ? 'Buying Amount' : typeFilter === 'sell' ? 'Sales Amount' : 'Amount';
  const typeReceivedLabel = typeFilter === 'buy' ? 'Paid' : 'Received';

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-transparent select-none">
      {/* 1. Top Header: Frosted glass bar with bold white "Reports" typography & Sales Graph button */}
      <div className="bg-[#1B4332]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0 z-20">
        <h1 className="text-2xl font-black text-white tracking-tight text-glass-lift">
          Reports
        </h1>

        {/* Sales Graph Button: Border outline and text in frosted white with mini-graph icon */}
        <button
          type="button"
          onClick={() => setShowGraphModal(true)}
          className="border border-white/20 text-white hover:text-white bg-white/10 hover:bg-white/15 active:bg-white/20 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm shadow-sm group"
          title="Open Sales Graph & Analytics"
        >
          <BarChart2 className="w-4 h-4 stroke-[2.2] text-white group-hover:scale-110 transition-transform" />
          <span>Sales Graph</span>
        </button>
      </div>

      {/* 2. Pinned Control Section: Date Pill, Segment Switcher & Dropdowns */}
      <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0 bg-transparent">
        {/* Row 1: Date Navigator Capsule & Daily/Monthly Segment Controller */}
        <div className="flex items-center gap-2">
          {/* Calendar Controller: Wide frosted glass pill capsule with chevrons and direct picker */}
          <div className="flex-1 bg-white rounded-full px-3 py-1.5 flex items-center justify-between border border-[#D6E9E1] shadow-xs relative">
            <button
              type="button"
              onClick={handlePrevTime}
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-full text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer"
              title="Previous Date"
              aria-label="Previous Date"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>

            <label className="font-extrabold text-xs sm:text-sm text-[#163B32] tracking-tight select-none cursor-pointer flex items-center gap-1">
              {timeFrame === 'daily'
                ? formatReportDateDisplay(selectedDate)
                : getFullMonthDisplay(selectedMonth)}
              <Calendar className="w-3.5 h-3.5 text-[#0B8F68] ml-0.5 opacity-90" />
              <input
                type={timeFrame === 'daily' ? 'date' : 'month'}
                value={timeFrame === 'daily' ? selectedDate : selectedMonth}
                onChange={(e) => {
                  if (timeFrame === 'daily') setSelectedDate(e.target.value);
                  else setSelectedMonth(e.target.value);
                }}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={handleNextTime}
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-full text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer"
              title="Next Date"
              aria-label="Next Date"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Time Frame Toggle: [ Daily | Monthly ] Segment Controller */}
          <div className="bg-slate-100 p-1 rounded-full flex items-center border border-[#D6E9E1] shadow-xs">
            <button
              type="button"
              onClick={() => setTimeFrame('daily')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                timeFrame === 'daily'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setTimeFrame('monthly')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                timeFrame === 'monthly'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Row 2: Three Distinct Inline Pill-Shaped Filter Selectors */}
        <div className="grid grid-cols-3 gap-2">
          {/* Dropdown 1: Type Filter (Section 3: All, Sell, Buy) */}
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

          {/* Dropdown 2: Shift Filter */}
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

          {/* Dropdown 3: Milk Type Filter */}
          <div className="relative bg-white rounded-full border border-[#D6E9E1] shadow-xs px-2.5 py-1 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#55756D] mr-1">Milk:</span>
            <select
              value={milkFilter}
              onChange={(e) => setMilkFilter(e.target.value as any)}
              className="text-xs font-bold text-[#163B32] bg-transparent outline-none cursor-pointer w-full text-right appearance-none pr-3"
            >
              <option value="all">All</option>
              <option value="cow">Cow</option>
              <option value="buffalo">Buffalo</option>
            </select>
            <div className="pointer-events-none absolute right-2 text-[#55756D] text-[10px]">▼</div>
          </div>
        </div>

        {/* Row 3: Grid-Mapped Entry Summary Metrics (Live Calculations) */}
        <div className="grid grid-cols-4 gap-2 pt-0.5">
          {/* Card 1: Milk Volume Summary */}
          <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
            <div className="text-[#0B8F68] mb-1">
              <Droplet className="w-4 h-4 fill-emerald-100 stroke-[#0B8F68] stroke-[2]" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
              {metrics.milk.toFixed(2)} L
            </span>
            <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">
              Milk
            </span>
          </div>

          {/* Card 2: Financial Amount Summary (Sales / Purchases / Amount) */}
          <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
            <div className="text-[#0B8F68] mb-1">
              <Tag className="w-4 h-4 stroke-[#0B8F68] stroke-[2]" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
              Rs{Math.round(metrics.amount).toLocaleString()}
            </span>
            <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">
              {typeFilter === 'buy' ? 'Buy Amount' : typeFilter === 'sell' ? 'Sales' : 'Amount'}
            </span>
          </div>

          {/* Card 3: Collections / Settlement Summary (Received / Paid) */}
          <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
            <div className="text-[#0B8F68] mb-1">
              <Banknote className="w-4 h-4 stroke-[#0B8F68] stroke-[2]" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
              Rs{Math.round(metrics.received).toLocaleString()}
            </span>
            <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">
              {typeReceivedLabel}
            </span>
          </div>

          {/* Card 4: Counter Summary (Entries) */}
          <div className="glass-card rounded-2xl p-2.5 text-center border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center">
            <div className="text-[#0B8F68] mb-1">
              <FileText className="w-4 h-4 stroke-[#0B8F68] stroke-[2]" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#163B32] tracking-tight leading-none">
              {metrics.count}
            </span>
            <span className="text-[10px] font-semibold text-[#55756D] mt-1 uppercase tracking-wider">
              Entries
            </span>
          </div>
        </div>

        {/* Due Balance Status Strip (Section 4 & 5) */}
        {metrics.due > 0 && (
          <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold">
            <span className="text-[11px] text-rose-800">
              Period Outstanding Due ({typeFilter === 'buy' ? 'Payable' : 'Receivable'}):
            </span>
            <span className="font-black text-[#E5485D]">
              Rs {Math.round(metrics.due).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 3. Section Title & Scrollable Record List View */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-1">
        {/* Section Heading */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h2 className="text-base font-black text-[#163B32] tracking-tight">
            Entry Details
          </h2>
          <span className="text-[11px] font-semibold text-[#55756D]">
            {filteredEntries.length} Records ({typeDisplayTitle})
          </span>
        </div>

        {/* Scrollable Checklist */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-24 pr-0.5">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center glass-card rounded-2xl border border-[#D6E9E1] my-2">
              <Droplet className="w-8 h-8 text-[#55756D]/60 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#163B32]">No records found</p>
              <p className="text-xs text-[#55756D] mt-1">
                Zero entries for {timeFrame === 'daily' ? formatReportDateDisplay(selectedDate) : getFullMonthDisplay(selectedMonth)} under &quot;{typeFilter}&quot; filter.
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isMorning = entry.shift === 'morning';
              const isSeller = entry.contactRole === 'seller';

              return (
                <div
                  key={entry.id}
                  className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center justify-between hover:border-[#0B8F68]/30 transition-all"
                >
                  {/* Left Side: Avatar + Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Far Left Badge: Soft circular avatar housing milk droplet icon */}
                    <div className="w-10 h-10 rounded-full bg-[#E1F3EA] text-[#0B8F68] flex items-center justify-center shrink-0 border border-[#D6E9E1]">
                      <Droplet className="w-5 h-5 fill-emerald-200 stroke-[#0B8F68] stroke-[2]" />
                    </div>

                    {/* Center-Left Identity & Transaction Meta-Block */}
                    <div className="min-w-0">
                      {/* Row 1: Name + Role Badge + Inline Shift Icon */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-[#163B32] truncate">
                          {entry.contactName}
                        </span>

                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                          isSeller ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1]'
                        }`}>
                          {isSeller ? 'Buy Milk' : 'Sell Milk'}
                        </span>

                        {/* Shift indicator */}
                        {isMorning ? (
                          <span 
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 shadow-3xs"
                            title="Morning Shift"
                          >
                            <Sun className="w-3 h-3 fill-amber-500 text-amber-500" />
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-3xs"
                            title="Evening Shift"
                          >
                            <Moon className="w-3 h-3 fill-indigo-500 text-indigo-500" />
                          </span>
                        )}
                      </div>

                      {/* Row 2: Mathematical log: volume & dynamic rate */}
                      <div className="text-xs text-[#55756D] font-medium mt-0.5">
                        {entry.liters.toFixed(2)} L @ Rs{entry.ratePerLiter.toFixed(1)}/L · {entry.milkType || 'Buffalo'}
                      </div>
                    </div>
                  </div>

                  {/* Far Right Financial & Timestamp Meta-Block */}
                  <div className="text-right shrink-0 pl-2">
                    {/* Row 1: Calculated row total */}
                    <div className="text-sm font-black text-[#163B32] tracking-tight">
                      Rs{Math.round(entry.totalAmount).toLocaleString()}
                    </div>

                    {/* Row 2: Local Pakistan timestamp */}
                    <div className="text-[11px] text-[#7A8C84] font-medium mt-0.5">
                      {entry.timestamp || '07:12 AM'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Sales Graph & Analytics Modal (Fully Operational Real Data, Sections 8 & 9) */}
      {showGraphModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowGraphModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1B4332] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-300" />
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  {typeFilter === 'buy' ? 'Buying' : typeFilter === 'sell' ? 'Sales' : 'Milk'} Graph &amp; Analytics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGraphModal(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Overview Stat Box */}
              <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] text-center shadow-xs">
                <span className="text-[11px] uppercase tracking-wider text-[#55756D] font-bold block">
                  Total {timeFrame === 'daily' ? 'Day' : 'Month'} {typeFinancialLabel}
                </span>
                <span className="text-3xl font-black text-[#163B32] tracking-tight block mt-1">
                  Rs{Math.round(metrics.amount).toLocaleString('en-PK')}
                </span>
                <span className="text-xs text-[#55756D] font-semibold mt-1 block">
                  {metrics.milk.toFixed(2)} Liters across {metrics.count} entries
                </span>
              </div>

              {/* Monthly Timeline Bar Chart (Section 8: Real Monthly Data) */}
              {timeFrame === 'monthly' && (
                <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#163B32]">
                      Daily Activity ({getFullMonthDisplay(selectedMonth)})
                    </span>
                    <div className="flex gap-1 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setGraphMetric('liters')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          graphMetric === 'liters'
                            ? 'bg-[#0B8F68] text-white font-bold'
                            : 'bg-slate-100 text-[#55756D] hover:text-[#163B32]'
                        }`}
                      >
                        Liters
                      </button>
                      <button
                        type="button"
                        onClick={() => setGraphMetric('amount')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          graphMetric === 'amount'
                            ? 'bg-[#0B8F68] text-white font-bold'
                            : 'bg-slate-100 text-[#55756D] hover:text-[#163B32]'
                        }`}
                      >
                        Rs
                      </button>
                    </div>
                  </div>

                  {metrics.count === 0 ? (
                    <div className="p-6 text-center text-xs text-[#55756D] font-semibold">
                      No transaction records in {getFullMonthDisplay(selectedMonth)} for {typeFilter} filter.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Responsive Mini Timeline Bars for Month */}
                      <div className="h-28 flex items-end gap-1 px-1 pt-3 pb-1 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                        {monthlyTimelineData.map((d) => {
                          const val = graphMetric === 'liters' ? d.liters : d.amount;
                          const heightPct = val > 0 ? Math.max(8, (val / maxMonthlyValue) * 100) : 0;

                          return (
                            <div 
                              key={d.day} 
                              className="flex-1 min-w-[8px] flex flex-col items-center h-full justify-end group relative"
                            >
                              {val > 0 && (
                                <div className="absolute -top-6 bg-slate-900 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap">
                                  {d.day}: {graphMetric === 'liters' ? `${d.liters.toFixed(1)}L` : `Rs${Math.round(d.amount)}`}
                                </div>
                              )}
                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-full rounded-t transition-all ${
                                  val > 0 ? 'bg-[#0B8F68] group-hover:bg-emerald-600' : 'bg-transparent'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-[#55756D] font-bold px-1">
                        <span>Day 1</span>
                        <span>Day 15</span>
                        <span>Day {monthlyTimelineData.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shift Distribution Chart (Section 8: Real Shift Data) */}
              <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-[#163B32] flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    Shift Distribution
                  </span>
                  <span className="text-[11px] font-bold text-[#55756D]">
                    Morning vs Evening
                  </span>
                </div>

                {/* Visual Bar */}
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex mb-2">
                  <div 
                    className="bg-[#0B8F68] h-full transition-all duration-500"
                    style={{ 
                      width: metrics.milk > 0 
                        ? `${(analytics.morningLiters / metrics.milk) * 100}%` 
                        : '0%' 
                    }}
                  />
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ 
                      width: metrics.milk > 0 
                        ? `${(analytics.eveningLiters / metrics.milk) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[#163B32]">
                    Morning: {analytics.morningLiters.toFixed(1)} L ({analytics.morningCount} entries)
                  </span>
                  <span className="text-indigo-700">
                    Evening: {analytics.eveningLiters.toFixed(1)} L ({analytics.eveningCount} entries)
                  </span>
                </div>
              </div>

              {/* Milk Type Breakdown (Real Data) */}
              <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-[#163B32] flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5 text-[#0B8F68]" />
                    Milk Type Ratio
                  </span>
                  <span className="text-[11px] font-bold text-[#55756D]">
                    Buffalo vs Cow
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex mb-2">
                  <div 
                    className="bg-[#0B8F68] h-full transition-all duration-500"
                    style={{ 
                      width: metrics.milk > 0 
                        ? `${(analytics.buffaloLiters / metrics.milk) * 100}%` 
                        : '0%' 
                    }}
                  />
                  <div 
                    className="bg-teal-400 h-full transition-all duration-500"
                    style={{ 
                      width: metrics.milk > 0 
                        ? `${(analytics.cowLiters / metrics.milk) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[#163B32]">
                    Buffalo: {analytics.buffaloLiters.toFixed(1)} L
                  </span>
                  <span className="text-teal-700">
                    Cow: {analytics.cowLiters.toFixed(1)} L
                  </span>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowGraphModal(false)}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white rounded-2xl font-bold text-xs shadow-md border border-emerald-400/30 transition-all cursor-pointer"
              >
                Close Graph
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
