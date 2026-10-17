import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getMonthDisplay, shiftMonthKey } from '../utils/formatters';

interface MonthSelectorProps {
  currentMonthKey: string;
  onMonthChange: (newMonthKey: string) => void;
  className?: string;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentMonthKey,
  onMonthChange,
  className = '',
}) => {
  const display = getMonthDisplay(currentMonthKey);

  const handlePrev = () => {
    onMonthChange(shiftMonthKey(currentMonthKey, -1));
  };

  const handleNext = () => {
    onMonthChange(shiftMonthKey(currentMonthKey, 1));
  };

  return (
    <div className={`flex items-center justify-center py-1 select-none ${className}`}>
      <div className="inline-flex items-center justify-between gap-3 px-3.5 py-1.5 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] shadow-xs text-[#163B32] transition-all">
        <button
          onClick={handlePrev}
          className="p-1 text-[#163B32] hover:text-[#0B8F68] active:bg-[#D6E9E1] rounded-full transition-colors cursor-pointer"
          aria-label="Previous Month"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-1.5 px-2">
          <Calendar className="w-4 h-4 text-[#0B8F68] stroke-[2.2]" />
          <span className="text-xs sm:text-sm font-extrabold text-[#163B32] tracking-tight">
            {display}
          </span>
        </div>

        <button
          onClick={handleNext}
          className="p-1 text-[#163B32] hover:text-[#0B8F68] active:bg-[#D6E9E1] rounded-full transition-colors cursor-pointer"
          aria-label="Next Month"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};

