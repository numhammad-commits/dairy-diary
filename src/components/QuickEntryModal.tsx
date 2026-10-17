import React, { useState } from 'react';
import { X, Sun, Moon, Check, Wallet } from 'lucide-react';
import { Contact, ShiftType, MilkType, LedgerEntry } from '../types/dairy';
import { formatPKR, getDeviceTodayDate } from '../utils/formatters';

interface QuickEntryModalProps {
  contact: Contact;
  onClose: () => void;
  onSave: (entry: Omit<LedgerEntry, 'id'>) => void;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  contact,
  onClose,
  onSave,
}) => {
  const isSeller = contact.role === 'seller';
  const defaultShift: ShiftType = new Date().getHours() < 13 ? 'morning' : 'evening';
  const defaultQuota = defaultShift === 'morning' 
    ? (contact.morningQuotaLiters || 10) 
    : (contact.eveningQuotaLiters || 8);

  const [shift, setShift] = useState<ShiftType>(defaultShift);
  const [milkType, setMilkType] = useState<MilkType>('buffalo');
  const [liters, setLiters] = useState<number>(defaultQuota);
  const [rate, setRate] = useState<number>(contact.defaultRate || 240);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [fatPercentage, setFatPercentage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const totalAmount = Math.round(liters * rate);
  const dueAmount = Math.max(0, totalAmount - receivedAmount);

  const handleAddLiters = (amount: number) => {
    setLiters((prev) => Math.max(0, parseFloat((prev + amount).toFixed(1))));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (liters <= 0) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const dateStr = getDeviceTodayDate();

    onSave({
      contactId: contact.id,
      contactName: contact.name,
      contactRole: contact.role,
      date: dateStr,
      timestamp: timeStr,
      shift,
      milkType,
      liters,
      ratePerLiter: rate,
      totalAmount,
      receivedAmount,
      dueAmount,
      fatPercentage: fatPercentage ? parseFloat(fatPercentage) : undefined,
      paymentMode: receivedAmount > 0 ? 'cash' : 'credit',
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-glass-gradient backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md border-b border-white/15 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center font-bold text-sm text-glass-lift shadow-inner">
              {contact.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight leading-tight text-white text-glass-lift">{contact.name}</h3>
              <p className="text-[11px] text-emerald-200">
                {isSeller ? 'Milk Purchase' : 'Milk Sale'} · Agreed Rate: Rs. {rate}/L
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-3.5">
          {/* Shift & Milk Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-emerald-100 mb-1">Shift</label>
              <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setShift('morning')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    shift === 'morning' ? 'bg-white text-emerald-900 shadow-xs' : 'text-emerald-200/80 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Morning</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShift('evening')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    shift === 'evening' ? 'bg-white text-emerald-900 shadow-xs' : 'text-emerald-200/80 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Evening</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-100 mb-1">Milk Type</label>
              <select
                value={milkType}
                onChange={(e) => setMilkType(e.target.value as MilkType)}
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="buffalo">Buffalo Milk (Pure)</option>
                <option value="cow">Cow Milk</option>
                <option value="mix">Mixed Milk</option>
                <option value="goat">Goat Milk</option>
              </select>
            </div>
          </div>

          {/* Liters Input & Quick Steppers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-white text-glass-lift">Volume (Liters)</label>
              <span className="text-xs font-medium text-emerald-200 bg-white/10 px-2 py-0.5 rounded border border-white/15">
                Current: {liters} L
              </span>
            </div>
            
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={liters || ''}
                onChange={(e) => setLiters(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                required
                className="w-full text-2xl font-extrabold text-slate-900 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-center focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none shadow-sm"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                Liters
              </span>
            </div>

            {/* Quick addition buttons */}
            <div className="flex items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => handleAddLiters(0.5)}
                className="flex-1 py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold rounded-lg border border-white/15 transition-colors cursor-pointer text-glass-lift"
              >
                +0.5 L
              </button>
              <button
                type="button"
                onClick={() => handleAddLiters(1)}
                className="flex-1 py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold rounded-lg border border-white/15 transition-colors cursor-pointer text-glass-lift"
              >
                +1 L
              </button>
              <button
                type="button"
                onClick={() => handleAddLiters(5)}
                className="flex-1 py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold rounded-lg border border-white/15 transition-colors cursor-pointer text-glass-lift"
              >
                +5 L
              </button>
              <button
                type="button"
                onClick={() => handleAddLiters(10)}
                className="flex-1 py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold rounded-lg border border-white/15 transition-colors cursor-pointer text-glass-lift"
              >
                +10 L
              </button>
            </div>
          </div>

          {/* Rate per Liter & Total Calculation */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-emerald-100 mb-1">
                Rate (PKR / Liter)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rs.
                </span>
                <input
                  type="number"
                  value={rate || ''}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  placeholder="240"
                  className="w-full pl-9 pr-2 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-100 mb-1">
                Total Billed
              </label>
              <div className="w-full px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm font-extrabold text-white text-glass-lift">
                {formatPKR(totalAmount)}
              </div>
            </div>
          </div>

          {/* Immediate Cash Payment / Advance */}
          <div className="glass-card p-2.5 rounded-xl border border-white/15 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white text-glass-lift flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-300" />
                <span>{isSeller ? 'Cash Cleared to Seller' : 'Cash Received from Buyer'}</span>
              </label>
              <button
                type="button"
                onClick={() => setReceivedAmount(totalAmount)}
                className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
              >
                Full Payment
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rs.
                </span>
                <input
                  type="number"
                  value={receivedAmount || ''}
                  onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full pl-9 pr-2 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/15">
                <span className="text-[11px] font-semibold text-emerald-100">Balance:</span>
                <span className={`text-xs font-black ${dueAmount > 0 ? 'text-glass-glow-red' : 'text-slate-300'}`}>
                  {formatPKR(dueAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Optional Fat % and Notes */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-emerald-100 mb-0.5">
                Fat % (Optional)
              </label>
              <input
                type="number"
                step="0.1"
                value={fatPercentage}
                onChange={(e) => setFatPercentage(e.target.value)}
                placeholder="e.g. 6.5"
                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-emerald-100 mb-0.5">
                Remarks / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Shift notes..."
                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 transition-colors cursor-pointer text-glass-lift"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg border border-emerald-400/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-glass-lift"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Entry ({formatPKR(totalAmount)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
