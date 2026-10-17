import React from 'react';
import { CalculatorView } from './CalculatorView';

interface CalculatorModalProps {
  onClose: () => void;
  onUseRate?: (rate: number, liters: number) => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ 
  onClose,
  onUseRate 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-glass-gradient rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col h-[90vh] max-h-[720px]"
        onClick={(e) => e.stopPropagation()}
      >
        <CalculatorView 
          onBack={onClose} 
          onUseRate={onUseRate} 
        />
      </div>
    </div>
  );
};
