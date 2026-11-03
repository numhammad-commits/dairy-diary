import React from 'react';
import { Droplets, Banknote, AlertCircle, CheckCircle2, Info, Navigation } from 'lucide-react';
import { formatPKR, formatLiters } from '../utils/formatters';
import { MonthSelector } from './MonthSelector';

interface FinancialSummaryCardProps {
  liters: number;
  amount: number;
  due: number;
  received: number;
  totalOutstanding: number;
  previousBalance?: number;
  onOpenOutstandingInfo: () => void;
  currentMonthKey?: string;
  onMonthChange?: (newKey: string) => void;
  onOpenTracker?: () => void;
  // True only when the active filter shows exclusively Buy Milk (vendor) contacts —
  // in that case "Received" is relabeled "Paid" since we're the one paying them.
  // Left false/omitted for Sell Milk or the mixed "All" view.
  isVendorView?: boolean;
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  liters,
  amount,
  due,
  received,
  totalOutstanding,
  previousBalance,
  onOpenOutstandingInfo,
  currentMonthKey,
  onMonthChange,
  onOpenTracker,
  isVendorView = false,
}) => {
  return (
    <div className="mx-3 my-2 space-y-2 select-none">
      {/* Month Navigation Pill */}
      {currentMonthKey && onMonthChange && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <MonthSelector
              currentMonthKey={currentMonthKey}
              onMonthChange={onMonthChange}
            />
          </div>
          {onOpenTracker && (
            <button
              type="button"
              onClick={onOpenTracker}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#D6E9E1] text-[#0B8F68] text-xs font-bold shadow-xs hover:bg-[#E1F3EA] active:scale-95 transition-all cursor-pointer"
              title="Open Delivery Tracker"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Tracker</span>
            </button>
          )}
        </div>
      )}

      {/* 2x2 Grid of Clean White Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Tile 1: Milk (blue circle icon) */}
        <div className="bg-white rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center gap-3 transition-all">
          <div className="w-10 h-10 rounded-full bg-[#1597E5] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Droplets className="w-5 h-5 fill-white text-white" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#55756D] leading-tight mb-0.5">
              Milk
            </span>
            <span className="text-base sm:text-lg font-black text-[#163B32] tracking-tight leading-tight truncate block">
              {formatLiters(liters)}
            </span>
          </div>
        </div>

        {/* Tile 2: Amount (green cash icon) */}
        <div className="bg-white rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center gap-3 transition-all">
          <div className="w-10 h-10 rounded-full bg-[#0B9B72] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Banknote className="w-5 h-5 text-white stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#55756D] leading-tight mb-0.5">
              Amount
            </span>
            <span className="text-base sm:text-lg font-black text-[#163B32] tracking-tight leading-tight truncate block">
              {formatPKR(amount)}
            </span>
          </div>
        </div>

        {/* Tile 3: Due (red warning icon) */}
        <div className="bg-white rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center gap-3 transition-all">
          <div className="w-10 h-10 rounded-full bg-[#E5485D] flex items-center justify-center text-white shrink-0 shadow-xs">
            <AlertCircle className="w-5 h-5 text-white stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#55756D] leading-tight mb-0.5">
              Due
            </span>
            <span className="text-base sm:text-lg font-black text-[#E5485D] tracking-tight leading-tight truncate block">
              {formatPKR(due)}
            </span>
          </div>
        </div>

        {/* Tile 4: Received (green checkmark icon) */}
        <div className="bg-white rounded-2xl p-3 border border-[#D6E9E1] shadow-xs flex items-center gap-3 transition-all">
          <div className="w-10 h-10 rounded-full bg-[#0B9B72] flex items-center justify-center text-white shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#55756D] leading-tight mb-0.5">
              {isVendorView ? 'Paid' : 'Received'}
            </span>
            <span className="text-base sm:text-lg font-black text-[#0B9B72] tracking-tight leading-tight truncate block">
              {formatPKR(received)}
            </span>
          </div>
        </div>
      </div>

      {/* Wide Total Outstanding Bar with Info Icon */}
      <button
        onClick={onOpenOutstandingInfo}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-[#E1F3EA] border border-[#D6E9E1] text-[#163B32] hover:bg-[#d6ecdf] transition-all shadow-xs active:scale-[0.99] cursor-pointer"
        title="Click to view lifetime debt aging & details"
      >
        <span className="text-xs font-semibold text-[#163B32]">Total Outstanding:</span>
        <span className="text-sm sm:text-base font-black text-[#163B32] tracking-tight">
          {formatPKR(totalOutstanding)}
        </span>
        <Info className="w-4 h-4 text-[#0B8F68] ml-0.5" />
      </button>

      {/* Previous Balance Carried Forward (shown separately, not mixed into Outstanding) */}
      {(previousBalance ?? 0) > 0 && (
        <div className="w-full flex items-center justify-between py-1.5 px-3.5 rounded-xl bg-[#FFF9E6] border border-[#FFE8A3] text-[#7A5800] text-xs shadow-xs">
          <span className="font-semibold text-xs sm:text-sm">Previous Balance Carried Forward:</span>
          <span className="font-black text-sm sm:text-base text-[#946200]">{formatPKR(previousBalance!)}</span>
        </div>
      )}
    </div>
  );
};
