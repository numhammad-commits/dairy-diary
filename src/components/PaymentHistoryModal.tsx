import React from 'react';
import { PaymentHistoryView } from './PaymentHistoryView';
import { PaymentRecord, Contact, LedgerEntry } from '../types/dairy';
import { INITIAL_PAYMENT_RECORDS } from '../data/mockDairyData';

interface PaymentHistoryModalProps {
  contacts?: Contact[];
  entries?: LedgerEntry[];
  paymentRecords?: PaymentRecord[];
  onClose: () => void;
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  paymentRecords = INITIAL_PAYMENT_RECORDS,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-glass-gradient rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col h-[90vh] max-h-[720px]"
        onClick={(e) => e.stopPropagation()}
      >
        <PaymentHistoryView 
          paymentRecords={paymentRecords}
          onBack={onClose}
        />
      </div>
    </div>
  );
};
