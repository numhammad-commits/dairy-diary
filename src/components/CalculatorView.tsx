import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  Wallet, 
  Lightbulb, 
  Check, 
  Sparkles,
  Copy
} from 'lucide-react';

interface CalculatorViewProps {
  onBack: () => void;
  onUseRate?: (rate: number, liters: number) => void;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({ 
  onBack,
  onUseRate 
}) => {
  // Input string states to support smooth decimal typing (e.g. '5.')
  const [baseRateStr, setBaseRateStr] = useState<string>('');
  const [quantityStr, setQuantityStr] = useState<string>('');
  const [fatStr, setFatStr] = useState<string>('');
  const [snfStr, setSnfStr] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);

  // Reactive math calculation engine
  const calculation = useMemo(() => {
    const baseRate = parseFloat(baseRateStr);
    const quantity = parseFloat(quantityStr);
    const fat = parseFloat(fatStr);

    const isBaseRateValid = !isNaN(baseRate) && baseRate > 0;
    const isQuantityValid = !isNaN(quantity) && quantity > 0;
    const isFatValid = !isNaN(fat) && fat > 0;

    // Optional SNF: defaults safely to standard 9.0 if left blank or invalid
    const isSnfProvided = snfStr.trim() !== '';
    const parsedSnf = parseFloat(snfStr);
    const effectiveSnf = isSnfProvided && !isNaN(parsedSnf) && parsedSnf >= 0 ? parsedSnf : 9.0;

    // All 3 mandatory fields must be entered with valid positive values
    if (!isBaseRateValid || !isQuantityValid || !isFatValid) {
      return {
        isValid: false,
        ratePerLiter: 0,
        totalAmount: 0,
        effectiveSnf: isSnfProvided ? parsedSnf : 9.0,
        isSnfDefaulted: !isSnfProvided,
      };
    }

    // Local Dairy Testing Formula:
    // Rate = Base Rate * ((Fat + SNF) / 15.5)
    // Based on standard 6.5 Fat & 9.0 SNF (6.5 + 9.0 = 15.5)
    const ratePerLiter = baseRate * ((fat + effectiveSnf) / 15.5);
    const totalAmount = ratePerLiter * quantity;

    return {
      isValid: true,
      ratePerLiter: Math.max(0, ratePerLiter),
      totalAmount: Math.max(0, totalAmount),
      effectiveSnf,
      isSnfDefaulted: !isSnfProvided,
    };
  }, [baseRateStr, quantityStr, fatStr, snfStr]);

  // Handle Refresh / Reset
  const handleReset = () => {
    setIsRotating(true);
    setBaseRateStr('');
    setQuantityStr('');
    setFatStr('');
    setSnfStr('');
    setTimeout(() => setIsRotating(false), 500);
  };

  // Preset loaders for fast testing and farmer convenience
  const applyPreset = (preset: 'standard_buffalo' | 'cow_milk' | 'screen_sample') => {
    if (preset === 'standard_buffalo') {
      setBaseRateStr('150');
      setQuantityStr('10');
      setFatStr('6.5');
      setSnfStr('9.0');
    } else if (preset === 'cow_milk') {
      setBaseRateStr('140');
      setQuantityStr('5.0');
      setFatStr('4.5');
      setSnfStr('8.5');
    } else if (preset === 'screen_sample') {
      setBaseRateStr('50');
      setQuantityStr('5.2');
      setFatStr('4.5');
      setSnfStr(''); // Demonstrates optional SNF defaulting to 9.0
    }
  };

  const handleCopyTotal = () => {
    if (calculation.totalAmount > 0) {
      navigator.clipboard.writeText(`Rs${calculation.totalAmount.toFixed(2)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Format helper functions
  const formatMoney = (val: number): string => {
    if (val === 0) return 'Rs0.00';
    return `Rs${val.toFixed(2)}`;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[#F4FBF7] select-none">
      {/* 1. Top Header App Bar (Deep corporate green #1E5631 matching theme) */}
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
            SNF &amp; Fat Calculator
          </h1>
        </div>

        {/* Clean white refresh/clear button icon on far right */}
        <button
          onClick={handleReset}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
          title="Reset Calculator"
          aria-label="Reset Calculator"
        >
          <RotateCcw className={`w-5 h-5 stroke-[2.2] transition-transform duration-500 ${isRotating ? '-rotate-180' : ''}`} />
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-20">
        {/* Quick Presets Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#0B8F68]" /> Quick:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('screen_sample')}
            className="px-2.5 py-1 rounded-full bg-white border border-[#D6E9E1] text-[#163B32] hover:bg-slate-50 font-semibold text-[11px] shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            Sample (50 / 5.2L / 4.5%)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('standard_buffalo')}
            className="px-2.5 py-1 rounded-full bg-white border border-[#D6E9E1] text-[#163B32] hover:bg-slate-50 font-semibold text-[11px] shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            Buffalo Standard (6.5 / 9.0)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('cow_milk')}
            className="px-2.5 py-1 rounded-full bg-white border border-[#D6E9E1] text-[#163B32] hover:bg-slate-50 font-semibold text-[11px] shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            Cow Milk (4.5 / 8.5)
          </button>
        </div>

        {/* ============================================================== */}
        {/* CARD 1: ENTER DETAILS (Mandatory & Optional Fields)            */}
        {/* ============================================================== */}
        <div className="glass-card rounded-3xl p-5 border border-[#D6E9E1] shadow-xs space-y-4 text-[#163B32]">
          <h2 className="text-base font-bold text-[#163B32] tracking-tight">
            Enter Details
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Field 1: Base Rate (Mandatory) */}
            <div>
              <label className="block text-xs font-bold text-[#55756D] mb-1.5">
                Base Rate <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={baseRateStr}
                  onChange={(e) => setBaseRateStr(e.target.value)}
                  placeholder="Rs e.g. 50"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Field 2: Quantity (Mandatory) */}
            <div>
              <label className="block text-xs font-bold text-[#55756D] mb-1.5">
                Quantity <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={quantityStr}
                  onChange={(e) => setQuantityStr(e.target.value)}
                  placeholder="e.g. 5.2"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Field 3: Fat % (Mandatory) */}
            <div>
              <label className="block text-xs font-bold text-[#55756D] mb-1.5">
                Fat % <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={fatStr}
                  onChange={(e) => setFatStr(e.target.value)}
                  placeholder="e.g. 4.5"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Field 4: SNF % (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#55756D]">
                  SNF %
                </label>
                <span className="text-[10px] text-[#7A8C84] font-medium">
                  {snfStr.trim() === '' ? 'Def: 9.0' : ''}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={snfStr}
                  onChange={(e) => setSnfStr(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: FINAL ESTIMATE (Reactive Real-Time Output)             */}
        {/* ============================================================== */}
        <div className="glass-card rounded-3xl p-5 border border-[#D6E9E1] shadow-xs space-y-4 text-[#163B32]">
          {/* Card Header matching Screen 1 (Wallet/Banknote icon + title) */}
          <div className="flex items-center justify-center gap-2 pb-1">
            <div className="w-6 h-6 rounded-lg bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center">
              <Wallet className="w-4 h-4 stroke-[2.5]" />
            </div>
            <h2 className="text-base font-extrabold text-[#163B32]">
              Final Estimate
            </h2>
          </div>

          <div className="h-px bg-[#D6E9E1] -mx-5" />

          {/* Row: Rate per Liter */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-[#55756D]">
              Rate per Liter
            </span>
            <span className="text-base font-bold text-[#163B32] tracking-tight font-mono">
              {formatMoney(calculation.ratePerLiter)}
            </span>
          </div>

          {/* Highlight Container: Total Amount */}
          <div className="bg-[#E1F3EA] border border-[#0B8F68]/30 rounded-2xl p-4 flex items-center justify-between text-[#163B32]">
            <span className="text-base font-bold text-[#163B32]">
              Total Amount
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#0B9B72] tracking-tight font-mono">
                {formatMoney(calculation.totalAmount)}
              </span>
              {calculation.totalAmount > 0 && (
                <button
                  type="button"
                  onClick={handleCopyTotal}
                  className="p-1 text-[#55756D] hover:text-[#163B32] rounded cursor-pointer"
                  title="Copy total amount"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[#0B8F68] stroke-[3]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#55756D] hover:text-[#163B32]" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Action button if user wants to use this calculated rate */}
          {onUseRate && calculation.isValid && (
            <button
              type="button"
              onClick={() => onUseRate(calculation.ratePerLiter, parseFloat(quantityStr) || 0)}
              className="w-full py-2.5 px-4 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Apply to Milk Entry (Rs{calculation.ratePerLiter.toFixed(2)}/L)</span>
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* CARD 3: HOW IT WORKS (Informative Formula Framework)           */}
        {/* ============================================================== */}
        <div className="glass-card rounded-3xl p-4.5 border border-[#D6E9E1] shadow-xs flex items-start gap-3.5 text-[#163B32]">
          <div className="w-10 h-10 rounded-2xl bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xs font-bold text-[#163B32]">
              How it works
            </h3>
            <p className="text-[11px] text-[#55756D] leading-relaxed font-medium">
              Calculated as: Rate = Base Rate × ((Fat + SNF) ÷ 15.5)
            </p>
            <p className="text-[11px] text-[#7A8C84] leading-relaxed">
              Based on standard 6.5 Fat &amp; 9.0 SNF
            </p>
            {calculation.isSnfDefaulted && (
              <p className="text-[10px] text-[#0B8F68] font-semibold bg-[#E1F3EA] border border-[#0B8F68]/30 px-2 py-0.5 rounded-md inline-block mt-1">
                Notice: Optional SNF is defaulting to standard 9.0
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
