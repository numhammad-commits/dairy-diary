import React from 'react';
import { AddUserView } from './AddUserView';
import { Contact } from '../types/dairy';

interface AddUserModalProps {
  onClose: () => void;
  onSave: (
    contact: Omit<Contact, 'id' | 'currentMonthDue' | 'totalLifetimeDue' | 'lastActivityTimestamp' | 'lastActivityIso' | 'createdAt'>, 
    openingBalance: number
  ) => void;
  existingContacts?: Contact[];
  onSelectExistingContact?: (contact: Contact) => void;
  showToast?: (message: string) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  onClose,
  onSave,
  existingContacts = [],
  onSelectExistingContact,
  showToast,
}) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md h-full max-h-[92vh] bg-glass-gradient rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-[#D6E9E1]"
        onClick={(e) => e.stopPropagation()}
      >
        <AddUserView
          onBack={onClose}
          onSave={onSave}
          existingContacts={existingContacts}
          onSelectExistingContact={onSelectExistingContact}
          showToast={showToast}
        />
      </div>
    </div>
  );
};
