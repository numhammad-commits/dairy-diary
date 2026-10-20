import React from 'react';
import { Home, BarChart2, Plus, BookOpen, Settings } from 'lucide-react';
import { ActiveNavTab } from '../types/dairy';

interface BottomNavBarProps {
  activeTab: ActiveNavTab;
  onTabSelect: (tab: ActiveNavTab) => void;
  onOpenAddUser: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabSelect,
  onOpenAddUser: _onOpenAddUser,
}) => {
  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-2.5 pb-5 pt-1 select-none z-50 bg-transparent">
      <nav className="bg-white rounded-full px-1.5 py-1.5 flex items-center justify-between shadow-lg border border-[#D6E9E1]">
        {/* 1. Home */}
        <button
          onClick={() => onTabSelect('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-[#163B32] font-bold'
              : 'text-[#55756D] hover:text-[#163B32]'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] font-bold mt-0.5">Home</span>
        </button>

        {/* 2. Reports */}
        <button
          onClick={() => onTabSelect('reports')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'text-[#163B32] font-bold'
              : 'text-[#55756D] hover:text-[#163B32]'
          }`}
        >
          <BarChart2 className={`w-5 h-5 ${activeTab === 'reports' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] font-medium mt-0.5">Reports</span>
        </button>

        {/* 3. Centered Elevated Floating Action Button: Add User */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-6">
          <button
            onClick={() => onTabSelect('add_user')}
            className="w-12 h-12 rounded-full bg-[#0B8F68] hover:bg-[#087A5A] active:scale-95 text-white flex items-center justify-center shadow-md ring-4 ring-[#F4FBF7] transition-all cursor-pointer group"
            title="Add New Customer / Supplier"
            aria-label="Add User"
          >
            <Plus className="w-6 h-6 stroke-[2.8] group-hover:scale-110 transition-transform" />
          </button>
          <span className={`text-[10px] font-bold mt-0.5 ${activeTab === 'add_user' ? 'text-[#0B8F68]' : 'text-[#163B32]'}`}>
            Add User
          </span>
        </div>

        {/* 5. Expenses */}
        <button
          onClick={() => onTabSelect('expenses')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'expenses'
              ? 'text-[#163B32] font-bold'
              : 'text-[#55756D] hover:text-[#163B32]'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${activeTab === 'expenses' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] font-medium mt-0.5">Expenses</span>
        </button>

        {/* 6. Settings */}
        <button
          onClick={() => onTabSelect('settings')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-[#163B32] font-bold'
              : 'text-[#55756D] hover:text-[#163B32]'
          }`}
        >
          <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] font-medium mt-0.5">Settings</span>
        </button>
      </nav>
    </div>
  );
};
