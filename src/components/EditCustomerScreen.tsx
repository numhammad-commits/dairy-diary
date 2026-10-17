import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Camera, 
  Check, 
  Droplet, 
  Tag, 
  Boxes, 
  Clock, 
  Plus, 
  AlertCircle,
  Sparkles,
  Percent,
  Mail,
  Navigation
} from 'lucide-react';
import { Contact, ContactRole } from '../types/dairy';

interface EditCustomerScreenProps {
  contact: Contact;
  onSave: (updatedContact: Contact) => void;
  onBack: () => void;
}

export const EditCustomerScreen: React.FC<EditCustomerScreenProps> = ({
  contact,
  onSave,
  onBack,
}) => {
  // Initialize state directly from the canonical contact record
  const initialData = useMemo(() => {
    const roleMode = contact.role === 'buyer' ? 'sell' : 'buy';
    const initialMilkType = (contact.milkTypePref || (contact.id === 'c-01' ? 'other' : 'buffalo')) as 'buffalo' | 'cow' | 'other';
    const initialRate = contact.defaultRate || 240;
    const initialQty = (contact.fixedQuantity || contact.morningQuotaLiters || 1.0).toString();
    const initialCycle = (contact.billCycle 
      ? contact.billCycle.charAt(0).toUpperCase() + contact.billCycle.slice(1) 
      : 'Monthly') as 'Monthly' | 'Weekly' | 'Daily';
    const initialDate = contact.billDate || 1;
    const initialTime = contact.billTime || '9:00 AM';
    const initialPriceSys = contact.priceSystem === 'fat_based' ? 'fat' : contact.priceSystem === 'formula_based' ? 'formula' : 'default';

    return {
      isActive: contact.status === 'active',
      milkType: initialMilkType,
      name: contact.name || '',
      phone: contact.phone || '',
      address: contact.address || '',
      email: contact.email || '',
      billCycle: initialCycle,
      billDate: initialDate,
      billTime: initialTime,
      priceSystem: initialPriceSys as 'default' | 'fat' | 'formula',
      pricePerUnit: initialRate.toString(),
      quantity: initialQty,
      autoAddEntry: !!contact.autoAddEntry,
      accountType: roleMode as 'buy' | 'sell',
      baseFat: '6.5',
      fatRate: initialRate.toString(),
      formulaFactor: '1.25',
    };
  }, [contact]);

  // Form State
  const [isActive, setIsActive] = useState<boolean>(initialData.isActive);
  const [milkType, setMilkType] = useState<'buffalo' | 'cow' | 'other'>(initialData.milkType);
  const [name, setName] = useState<string>(initialData.name);
  const [phone, setPhone] = useState<string>(initialData.phone);
  const [address, setAddress] = useState<string>(initialData.address);
  const [email, setEmail] = useState<string>(initialData.email);
  const [billCycle, setBillCycle] = useState<'Monthly' | 'Weekly' | 'Daily'>(initialData.billCycle);
  const [billDate, setBillDate] = useState<number>(initialData.billDate);
  const [billTime, setBillTime] = useState<string>(initialData.billTime);
  const [priceSystem, setPriceSystem] = useState<'default' | 'fat' | 'formula'>(initialData.priceSystem);
  const [pricePerUnit, setPricePerUnit] = useState<string>(initialData.pricePerUnit);
  const [quantity, setQuantity] = useState<string>(initialData.quantity);
  const [autoAddEntry, setAutoAddEntry] = useState<boolean>(initialData.autoAddEntry);
  const [accountType, setAccountType] = useState<'buy' | 'sell'>(initialData.accountType);
  const [baseFat, setBaseFat] = useState<string>(initialData.baseFat);
  const [fatRate, setFatRate] = useState<string>(initialData.fatRate);
  const [formulaFactor, setFormulaFactor] = useState<string>(initialData.formulaFactor);

  // Delivery Location / GPS State
  const [area, setArea] = useState<string>(contact.area || '');
  const [latitude, setLatitude] = useState<string>(contact.latitude != null ? contact.latitude.toString() : '');
  const [longitude, setLongitude] = useState<string>(contact.longitude != null ? contact.longitude.toString() : '');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');

  const handlePickCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser.');
      return;
    }
    setIsLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      (err) => {
        setGpsError(err.message || 'Unable to retrieve location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Unsaved Changes Confirmation Dialog State
  const [showDiscardDialog, setShowDiscardDialog] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dirty-State Tracking
  const hasUnsavedChanges = useMemo(() => {
    return (
      isActive !== initialData.isActive ||
      milkType !== initialData.milkType ||
      name.trim() !== initialData.name.trim() ||
      phone.trim() !== initialData.phone.trim() ||
      address.trim() !== initialData.address.trim() ||
      email.trim() !== initialData.email.trim() ||
      billCycle !== initialData.billCycle ||
      billDate !== initialData.billDate ||
      billTime.trim() !== initialData.billTime.trim() ||
      priceSystem !== initialData.priceSystem ||
      pricePerUnit.trim() !== initialData.pricePerUnit.trim() ||
      quantity.trim() !== initialData.quantity.trim() ||
      autoAddEntry !== initialData.autoAddEntry ||
      accountType !== initialData.accountType
    );
  }, [
    isActive,
    milkType,
    name,
    phone,
    address,
    email,
    billCycle,
    billDate,
    billTime,
    priceSystem,
    pricePerUnit,
    quantity,
    autoAddEntry,
    accountType,
    initialData,
  ]);

  // Handle Back Arrow Click
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      onBack();
    }
  };

  // Handle Preset Clicks (250ml, 500ml, 1L, 2L, 5L)
  const handleSelectPreset = (presetVal: string) => {
    setQuantity(presetVal);
  };

  // Submit & Save Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Customer name is required.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setErrorMessage('Customer phone number is required.');
      return;
    }

    const parsedRate = parseFloat(pricePerUnit) || contact.defaultRate || 240;
    const parsedQty = parseFloat(quantity) || 1.0;
    const newRole: ContactRole = accountType === 'buy' ? 'seller' : 'buyer';

    // Construct updated customer object with exact same ID
    const updatedContact: Contact = {
      ...contact,
      name: trimmedName,
      phone: trimmedPhone,
      address: address.trim() || undefined,
      area: area.trim() || undefined,
      latitude: latitude.trim() !== '' && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : undefined,
      longitude: longitude.trim() !== '' && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : undefined,
      email: email.trim() || undefined,
      role: newRole,
      status: isActive ? 'active' : 'inactive',
      defaultRate: parsedRate,
      milkTypePref: milkType,
      morningQuotaLiters: parsedQty,
      eveningQuotaLiters: parsedQty,
      fixedQuantity: parsedQty,
      billCycle: billCycle.toLowerCase() as any,
      billDate,
      billTime,
      priceSystem: priceSystem === 'default' ? 'default' : priceSystem === 'fat' ? 'fat_based' : 'formula_based',
      autoAddEntry,
      lastActivityTimestamp: contact.lastActivityTimestamp,
      lastActivityIso: contact.lastActivityIso,
    };

    onSave(updatedContact);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[#F4FBF7] relative select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER APP BAR                                                     */}
      {/* ========================================================================= */}
      <div className="bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            title="Go Back to Ledger"
            aria-label="Go Back to Ledger"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Edit Customer
          </h1>
        </div>

        {/* Active Toggle Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white tracking-wide">Active</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer" 
              aria-label="Toggle user active status"
            />
            <div className="w-10 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-400"></div>
          </label>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FORM BODY - KEYBOARD AWARE SCROLLABLE CONTAINER                       */}
      {/* ========================================================================= */}
      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 max-w-md mx-auto w-full pb-6">
          
          {/* Error Banner if validation fails */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Customer Category Segmented Selector: [ Buffalo ] [ Cow ] [ Other ] */}
          <div className="bg-white rounded-2xl p-1 border border-[#D6E9E1] shadow-xs grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setMilkType('buffalo')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                milkType === 'buffalo'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              {milkType === 'buffalo' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <span>Buffalo</span>
            </button>

            <button
              type="button"
              onClick={() => setMilkType('cow')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                milkType === 'cow'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              {milkType === 'cow' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <Droplet className="w-3.5 h-3.5 fill-current" />
              <span>Cow</span>
            </button>

            <button
              type="button"
              onClick={() => setMilkType('other')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                milkType === 'other'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              {milkType === 'other' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <Boxes className="w-3.5 h-3.5" />
              <span>Other</span>
            </button>
          </div>

          {/* 2. Core Info: Circular Profile Image / DP Node + Stacked Inputs (Name & Phone) */}
          <div className="flex items-center gap-3">
            {/* DP Circular Frame */}
            <div 
              className="w-22 h-22 rounded-full border-2 border-[#D6E9E1] bg-white flex flex-col items-center justify-center text-[#0B8F68] cursor-pointer hover:bg-slate-50 active:scale-95 transition-all shrink-0 shadow-xs relative group"
              title="Change Display Picture"
            >
              <div className="relative">
                <Camera className="w-6 h-6 stroke-[2] text-[#0B8F68]" />
                <Plus className="w-2.5 h-2.5 stroke-[3] absolute -top-1 -right-1 text-[#0B8F68]" />
              </div>
              <span className="text-[11px] font-black tracking-tight mt-0.5 text-[#55756D]">DP</span>
            </div>

            {/* Stacked Inputs: Name & Phone */}
            <div className="flex-1 space-y-2.5">
              {/* Name Field */}
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  className="w-full text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>

              {/* Phone Field */}
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* 3. Address Field (Optional) */}
          <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address (Optional)"
              className="w-full text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>

          {/* Email Field (Optional) */}
          <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (Optional)"
              className="w-full text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>

          {/* Delivery Area & GPS Coordinates (Optional for Tracker) */}
          <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                Delivery Area &amp; GPS Coordinates (Optional)
              </span>
              <button
                type="button"
                onClick={handlePickCurrentLocation}
                disabled={isLocating}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#163B32] border border-[#D6E9E1] text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Navigation className="w-3 h-3 text-[#0B8F68]" />
                <span>{isLocating ? 'Locating...' : 'Pick Current GPS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Area / Sector"
                  className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 px-2.5 py-2 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Latitude"
                  className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 px-2.5 py-2 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Longitude"
                  className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 px-2.5 py-2 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                />
              </div>
            </div>
            {gpsError && <p className="text-[10px] text-rose-500 font-semibold">{gpsError}</p>}
          </div>

          {/* 4. Billing Configurations: Bill Cycle | Date | Bill Time */}
          <div className="grid grid-cols-3 gap-2">
            {/* Bill Cycle */}
            <div className="relative glass-card bg-white rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                Bill Cycle
              </span>
              <select
                value={billCycle}
                onChange={(e) => setBillCycle(e.target.value as any)}
                className="text-xs font-black text-[#163B32] bg-transparent outline-none cursor-pointer appearance-none pr-3 mt-0.5"
              >
                <option value="Monthly" className="text-slate-900 bg-white">Monthly</option>
                <option value="Weekly" className="text-slate-900 bg-white">Weekly</option>
                <option value="Daily" className="text-slate-900 bg-white">Daily</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 bottom-2 text-[#55756D] text-[10px]">▼</div>
            </div>

            {/* Date / Day selector */}
            <div className="relative glass-card bg-white rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                Date
              </span>
              <select
                value={billDate}
                onChange={(e) => setBillDate(parseInt(e.target.value, 10))}
                className="text-xs font-black text-[#163B32] bg-transparent outline-none cursor-pointer appearance-none pr-3 mt-0.5"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d} className="text-slate-900 bg-white">
                    {d}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 bottom-2 text-[#55756D] text-[10px]">▼</div>
            </div>

            {/* Bill Time */}
            <div className="relative glass-card bg-white rounded-2xl px-3 py-2 border border-[#D6E9E1] shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold text-[#55756D] uppercase tracking-wider block">
                Bill Time
              </span>
              <input
                type="text"
                value={billTime}
                onChange={(e) => setBillTime(e.target.value)}
                className="text-xs font-black text-[#163B32] bg-transparent outline-none mt-0.5"
              />
            </div>
          </div>

          {/* 5. Price System Matrix */}
          <div className="space-y-2">
            <span className="text-xs font-black text-[#163B32] tracking-tight block">
              Price System
            </span>

            {/* 3 Horizontal Radio Choices */}
            <div className="flex items-center justify-between text-xs font-extrabold text-[#55756D] pt-0.5">
              {/* Radio 1: Default Rate */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="price_system_edit"
                  checked={priceSystem === 'default'}
                  onChange={() => setPriceSystem('default')}
                  className="accent-emerald-600 w-4 h-4 cursor-pointer"
                />
                <span className="text-[#163B32]">Default Rate</span>
              </label>

              {/* Radio 2: Fat Based */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="price_system_edit"
                  checked={priceSystem === 'fat'}
                  onChange={() => setPriceSystem('fat')}
                  className="accent-emerald-600 w-4 h-4 cursor-pointer"
                />
                <span className="text-[#163B32]">Fat Based</span>
              </label>

              {/* Radio 3: Formula Based */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="price_system_edit"
                  checked={priceSystem === 'formula'}
                  onChange={() => setPriceSystem('formula')}
                  className="accent-emerald-600 w-4 h-4 cursor-pointer"
                />
                <span className="text-[#163B32]">Formula Based</span>
              </label>
            </div>

            {/* Conditional Input Fields */}
            {priceSystem === 'default' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Price per unit (Rs.) */}
                <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    step="0.5"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    placeholder="Price per unit"
                    className="w-full text-xs sm:text-sm font-black text-slate-900 outline-none bg-transparent placeholder:text-slate-400"
                  />
                </div>

                {/* Quantity (L) */}
                <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    step="0.25"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1.0"
                    className="w-full text-xs sm:text-sm font-black text-slate-900 outline-none bg-transparent"
                  />
                </div>
              </div>
            )}

            {priceSystem === 'fat' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2">
                  <Percent className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    step="0.1"
                    value={baseFat}
                    onChange={(e) => setBaseFat(e.target.value)}
                    placeholder="Base Fat % (6.5)"
                    className="w-full text-xs font-black text-slate-900 outline-none bg-transparent"
                  />
                </div>
                <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    step="0.5"
                    value={fatRate}
                    onChange={(e) => setFatRate(e.target.value)}
                    placeholder="Rate @ Base Fat"
                    className="w-full text-xs font-black text-slate-900 outline-none bg-transparent"
                  />
                </div>
              </div>
            )}

            {priceSystem === 'formula' && (
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs flex items-center gap-2 pt-1">
                <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={formulaFactor}
                  onChange={(e) => setFormulaFactor(e.target.value)}
                  placeholder="LR/Fat Formula Multiplier (1.25)"
                  className="w-full text-xs font-black text-slate-900 outline-none bg-transparent"
                />
              </div>
            )}
          </div>

          {/* 6. Custom Quantity Quick Presets: [250ml] [500ml] [1L] [2L] [5L] */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#55756D] block">
              Custom Quantity Presets (e.g. 250ml, 1L, 2.5kg)
            </span>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { label: '250ml', val: '0.25' },
                { label: '500ml', val: '0.5' },
                { label: '1L', val: '1.0' },
                { label: '2L', val: '2.0' },
                { label: '5L', val: '5.0' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectPreset(preset.val)}
                  className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                    quantity === preset.val
                      ? 'bg-[#0B8F68] text-white border-[#0B8F68] shadow-xs'
                      : 'bg-white text-[#55756D] border-[#D6E9E1] hover:text-[#163B32]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Auto Add Entry Row */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-black text-[#163B32] tracking-tight">
              Auto Add Entry
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoAddEntry}
                onChange={(e) => setAutoAddEntry(e.target.checked)}
                className="sr-only peer" 
                aria-label="Toggle auto add entry"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B8F68]"></div>
            </label>
          </div>

          {/* 8. Transaction Type / Ledger Account Classification Toggle: [✓ Buy Milk] [Sell Milk] */}
          <div className="bg-white rounded-2xl p-1 border border-[#D6E9E1] shadow-xs grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setAccountType('buy')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                accountType === 'buy'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              {accountType === 'buy' && <Check className="w-4 h-4 stroke-[3]" />}
              <span>Buy Milk</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountType('sell')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                accountType === 'sell'
                  ? 'bg-[#0B8F68] text-white shadow-xs font-black'
                  : 'text-[#55756D] hover:text-[#163B32]'
              }`}
            >
              {accountType === 'sell' && <Check className="w-4 h-4 stroke-[3]" />}
              <span>Sell Milk</span>
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. PERSISTENT STICKY SUBMIT BUTTON: SAVE CHANGES                          */}
        {/* ========================================================================= */}
        <div className="p-4 bg-white border-t border-[#D6E9E1] shrink-0 z-20 shadow-sm">
          <button
            type="submit"
            className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white rounded-2xl font-black text-sm tracking-wider uppercase shadow-md transition-all cursor-pointer"
          >
            SAVE CHANGES
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 4. UNSAVED CHANGES CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      {showDiscardDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowDiscardDialog(false)}
        >
          <div 
            className="w-full max-w-xs glass-card bg-[#1B4332]/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl space-y-4 border border-white/20 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-base text-white text-glass-lift">
              Discard changes?
            </h3>
            <p className="text-xs text-[#C8E6C9] font-medium leading-relaxed">
              You have unsaved edits. If you leave now, your changes will be discarded.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-white/20 text-xs font-bold text-white/80 hover:bg-white/10 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardDialog(false);
                  onBack();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer text-glass-lift"
              >
                DISCARD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
