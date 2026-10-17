import React from 'react';
import { FilterTab } from '../types/dairy';

interface SegmentedTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="mx-3 my-2 p-1 rounded-full bg-white border border-[#D6E9E1] flex items-center shadow-xs select-none">
      <button
        onClick={() => onTabChange('all')}
        className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer text-center ${
          activeTab === 'all'
            ? 'bg-[#0B8F68] text-white shadow-xs'
            : 'text-[#163B32] hover:text-[#0B8F68]'
        }`}
      >
        All
      </button>

      <div className="h-3 w-px bg-[#D6E9E1] shrink-0" />

      <button
        onClick={() => onTabChange('buy_milk')}
        className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer text-center ${
          activeTab === 'buy_milk'
            ? 'bg-[#0B8F68] text-white shadow-xs'
            : 'text-[#163B32] hover:text-[#0B8F68]'
        }`}
      >
        Buy Milk
      </button>

      <div className="h-3 w-px bg-[#D6E9E1] shrink-0" />

      <button
        onClick={() => onTabChange('sell_milk')}
        className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer text-center ${
          activeTab === 'sell_milk'
            ? 'bg-[#0B8F68] text-white shadow-xs'
            : 'text-[#163B32] hover:text-[#0B8F68]'
        }`}
      >
        Sell Milk
      </button>
    </div>
  );
};
