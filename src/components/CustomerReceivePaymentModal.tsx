import React, { useState, useMemo } from 'react';
import { ArrowLeft, X, DollarSign, Calendar, CreditCard, FileText, Check } from 'lucide-react';
import { Contact } from '../types/dairy';
import { formatPKR, getDeviceTodayDate, getFullMonthDisplay, shiftMonthKey } from '../utils/formatters';

interface CustomerReceivePaymentModalProps {
  contact: Contact;
  currentOutstanding: number;
  currentMonthDue: number;
  currentMonthKey: string;
  onClose: () => void;
  onSavePayment: (data: {
    amount: number;
    month: string;
    date: string;
    paymentMethod: string;
    notes?: string;
  }) => void;
}

export const CustomerReceivePaymentModal: React.FC<CustomerReceivePaymentModalProps> = ({
  contact,
  currentOutstanding,
  currentMonthDue,
  currentMonthKey,
  onClose,
  onSavePayment,
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [paymentDate, setPaymentDate] = useState<string>(getDeviceTodayDate());
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Month selection options (last 6 months and current month)
  const monthOptions = useMemo(() => {
    const list = [currentMonthKey];
    let curr = currentMonthKey;
    for (let i = 0; i < 5; i++) {
      curr = shiftMonthKey(curr, -1);
      list.push(curr);
    }
    return list;
  }, [currentMonthKey]);

  const parsedAmount = useMemo(() => {
    if (!amountStr) return 0;
    const clean = amountStr.toString().replace(/[^0-9.]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }, [amountStr]);

  const afterPayment = useMemo(() => {
    return Math.max(0, currentOutstanding - parsedAmount);
  }, [currentOutstanding, parsedAmount]);

  const handlePreFill = (value: number) => {
    if (value >= 0) {
      setAmountStr(Math.round(value).toString());
      setErrorMsg(null);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSave = () => {
    if (isSubmitting) return;
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than 0');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    onSavePayment({
      amount: amt,
      month: selectedMonth,
      date: paymentDate,
      paymentMethod,
      notes: notes.trim() ? notes.trim() : undefined,
    });
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
                Receive Payment — {contact.name}
              </h1>
              <p className="text-xs text-white/80 font-medium leading-tight">
                Record Payment Received
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
        {/* SCROLLABLE FORM BODY                                                      */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">
          {/* Live Summary Card */}
          <div className="glass-card rounded-2xl border border-[#D6E9E1] p-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D6E9E1] pb-2 mb-2">
              <span className="text-xs font-bold text-[#55756D]">Current Outstanding</span>
              <span className="text-sm font-black text-[#E5485D]">
                {formatPKR(currentOutstanding)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#55756D]">After This Payment</span>
              <span className="text-base font-black text-[#0B9B72]">
                {formatPKR(afterPayment)}
              </span>
            </div>

            {/* Quick Fill Shortcuts */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-[#D6E9E1]">
              <button
                type="button"
                onClick={() => handlePreFill(currentMonthDue)}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-[11px] font-black text-[#163B32] transition-colors cursor-pointer text-center border border-[#D6E9E1]"
              >
                Pay Month Due (Rs{Math.round(currentMonthDue)})
              </button>
              <button
                type="button"
                onClick={() => handlePreFill(currentOutstanding)}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-[11px] font-black text-[#163B32] transition-colors cursor-pointer text-center border border-[#D6E9E1]"
              >
                Pay Full Due (Rs{Math.round(currentOutstanding)})
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-[#E5485D] text-xs font-bold rounded-xl text-center">
              {errorMsg}
            </div>
          )}

          {/* 1. Amount Received (Rs) */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs">
            <label className="block text-xs font-extrabold text-[#163B32] mb-1">
              Amount Received (Rs) <span className="text-[#E5485D]">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="text-xs font-bold text-[#55756D] absolute left-3">Rs</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="e.g. 5000"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
            </div>
          </div>

          {/* 2. Month */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs">
            <label className="block text-xs font-extrabold text-[#163B32] mb-1">
              Month
            </label>
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-[#0B8F68] absolute left-3 pointer-events-none" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500"
              >
                {monthOptions.map((mKey) => (
                  <option key={mKey} value={mKey}>
                    {getFullMonthDisplay(mKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Date */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs">
            <label className="block text-xs font-extrabold text-[#163B32] mb-1">
              Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* 4. Payment Method */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs">
            <label className="block text-xs font-extrabold text-[#163B32] mb-1">
              Payment Method
            </label>
            <div className="relative flex items-center">
              <CreditCard className="w-4 h-4 text-[#0B8F68] absolute left-3 pointer-events-none" />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Easypaisa">Easypaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* 5. Notes (Optional) */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs">
            <label className="block text-xs font-extrabold text-[#163B32] mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via mobile transfer, token, etc."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM BUTTONS                                                            */}
        {/* ========================================================================= */}
        <div className="p-3.5 bg-white border-t border-[#D6E9E1] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-[#163B32] rounded-2xl font-bold text-xs transition-colors cursor-pointer border border-[#D6E9E1]"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className={`flex-1 py-3 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:bg-emerald-900 text-white rounded-2xl font-black text-xs shadow-md border border-emerald-400/40 flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? 'Saving...' : 'Save Receipt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
