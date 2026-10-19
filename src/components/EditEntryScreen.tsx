import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  AlertCircle,
  Plus,
  X
} from 'lucide-react';
import { Contact, LedgerEntry, ShiftType, MilkType } from '../types/dairy';
import { shiftDateString } from '../utils/formatters';
import { loadPersistedEntries } from '../utils/storage';

interface EditEntryScreenProps {
  entry: LedgerEntry;
  contact: Contact;
  onUpdate: (updatedEntry: LedgerEntry) => void;
  onDelete: (entryId: string) => void;
  onBack: () => void;
  showToast?: (message: string) => void;
}

export const EditEntryScreen: React.FC<EditEntryScreenProps> = ({
  entry,
  contact,
  onUpdate,
  onDelete,
  onBack,
  showToast,
}) => {
  // Initial Snapshot for Dirty-State Tracking
  const initialData = useMemo(() => {
    return {
      paymentMode: (entry.paymentMode === 'cash' ? 'cash' : 'credit') as 'credit' | 'cash',
      date: entry.date,
      shift: entry.shift,
      product: 'Milk',
      milkType: (entry.milkType || 'other') as 'other' | 'buffalo' | 'cow',
      quantity: entry.liters.toString(),
      rate: entry.ratePerLiter.toString(),
      remarks: entry.notes || '',
      photo: null as string | null,
    };
  }, [entry]);

  // Form States initialized with the EXACT transaction data
  const [paymentMode, setPaymentMode] = useState<'credit' | 'cash'>(initialData.paymentMode);
  const [date, setDate] = useState<string>(initialData.date);
  const [shift, setShift] = useState<ShiftType>(initialData.shift);
  const [product, setProduct] = useState<string>(initialData.product);
  const [milkType, setMilkType] = useState<'other' | 'buffalo' | 'cow'>(initialData.milkType);
  const [quantity, setQuantity] = useState<string>(initialData.quantity);
  const [rate, setRate] = useState<string>(initialData.rate);
  const [remarks, setRemarks] = useState<string>(initialData.remarks);
  const [photo, setPhoto] = useState<string | null>(initialData.photo);

  // Dialog States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);

  // Reactive Total Calculation: Quantity × Rate
  const calculatedTotal = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return (q * r).toFixed(2);
  }, [quantity, rate]);

  // Dirty State Detection
  const isDirty = useMemo(() => {
    return (
      paymentMode !== initialData.paymentMode ||
      date !== initialData.date ||
      shift !== initialData.shift ||
      product !== initialData.product ||
      milkType !== initialData.milkType ||
      quantity !== initialData.quantity ||
      rate !== initialData.rate ||
      remarks !== initialData.remarks ||
      photo !== initialData.photo
    );
  }, [
    paymentMode,
    date,
    shift,
    product,
    milkType,
    quantity,
    rate,
    remarks,
    photo,
    initialData,
  ]);

  // Handle Back Arrow
  const handleBack = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onBack();
    }
  };

  // Date Shift Helpers (Prev / Next Day)
  const handleShiftDay = (delta: number) => {
    setDate((prev) => shiftDateString(prev, delta));
  };

  // Format Date for Display (e.g., "04 Oct 2026")
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

  // Presets Click Handler
  const handleSelectPreset = (presetVal: string) => {
    setQuantity(presetVal);
  };

  // Submit & Update Entry
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage('Please enter a valid milk quantity greater than 0.');
      return;
    }

    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate < 0) {
      setErrorMessage('Please enter a valid milk rate.');
      return;
    }

    // Exact-match duplicate guard (contactId + date + shift), excluding this entry itself.
    // Reads straight from storage (same fallback pattern AddEntryScreen already uses) since
    // this screen isn't handed the full entries array as a prop.
    const isDuplicate = loadPersistedEntries().some(
      (e) => e.id !== entry.id && e.contactId === entry.contactId && e.date === date && e.shift === shift
    );
    if (isDuplicate) {
      setShowDuplicateModal(true);
      return;
    }

    const totalAmount = Math.round(parsedQty * parsedRate);
    const isCash = paymentMode === 'cash';

    const updatedEntry: LedgerEntry = {
      ...entry, // preserves entry.id, contactId, timestamp, etc.
      date,
      shift,
      milkType: milkType as MilkType,
      liters: parsedQty,
      ratePerLiter: parsedRate,
      totalAmount,
      receivedAmount: isCash ? totalAmount : 0,
      dueAmount: isCash ? 0 : totalAmount,
      paymentMode: isCash ? 'cash' : 'credit',
      notes: remarks.trim() || undefined,
    };

    onUpdate(updatedEntry);
    if (showToast) {
      showToast('Entry updated successfully');
    }
    onBack();
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    onDelete(entry.id);
    setShowDeleteConfirm(false);
    if (showToast) {
      showToast('Entry deleted successfully');
    }
    onBack();
  };

  // Customer Initial Avatar
  const customerInitial = (contact.name || entry.contactName || 'C').charAt(0).toUpperCase();

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[#F4FBF7] relative select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER APP BAR (Deep Corporate Green #1E5631)                       */}
      {/* ========================================================================= */}
      <div className="bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-30">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            title="Go Back"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Edit Entry
          </h1>
        </div>

        {/* Right: Payment Mode (Credit / Cash) & Delete Icon */}
        <div className="flex items-center gap-2.5">
          {/* Segmented Payment Mode Selector */}
          <div className="bg-white/10 p-0.5 rounded-xl flex items-center border border-white/15">
            <button
              type="button"
              onClick={() => setPaymentMode('credit')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                paymentMode === 'credit'
                  ? 'bg-amber-500 text-white shadow-2xs'
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
                  ? 'bg-[#0B8F68] text-white shadow-2xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Cash
            </button>
          </div>

          {/* Delete Trash Icon */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 hover:bg-rose-700/80 active:bg-rose-800 rounded-lg text-white/90 hover:text-white transition-colors cursor-pointer"
            title="Delete this entry"
          >
            <Trash2 className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FORM BODY - SCROLLABLE CONTENT                                         */}
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
            <div className="w-12 h-12 rounded-full bg-[#006B52] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
              {customerInitial}
            </div>

            {/* Name & Informational Default Rate */}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-[#163B32] tracking-tight truncate">
                {contact.name || entry.contactName}
              </h2>
              <p className="text-xs font-semibold text-[#55756D] mt-0.5">
                Default Rate: Rs{contact.defaultRate ? contact.defaultRate.toFixed(1) : '240.0'}/L
              </p>
            </div>
          </div>

          {/* Date & Shift Row */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Left: Date Selector with Jump Arrows */}
            <div className="bg-white rounded-2xl p-2.5 border border-slate-300 shadow-2xs flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </button>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-extrabold text-slate-900 tracking-tight">
                <CalendarIcon className="w-4 h-4 text-emerald-600 shrink-0" />
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
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Right: Shift Dropdown */}
            <div className="relative bg-white rounded-2xl px-3 py-2.5 border border-slate-300 shadow-2xs flex items-center justify-between">
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftType)}
                aria-label="Shift selector"
                className="w-full text-xs font-black text-slate-900 bg-transparent outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
              <div className="pointer-events-none absolute right-3 text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* Item / Product & Milk Type Row */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Item / Product */}
            <div className="relative bg-white rounded-2xl px-3.5 py-2 border border-slate-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Item / Product
              </span>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                aria-label="Item product selector"
                className="text-xs font-black text-slate-900 bg-transparent outline-none cursor-pointer appearance-none pr-4 mt-0.5"
              >
                <option value="Milk">Milk</option>
                <option value="Yogurt">Yogurt</option>
                <option value="Butter">Butter</option>
              </select>
              <div className="pointer-events-none absolute right-3 bottom-2 text-slate-400 text-xs">▼</div>
            </div>

            {/* Milk Type */}
            <div className="relative bg-white rounded-2xl px-3.5 py-2 border border-slate-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Milk Type
              </span>
              <select
                value={milkType}
                onChange={(e) => setMilkType(e.target.value as any)}
                aria-label="Milk type selector"
                className="text-xs font-black text-slate-900 bg-transparent outline-none cursor-pointer appearance-none pr-4 mt-0.5"
              >
                <option value="other">📦 Other</option>
                <option value="buffalo">🥛 Buffalo</option>
                <option value="cow">🐄 Cow</option>
              </select>
              <div className="pointer-events-none absolute right-3 bottom-2 text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* Financial Inputs: Quantity | Rate (Rs) | Total (Rs) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Quantity */}
            <div className="relative bg-white rounded-2xl px-3 py-2 border border-slate-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quantity (L)
              </span>
              <input
                type="number"
                step="0.25"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none mt-0.5"
              />
            </div>

            {/* Rate (Rs) */}
            <div className="relative bg-white rounded-2xl px-3 py-2 border border-slate-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Rate (Rs)
              </span>
              <input
                type="number"
                step="0.5"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none mt-0.5"
              />
            </div>

            {/* Total (Rs) - Reactively calculated */}
            <div className="relative glass-card bg-white rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                Total (Rs)
              </span>
              <span className="text-xs sm:text-sm font-black text-[#0B9B72] mt-0.5 font-mono">
                {calculatedTotal}
              </span>
            </div>
          </div>

          {/* Quick Quantity Presets: [250ml] [500ml] [1L] [2L] [5L] */}
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
                    : 'bg-white text-[#55756D] border-[#D6E9E1] hover:text-[#163B32]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Remarks + Photo Row */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Remarks (Optional) */}
            <div className="col-span-2 bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex flex-col justify-center">
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks (Optional)"
                className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              />
            </div>

            {/* Photo Attachment */}
            <div 
              onClick={() => {
                if (showToast) showToast('Camera / Photo attachment ready');
              }}
              className="bg-white rounded-2xl p-2 border border-slate-300 shadow-2xs flex flex-col items-center justify-center text-emerald-700 hover:bg-emerald-50/50 cursor-pointer transition-colors"
            >
              <Camera className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-black text-slate-600 mt-0.5">Photo</span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. PRIMARY ACTION: UPDATE ENTRY                                           */}
        {/* ========================================================================= */}
        <div className="p-4 bg-white border-t border-[#D6E9E1] shrink-0 z-20 shadow-sm">
          <button
            type="submit"
            className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white rounded-2xl font-black text-sm tracking-wider uppercase shadow-md transition-all cursor-pointer"
          >
            Update Entry
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 4. CONFIRMATION DIALOG: DELETE ENTRY                                      */}
      {/* ========================================================================= */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="w-full max-w-xs glass-card bg-[#1B4332]/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl space-y-4 border border-white/20 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black text-base text-white text-glass-lift">
              Delete Entry?
            </h3>
            <p className="text-xs text-[#C8E6C9] font-medium leading-relaxed">
              Are you sure you want to permanently delete this milk entry? This will update the customer's active ledger balances.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-white/20 text-xs font-bold text-white/80 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer text-glass-lift"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONFIRMATION DIALOG: DISCARD CHANGES                                    */}
      {/* ========================================================================= */}
      {showDiscardConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div 
            className="w-full max-w-xs glass-card bg-[#1B4332]/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl space-y-4 border border-white/20 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black text-base text-white text-glass-lift">
              Discard changes?
            </h3>
            <p className="text-xs text-[#C8E6C9] font-medium leading-relaxed">
              You have unsaved edits. Discard them and return to the ledger?
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-white/20 text-xs font-bold text-white/80 hover:bg-white/10 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onBack();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer text-glass-lift"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ERROR DIALOG: DELIVERY ALREADY ENTERED                                  */}
      {/* ========================================================================= */}
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
              Delivery already exists for this customer on{' '}
              <span className="font-bold text-slate-800">{formattedDateDisplay}</span> (
              {shift === 'morning' ? 'Morning Shift' : 'Evening Shift'}).
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
  );
};
