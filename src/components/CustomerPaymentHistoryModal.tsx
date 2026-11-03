import React, { useState, useMemo } from 'react';
import { ArrowLeft, X, ChevronDown, ChevronUp, Calendar, Droplet, DollarSign, Clock, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord } from '../types/dairy';
import { formatPKR, formatLiters, getFullMonthDisplay } from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';

interface CustomerPaymentHistoryModalProps {
  contact: Contact;
  entries: LedgerEntry[];
  paymentRecords: PaymentRecord[];
  currentMonthKey: string;
  onClose: () => void;
  onEditPayment?: (paymentId: string, updates: { amount: number; paymentMethod: string }) => void;
  onDeletePayment?: (paymentId: string) => void;
}

interface MonthlyHistorySummary {
  monthKey: string;
  monthDisplay: string;
  milkDelivered: number;
  amountDue: number;
  amountReceived: number;
  outstanding: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  entries: LedgerEntry[];
  payments: PaymentRecord[];
}

export const CustomerPaymentHistoryModal: React.FC<CustomerPaymentHistoryModalProps> = ({
  contact,
  entries,
  paymentRecords,
  currentMonthKey,
  onClose,
  onEditPayment,
  onDeletePayment,
}) => {
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(currentMonthKey);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editAmountStr, setEditAmountStr] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('Cash');
  const [deleteTargetPayment, setDeleteTargetPayment] = useState<PaymentRecord | null>(null);

  // Filter entries and payments for this specific customer
  const customerEntries = useMemo(() => {
    return entries.filter((e) => e.contactId === contact.id);
  }, [entries, contact.id]);

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

  // Aggregate monthly data in chronological order (newest at top, oldest at bottom)
  const monthlyHistory = useMemo<MonthlyHistorySummary[]>(() => {
    const monthKeysSet = new Set<string>();
    
    // Always include current month
    if (currentMonthKey) monthKeysSet.add(currentMonthKey);

    customerEntries.forEach((e) => {
      const mKey = e.date.substring(0, 7);
      if (mKey) monthKeysSet.add(mKey);
    });

    customerPayments.forEach((p) => {
      const mKey = p.billingMonth || p.date.substring(0, 7);
      if (mKey) monthKeysSet.add(mKey);
    });

    // If contact has createdAt, add past months between createdAt and currentMonth
    if (contact.createdAt) {
      const createdKey = contact.createdAt.substring(0, 7);
      if (createdKey && createdKey <= currentMonthKey) {
        monthKeysSet.add(createdKey);
      }
    }

    const sortedMonthKeys = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));

    return sortedMonthKeys.map((mKey) => {
      const fin = getCustomerMonthDue(contact, mKey, entries, paymentRecords);
      const mEntries = customerEntries.filter((e) => e.date.startsWith(mKey));
      const mPayments = customerPayments.filter((p) => (p.billingMonth ? p.billingMonth === mKey : p.date.startsWith(mKey)));

      // Status badge: Paid / Partial / Unpaid
      let status: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
      if (fin.totalOutstanding === 0 && (fin.received > 0 || fin.amount > 0)) {
        status = 'Paid';
      } else if (fin.received > 0 && fin.totalOutstanding > 0) {
        status = 'Partial';
      } else {
        status = 'Unpaid';
      }

      return {
        monthKey: mKey,
        monthDisplay: getFullMonthDisplay(mKey),
        milkDelivered: fin.liters,
        amountDue: fin.due,
        amountReceived: fin.received,
        outstanding: fin.totalOutstanding,
        status,
        entries: mEntries.sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp)),
        payments: mPayments.sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp)),
      };
    });
  }, [customerEntries, customerPayments, currentMonthKey, contact]);

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
        {/* TOP HEADER: Frosted Glass & Gradient Theme                                */}
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
                Payment History — {contact.name}
              </h1>
              <p className="text-xs text-white/80 font-medium leading-tight">
                Monthly Ledger Breakdown
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
        {/* SCROLLABLE MONTH-BY-MONTH BREAKDOWN (Newest at top, oldest at bottom)     */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
          {monthlyHistory.length === 0 ? (
            <div className="glass-card rounded-2xl border border-[#D6E9E1] p-8 text-center shadow-xs mt-6">
              <Clock className="w-10 h-10 text-[#0B8F68] mx-auto mb-2.5 stroke-[1.8]" />
              <p className="text-sm font-black text-[#163B32]">No payment history yet.</p>
              <p className="text-xs text-[#55756D] mt-1">No monthly records or deliveries logged yet.</p>
            </div>
          ) : (
            monthlyHistory.map((m) => {
              const isExpanded = expandedMonthKey === m.monthKey;
              return (
                <div
                  key={m.monthKey}
                  className="glass-card rounded-2xl border border-[#D6E9E1] shadow-xs overflow-hidden transition-all"
                >
                  {/* Tappable Month Header Card */}
                  <button
                    type="button"
                    onClick={() => setExpandedMonthKey(isExpanded ? null : m.monthKey)}
                    className="w-full text-left p-3.5 flex flex-col gap-2.5 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#0B8F68]" />
                        <span className="font-extrabold text-sm text-[#163B32]">
                          {m.monthDisplay}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Status badge: Paid / Partial / Unpaid */}
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            m.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : m.status === 'Partial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {m.status}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#55756D]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#55756D]" />
                        )}
                      </div>
                    </div>

                    {/* Summary Row */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-[#D6E9E1] text-left">
                      <div>
                        <span className="text-[10px] font-semibold text-[#55756D] block">Milk</span>
                        <span className="text-xs font-black text-[#163B32] block mt-0.5">
                          {formatLiters(m.milkDelivered)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-[#55756D] block">Due</span>
                        <span className="text-xs font-black text-[#E5485D] block mt-0.5">
                          Rs{Math.round(m.amountDue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-[#55756D] block">Received</span>
                        <span className="text-xs font-black text-[#0B9B72] block mt-0.5">
                          Rs{Math.round(m.amountReceived)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-[#55756D] block">Balance</span>
                        <span className="text-xs font-black text-[#E5485D] block mt-0.5">
                          Rs{Math.round(m.outstanding)}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Individual Entries Breakdown */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-[#D6E9E1] bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#55756D] px-0.5">
                        <span>Payment & Due Records</span>
                        {m.payments.length > 0 && (
                          <span className="text-[#0B8F68]">Payments: {m.payments.length}</span>
                        )}
                      </div>

                      {/* Entries List */}
                      {m.payments.length === 0 && m.milkDelivered === 0 ? (
                        <p className="text-xs text-[#55756D]/70 italic py-1 px-1">
                          No payment or due records for this month.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                          {/* Payments */}
                          {m.payments.map((p) => (
                            <div
                              key={p.id}
                              className="glass-tile rounded-xl p-2.5 border border-[#D6E9E1] flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <DollarSign className="w-3.5 h-3.5 text-[#0B8F68] shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-extrabold text-[#163B32] block leading-tight">
                                    Payment Received
                                  </span>
                                  <span className="text-[10px] text-[#55756D] block truncate">
                                    {p.date} • {p.paymentMethod || 'Cash'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-black text-[#0B9B72]">
                                  +Rs{p.amount.toLocaleString('en-PK')}
                                </span>
                                {(onEditPayment || onDeletePayment) && (
                                  <div className="flex items-center gap-1">
                                    {onEditPayment && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingPayment(p);
                                          setEditAmountStr(p.amount.toString());
                                          setEditMethod(p.paymentMethod || 'Cash');
                                        }}
                                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-[#163B32] transition-colors cursor-pointer shrink-0"
                                        aria-label="Edit payment"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    )}
                                    {onDeletePayment && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTargetPayment(p);
                                        }}
                                        className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 flex items-center justify-center text-rose-600 transition-colors cursor-pointer shrink-0"
                                        aria-label="Delete payment"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Month Due Entry */}
                          {m.milkDelivered > 0 && (
                            <div
                              className="glass-tile rounded-xl p-2.5 border border-[#D6E9E1] flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[#55756D]" />
                                <div>
                                  <span className="font-extrabold text-[#163B32] block leading-tight">
                                    Month Milk Bill Due
                                  </span>
                                  <span className="text-[10px] text-[#55756D] block">
                                    {m.monthDisplay} • {formatLiters(m.milkDelivered)} Total
                                  </span>
                                </div>
                              </div>
                              <span className="font-black text-[#E5485D]">
                                Rs{Math.round(m.amountDue)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Close Button */}
        <div className="p-3 bg-white border-t border-[#D6E9E1] shrink-0 shadow-sm">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white rounded-2xl font-black text-xs shadow-sm transition-all cursor-pointer text-center"
          >
            Close History
          </button>
        </div>
      </div>

      {/* Edit Payment Dialog */}
      {editingPayment && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
          onClick={() => setEditingPayment(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-[#D6E9E1]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-[#0B8F68]">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <Pencil className="w-4.5 h-4.5 text-[#0B8F68]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">Edit Payment</h3>
                <p className="text-[11px] text-slate-500 font-medium">{editingPayment.date}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#163B32] mb-1">Amount (Rs)</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={editAmountStr}
                onChange={(e) => setEditAmountStr(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#163B32] mb-1">Payment Method</label>
              <select
                value={editMethod}
                onChange={(e) => setEditMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Easypaisa">Easypaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!(parseFloat(editAmountStr) > 0)}
                onClick={() => {
                  const amt = parseFloat(editAmountStr);
                  if (isNaN(amt) || amt <= 0) return;
                  onEditPayment?.(editingPayment.id, { amount: amt, paymentMethod: editMethod });
                  setEditingPayment(null);
                }}
                className="flex-1 py-2.5 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payment Confirmation Dialog */}
      {deleteTargetPayment && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
          onClick={() => setDeleteTargetPayment(null)}
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
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">Delete Payment?</h3>
                <p className="text-[11px] text-slate-500 font-medium">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Delete this payment of{' '}
              <span className="font-bold text-slate-800">
                Rs{deleteTargetPayment.amount.toLocaleString('en-PK')}
              </span>{' '}
              recorded on {deleteTargetPayment.date}? This cannot be undone.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTargetPayment(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePayment?.(deleteTargetPayment.id);
                  setDeleteTargetPayment(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
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
