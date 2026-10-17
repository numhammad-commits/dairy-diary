import React from 'react';
import { X, Info, TrendingUp, AlertTriangle, MessageSquare, ChevronRight } from 'lucide-react';
import { Contact, LedgerEntry, PaymentRecord } from '../types/dairy';
import { formatPKR, getDeviceCurrentMonthKey } from '../utils/formatters';
import { getCustomerMonthDue } from '../utils/calculations';

interface OutstandingInfoModalProps {
  currentMonthDue: number;
  totalOutstanding: number;
  previousBalance?: number;
  monthDisplay: string;
  contacts: Contact[];
  entries?: LedgerEntry[];
  paymentRecords?: PaymentRecord[];
  currentMonthKey?: string;
  onClose: () => void;
  onSelectContact: (c: Contact) => void;
}

export const OutstandingInfoModal: React.FC<OutstandingInfoModalProps> = ({
  currentMonthDue,
  totalOutstanding,
  previousBalance,
  monthDisplay,
  contacts,
  entries = [],
  paymentRecords = [],
  currentMonthKey,
  onClose,
  onSelectContact,
}) => {
  const activeMonth = currentMonthKey || getDeviceCurrentMonthKey();

  // Dynamically calculate debtor rankings based on true computed balance
  const topDebtors = [...contacts]
    .map((c) => {
      const fin = getCustomerMonthDue(c, activeMonth, entries, paymentRecords);
      const totalBalance = fin.due + fin.previousDue;
      return { contact: c, totalBalance };
    })
    .filter((d) => d.totalBalance > 0)
    .sort((a, b) => b.totalBalance - a.totalBalance)
    .slice(0, 5);

  const prevMonthsDue = previousBalance !== undefined ? previousBalance : Math.max(0, totalOutstanding - currentMonthDue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#F4FBF7] rounded-2xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006B52] to-[#1B4332] text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-[#A9DFBF]" />
            <h3 className="font-bold text-sm tracking-tight text-white">Total Outstanding Debt Analysis</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-[#F4FBF7]">
          {/* Explanation Box */}
          <div className="p-3.5 rounded-xl bg-white border border-[#D6E9E1] shadow-xs text-[#55756D] space-y-1">
            <h4 className="text-xs font-bold text-[#163B32] flex items-center gap-1.5">
              <span>Understanding Total Outstanding</span>
            </h4>
            <p className="text-xs text-[#55756D] leading-relaxed">
              While <strong className="text-[#163B32]">{monthDisplay} Due ({formatPKR(currentMonthDue)})</strong> reflects uncollected milk balances in this specific calendar month, <strong className="text-[#163B32]">Total Outstanding ({formatPKR(totalOutstanding)})</strong> is the current month's due. Prior unpaid balances are tracked separately under Prior Ledger Debt.
            </p>
          </div>

          {/* Debt Breakdown Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-white border border-[#D6E9E1] shadow-xs">
              <span className="text-[10px] text-[#55756D] font-semibold block">{monthDisplay} Cycle Due</span>
              <span className="text-base font-extrabold text-[#E5485D]">{formatPKR(currentMonthDue)}</span>
              <span className="text-[10px] text-[#7A8C84] block mt-0.5">Current active month</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#D6E9E1] shadow-xs">
              <span className="text-[10px] text-[#55756D] font-semibold block">Prior Ledger Debt</span>
              <span className="text-base font-extrabold text-[#D97706]">{formatPKR(prevMonthsDue)}</span>
              <span className="text-[10px] text-[#7A8C84] block mt-0.5">Overdue from prior cycles</span>
            </div>
          </div>

          {/* Aging Spectrum */}
          <div className="p-3 rounded-xl bg-white border border-[#D6E9E1] shadow-xs space-y-2">
            <h5 className="text-xs font-bold text-[#163B32] flex items-center justify-between">
              <span>Debt Aging Spectrum</span>
              <span className="text-[11px] font-bold text-[#0B8F68]">{formatPKR(totalOutstanding + prevMonthsDue)}</span>
            </h5>

            <div className="h-2.5 w-full bg-[#E1F3EA] rounded-full overflow-hidden flex border border-[#D6E9E1]">
              <div className="bg-[#0B8F68] h-full w-[28%]" title="0-30 Days" />
              <div className="bg-amber-400 h-full w-[42%]" title="31-60 Days" />
              <div className="bg-[#E5485D] h-full w-[30%]" title="60+ Days Overdue" />
            </div>

            <div className="flex justify-between text-[10px] text-[#55756D] pt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#0B8F68]" /> 0-30d: {formatPKR(currentMonthDue)}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 31-60d: {formatPKR(prevMonthsDue)}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#E5485D]" /> 60d+: {formatPKR(0)}
              </span>
            </div>
          </div>

          {/* Top Overdue Accounts */}
          <div>
            <h5 className="text-xs font-bold text-[#163B32] mb-2 flex items-center justify-between">
              <span>Top Overdue Accounts</span>
              <span className="text-[10px] text-[#55756D]">Tap to open ledger</span>
            </h5>

            <div className="bg-white border border-[#D6E9E1] rounded-xl divide-y divide-[#D6E9E1] overflow-hidden shadow-xs">
              {topDebtors.map(({ contact: debtor, totalBalance }) => (
                <div
                  key={debtor.id}
                  onClick={() => {
                    onClose();
                    onSelectContact(debtor);
                  }}
                  className="p-2.5 flex items-center justify-between hover:bg-emerald-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] flex items-center justify-center font-bold text-xs text-[#0B8F68] shadow-inner">
                      {debtor.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#163B32] block">{debtor.name}</span>
                      <span className="text-[10px] text-[#55756D]">{debtor.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#E5485D]">
                      {formatPKR(totalBalance)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#55756D]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-[#D6E9E1] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-emerald-50 text-[#55756D] hover:text-[#163B32] text-xs font-bold rounded-lg border border-[#D6E9E1] transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
