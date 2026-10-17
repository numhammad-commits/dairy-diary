import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Wallet, 
  User, 
  Receipt,
  Download
} from 'lucide-react';
import { PaymentRecord } from '../types/dairy';
import { getFullMonthDisplay, shiftMonthKey, getDeviceCurrentMonthKey } from '../utils/formatters';

interface PaymentHistoryViewProps {
  paymentRecords: PaymentRecord[];
  initialMonthKey?: string;
  onBack: () => void;
  showToast?: (message: string) => void;
}

export const PaymentHistoryView: React.FC<PaymentHistoryViewProps> = ({
  paymentRecords,
  initialMonthKey = getDeviceCurrentMonthKey(),
  onBack,
  showToast,
}) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(initialMonthKey);

  React.useEffect(() => {
    if (initialMonthKey) {
      setSelectedMonthKey(initialMonthKey);
    }
  }, [initialMonthKey]);

  // Filter payments dynamically for selected month
  const monthlyPayments = useMemo(() => {
    return paymentRecords.filter((record) =>
      record.billingMonth ? record.billingMonth === selectedMonthKey : record.date.startsWith(selectedMonthKey)
    );
  }, [paymentRecords, selectedMonthKey]);

  // Total received sum for selected month
  const totalReceived = useMemo(() => {
    return monthlyPayments.reduce((sum, item) => sum + item.amount, 0);
  }, [monthlyPayments]);

  // Navigate months
  const handlePrevMonth = () => {
    setSelectedMonthKey((prev) => shiftMonthKey(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonthKey((prev) => shiftMonthKey(prev, 1));
  };

  const handleExport = () => {
    if (showToast) {
      showToast(`Exported ${getFullMonthDisplay(selectedMonthKey)} payment statement`);
    }
  };

  // Format currency with two decimals e.g. Rs88920.00
  const formatAmountFloat = (val: number): string => {
    return `Rs${val.toFixed(2)}`;
  };

  const formatPositiveAmount = (val: number): string => {
    return `+Rs${val.toFixed(2)}`;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[#F4FBF7] select-none">
      {/* 1. Top Header App Bar (Deep corporate green #1E5631) */}
      <div className="bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            title="Back to Home"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Payment History
          </h1>
        </div>

        {/* Optional Statement Export Action */}
        <button
          onClick={handleExport}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
          title="Export Payment Statement"
          aria-label="Export Payment Statement"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Date Navigation Filter Bar */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#D6E9E1] shadow-xs shrink-0 z-10 text-[#163B32]">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 rounded-xl hover:bg-slate-100 active:bg-slate-200 text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer"
          title="Previous Month"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <span className="font-extrabold text-base text-[#163B32] tracking-tight">
          {getFullMonthDisplay(selectedMonthKey)}
        </span>

        <button
          onClick={handleNextMonth}
          className="p-1.5 rounded-xl hover:bg-slate-100 active:bg-slate-200 text-[#55756D] hover:text-[#163B32] transition-colors cursor-pointer"
          title="Next Month"
          aria-label="Next Month"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 3. Scrollable History List View with Top Summary Card */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 pb-20">
        {/* "Total Received" Metrics Summary Card */}
        <div className="glass-card bg-[#006B52] rounded-3xl p-5 text-white shadow-md border border-[#006B52] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#C8E6C9] tracking-wide block uppercase">
              Total Received
            </span>
            <span className="text-3xl font-black text-white tracking-tight mt-1 block">
              {formatAmountFloat(totalReceived)}
            </span>
            <span className="text-[11px] text-[#C8E6C9] font-medium mt-1 block">
              {monthlyPayments.length} transactions in {getFullMonthDisplay(selectedMonthKey)}
            </span>
          </div>

          {/* Translucent white circular badge with wallet icon */}
          <div className="w-14 h-14 rounded-2xl bg-white/20 text-white border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
            <Wallet className="w-7 h-7 stroke-[2]" />
          </div>
        </div>

        {/* Itemized Payment Records */}
        {monthlyPayments.length > 0 ? (
          <div className="space-y-3">
            {monthlyPayments.map((record) => (
              <div
                key={record.id}
                className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs flex items-center justify-between hover:border-[#0B8F68]/30 transition-all text-[#163B32]"
              >
                {/* Left Block: Avatar & Contact Meta */}
                <div className="flex items-center">
                  {/* Generic Circular Profile Avatar */}
                  <div className="w-12 h-12 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center shrink-0 mr-3.5">
                    <User className="w-6 h-6 stroke-[2.2]" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#163B32] leading-snug">
                      {record.contactName}
                    </h3>
                    <p className="text-xs text-[#55756D] font-medium mt-0.5">
                      {record.displayDate}
                    </p>
                    {record.paymentMethod && (
                      <span className="text-[10px] font-semibold text-[#55756D] bg-slate-100 border border-[#D6E9E1] px-1.5 py-0.5 rounded inline-block mt-1">
                        {record.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Block: Amount & Status Badge */}
                <div className="text-right shrink-0 pl-3">
                  <span className="text-base font-extrabold text-[#0B9B72] tracking-tight block">
                    {formatPositiveAmount(record.amount)}
                  </span>
                  <span className="text-xs text-[#55756D] font-medium block mt-0.5">
                    {record.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="glass-card rounded-3xl p-8 border border-[#D6E9E1] shadow-xs text-center flex flex-col items-center justify-center my-4 space-y-2 text-[#163B32]">
            <div className="w-16 h-16 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center mb-2">
              <Receipt className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h3 className="text-sm font-bold text-[#163B32]">
              No Payment Records
            </h3>
            <p className="text-xs text-[#55756D] max-w-xs leading-relaxed">
              No payment transactions were logged for {getFullMonthDisplay(selectedMonthKey)}. Use the chevrons above to view other months.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
