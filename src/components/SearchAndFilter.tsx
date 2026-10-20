import React, { useState } from 'react';
import { Search, Clock, Users, ChevronDown, Check, MapPin, Filter } from 'lucide-react';
import { SortOption, CustomerStatusFilter } from '../types/dairy';

export interface AvailableAddressesInfo {
  addresses: string[];
  hasNoAddress: boolean;
}

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  statusFilter: CustomerStatusFilter;
  onStatusFilterChange: (status: CustomerStatusFilter) => void;
  addressFilter?: string;
  onAddressFilterChange?: (address: string) => void;
  availableAddresses?: AvailableAddressesInfo;
  countLabel: string;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  addressFilter = 'all',
  onAddressFilterChange,
  availableAddresses,
  countLabel,
}) => {
  const [isOpen, setIsOpen] = useState(
    typeof window !== 'undefined' && window.location.search.includes('dropdown=open')
  );

  // Computes the button label dynamically to reflect current status, address, & sort
  const getButtonLabel = () => {
    const sortText =
      sortOption === 'alphabetical' ? 'Name (A-Z)' :
      sortOption === 'latest' ? 'Latest' :
      sortOption === 'highest_due' ? 'Highest Due' : 'Lowest Due';

    let label = sortText;
    if (statusFilter === 'inactive') {
      label = `Inactive · ${sortOption === 'alphabetical' ? 'A-Z' : sortText}`;
    } else if (statusFilter === 'all') {
      label = `All · ${sortOption === 'alphabetical' ? 'A-Z' : sortText}`;
    }

    if (addressFilter && addressFilter !== 'all') {
      const areaTag =
        addressFilter === 'no_address'
          ? 'No Area'
          : (addressFilter.length > 10 ? `${addressFilter.slice(0, 9)}…` : addressFilter);
      return `${areaTag} · ${label}`;
    }

    return label;
  };

  return (
    <div className={`mx-3 my-2 rounded-full px-3.5 py-2 bg-white border border-[#D6E9E1] shadow-xs flex items-center justify-between gap-2 transition-all focus-within:ring-2 focus-within:ring-[#0B8F68]/30 relative select-none ${isOpen ? 'z-50' : 'z-10'}`}>
      {/* Search Input */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Search className="w-4 h-4 text-[#55756D] shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search customer..."
          className="w-full text-sm font-medium text-[#163B32] placeholder-[#55756D]/75 focus:outline-none bg-transparent"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="text-[#55756D] hover:text-[#163B32] text-xs px-1 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-[#D6E9E1] shrink-0" />

      {/* Combined Sort + Status Filter Menu Trigger */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#163B32] bg-transparent py-0.5 cursor-pointer focus:outline-none hover:text-[#0B8F68] transition-colors"
          aria-label="Customer Status and Sorting Filter"
          aria-expanded={isOpen}
        >
          <Filter className="w-3.5 h-3.5 text-[#0B8F68] shrink-0" />
          <span className="whitespace-nowrap font-bold max-w-[120px] truncate text-[#163B32]">
            {getButtonLabel()}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#55756D] shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu (Issue 2 Fix: z-[9999] on top of all cards) */}
        {isOpen && (
          <>
            {/* Backdrop for click outside */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />

            <div className="absolute right-0 top-full mt-2 w-56 max-w-[85vw] max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-[9999] animate-in fade-in zoom-in-95 duration-100 select-none">
              {/* Section 1: Customer Status */}
              <div className="px-2 pb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 py-1 block">
                  Customer Status
                </span>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onStatusFilterChange('active');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'active'
                        ? 'bg-emerald-50 text-[#1E5631]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Active</span>
                    </div>
                    {statusFilter === 'active' && (
                      <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStatusFilterChange('inactive');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'inactive'
                        ? 'bg-amber-50 text-amber-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Inactive</span>
                    </div>
                    {statusFilter === 'inactive' && (
                      <Check className="w-3.5 h-3.5 text-amber-900 stroke-[2.5]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStatusFilterChange('all');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>All</span>
                    </div>
                    {statusFilter === 'all' && (
                      <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-150 my-1" />

              {/* Section 2: Sorting */}
              <div className="px-2 pt-1 pb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 py-1 block">
                  Sorting
                </span>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSortChange('alphabetical');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sortOption === 'alphabetical'
                        ? 'bg-emerald-50 text-[#1E5631]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>A–Z</span>
                    {sortOption === 'alphabetical' && (
                      <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSortChange('latest');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sortOption === 'latest'
                        ? 'bg-emerald-50 text-[#1E5631]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Latest</span>
                    {sortOption === 'latest' && (
                      <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSortChange('highest_due');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sortOption === 'highest_due'
                        ? 'bg-emerald-50 text-[#1E5631]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Highest Due</span>
                    {sortOption === 'highest_due' && (
                      <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSortChange('lowest_due');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sortOption === 'lowest_due'
                        ? 'bg-emerald-50 text-[#1E5631]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Lowest Due</span>
                    {sortOption === 'lowest_due' && (
                      <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-150 my-1" />

              {/* Section 3: Address Order */}
              <div className="px-2 pt-1 pb-1">
                <div className="flex items-center justify-between px-2.5 py-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Filter by Area
                  </span>
                  {addressFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddressFilterChange?.('all');
                      }}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5 overscroll-contain">
                  {/* All Areas (Default) */}
                  <button
                    type="button"
                    onClick={() => {
                      onAddressFilterChange?.('all');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      addressFilter === 'all'
                        ? 'bg-emerald-50 text-[#1E5631]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">All Areas</span>
                    </div>
                    {addressFilter === 'all' && (
                      <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5] shrink-0" />
                    )}
                  </button>

                  {/* List of dynamic customer addresses */}
                  {availableAddresses?.addresses.map((address) => {
                    const isSelected = addressFilter === address;
                    return (
                      <button
                        key={address}
                        type="button"
                        onClick={() => {
                          onAddressFilterChange?.(address);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-[#1E5631]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        title={address}
                      >
                        <div className="flex items-center gap-2 truncate pr-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                          />
                          <span className="truncate text-left">{address}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#1E5631] stroke-[2.5] shrink-0" />
                        )}
                      </button>
                    );
                  })}

                  {/* Fallback for customers with no saved address */}
                  {availableAddresses?.hasNoAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        onAddressFilterChange?.('no_address');
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        addressFilter === 'no_address'
                          ? 'bg-amber-50 text-amber-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            addressFilter === 'no_address' ? 'bg-amber-600' : 'bg-slate-300'
                          }`}
                        />
                        <span className="truncate text-left italic">No Area</span>
                      </div>
                      {addressFilter === 'no_address' && (
                        <Check className="w-3.5 h-3.5 text-amber-900 stroke-[2.5] shrink-0" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-[#D6E9E1] shrink-0" />

      {/* Stats Badge */}
      <div className="flex items-center gap-1 shrink-0 text-[#55756D]">
        <Users className="w-4 h-4 text-[#55756D]" />
        <span className="text-xs font-semibold tracking-tight whitespace-nowrap text-[#55756D]">
          {countLabel}
        </span>
      </div>
    </div>
  );
};
