import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Moon, 
  Check, 
  AlertTriangle, 
  Palette,
  MousePointerClick,
  X
} from 'lucide-react';
import { Contact, LedgerEntry, ShiftType, MilkType } from '../types/dairy';
import { getDeviceTodayDate, shiftMonthKey, formatLiters } from '../utils/formatters';

interface BulkEntryModalProps {
  contact: Contact;
  entries: LedgerEntry[];
  initialMonthKey?: string;
  onClose: () => void;
  onSaveEntries: (newEntries: Omit<LedgerEntry, 'id'>[]) => void;
  showToast?: (message: string) => void;
}

export const BulkEntryModal: React.FC<BulkEntryModalProps> = ({
  contact,
  entries,
  initialMonthKey,
  onClose,
  onSaveEntries,
  showToast,
}) => {
  const todayStr = getDeviceTodayDate();
  const initialYearMonth = initialMonthKey || todayStr.substring(0, 7);

  // 1. Month Navigation State
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(initialYearMonth);

  // 2. Shift Selector: 'morning' | 'evening' | 'both'
  const [selectedShift, setSelectedShift] = useState<'morning' | 'evening' | 'both'>('morning');

  // 3. Batch Configuration (Rate & Quantity)
  const defaultRate = (contact.defaultRate || 240).toFixed(1);
  const defaultQty = (contact.fixedQuantity || contact.morningQuotaLiters || 4.0).toFixed(1);

  const [rateInput, setRateInput] = useState<string>(defaultRate);
  const [qtyInput, setQtyInput] = useState<string>(defaultQty);

  // 4. Staged Selections: map from dateStr (YYYY-MM-DD) -> { morning?: boolean; evening?: boolean }
  const [stagedDays, setStagedDays] = useState<Record<string, { morning?: boolean; evening?: boolean }>>({});

  // 5. Duplicate Warning Dialog State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Parse Month Details
  const { year, month, daysInMonth, firstDayIndex, monthDisplay } = useMemo(() => {
    const [yStr, mStr] = currentMonthKey.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const days = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const dateObj = new Date(y, m - 1, 1);
    const display = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return {
      year: y,
      month: m,
      daysInMonth: days,
      firstDayIndex: firstDay,
      monthDisplay: display,
    };
  }, [currentMonthKey]);

  // Existing database entries for this customer in this month
  const dbEntriesMap = useMemo(() => {
    const map: Record<string, { morning?: LedgerEntry; evening?: LedgerEntry }> = {};
    entries
      .filter((e) => e.contactId === contact.id && e.date.startsWith(currentMonthKey))
      .forEach((e) => {
        if (!map[e.date]) map[e.date] = {};
        if (e.shift === 'morning') map[e.date].morning = e;
        if (e.shift === 'evening') map[e.date].evening = e;
      });
    return map;
  }, [entries, contact.id, currentMonthKey]);

  // Numeric Values
  const parsedRate = parseFloat(rateInput) || 0;
  const parsedQty = parseFloat(qtyInput) || 0;

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonthKey((prev) => shiftMonthKey(prev, -1));
    setStagedDays({});
  };

  const handleNextMonth = () => {
    setCurrentMonthKey((prev) => shiftMonthKey(prev, 1));
    setStagedDays({});
  };

  // Helper to format date string
  const getDateStr = (dayNum: number): string => {
    const dayPadded = String(dayNum).padStart(2, '0');
    return `${currentMonthKey}-${dayPadded}`;
  };

  // Handle Date Cell Click with cycling: 1st Tap: Selected Shift -> 2nd Tap: Both -> 3rd Tap: Clear
  const handleDateClick = (dayNum: number) => {
    const dateStr = getDateStr(dayNum);
    const dbDay = dbEntriesMap[dateStr] || {};
    const stagedDay = stagedDays[dateStr] || {};

    const hasDbMorning = Boolean(dbDay.morning);
    const hasDbEvening = Boolean(dbDay.evening);
    const hasStagedMorning = Boolean(stagedDay.morning);
    const hasStagedEvening = Boolean(stagedDay.evening);

    // Format human readable date for warnings
    const dateObj = new Date(year, month - 1, dayNum);
    const formattedDate = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

    // If day is already staged in both shifts -> 3rd tap clears it
    if ((hasStagedMorning || hasDbMorning) && (hasStagedEvening || hasDbEvening) && (hasStagedMorning || hasStagedEvening)) {
      setStagedDays((prev) => {
        const copy = { ...prev };
        delete copy[dateStr];
        return copy;
      });
      return;
    }

    // If day is already staged for morning or evening -> 2nd tap promotes to Both (if free in DB)
    if (hasStagedMorning && !hasStagedEvening) {
      if (hasDbEvening) {
        setDuplicateWarning(`Evening delivery has already been entered for ${formattedDate}. Tap again to clear.`);
        setStagedDays((prev) => {
          const copy = { ...prev };
          delete copy[dateStr];
          return copy;
        });
        return;
      }
      setStagedDays((prev) => ({
        ...prev,
        [dateStr]: { morning: true, evening: true },
      }));
      return;
    }

    if (hasStagedEvening && !hasStagedMorning) {
      if (hasDbMorning) {
        setDuplicateWarning(`Morning delivery has already been entered for ${formattedDate}. Tap again to clear.`);
        setStagedDays((prev) => {
          const copy = { ...prev };
          delete copy[dateStr];
          return copy;
        });
        return;
      }
      setStagedDays((prev) => ({
        ...prev,
        [dateStr]: { morning: true, evening: true },
      }));
      return;
    }

    // 1st Tap: Not staged yet, apply according to selectedShift
    if (selectedShift === 'morning') {
      if (hasDbMorning) {
        setDuplicateWarning(`This customer's Morning delivery has already been entered for ${formattedDate}.`);
        return;
      }
      setStagedDays((prev) => ({
        ...prev,
        [dateStr]: { ...prev[dateStr], morning: true },
      }));
      return;
    }

    if (selectedShift === 'evening') {
      if (hasDbEvening) {
        setDuplicateWarning(`This customer's Evening delivery has already been entered for ${formattedDate}.`);
        return;
      }
      setStagedDays((prev) => ({
        ...prev,
        [dateStr]: { ...prev[dateStr], evening: true },
      }));
      return;
    }

    if (selectedShift === 'both') {
      if (hasDbMorning && hasDbEvening) {
        setDuplicateWarning(`Both Morning and Evening deliveries have already been entered for ${formattedDate}.`);
        return;
      }

      const nextState: { morning?: boolean; evening?: boolean } = {};
      if (!hasDbMorning) nextState.morning = true;
      if (!hasDbEvening) nextState.evening = true;

      setStagedDays((prev) => ({
        ...prev,
        [dateStr]: nextState,
      }));
    }
  };

  // Apply Action: Stage all available unentered days of the month with current shift
  const handleApply = () => {
    let newlyAddedCount = 0;
    const newStaged: Record<string, { morning?: boolean; evening?: boolean }> = { ...stagedDays };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = getDateStr(day);
      const dbDay = dbEntriesMap[dateStr] || {};
      const current = newStaged[dateStr] || {};

      let changed = false;
      const updated = { ...current };

      if (selectedShift === 'morning' || selectedShift === 'both') {
        if (!dbDay.morning && !updated.morning) {
          updated.morning = true;
          changed = true;
          newlyAddedCount++;
        }
      }

      if (selectedShift === 'evening' || selectedShift === 'both') {
        if (!dbDay.evening && !updated.evening) {
          updated.evening = true;
          changed = true;
          newlyAddedCount++;
        }
      }

      if (changed) {
        newStaged[dateStr] = updated;
      }
    }

    setStagedDays(newStaged);
    if (showToast) {
      if (newlyAddedCount > 0) {
        showToast(`Applied ${selectedShift} batch to ${newlyAddedCount} available delivery dates`);
      } else {
        showToast('All dates in this month already contain deliveries for this shift');
      }
    }
  };

  // Save Action: Convert all staged entries to real LedgerEntry objects
  const handleSave = () => {
    if (parsedQty <= 0) {
      setDuplicateWarning('Please enter a valid milk quantity greater than 0.');
      return;
    }
    if (parsedRate <= 0) {
      setDuplicateWarning('Please enter a valid milk rate.');
      return;
    }

    const entriesToCreate: Omit<LedgerEntry, 'id'>[] = [];

    // Iterate through all staged dates sorted chronologically
    const sortedDates = Object.keys(stagedDays).sort();

    for (const dateStr of sortedDates) {
      const staged = stagedDays[dateStr];
      const dbDay = dbEntriesMap[dateStr] || {};

      // Morning entry
      if (staged.morning && !dbDay.morning) {
        const totalAmount = Math.round(parsedQty * parsedRate);
        entriesToCreate.push({
          contactId: contact.id,
          contactName: contact.name,
          contactRole: contact.role,
          date: dateStr,
          timestamp: '07:30 AM',
          shift: 'morning',
          milkType: (contact.milkTypePref as MilkType) || 'buffalo',
          liters: parsedQty,
          ratePerLiter: parsedRate,
          totalAmount,
          receivedAmount: 0,
          dueAmount: totalAmount,
          paymentMode: 'credit',
          notes: 'Bulk Entry',
        });
      }

      // Evening entry
      if (staged.evening && !dbDay.evening) {
        const totalAmount = Math.round(parsedQty * parsedRate);
        entriesToCreate.push({
          contactId: contact.id,
          contactName: contact.name,
          contactRole: contact.role,
          date: dateStr,
          timestamp: '06:30 PM',
          shift: 'evening',
          milkType: (contact.milkTypePref as MilkType) || 'buffalo',
          liters: parsedQty,
          ratePerLiter: parsedRate,
          totalAmount,
          receivedAmount: 0,
          dueAmount: totalAmount,
          paymentMode: 'credit',
          notes: 'Bulk Entry',
        });
      }
    }

    if (entriesToCreate.length === 0) {
      setDuplicateWarning('No new dates selected. Tap dates on the calendar or click Apply to select available dates.');
      return;
    }

    onSaveEntries(entriesToCreate);
    if (showToast) {
      showToast(`Saved ${entriesToCreate.length} bulk entries for ${contact.name}!`);
    }
    onClose();
  };

  // Color Key Summary Metrics Calculation
  const metrics = useMemo(() => {
    let activeDaysCount = 0;
    let morningCount = 0;
    let eveningCount = 0;
    let totalLiters = 0;
    let totalAmount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = getDateStr(day);
      const dbDay = dbEntriesMap[dateStr] || {};
      const staged = stagedDays[dateStr] || {};

      const hasMorning = Boolean(dbDay.morning || staged.morning);
      const hasEvening = Boolean(dbDay.evening || staged.evening);

      if (hasMorning || hasEvening) {
        activeDaysCount++;
      }

      if (hasMorning) {
        morningCount++;
        const liters = dbDay.morning ? dbDay.morning.liters : parsedQty;
        const rate = dbDay.morning ? dbDay.morning.ratePerLiter : parsedRate;
        totalLiters += liters;
        totalAmount += Math.round(liters * rate);
      }

      if (hasEvening) {
        eveningCount++;
        const liters = dbDay.evening ? dbDay.evening.liters : parsedQty;
        const rate = dbDay.evening ? dbDay.evening.ratePerLiter : parsedRate;
        totalLiters += liters;
        totalAmount += Math.round(liters * rate);
      }
    }

    const emptyDaysCount = daysInMonth - activeDaysCount;
    const totalShifts = morningCount + eveningCount;

    return {
      activeDaysCount,
      emptyDaysCount,
      morningCount,
      eveningCount,
      totalShifts,
      totalLiters,
      totalAmount,
    };
  }, [daysInMonth, dbEntriesMap, stagedDays, parsedQty, parsedRate]);

  // Count staged entries awaiting save
  const stagedCount = useMemo(() => {
    let count = 0;
    Object.keys(stagedDays).forEach((dateStr) => {
      const staged = stagedDays[dateStr];
      const dbDay = dbEntriesMap[dateStr] || {};
      if (staged.morning && !dbDay.morning) count++;
      if (staged.evening && !dbDay.evening) count++;
    });
    return count;
  }, [stagedDays, dbEntriesMap]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="w-full max-w-md h-full bg-glass-gradient text-[#163B32] shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* 1. TOP HEADER APP BAR (Matching Screenshot 2)                            */}
        {/* ========================================================================= */}
        <div className="bg-[#1B4332] border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white leading-tight">
                Bulk Entry
              </h1>
              <p className="text-xs text-[#C8E6C9] font-medium leading-tight">
                {contact.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
          {/* ========================================================================= */}
          {/* 2. MONTH NAVIGATOR & SHIFT SELECTOR BAR (Matching Screenshot 2)           */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-between gap-2">
            {/* Month Navigator: < Oct 2026 > */}
            <div className="flex items-center gap-1 bg-white rounded-full px-2 py-0.5 border border-[#D6E9E1] shadow-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-[#55756D] hover:text-[#163B32] hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
              <span className="font-extrabold text-sm text-[#163B32] min-w-[75px] text-center">
                {monthDisplay}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-[#55756D] hover:text-[#163B32] hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Shift Selector Pills: Morning | Evening | Both */}
            <div className="flex items-center bg-white rounded-full p-1 border border-[#D6E9E1] shadow-xs gap-0.5">
              <button
                type="button"
                onClick={() => setSelectedShift('morning')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  selectedShift === 'morning'
                    ? 'bg-[#f59e0b] text-white shadow-xs font-black'
                    : 'text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                <Sun className="w-3.5 h-3.5 fill-current" />
                <span>Morning</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShift('evening')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  selectedShift === 'evening'
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                <Moon className="w-3.5 h-3.5 fill-current" />
                <span>Evening</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShift('both')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  selectedShift === 'both'
                    ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                    : 'text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                <span className="text-[11px] leading-none">☀️🌙</span>
                <span>Both</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. CURRENT BATCH CARD: Rate & Milk Quantity Inputs (Screenshot 2)          */}
          {/* ========================================================================= */}
          <div className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0B8F68] inline-block shadow-xs"></span>
                <span className="text-xs font-extrabold text-[#163B32]">
                  Current Batch Color
                </span>
              </div>
              <span className="text-xs font-bold text-[#55756D]">
                {formatLiters(parsedQty)} @ Rs{parsedRate.toFixed(1)}
              </span>
            </div>

            {/* Inputs: Rate & Milk Quantity */}
            <div className="grid grid-cols-2 gap-3">
              {/* Rate Input */}
              <div className="relative border border-slate-300 rounded-xl px-3 pt-2 pb-1.5 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all bg-white shadow-xs">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Rate
                </span>
                <div className="flex items-center">
                  <span className="text-xs font-bold text-slate-500 mr-1">Rs</span>
                  <input
                    type="number"
                    step="0.5"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    placeholder="240.0"
                    className="w-full text-sm font-extrabold text-slate-800 outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Milk Quantity Input */}
              <div className="relative border border-slate-300 rounded-xl px-3 pt-2 pb-1.5 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all bg-white shadow-xs">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Milk Quantity
                </span>
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    step="0.5"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    placeholder="4.0"
                    className="w-full text-sm font-extrabold text-slate-800 outline-none bg-transparent"
                  />
                  <span className="text-xs font-extrabold text-slate-500 ml-1">L</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. TAP INSTRUCTION HINT & SELECTION STATUS (Screenshot 2)                  */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-between text-[11px] text-[#55756D] font-medium px-1">
            <div className="flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5 text-[#55756D] shrink-0" />
              <span>Tap: Morning/Evening · 2nd Tap: Both (45° split) · 3rd Tap: Clear</span>
            </div>
          </div>

          {/* Staged Selection Status Bar (Mixed Selection breakdown) */}
          {Object.keys(stagedDays).length > 0 && (
            <div className="bg-[#E1F3EA] border border-[#0B8F68]/30 text-[#163B32] rounded-xl px-3 py-2 text-xs flex items-center justify-between shadow-xs">
              <span className="font-bold">
                {Object.keys(stagedDays).length} dates selected · {stagedCount} deliveries ready
              </span>
              <button
                type="button"
                onClick={() => setStagedDays({})}
                className="text-[#0B8F68] hover:text-[#163B32] font-extrabold underline cursor-pointer text-[11px]"
              >
                Clear All
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. CALENDAR GRID (Screenshot 2)                                           */}
          {/* ========================================================================= */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs">
            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-xs font-bold text-[#55756D]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* Empty leading padding cells */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const dayNum = index + 1;
                const dateStr = getDateStr(dayNum);
                const isToday = dateStr === todayStr;

                const dbDay = dbEntriesMap[dateStr] || {};
                const staged = stagedDays[dateStr] || {};

                const hasMorning = Boolean(dbDay.morning || staged.morning);
                const hasEvening = Boolean(dbDay.evening || staged.evening);
                const hasBoth = hasMorning && hasEvening;

                const isStagedAny = Boolean(staged.morning || staged.evening);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleDateClick(dayNum)}
                    className={`aspect-square rounded-2xl relative overflow-hidden transition-all cursor-pointer flex items-center justify-center font-bold text-xs ${
                      isToday
                        ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/30 shadow-xs'
                        : 'border border-slate-200 hover:border-slate-300'
                    } ${
                      !hasMorning && !hasEvening ? 'bg-white hover:bg-slate-50 text-slate-700' : ''
                    }`}
                    title={`Day ${dayNum}${hasMorning ? ' (Morning)' : ''}${hasEvening ? ' (Evening)' : ''}`}
                  >
                    {/* Visual 45° Split Background / Corners */}
                    {hasBoth && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Top-left triangle: Morning */}
                        <div 
                          className="absolute inset-0 bg-[#2e7d32]"
                          style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                        >
                          <Sun className="w-2.5 h-2.5 text-white/95 absolute top-1 left-1" />
                        </div>
                        {/* Bottom-right triangle: Evening */}
                        <div 
                          className="absolute inset-0 bg-[#1b5e20]"
                          style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                        >
                          <Moon className="w-2.5 h-2.5 text-white/95 absolute bottom-1 right-1" />
                        </div>
                      </div>
                    )}

                    {/* Morning only */}
                    {hasMorning && !hasEvening && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div 
                          className="absolute inset-0 bg-[#2e7d32]"
                          style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                        >
                          <Sun className="w-2.5 h-2.5 text-white/95 absolute top-1 left-1" />
                        </div>
                      </div>
                    )}

                    {/* Evening only */}
                    {!hasMorning && hasEvening && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div 
                          className="absolute inset-0 bg-[#1b5e20]"
                          style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                        >
                          <Moon className="w-2.5 h-2.5 text-white/95 absolute bottom-1 right-1" />
                        </div>
                      </div>
                    )}

                    {/* Center Day Number (High Legibility Badge) */}
                    <span 
                      className={`relative z-10 font-extrabold text-xs ${
                        hasBoth || hasMorning || hasEvening
                          ? 'w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xs text-[11px]'
                          : 'text-slate-800'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Small badge dot if staged for save */}
                    {isStagedAny && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 z-20" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 6. COLOR KEY & SUMMARY CARDS (Screenshot 2)                                */}
          {/* ========================================================================= */}
          <div className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs space-y-2.5">
            {/* Header: Color Key: Rates & Quantities 6 of 31 Days Active */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#163B32]">
                <Palette className="w-4 h-4 text-[#0B8F68]" />
                <span>Color Key: Rates & Quantities</span>
              </div>
              <span className="text-xs font-bold text-[#55756D]">
                {metrics.activeDaysCount} of {daysInMonth} Days Active
              </span>
            </div>

            {/* 2-Column Summary Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Active / Batch Card */}
              <div className="border border-[#D6E9E1] bg-[#F4FBF7] rounded-xl p-2.5 space-y-1 text-[#163B32]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0B8F68] inline-block shrink-0" />
                  <span className="font-extrabold text-xs text-[#163B32] truncate">
                    {formatLiters(parsedQty)} @ Rs{parsedRate.toFixed(0)}
                  </span>
                </div>
                <div className="text-[11px] text-[#55756D] font-medium">
                  {metrics.morningCount} ☀️ · {metrics.eveningCount} 🌙 ({metrics.totalShifts})
                </div>
                <div className="text-[11px] font-bold text-[#163B32]">
                  {formatLiters(metrics.totalLiters)} · Rs{metrics.totalAmount.toLocaleString('en-PK')}
                </div>
              </div>

              {/* No Entry Card */}
              <div className="border border-[#D6E9E1] bg-slate-50 rounded-xl p-2.5 space-y-1 text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  <span className="font-extrabold text-xs text-[#55756D]">
                    No Entry
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {metrics.emptyDaysCount} Days Empty
                </div>
                <div className="text-[11px] font-semibold text-slate-400">
                  0 L · Rs 0
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7. BOTTOM ACTION BAR: Apply & Save Buttons (Screenshot 2)                 */}
        {/* ========================================================================= */}
        <div className="bg-white border-t border-[#D6E9E1] px-4 py-3 shrink-0 grid grid-cols-2 gap-3 z-30 shadow-sm">
          {/* Apply Button */}
          <button
            type="button"
            onClick={handleApply}
            className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-[#163B32] border border-[#D6E9E1] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Apply</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Save {stagedCount > 0 ? `(${stagedCount})` : ''}</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 8. DUPLICATE & VALIDATION WARNING MODAL (Requirement Section)             */}
        {/* ========================================================================= */}
        {duplicateWarning && (
          <div 
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => setDuplicateWarning(null)}
          >
            <div 
              className="w-full max-w-sm bg-[#1B4332]/95 backdrop-blur-xl rounded-3xl p-5 shadow-2xl space-y-3.5 border border-amber-400/30 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-amber-300 border-b border-white/10 pb-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-sm">
                  ⚠️ Delivery Notice
                </h3>
              </div>

              <p className="text-xs text-white/90 font-medium leading-relaxed">
                {duplicateWarning}
              </p>

              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="w-full py-2.5 bg-white/15 hover:bg-white/25 active:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/20 transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
