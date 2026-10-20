import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { Contact, LedgerEntry, ShiftType, MilkType, ProductType, PRODUCT_TYPE_LABELS } from '../types/dairy';
import { loadPersistedEntries } from '../utils/storage';
import { getDeviceTodayDate, shiftDateString } from '../utils/formatters';

export interface AddEntryContext {
  customer: Contact;
  source?: 'customer-list' | 'customer-ledger' | 'dashboard' | 'history' | 'search' | 'other';
  existingEntries?: LedgerEntry[];
  onClose: () => void;
  onSave: (entry: Omit<LedgerEntry, 'id'>) => void;
  showToast?: (message: string) => void;
}

export const AddEntryScreen: React.FC<AddEntryContext> = ({
  customer,
  source = 'customer-list',
  existingEntries,
  onClose,
  onSave,
  showToast,
}) => {
  // Requirement 1: Automatically set the date to the actual current device date
  const actualTodayDate = getDeviceTodayDate();

  // Shift default: this customer's own most recent entry's shift, or 'morning' if they're new.
  const defaultShift: ShiftType = useMemo(() => {
    const customerEntries = (existingEntries || []).filter((e) => e.contactId === customer.id);
    if (customerEntries.length === 0) return 'morning';
    const mostRecent = [...customerEntries].sort(
      (a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp)
    )[0];
    return mostRecent.shift;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Milk Type default from customer preference
  const defaultMilkType: 'other' | 'buffalo' | 'cow' | 'goat' = customer.milkTypePref || 'buffalo';

  // Rate default from customer default rate
  const defaultRate = customer.defaultRate || 240;

  // Default quantity (2.0 L as shown in reference Screenshot 3, or customer fixed/quota)
  const defaultQty = (customer.fixedQuantity || customer.morningQuotaLiters || 2.0).toString();

  // Form States
  const [paymentMode, setPaymentMode] = useState<'credit' | 'cash'>('credit');
  const [date, setDate] = useState<string>(actualTodayDate);
  const [shift, setShift] = useState<ShiftType>(defaultShift);
  const [entryKind, setEntryKind] = useState<'milk' | 'product'>('milk');
  const [productType, setProductType] = useState<ProductType>('paneer');
  const [productUnit, setProductUnit] = useState<'kg' | 'liters'>('kg');
  const [milkType, setMilkType] = useState<'other' | 'buffalo' | 'cow' | 'goat'>(defaultMilkType);
  const [quantity, setQuantity] = useState<string>(defaultQty);
  const [rate, setRate] = useState<string>(defaultRate.toString());
  const [remarks, setRemarks] = useState<string>('');
  const [photo, setPhoto] = useState<string | null>(null);

  // Loading & Alert States (Requirements 2 & 3)
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAdvanceWarningModal, setShowAdvanceWarningModal] = useState<boolean>(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [pendingEntryData, setPendingEntryData] = useState<Omit<LedgerEntry, 'id'> | null>(null);

  // Reactive Total Calculation: Quantity × Rate
  const calculatedTotal = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return (q * r).toFixed(2);
  }, [quantity, rate]);

  // Date Shift Helpers (Prev / Next Day)
  const handleShiftDay = (delta: number) => {
    setDate((prev) => shiftDateString(prev, delta));
  };

  // Formatted Date Display (e.g., "03 Oct 2026")
  const formattedDateDisplay = useMemo(() => {
    try {
      const [yearStr, monthStr, dayStr] = date.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return date;
    }
  }, [date]);

  // Quantity Preset Selector
  const handleSelectPreset = (presetVal: string) => {
    setQuantity(presetVal);
  };

  // Helper to execute saving entry
  const doSave = (entryData: Omit<LedgerEntry, 'id'>) => {
    setIsSaving(true);
    setTimeout(() => {
      onSave(entryData);
      setIsSaving(false);
      if (showToast) {
        showToast(`Entry added for ${customer.name}`);
      }
      onClose();
    }, 250);
  };

  // Products don't expose a meaningful shift — fixed under the hood so the data model
  // (LedgerEntry.shift is required) stays valid without showing the field to the user.
  const effectiveShift: ShiftType = entryKind === 'product' ? 'morning' : shift;

  // Save Entry Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage('Please enter a valid quantity greater than 0.');
      return;
    }

    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate < 0) {
      setErrorMessage('Please enter a valid rate.');
      return;
    }

    // 1. Requirement 3: Check for Duplicate Customer Delivery (same customer, date, shift).
    // Type-aware: a milk entry and a product entry (or two different products) on the same
    // contactId+date+shift are NOT duplicates of each other — only an exact same-kind match
    // is (unchanged behavior for milk-vs-milk).
    const recordsToCheck = existingEntries || loadPersistedEntries();
    const isDuplicate = recordsToCheck.some((entry) => {
      if (entry.contactId !== customer.id || entry.date !== date || entry.shift !== effectiveShift) {
        return false;
      }
      const existingKind = entry.entryType || 'milk';
      if (existingKind !== entryKind) return false;
      if (entryKind === 'product') return entry.productType === productType;
      return true;
    });

    if (isDuplicate) {
      setShowDuplicateModal(true);
      return;
    }

    const totalAmount = Math.round(parsedQty * parsedRate);
    const isCash = paymentMode === 'cash';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const baseEntry = {
      contactId: customer.id,
      contactName: customer.name,
      contactRole: customer.role,
      date,
      timestamp: timeStr,
      shift: effectiveShift,
      totalAmount,
      receivedAmount: isCash ? totalAmount : 0,
      dueAmount: isCash ? 0 : totalAmount,
      paymentMode: (isCash ? 'cash' : 'credit') as 'cash' | 'credit',
      notes: remarks.trim() || undefined,
    };

    const entryToSave: Omit<LedgerEntry, 'id'> =
      entryKind === 'product'
        ? {
            ...baseEntry,
            milkType: 'other' as MilkType,
            liters: 0,
            ratePerLiter: 0,
            entryType: 'product',
            productType,
            productQuantity: parsedQty,
            productUnit,
            productRate: parsedRate,
          }
        : {
            ...baseEntry,
            entryType: 'milk',
            milkType: milkType as MilkType,
            liters: parsedQty,
            ratePerLiter: parsedRate,
          };

    // 2. Requirement 2: Warning for Advance/Future Entries
    if (date > actualTodayDate) {
      setPendingEntryData(entryToSave);
      setShowAdvanceWarningModal(true);
      return;
    }

    doSave(entryToSave);
  };

  const customerInitial = (customer.name || 'C').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="w-full max-w-md h-full bg-glass-gradient shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* 1. TOP HEADER APP BAR (Emerald Green Header)                             */}
        {/* ========================================================================= */}
        <div className="relative bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-30">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Add New Entry
            </h1>
          </div>

          {/* Right: Payment Mode (Credit / Cash) */}
          <div className="bg-white/10 p-0.5 rounded-xl flex items-center border border-white/20">
            <button
              type="button"
              onClick={() => setPaymentMode('credit')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                paymentMode === 'credit'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Credit
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('cash')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                paymentMode === 'cash'
                  ? 'bg-[#0B8F68] text-white shadow-xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Cash
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. FORM BODY - SCROLLABLE CONTAINER                                      */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 max-w-md mx-auto w-full pb-6">
            
            {/* Validation Error Banner */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Customer Information Card */}
            <div className="glass-card rounded-3xl p-4 border border-[#D6E9E1] shadow-xs flex items-center gap-3.5">
              {/* Avatar Circle */}
              <div className="w-12 h-12 rounded-2xl bg-[#006B52] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                {customerInitial}
              </div>

              {/* Name & Default Rate */}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-[#163B32] tracking-tight truncate">
                  {customer.name}
                </h2>
                <p className="text-xs font-semibold text-[#55756D] mt-0.5">
                  Default Rate: Rs{customer.defaultRate ? customer.defaultRate.toFixed(1) : '240.0'}/L
                </p>
              </div>
            </div>

            {/* Entry Kind Toggle: Milk vs Other Product */}
            <div className="glass-card rounded-2xl p-1 border border-[#D6E9E1] shadow-xs flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEntryKind('milk');
                  setQuantity(defaultQty);
                  setRate(defaultRate.toString());
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  entryKind === 'milk' ? 'bg-[#0B8F68] text-white shadow-xs' : 'text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                Milk
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryKind('product');
                  setQuantity('0.5');
                  setRate('0');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  entryKind === 'product' ? 'bg-[#0B8F68] text-white shadow-xs' : 'text-[#55756D] hover:text-[#163B32]'
                }`}
              >
                Other Product
              </button>
            </div>

            {/* Date & Shift Row */}
            <div className={entryKind === 'product' ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-2 gap-2.5'}>
              {/* Left: Date Selector with Jump Arrows */}
              <div className="glass-card rounded-2xl p-2.5 border border-[#D6E9E1] shadow-xs flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleShiftDay(-1)}
                  className="p-1 text-[#55756D] hover:text-[#163B32] rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-extrabold text-[#163B32] tracking-tight">
                  <CalendarIcon className="w-4 h-4 text-[#0B8F68] shrink-0" />
                  <span>{formattedDateDisplay}</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="sr-only"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleShiftDay(1)}
                  className="p-1 text-[#55756D] hover:text-[#163B32] rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Right: Shift Dropdown (milk only — products don't expose a shift field) */}
              {entryKind === 'milk' && (
                <div className="relative glass-card rounded-2xl px-3 py-2.5 border border-[#D6E9E1] shadow-xs flex items-center justify-between">
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as ShiftType)}
                    aria-label="Shift selector"
                    className="w-full text-xs font-black text-[#163B32] bg-transparent outline-none cursor-pointer appearance-none pr-4"
                  >
                    <option value="morning" className="bg-white text-[#163B32]">Morning</option>
                    <option value="evening" className="bg-white text-[#163B32]">Evening</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 text-[#55756D] text-xs">▼</div>
                </div>
              )}
            </div>

            {entryKind === 'milk' ? (
              /* Milk Type */
              <div className="relative glass-card rounded-2xl px-3.5 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                  Milk Type
                </span>
                <select
                  value={milkType}
                  onChange={(e) => setMilkType(e.target.value as any)}
                  aria-label="Milk type selector"
                  className="text-xs font-black text-[#163B32] bg-transparent outline-none cursor-pointer appearance-none pr-4 mt-0.5"
                >
                  <option value="other" className="bg-white text-[#163B32]">📦 Other</option>
                  <option value="buffalo" className="bg-white text-[#163B32]">🥛 Buffalo</option>
                  <option value="cow" className="bg-white text-[#163B32]">🐄 Cow</option>
                  <option value="goat" className="bg-white text-[#163B32]">🐐 Goat</option>
                </select>
                <div className="pointer-events-none absolute right-3 bottom-2 text-[#55756D] text-xs">▼</div>
              </div>
            ) : (
              /* Product Type & Unit */
              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative glass-card rounded-2xl px-3.5 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                    Product Type
                  </span>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                    aria-label="Product type selector"
                    className="text-xs font-black text-[#163B32] bg-transparent outline-none cursor-pointer appearance-none pr-4 mt-0.5"
                  >
                    {(Object.entries(PRODUCT_TYPE_LABELS) as [ProductType, string][]).map(([value, label]) => (
                      <option key={value} value={value} className="bg-white text-[#163B32]">{label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 bottom-2 text-[#55756D] text-xs">▼</div>
                </div>

                <div className="relative glass-card rounded-2xl px-3.5 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                    Unit
                  </span>
                  <select
                    value={productUnit}
                    onChange={(e) => setProductUnit(e.target.value as 'kg' | 'liters')}
                    aria-label="Product unit selector"
                    className="text-xs font-black text-[#163B32] bg-transparent outline-none cursor-pointer appearance-none pr-4 mt-0.5"
                  >
                    <option value="kg" className="bg-white text-[#163B32]">Kg</option>
                    <option value="liters" className="bg-white text-[#163B32]">Liters</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 bottom-2 text-[#55756D] text-xs">▼</div>
                </div>
              </div>
            )}

            {/* Financial Inputs: Quantity | Rate (Rs) | Total (Rs) */}
            <div className="grid grid-cols-3 gap-2">
              {/* Quantity */}
              <div className="relative glass-card rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                  Quantity ({entryKind === 'product' ? (productUnit === 'kg' ? 'Kg' : 'L') : 'L'})
                </span>
                <input
                  type="number"
                  step="0.25"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="text-xs sm:text-sm font-black text-[#163B32] bg-transparent outline-none mt-0.5"
                />
              </div>

              {/* Rate (Rs) */}
              <div className="relative glass-card rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                  Rate (Rs)
                </span>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="text-xs sm:text-sm font-black text-[#163B32] bg-transparent outline-none mt-0.5"
                />
              </div>

              {/* Total (Rs) - Reactively calculated */}
              <div className="relative glass-card rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                  Total (Rs)
                </span>
                <span className="text-xs sm:text-sm font-black text-[#0B9B72] mt-0.5">
                  {calculatedTotal}
                </span>
              </div>
            </div>

            {/* Quick Quantity Presets: [250ml] [500ml] [1L] [2L] [5L] (milk only) */}
            {entryKind === 'milk' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { label: '250ml', val: '0.25' },
                  { label: '500ml', val: '0.5' },
                  { label: '1L', val: '1.0' },
                  { label: '2L', val: '2.0' },
                  { label: '5L', val: '5.0' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset.val)}
                    className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      quantity === preset.val
                        ? 'bg-[#0B8F68] text-white border-[#0B8F68] shadow-xs'
                        : 'bg-white text-[#55756D] hover:text-[#163B32] border-[#D6E9E1]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Remarks + Photo Row */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Remarks (Optional) */}
              <div className="col-span-2 glass-card rounded-2xl px-3.5 py-2.5 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks (Optional)"
                  className="w-full text-xs font-semibold text-[#163B32] placeholder:text-[#7A8C84] outline-none bg-transparent"
                />
              </div>

              {/* Photo Attachment */}
              <div 
                onClick={() => {
                  if (showToast) showToast('Camera / Photo attachment ready');
                }}
                className="glass-card rounded-2xl p-2 border border-[#D6E9E1] shadow-xs flex flex-col items-center justify-center text-[#0B8F68] hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <Camera className="w-5 h-5 stroke-[2]" />
                <span className="text-[10px] font-black text-[#55756D] mt-0.5">Photo</span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* 3. PRIMARY ACTION: SAVE ENTRY                                             */}
          {/* ========================================================================= */}
          <div className="p-4 bg-white border-t border-[#D6E9E1] shrink-0 z-20 shadow-sm">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] disabled:bg-slate-400 text-white rounded-2xl font-black text-sm tracking-wider uppercase shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>SAVE ENTRY</span>
              )}
            </button>
          </div>
        </form>

        {/* ⚠️ Advance Entry Warning Modal (Requirement 2) */}
        {showAdvanceWarningModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in select-none">
            <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-amber-200 text-center animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                ⚠️ Advance Entry
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                You are entering a delivery for a future date (<span className="font-bold text-slate-800">{formattedDateDisplay}</span>). Please confirm that you want to continue.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdvanceWarningModal(false);
                    setPendingEntryData(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdvanceWarningModal(false);
                    if (pendingEntryData) {
                      doSave(pendingEntryData);
                      setPendingEntryData(null);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#1E5631] text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ⚠️ Delivery Already Entered Modal (Requirement 3) */}
        {showDuplicateModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in select-none">
            <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-rose-200 text-center animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                ⚠️ Delivery Already Entered
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {entryKind === 'product' ? (
                  <>A <span className="font-bold text-slate-800">{PRODUCT_TYPE_LABELS[productType]}</span> entry has already been recorded for <span className="font-bold text-slate-800">{formattedDateDisplay}</span>.</>
                ) : (
                  <>This customer&apos;s delivery has already been entered for <span className="font-bold text-slate-800">{formattedDateDisplay}</span> ({shift === 'morning' ? 'Morning Shift' : 'Evening Shift'}).</>
                )}
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="w-full py-2.5 rounded-xl bg-[#1E5631] text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
