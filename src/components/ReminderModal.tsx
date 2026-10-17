import React from 'react';
import { RemindersView } from './RemindersView';
import { ReminderSetting } from '../types/dairy';

interface ReminderModalProps {
  reminders: ReminderSetting;
  onClose: () => void;
  onSave: (updated: ReminderSetting) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  reminders,
  onClose,
  onSave,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-glass-gradient rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col h-[90vh] max-h-[720px]"
        onClick={(e) => e.stopPropagation()}
      >
        <RemindersView 
          reminders={reminders}
          onUpdateReminders={onSave}
          onBack={onClose}
        />
      </div>
    </div>
  );
};
