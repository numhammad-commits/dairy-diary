import React, { useState, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Mail,
  Camera, 
  Save, 
  Check, 
  ChevronRight, 
  Printer, 
  Cloud, 
  MessageCircle, 
  ExternalLink, 
  FileText, 
  Building2, 
  QrCode, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  Globe,
  Search,
  AlertCircle,
  X,
  Fuel,
  Pencil
} from 'lucide-react';
import { BusinessSettings } from '../types/dairy';
import { SawaaLogo } from './SawaaLogo';
import { 
  REGIONAL_CONFIGS, 
  getActiveRegionConfig, 
  RegionConfig 
} from '../utils/regionalPaymentConfig';

interface SettingsViewProps {
  settings: BusinessSettings;
  onUpdateSettings: (newSettings: BusinessSettings) => void;
  onBack: () => void;
  onOpenBackup: () => void;
  onOpenArchitectureModal: () => void;
  onOpenMonthlyBilling?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  onOpenBackup,
  onOpenArchitectureModal,
  onOpenMonthlyBilling,
}) => {
  const [form, setForm] = useState<BusinessSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [expandedPaymentMethod, setExpandedPaymentMethod] = useState<string | null>(null);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pendingRegion, setPendingRegion] = useState<RegionConfig | null>(null);
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');

  // Active region derived from settings
  const activeRegion = useMemo(() => {
    return getActiveRegionConfig(form.currency, form.currencySymbol);
  }, [form.currency, form.currencySymbol]);

  // File input refs for QR codes & profile avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const updated = { ...form, logoUrl: event.target?.result as string };
        setForm(updated);
        onUpdateSettings(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to get method data for the currently active region
  const getMethodData = (methodId: string): Record<string, any> => {
    const regionCode = activeRegion.code;
    const regionSaved = form.savedRegionPayments?.[regionCode];

    if (regionCode === 'PKR') {
      if (methodId === 'easypaisa') return regionSaved?.easypaisa || form.easypaisa || {};
      if (methodId === 'jazzcash') return regionSaved?.jazzcash || form.jazzcash || {};
      if (methodId === 'bankTransfer') return regionSaved?.bankTransfer || form.bankTransfer || {};
    }

    return regionSaved?.[methodId] || {};
  };

  // Helper to update any field on any regional payment method
  const updateMethodField = (methodId: string, fieldKey: string, value: any) => {
    setForm((prev) => {
      const regionCode = activeRegion.code;
      const currentRegionSaved = prev.savedRegionPayments?.[regionCode] || {};
      const currentMethodData = getMethodData(methodId);
      const updatedMethodData = {
        ...currentMethodData,
        [fieldKey]: value,
      };

      const updatedSavedRegionPayments = {
        ...(prev.savedRegionPayments || {}),
        [regionCode]: {
          ...currentRegionSaved,
          [methodId]: updatedMethodData,
        },
      };

      const updatedForm: BusinessSettings = {
        ...prev,
        savedRegionPayments: updatedSavedRegionPayments,
      };

      // Keep legacy fields in sync for PKR so existing code and backups remain 100% compatible
      if (regionCode === 'PKR') {
        if (methodId === 'easypaisa') {
          updatedForm.easypaisa = { ...prev.easypaisa, ...updatedMethodData } as any;
        } else if (methodId === 'jazzcash') {
          updatedForm.jazzcash = { ...prev.jazzcash, ...updatedMethodData } as any;
        } else if (methodId === 'bankTransfer') {
          updatedForm.bankTransfer = { ...prev.bankTransfer, ...updatedMethodData } as any;
        }
      }

      return updatedForm;
    });
  };

  // QR upload handler for any regional method
  const handleMethodQrUpload = (methodId: string, file?: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        updateMethodField(methodId, 'qrCodeUrl', url);
      };
      reader.readAsDataURL(file);
    }
  };

  // Confirm currency & region switch (WARNING 9: Preserves old details & restores new region details)
  const handleConfirmRegionChange = () => {
    if (!pendingRegion) return;
    const oldCode = activeRegion.code;
    const newCode = pendingRegion.code;

    setForm((prev) => {
      const currentSaved = prev.savedRegionPayments || {};
      const pkrSaved = oldCode === 'PKR' ? {
        easypaisa: prev.easypaisa,
        jazzcash: prev.jazzcash,
        bankTransfer: prev.bankTransfer,
      } : currentSaved.PKR;

      const updatedSaved = {
        ...currentSaved,
        PKR: pkrSaved,
        [oldCode]: currentSaved[oldCode] || (oldCode === 'PKR' ? pkrSaved : {}),
      };

      const newRegionSaved = updatedSaved[newCode] || {};

      const nextForm: BusinessSettings = {
        ...prev,
        currency: pendingRegion.currencyName,
        currencySymbol: pendingRegion.currencySymbol,
        savedRegionPayments: updatedSaved,
      };

      // If switching back to PKR, restore legacy fields
      if (newCode === 'PKR') {
        if (newRegionSaved.easypaisa) nextForm.easypaisa = newRegionSaved.easypaisa;
        if (newRegionSaved.jazzcash) nextForm.jazzcash = newRegionSaved.jazzcash;
        if (newRegionSaved.bankTransfer) nextForm.bankTransfer = newRegionSaved.bankTransfer;
      }

      onUpdateSettings(nextForm);
      return nextForm;
    });

    setPendingRegion(null);
    setShowCurrencyModal(false);
    setCurrencySearchQuery('');
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onUpdateSettings(form);
    setSaveSuccess(true);
    setIsEditingProfile(false);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const pakistaniBanks = [
    'Meezan Bank',
    'Habib Bank Limited (HBL)',
    'United Bank Limited (UBL)',
    'MCB Bank Limited',
    'Allied Bank Limited (ABL)',
    'Bank Alfalah',
    'Askari Bank',
    'Standard Chartered Pakistan',
    'Bank of Punjab (BOP)',
    'Faysal Bank',
    'National Bank of Pakistan (NBP)',
    'Soneri Bank',
    'JS Bank',
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-transparent select-none">
      {/* 1. Header Bar - Greenish Theme matching Screen 1 & 2 */}
      <div className="bg-[#1B4332]/90 backdrop-blur-md text-white px-4 py-3 flex items-center gap-3 shrink-0 border-b border-white/10 z-20">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
          title="Back to Home"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-white text-glass-lift">Settings</h1>
      </div>

      {/* 2. Scrollable Body containing all sections */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
        {/* ============================================================== */}
        {/* SECTION 1: BUSINESS PROFILE (Screen 1)                         */}
        {/* ============================================================== */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-[#163B32]">
              Business Profile
            </h2>
            {isEditingProfile ? (
              <span className="text-[10px] font-bold text-[#0B8F68] bg-[#E1F3EA] px-2.5 py-1 rounded-full border border-[#D6E9E1]">
                Editing…
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="text-[10px] font-bold text-[#0B8F68] bg-[#E1F3EA] hover:bg-[#D6E9E1] px-2.5 py-1 rounded-full border border-[#D6E9E1] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs space-y-3">
            <div className="flex items-center gap-3.5">
              {/* Circle Avatar with Edit Badge */}
              <div className="relative shrink-0">
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-18 h-18 rounded-full bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center shadow-sm overflow-hidden group cursor-pointer relative"
                  title="Upload Logo"
                >
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center flex flex-col items-center justify-center">
                      <span className="text-xl leading-none">🥛</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-emerald-300 mt-0.5">
                        {form.businessName ? form.businessName.slice(0, 6) : 'LOGO'}
                      </span>
                    </div>
                  )}

                  {/* Edit Pencil Badge */}
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center border-2 border-white shadow-xs group-hover:bg-emerald-600">
                    <Camera className="w-3 h-3" />
                  </div>
                </button>
              </div>

              {/* Stacked Inputs: Name & Phone */}
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Business / Distributor Name"
                    readOnly={!isEditingProfile}
                    className={`w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl shadow-xs focus:outline-none ${
                      isEditingProfile
                        ? 'text-slate-900 bg-white border border-slate-300 focus:ring-1 focus:ring-emerald-500'
                        : 'text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone Number (e.g. 03315183002)"
                    readOnly={!isEditingProfile}
                    className={`w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl shadow-xs focus:outline-none ${
                      isEditingProfile
                        ? 'text-slate-900 bg-white border border-slate-300 focus:ring-1 focus:ring-emerald-500'
                        : 'text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Address Input */}
            <div className="relative pt-1">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Location / Address"
                readOnly={!isEditingProfile}
                className={`w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl shadow-xs focus:outline-none ${
                  isEditingProfile
                    ? 'text-slate-900 bg-white border border-slate-300 focus:ring-1 focus:ring-emerald-500'
                    : 'text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Email Address Input (for Backup, Restore, and Cloud Sync) */}
            <div className="relative pt-1">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email Address (e.g. farm@example.com)"
                readOnly={!isEditingProfile}
                className={`w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl shadow-xs focus:outline-none ${
                  isEditingProfile
                    ? 'text-slate-900 bg-white border border-slate-300 focus:ring-1 focus:ring-emerald-500'
                    : 'text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed'
                }`}
              />
            </div>

            <p className="text-[11px] text-[#55756D] font-medium px-1">
              Used for backup, restore, and syncing your data across devices.
            </p>

            <p className="text-[10px] text-[#55756D]/80 px-1">
              Logo appears in PDF • Name &amp; Phone shown in shared bill
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: PAYMENT DETAILS (Region Driven)                     */}
        {/* ============================================================== */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#163B32]">
              Payment Details ({activeRegion.country} Accounts)
            </h2>
            <span className="text-[10px] text-[#0B8F68] font-bold bg-[#E1F3EA] px-2 py-0.5 rounded-full border border-[#D6E9E1] flex items-center gap-1">
              <span>{activeRegion.flagEmoji}</span>
              <span>{activeRegion.code}</span>
            </span>
          </div>

          <div className="space-y-3">
            {activeRegion.methods.map((method) => {
              const data = getMethodData(method.id);
              const isShowOnPdf = Boolean(data.showOnPdf);
              const isExpanded = expandedPaymentMethod === method.id;

              return (
                <div
                  key={method.id}
                  className="glass-card rounded-2xl p-3.5 border border-[#D6E9E1] shadow-xs space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedPaymentMethod(isExpanded ? null : method.id)}
                    className={`w-full flex items-center justify-between cursor-pointer text-left ${
                      isExpanded ? 'pb-2 border-b border-[#D6E9E1]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg ${method.badgeBg} text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0`}
                      >
                        {method.shortBadge}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[#163B32] truncate">{method.name}</h3>
                        <p className="text-[10px] text-[#55756D] truncate">{method.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* PDF Toggle Switch */}
                      <label
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] font-bold text-[#55756D] hidden sm:inline">Show on PDF Bill</span>
                        <div className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isShowOnPdf}
                            onChange={(e) => updateMethodField(method.id, 'showOnPdf', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0B8F68]"></div>
                        </div>
                      </label>
                      <ChevronRight
                        className={`w-4 h-4 text-[#55756D] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <>
                      {/* Dynamic Fields for this method */}
                      <div
                        className={
                          method.fields.length > 1
                            ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
                            : 'space-y-2'
                        }
                      >
                        {method.fields.map((fld) => {
                          const val = data[fld.key] || '';
                          const warn = fld.validate ? fld.validate(val) : null;
                          const isFullCol =
                            fld.type === 'select' ||
                            fld.key === 'iban' ||
                            (fld.key === 'accountTitle' && method.fields.length >= 3);

                          return (
                            <div
                              key={fld.key}
                              className={isFullCol ? 'sm:col-span-2' : ''}
                            >
                              <label className="block text-[10px] font-semibold text-[#55756D] mb-1">
                                {fld.label}
                              </label>
                              {fld.type === 'select' ? (
                                <select
                                  value={val}
                                  onChange={(e) => updateMethodField(method.id, fld.key, e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:outline-none shadow-xs"
                                >
                                  <option value="">Select Bank</option>
                                  {fld.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => updateMethodField(method.id, fld.key, e.target.value)}
                                  placeholder={fld.placeholder}
                                  className={`w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none shadow-xs ${
                                    fld.isMono ? 'font-mono font-semibold' : ''
                                  }`}
                                />
                              )}
                              {warn && val && (
                                <p className="text-[9px] text-amber-500 mt-0.5 font-medium leading-tight">
                                  ⚠️ {warn}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* QR Code Upload / Remove for methods that support QR */}
                      {method.hasQr && (
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-[#0B8F68]" />
                            <span className="text-[#55756D] font-medium">{method.name} QR Code:</span>
                            {data.qrCodeUrl ? (
                              <span className="text-[#0B8F68] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                              </span>
                            ) : (
                              <span className="text-[#55756D]/60">None</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="file"
                              id={`qr-upload-input-${method.id}`}
                              onChange={(e) => {
                                handleMethodQrUpload(method.id, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                              accept="image/*"
                              className="hidden"
                            />
                            {data.qrCodeUrl ? (
                              <button
                                type="button"
                                onClick={() => updateMethodField(method.id, 'qrCodeUrl', '')}
                                className="text-rose-600 hover:text-rose-700 text-[10px] font-bold px-2 py-0.5 bg-rose-50 border border-rose-200 rounded cursor-pointer"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => document.getElementById(`qr-upload-input-${method.id}`)?.click()}
                                className="text-[#0B8F68] hover:text-[#163B32] text-[10px] font-bold px-2.5 py-1 bg-[#E1F3EA] border border-[#D6E9E1] rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Upload QR</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-[#55756D] mt-2 px-1">
            Added to PDF reports and shared messages to collect payments easily
          </p>
        </div>

        {/* ============================================================== */}
        {/* SECTION 3: REGIONAL SETTINGS (Screen 2)                        */}
        {/* ============================================================== */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#163B32] mb-2 px-1">
            Regional Settings
          </h2>

          <div className="glass-card rounded-2xl border border-[#D6E9E1] shadow-xs divide-y divide-[#D6E9E1] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCurrencyModal(true)}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E1F3EA] text-[#0B8F68] font-black text-xs flex items-center justify-center border border-[#D6E9E1]">
                  {activeRegion.currencySymbol || form.currencySymbol || 'Rs.'}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#163B32]">Change Currency</h3>
                  <p className="text-[10px] text-[#55756D]">Tap to search and select currency</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#163B32] font-bold">
                <span>{form.currencySymbol} ({form.currency})</span>
                <ChevronRight className="w-4 h-4 text-[#55756D]" />
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 3B: VEHICLE & FUEL SETTINGS (Delivery Tracker)          */}
        {/* ============================================================== */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#163B32] mb-2 px-1">
            Vehicle &amp; Fuel Settings (Delivery Tracker)
          </h2>

          <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs space-y-3">
            {/* Fuel Type: Petrol vs Diesel */}
            <div>
              <label className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block mb-1.5">
                Fuel Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      vehicleSettings: {
                        ...(form.vehicleSettings || { fuelType: 'petrol' }),
                        fuelType: 'petrol',
                      },
                    })
                  }
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    (form.vehicleSettings?.fuelType || 'petrol') === 'petrol'
                      ? 'bg-[#0B8F68] text-white shadow-xs font-black border border-[#0B8F68]'
                      : 'bg-slate-100 text-[#55756D] hover:text-[#163B32] border border-[#D6E9E1]'
                  }`}
                >
                  <Fuel className="w-3.5 h-3.5" />
                  <span>Petrol</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      vehicleSettings: {
                        ...(form.vehicleSettings || { fuelType: 'diesel' }),
                        fuelType: 'diesel',
                      },
                    })
                  }
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    form.vehicleSettings?.fuelType === 'diesel'
                      ? 'bg-[#0B8F68] text-white shadow-xs font-black border border-[#0B8F68]'
                      : 'bg-slate-100 text-[#55756D] hover:text-[#163B32] border border-[#D6E9E1]'
                  }`}
                >
                  <Fuel className="w-3.5 h-3.5" />
                  <span>Diesel</span>
                </button>
              </div>
            </div>

            {/* Inputs: Fuel Rate (km/L) & Fuel Price per Liter */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block mb-1">
                  Fuel Rate (km / Liter)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder="e.g. 35"
                  value={form.vehicleSettings?.fuelRateKmPerLiter ?? ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setForm({
                      ...form,
                      vehicleSettings: {
                        fuelType: form.vehicleSettings?.fuelType || 'petrol',
                        ...form.vehicleSettings,
                        fuelRateKmPerLiter: isNaN(val) ? undefined : val,
                      },
                    });
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block mb-1">
                  Price / Liter ({form.currencySymbol || 'Rs.'})
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 280"
                  value={form.vehicleSettings?.fuelPricePerLiter ?? ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setForm({
                      ...form,
                      vehicleSettings: {
                        fuelType: form.vehicleSettings?.fuelType || 'petrol',
                        ...form.vehicleSettings,
                        fuelPricePerLiter: isNaN(val) ? undefined : val,
                      },
                    });
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
                />
              </div>
            </div>

            <p className="text-[10px] text-[#55756D] px-1 pt-0.5">
              Used by Delivery Tracker to calculate daily estimated fuel consumption and travel cost.
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 4: RECEIPT SETTINGS (Screen 2)                         */}
        {/* ============================================================== */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#163B32] mb-2 px-1">
            Receipt Settings
          </h2>

          <div className="glass-card rounded-2xl border border-[#D6E9E1] shadow-xs divide-y divide-[#D6E9E1] overflow-hidden">
            {/* Receipt Template Selector */}
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E1F3EA] text-[#0B8F68] flex items-center justify-center border border-[#D6E9E1]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#163B32]">Receipt Template</h3>
                  <p className="text-[10px] text-[#55756D]">{form.receiptTemplate}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#55756D]" />
            </button>

            {/* Show Print Button on Entries Toggle */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E1F3EA] text-[#0B8F68] flex items-center justify-center border border-[#D6E9E1]">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#163B32]">Show Print Button on Entries</h3>
                  <p className="text-[10px] text-[#55756D]">Quick print button on every daily entry</p>
                </div>
              </div>

              {/* Styled Emerald Toggle Switch matching Screen 2 */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showPrintButtonOnEntries}
                  onChange={(e) =>
                    setForm({ ...form, showPrintButtonOnEntries: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B8F68]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 5: DATA MANAGEMENT (Screen 2)                         */}
        {/* ============================================================== */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#163B32] mb-2 px-1">
            Data Management
          </h2>

          <div className="glass-card rounded-2xl border border-[#D6E9E1] shadow-xs divide-y divide-[#D6E9E1] overflow-hidden">
            <button
              type="button"
              onClick={onOpenBackup}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E1F3EA] text-[#0B8F68] flex items-center justify-center border border-[#D6E9E1]">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#163B32]">Backup &amp; Restore</h3>
                  <p className="text-[10px] text-[#55756D]">Last backup: {form.lastBackupTimestamp}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#55756D]" />
            </button>

            {onOpenMonthlyBilling && (
              <button
                type="button"
                onClick={onOpenMonthlyBilling}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#E1F3EA] text-[#0B8F68] flex items-center justify-center border border-[#D6E9E1]">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#163B32]">Send Monthly Bills via WhatsApp</h3>
                    <p className="text-[10px] text-[#55756D]">Generate &amp; dispatch monthly bills to all customers</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#55756D]" />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 6: COMMUNITY (Screen 2)                               */}
        {/* ============================================================== */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#163B32] mb-2 px-1">
            Community
          </h2>

          <div className="glass-card rounded-2xl border border-[#D6E9E1] shadow-xs divide-y divide-[#D6E9E1] overflow-hidden">
            <a
              href="https://whatsapp.com/channel/0029Va8DairyDiaryUpdates"
              target="_blank"
              rel="noreferrer"
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E1F3EA] text-[#0B8F68] flex items-center justify-center border border-[#D6E9E1]">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#163B32]">Join WhatsApp Channel</h3>
                  <p className="text-[10px] text-[#55756D]">Get latest updates and free apps</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-[#55756D]" />
            </a>
          </div>
        </div>

        {/* Developer Technical Blueprint Link */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenArchitectureModal}
            className="w-full py-2.5 px-3 bg-white border border-[#D6E9E1] text-[#163B32] hover:text-[#0B8F68] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>View Architecture Blueprint &amp; PostgreSQL Schema</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* SECTION: ABOUT                                                  */}
        {/* ============================================================== */}
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[#163B32] mb-2 px-1">
            About
          </h2>

          <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SawaaLogo variant="icon" size="md" />
              <div>
                <h3 className="text-sm font-black text-[#163B32] leading-tight">
                  Dairy Diary
                </h3>
                <p className="text-[11px] text-[#55756D] font-medium">
                  Powered by Dairy Diary · Developed by SAWAA Networking
                </p>
                <p className="text-[10px] text-[#0B8F68] font-bold mt-0.5">
                  Milk Ledger &amp; Customer Billing System
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
              Official App
            </span>
          </div>
        </div>
      </div>

      {/* 3. Persistent Sticky Footer matching Screen 2 (Emerald Green #1E5631) */}
      <div className="shrink-0 bg-[#1B4332]/90 backdrop-blur-md border-t border-white/10 p-3 shadow-lg z-30 flex items-center justify-center">
        <button
          type="button"
          onClick={() => handleSave()}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-md border border-emerald-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Settings Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Currency Switcher Modal */}
      {showCurrencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="bg-[#1E5631] text-white p-3.5 font-bold text-sm flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>Select Primary Currency &amp; Region</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCurrencyModal(false);
                  setCurrencySearchQuery('');
                }}
                className="p-1 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={currencySearchQuery}
                  onChange={(e) => setCurrencySearchQuery(e.target.value)}
                  placeholder="Search currency, country, or code..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#1E5631]"
                />
              </div>
            </div>

            {/* Currency Options List */}
            <div className="p-2 divide-y divide-slate-100 overflow-y-auto text-xs flex-1">
              {Object.values(REGIONAL_CONFIGS)
                .filter((r) => {
                  if (!currencySearchQuery.trim()) return true;
                  const q = currencySearchQuery.toLowerCase().trim();
                  return (
                    r.country.toLowerCase().includes(q) ||
                    r.currencyName.toLowerCase().includes(q) ||
                    r.code.toLowerCase().includes(q) ||
                    r.currencySymbol.toLowerCase().includes(q)
                  );
                })
                .map((r) => {
                  const isSelected = activeRegion.code === r.code;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => {
                        if (r.code === activeRegion.code) {
                          setShowCurrencyModal(false);
                          return;
                        }
                        // WARNING 9: Prompt confirmation before switching currency
                        setPendingRegion(r);
                      }}
                      className={`w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-50 rounded-xl transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EAF2EC] font-bold text-[#1E5631]' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl shrink-0">{r.flagEmoji}</span>
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{r.currencyName}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({r.code})</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {r.country} • Symbol: {r.currencySymbol}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#1E5631] shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Switching Currency (WARNING 9) */}
      {pendingRegion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Change Currency &amp; Region?</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {activeRegion.country} ({activeRegion.code}) → {pendingRegion.country} ({pendingRegion.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
              Changing currency will hide your current payment details. They will be saved and restored if you switch back. Continue?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingRegion(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegionChange}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1E5631] hover:bg-emerald-800 transition-colors cursor-pointer shadow-xs"
              >
                Change Currency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Template Selector Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#1E5631] text-white p-3 font-bold text-sm flex justify-between items-center">
              <span>Select Receipt Template</span>
              <button onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>
            <div className="p-3 space-y-1.5 text-xs">
              {['Modern (Default)', 'Classic Thermal (58mm)', 'Compact Ledger Sheet'].map((tpl) => (
                <button
                  key={tpl}
                  onClick={() => {
                    setForm({ ...form, receiptTemplate: tpl });
                    setShowTemplateModal(false);
                  }}
                  className={`w-full p-2.5 text-left font-semibold flex justify-between items-center rounded-lg transition-colors ${
                    form.receiptTemplate === tpl
                      ? 'bg-[#EAF2EC] text-[#1E5631] font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{tpl}</span>
                  {form.receiptTemplate === tpl && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
