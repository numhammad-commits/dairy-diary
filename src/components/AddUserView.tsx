import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Edit3, 
  ChevronRight, 
  Phone, 
  MapPin, 
  Camera, 
  Check, 
  Droplet, 
  Tag, 
  Boxes, 
  Plus,
  BookUser,
  AlertCircle,
  Smartphone,
  Mail,
  Navigation
} from 'lucide-react';
import { Contact, ContactRole } from '../types/dairy';

interface AddUserViewProps {
  onBack: () => void;
  onSave: (
    contact: Omit<Contact, 'id' | 'currentMonthDue' | 'totalLifetimeDue' | 'lastActivityTimestamp' | 'lastActivityIso' | 'createdAt'>, 
    openingBalance: number
  ) => void;
  existingContacts?: Contact[];
  onSelectExistingContact?: (contact: Contact) => void;
  showToast?: (message: string) => void;
}

export const AddUserView: React.FC<AddUserViewProps> = ({
  onBack,
  onSave,
  existingContacts = [],
  onSelectExistingContact,
  showToast,
}) => {
  // Navigation Flow: 'options' -> 'form'
  const [currentStep, setCurrentStep] = useState<'options' | 'form'>('options');

  // Device capability notice state
  const [showUnsupportedModal, setShowUnsupportedModal] = useState<boolean>(false);
  const [multiplePhoneList, setMultiplePhoneList] = useState<{ name: string; numbers: string[] } | null>(null);
  const [duplicateCustomer, setDuplicateCustomer] = useState<Contact | null>(null);

  // Form States
  const [isActive, setIsActive] = useState<boolean>(true);
  const [milkType, setMilkType] = useState<'buffalo' | 'cow' | 'other' | 'goat'>('buffalo');
  const [avatarImage, setAvatarImage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  
  // Delivery Location / GPS State
  const [area, setArea] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
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
  
  // Billing Configurations
  const [billCycle, setBillCycle] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  const [billDate, setBillDate] = useState<number>(1);
  const [billTime, setBillTime] = useState<string>('9:00 AM');

  // Price System Matrix
  const [priceSystem, setPriceSystem] = useState<'default' | 'fat' | 'formula'>('default');
  const [pricePerUnit, setPricePerUnit] = useState<string>('240');
  const [quantity, setQuantity] = useState<string>('1.0');

  // Transaction Mode: Buy Milk (Vendor) vs Sell Milk (Customer)
  const [accountType, setAccountType] = useState<'buy' | 'sell'>('buy');

  // Check for duplicate phone number
  const checkDuplicate = (phoneNumber: string): Contact | undefined => {
    const normInput = phoneNumber.replace(/\D/g, '').replace(/^92/, '0');
    if (normInput.length < 7) return undefined;
    return existingContacts.find((c) => {
      const cNorm = c.phone.replace(/\D/g, '').replace(/^92/, '0');
      return cNorm === normInput;
    });
  };

  // Open manual form directly
  const handleOpenManualForm = () => {
    setName('');
    setPhone('+92 ');
    setAddress('');
    setEmail('');
    setPricePerUnit(accountType === 'buy' ? '240' : '260');
    setQuantity('1.0');
    setMilkType('buffalo');
    setIsActive(true);
    setCurrentStep('form');
  };

  // Real Native Device Contact Picker (Section 2 & 20)
  const handleAddFromContacts = async () => {
    // Check if the real W3C Contact Picker API is supported in this browser
    const isSupported = 'contacts' in navigator && 'ContactsManager' in window;

    if (!isSupported) {
      // Platform capability is honest (Section 20): no fake contacts
      setShowUnsupportedModal(true);
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const selected = await (navigator as any).contacts.select(props, opts);

      if (selected && selected.length > 0) {
        const contact = selected[0];
        const contactName = contact.name?.[0] || '';
        const phoneList: string[] = contact.tel || [];

        if (phoneList.length === 0) {
          setName(contactName);
          setPhone('+92 ');
          setCurrentStep('form');
          if (showToast) showToast('Selected contact does not have a saved phone number. Please enter it manually.');
          return;
        }

        if (phoneList.length > 1) {
          // Multiple numbers: ask user to choose (Section 7)
          setMultiplePhoneList({
            name: contactName,
            numbers: phoneList,
          });
          return;
        }

        processSelectedContact(contactName, phoneList[0]);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        if (showToast) showToast('Could not access device contacts. Please use manual entry.');
      }
    }
  };

  const processSelectedContact = (contactName: string, selectedPhone: string) => {
    // Section 8: Prevent duplicate customers
    const dup = checkDuplicate(selectedPhone);
    if (dup) {
      setDuplicateCustomer(dup);
      return;
    }

    setName(contactName);
    setPhone(selectedPhone);
    setAddress('');
    setPricePerUnit(accountType === 'buy' ? '240' : '260');
    setQuantity('1.0');
    setMilkType('buffalo');
    setIsActive(true);
    setCurrentStep('form');

    if (showToast) {
      showToast(`Imported ${contactName} (${selectedPhone})`);
    }
  };

  // Reads a selected file, center-crops it to a square, and downsizes it to a small
  // JPEG data URL so a photo never bloats localStorage.
  function fileToCompressedDataUrl(file: File, maxDim = 240, quality = 0.72): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not load image'));
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, sx, sy, side, side, 0, 0, maxDim, maxDim);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarImage(await fileToCompressedDataUrl(file));
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Form submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      if (showToast) showToast('Please enter a customer name');
      return;
    }

    // Section 8: Prevent duplicate before saving
    const dup = checkDuplicate(phone);
    if (dup) {
      setDuplicateCustomer(dup);
      return;
    }

    const role: ContactRole = accountType === 'buy' ? 'seller' : 'buyer';
    const parsedRate = parseFloat(pricePerUnit) || (role === 'seller' ? 240 : 260);
    const parsedQty = parseFloat(quantity) || 1.0;

    onSave(
      {
        name: name.trim(),
        role,
        phone: phone.trim() || '+92 300 0000000',
        address: address.trim() || undefined,
        area: area.trim() || undefined,
        latitude: latitude.trim() !== '' && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : undefined,
        longitude: longitude.trim() !== '' && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : undefined,
        email: email.trim() || undefined,
        defaultRate: parsedRate,
        morningQuotaLiters: parsedQty,
        eveningQuotaLiters: parsedQty,
        avatarColor: 'bg-[#1E5631]',
        avatarImage: avatarImage || undefined,
        status: isActive ? 'active' : 'inactive',
        milkTypePref: milkType,
        billCycle: billCycle.toLowerCase() as any,
        billDate,
        billTime,
        priceSystem: priceSystem === 'default' ? 'default' : priceSystem === 'fat' ? 'fat_based' : 'formula_based',
        autoAddEntry: false,
        fixedQuantity: parsedQty,
      },
      0
    );

    if (showToast) {
      showToast(`${name.trim()} successfully registered as ${role === 'seller' ? 'Seller' : 'Buyer'}!`);
    }

    onBack();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-transparent relative select-none">
      {/* 1. Header */}
      <div className="bg-[#1B4332]/90 backdrop-blur-md text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (currentStep === 'form') {
                setCurrentStep('options');
              } else {
                onBack();
              }
            }}
            className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            title="Go Back"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-white text-glass-lift">
            {currentStep === 'form' ? 'Add New User' : 'Add User'}
          </h1>
        </div>

        {currentStep === 'form' ? (
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
              <div className="w-10 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        ) : (
          <span className="text-xs font-semibold text-[#C8E6C9]">
            Real Customer Registration
          </span>
        )}
      </div>

      {/* 2. Step 1: Option Selection (Honest, Real Options) */}
      {currentStep === 'options' && (
        <div className="flex-1 min-h-0 flex flex-col justify-center p-5 max-w-md mx-auto w-full space-y-4">
          <div className="text-center pb-2">
            <h2 className="text-xl font-black text-[#163B32] tracking-tight">How would you like to add?</h2>
            <p className="text-xs text-[#55756D] mt-1">Select an option below to register your customer</p>
          </div>

          {/* Option A: Real Device Contacts */}
          <div
            onClick={handleAddFromContacts}
            className="glass-card rounded-3xl p-5 shadow-xs border border-[#D6E9E1] hover:border-[#0B8F68]/40 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99] text-[#163B32]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <BookUser className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-extrabold text-[#163B32] tracking-tight">
                    Add from Contacts
                  </h3>
                  <span className="bg-[#E1F3EA] text-[#0B8F68] text-[10px] font-black px-1.5 py-0.5 rounded-md border border-[#D6E9E1]">
                    Device
                  </span>
                </div>
                <p className="text-xs text-[#55756D] font-medium mt-1 leading-relaxed">
                  Open your real Android phone book to select an existing contact
                </p>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-[#55756D] group-hover:translate-x-0.5 group-hover:text-[#163B32] transition-all" />
          </div>

          {/* Option B: Add Manually */}
          <div
            onClick={handleOpenManualForm}
            className="glass-card rounded-3xl p-5 shadow-xs border border-[#D6E9E1] hover:border-[#0B8F68]/40 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99] text-[#163B32]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Edit3 className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#163B32] tracking-tight">
                  Add Manually
                </h3>
                <p className="text-xs text-[#55756D] font-medium mt-1 leading-relaxed">
                  Directly type customer name, phone number, rates &amp; quota
                </p>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-[#55756D] group-hover:text-[#163B32] group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      )}

      {/* 3. Step 2: Customer Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto pb-32">
          <div className="p-4 space-y-4 max-w-md mx-auto w-full pb-8">
            
            {/* Avatar / Camera */}
            <div className="flex flex-col items-center justify-center pt-1 pb-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full border-2 border-dashed border-[#D6E9E1] bg-white flex flex-col items-center justify-center text-[#0B8F68] cursor-pointer hover:bg-slate-50 transition-all relative group shadow-xs overflow-hidden"
              >
                {avatarImage ? (
                  <img src={avatarImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <>
                    <Camera className="w-7 h-7 text-[#0B8F68] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-[#55756D] mt-1 tracking-tight">PHOTO</span>
                  </>
                )}
                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-xs border border-[#D6E9E1] text-[#0B8F68]">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            </div>

            {/* Account Type Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-[#0B8F68]" />
                Customer Account Type
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-[#D6E9E1]">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('buy');
                    setPricePerUnit('240');
                  }}
                  className={`py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    accountType === 'buy'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                      : 'text-[#55756D] hover:text-[#163B32]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Buy Milk (Seller)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('sell');
                    setPricePerUnit('260');
                  }}
                  className={`py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    accountType === 'sell'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                      : 'text-[#55756D] hover:text-[#163B32]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Sell Milk (Buyer)
                </button>
              </div>
            </div>

            {/* 1. Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1.5">
                <span className="text-red-500">*</span> Customer Name
              </label>
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* 2. Phone Input */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#0B8F68]" />
                <span className="text-red-500">*</span> Phone Number
              </label>
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all flex items-center gap-2">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300 1234567"
                  className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* 3. Address (Optional) */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0B8F68]" />
                Address (Optional)
              </label>
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all flex items-center gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Village, Mohallah, Farm or Sector"
                  className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Email (Optional) */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#0B8F68]" />
                Email (Optional)
              </label>
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-300 shadow-2xs focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Delivery Area & GPS Coordinates (Optional for Tracker) */}
            <div className="glass-card rounded-2xl p-3 border border-[#D6E9E1] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#163B32] uppercase tracking-wider block">
                  Delivery Area &amp; GPS Coordinates (Optional)
                </span>
                <button
                  type="button"
                  onClick={handlePickCurrentLocation}
                  disabled={isLocating}
                  className="px-2.5 py-1 bg-[#E1F3EA] hover:bg-[#d5eee2] text-[#0B8F68] border border-[#D6E9E1] text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
              {gpsError && <p className="text-[10px] text-red-500 font-semibold">{gpsError}</p>}
            </div>

            {/* 4. Milk Category Matrix */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-[#0B8F68]" />
                Milk Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'buffalo', label: 'Buffalo Milk' },
                  { id: 'cow', label: 'Cow Milk' },
                  { id: 'goat', label: 'Goat Milk' },
                  { id: 'other', label: 'Mix / Other' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMilkType(item.id as any)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      milkType === item.id
                        ? 'border-[#0B8F68] bg-[#0B8F68] text-white shadow-xs font-black'
                        : 'border-[#D6E9E1] bg-white text-[#55756D] hover:text-[#163B32]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Rate Per Liter & Daily Quota */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#0B8F68]" />
                  Rate (Rs / Liter)
                </label>
                <div className="bg-white rounded-2xl px-3 py-2 border border-slate-300 shadow-2xs flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Rs</span>
                  <input
                    type="number"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className="w-full text-right font-extrabold text-sm text-slate-900 outline-none bg-transparent"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-[#163B32] tracking-tight flex items-center gap-1">
                  <Boxes className="w-3.5 h-3.5 text-[#0B8F68]" />
                  Daily Quota (Liters)
                </label>
                <div className="bg-white rounded-2xl px-3 py-2 border border-slate-300 shadow-2xs flex items-center justify-between">
                  <input
                    type="number"
                    step="0.5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full text-left font-extrabold text-sm text-slate-900 outline-none bg-transparent"
                  />
                  <span className="text-xs font-bold text-slate-400">L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Save Action */}
          <div className="p-4 bg-[#1B4332]/90 backdrop-blur-md border-t border-white/10 shadow-md flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('options')}
              className="py-3 px-4 rounded-xl border border-white/20 text-white/90 hover:bg-white/10 transition-colors text-xs font-extrabold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-glass-lift"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Save Customer
            </button>
          </div>
        </form>
      )}

      {/* Honest Platform Capability Modal (Section 20) */}
      {showUnsupportedModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 border border-slate-200 text-center text-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto mb-3.5">
              <Smartphone className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              Native Contact Picker
            </h3>
            <p className="text-xs text-[#55756D] mt-2 leading-relaxed">
              The real device Contact Picker API (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">navigator.contacts</code>) operates when running in Google Chrome on an Android smartphone or within a packaged native Android application.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Inside this desktop/web preview, you can register any customer using the manual entry form.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnsupportedModal(false);
                  handleOpenManualForm();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold hover:brightness-110 transition-all shadow-md cursor-pointer"
              >
                Enter Details Manually
              </button>
              <button
                type="button"
                onClick={() => setShowUnsupportedModal(false)}
                className="w-full py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Phone Numbers Modal */}
      {multiplePhoneList && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 border border-slate-200 text-slate-900">
            <h3 className="text-base font-extrabold text-slate-900">
              Select Phone Number
            </h3>
            <p className="text-xs text-[#55756D] mt-0.5">
              {multiplePhoneList.name} has multiple numbers. Choose one:
            </p>
            <div className="mt-4 space-y-2">
              {multiplePhoneList.numbers.map((num, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const cName = multiplePhoneList.name;
                    setMultiplePhoneList(null);
                    processSelectedContact(cName, num);
                  }}
                  className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-all group cursor-pointer"
                >
                  <span className="text-sm font-extrabold text-slate-900">
                    {num}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMultiplePhoneList(null)}
              className="w-full mt-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 text-center cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Customer Warning (Section 8) */}
      {duplicateCustomer && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 border border-amber-300 text-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 text-center leading-snug">
              This phone number is already saved in Dairy Diary
            </h3>
            <p className="text-xs text-[#55756D] text-center mt-2">
              A customer is already registered with this number:
            </p>
            <div className="mt-3 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-center">
              <div className="font-black text-slate-900 text-sm">
                {duplicateCustomer.name}
              </div>
              <div className="text-xs font-bold text-amber-700 mt-0.5">
                {duplicateCustomer.phone}
              </div>
              <div className="text-[11px] text-slate-600 font-semibold mt-1">
                Account: {duplicateCustomer.role === 'seller' ? 'Milk Seller' : 'Milk Buyer'} · Status: {duplicateCustomer.status}
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const target = duplicateCustomer;
                  setDuplicateCustomer(null);
                  if (onSelectExistingContact) {
                    onSelectExistingContact(target);
                  } else {
                    onBack();
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold hover:brightness-110 transition-all shadow-md cursor-pointer"
              >
                Open Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setDuplicateCustomer(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Return to Customer Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
