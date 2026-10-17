import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Bell, 
  BellOff, 
  Clock, 
  Sun, 
  Moon, 
  Pencil, 
  Check, 
  Volume2, 
  Sparkles,
  X,
  MessageCircle
} from 'lucide-react';
import { ReminderSetting } from '../types/dairy';

interface RemindersViewProps {
  reminders: ReminderSetting;
  onUpdateReminders: (updated: ReminderSetting) => void;
  onBack: () => void;
  showToast?: (message: string) => void;
  onOpenMonthlyBilling?: () => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders,
  onUpdateReminders,
  onBack,
  showToast,
  onOpenMonthlyBilling,
}) => {
  const [settings, setSettings] = useState<ReminderSetting>(reminders);
  const [editingShift, setEditingShift] = useState<'morning' | 'evening' | null>(null);
  const [tempTime, setTempTime] = useState<string>('11:00');
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isTestTriggered, setIsTestTriggered] = useState<boolean>(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);

  // Sync internal state when parent props update
  useEffect(() => {
    setSettings(reminders);
  }, [reminders]);

  // Convert "HH:mm" (24-hour) to 12-hour AM/PM format (e.g. "11:00 AM", "07:30 PM")
  const formatTime12h = (time24: string): string => {
    if (!time24) return '11:00 AM';
    const [hStr, mStr] = time24.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = mStr || '00';
    if (isNaN(hours)) return '11:00 AM';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' becomes '12'
    const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  // Convert 12-hour values into 24-hour HH:mm
  const convertTo24h = (hours12: number, minutes: string, period: 'AM' | 'PM'): string => {
    let h = hours12;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const hh = h < 10 ? `0${h}` : `${h}`;
    return `${hh}:${minutes}`;
  };

  // Handle master toggle
  const handleToggleMaster = () => {
    const updated: ReminderSetting = {
      ...settings,
      isMasterEnabled: !settings.isMasterEnabled,
    };
    setSettings(updated);
    onUpdateReminders(updated);

    if (updated.isMasterEnabled) {
      if (showToast) {
        showToast('Daily reminders enabled! Scheduled for morning & evening.');
      }
      // Request browser notification permission if not yet granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
        });
      }
    } else {
      if (showToast) {
        showToast('Daily reminders turned OFF');
      }
    }
  };

  // Open Time Picker dialog for a shift
  const openTimePicker = (shift: 'morning' | 'evening') => {
    if (!settings.isMasterEnabled) return;
    setEditingShift(shift);
    setTempTime(shift === 'morning' ? settings.morningTime : settings.eveningTime);
  };

  // Save selected time
  const handleSaveTime = (newTime: string) => {
    if (!editingShift) return;
    const updated: ReminderSetting = {
      ...settings,
      [editingShift === 'morning' ? 'morningTime' : 'eveningTime']: newTime,
    };
    setSettings(updated);
    onUpdateReminders(updated);
    setEditingShift(null);
    if (showToast) {
      showToast(`${editingShift === 'morning' ? 'Morning' : 'Evening'} reminder updated to ${formatTime12h(newTime)}`);
    }
  };

  // Local Push Notification Simulator & Test Trigger (2 min / 5 sec test)
  const handleTriggerTest = () => {
    if (isTestTriggered) return;
    setIsTestTriggered(true);
    setTestCountdown(5);

    const interval = setInterval(() => {
      setTestCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          fireNotification();
          setIsTestTriggered(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fireNotification = () => {
    // 1. Web Notification API if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Dairy Diary - Milk Entry Reminder', {
          body: 'Time to record your daily milk collection and farmer entries!',
          icon: '/favicon.ico',
        });
      } catch {
        // Fallback safely
      }
    }

    // 2. Play subtle notification sound if available
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // AudioContext not available or blocked
    }

    if (showToast) {
      showToast('🔔 Reminder Alert: Time to log milk collection entries!');
    }
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
            Daily Reminders
          </h1>
        </div>

        {/* Quick Test Alert Button */}
        <button
          onClick={handleTriggerTest}
          disabled={!settings.isMasterEnabled || isTestTriggered}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/15 ${
            !settings.isMasterEnabled 
              ? 'opacity-40 text-white/60 bg-white/5' 
              : isTestTriggered 
                ? 'bg-amber-500 text-white animate-pulse' 
                : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
          title="Test Reminder Alert"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{isTestTriggered ? `${testCountdown}s...` : 'Test Alert'}</span>
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-20">
        {/* ============================================================== */}
        {/* CARD 1: HERO / FEATURE STATUS CARD                             */}
        {/* ============================================================== */}
        <div className="glass-card rounded-3xl p-6 border border-[#D6E9E1] shadow-xs text-center flex flex-col items-center text-[#163B32]">
          {/* Centered Alarm Clock Icon enclosed in soft green circle */}
          <div className="w-20 h-20 rounded-full bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center mb-4 shadow-inner">
            <Clock className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h2 className="text-lg font-bold text-[#163B32] tracking-tight mb-1">
            Never Miss an Entry
          </h2>
          <p className="text-xs text-[#55756D] font-medium max-w-xs leading-relaxed">
            Get notified daily to add your milk entries.
          </p>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: MASTER TOGGLE SWITCH CARD                              */}
        {/* ============================================================== */}
        <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs flex items-center justify-between text-[#163B32]">
          <div className="flex items-center gap-3">
            {settings.isMasterEnabled ? (
              <div className="w-8 h-8 rounded-full bg-[#E1F3EA] text-[#0B8F68] border border-[#D6E9E1] flex items-center justify-center">
                <Bell className="w-4 h-4 stroke-[2.4]" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center">
                <BellOff className="w-4 h-4 stroke-[2]" />
              </div>
            )}

            <div>
              <span className={`text-sm font-bold block ${settings.isMasterEnabled ? 'text-[#163B32]' : 'text-slate-400'}`}>
                {settings.isMasterEnabled ? 'Reminders ON' : 'Reminders OFF'}
              </span>
              <span className="text-[11px] text-[#55756D] block">
                {settings.isMasterEnabled ? 'Daily alerts scheduled' : 'All shift notifications paused'}
              </span>
            </div>
          </div>

          {/* Master Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={settings.isMasterEnabled}
            onClick={handleToggleMaster}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-slate-300 transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.isMasterEnabled ? 'bg-[#0B8F68]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                settings.isMasterEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* ============================================================== */}
        {/* SECTION 3: "SET TIMES" SHIFT SCHEDULING CARDS                  */}
        {/* ============================================================== */}
        <div>
          <h3 className="text-base font-bold text-[#163B32] px-1 mb-3">
            Set Times
          </h3>

          <div className={`space-y-3 transition-opacity duration-200 ${
            settings.isMasterEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}>
            {/* Shift Card 1: Morning Reminder */}
            <div
              onClick={() => openTimePicker('morning')}
              className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0B8F68]/40 active:scale-[0.99] transition-all group text-[#163B32]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                  <Sun className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#163B32] group-hover:text-[#0B8F68] transition-colors">
                    Morning Reminder
                  </h4>
                  <p className="text-xs font-semibold text-[#0B8F68] font-mono mt-0.5">
                    {formatTime12h(settings.morningTime)}
                  </p>
                </div>
              </div>

              {/* Interactive Pencil Edit Icon */}
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#E1F3EA] flex items-center justify-center text-[#55756D] group-hover:text-[#0B8F68] transition-colors border border-[#D6E9E1]">
                <Pencil className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>

            {/* Shift Card 2: Evening Reminder */}
            <div
              onClick={() => openTimePicker('evening')}
              className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#0B8F68]/40 active:scale-[0.99] transition-all group text-[#163B32]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Moon className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#163B32] group-hover:text-[#0B8F68] transition-colors">
                    Evening Reminder
                  </h4>
                  <p className="text-xs font-semibold text-[#0B8F68] font-mono mt-0.5">
                    {formatTime12h(settings.eveningTime)}
                  </p>
                </div>
              </div>

              {/* Interactive Pencil Edit Icon */}
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#E1F3EA] flex items-center justify-center text-[#55756D] group-hover:text-[#0B8F68] transition-colors border border-[#D6E9E1]">
                <Pencil className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Milk Billing via WhatsApp Card */}
        {onOpenMonthlyBilling && (
          <div className="glass-card rounded-2xl p-4 border border-[#D6E9E1] shadow-xs flex items-center justify-between text-[#163B32]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#163B32]">
                  Monthly Milk Bills
                </h4>
                <p className="text-xs font-semibold text-[#55756D] mt-0.5">
                  Send bills via WhatsApp to all customers
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenMonthlyBilling}
              className="px-3.5 py-2 bg-[#0B8F68] hover:bg-[#087A5A] active:bg-[#066147] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              Send
            </button>
          </div>
        )}

        {/* Tip Banner Footer */}
        <div className="pt-2 text-center">
          <p className="text-xs text-[#55756D] italic font-medium">
            💡 Tip: Set a time 2 minutes from now to test!
          </p>
        </div>

        {/* Browser notification permission advisory */}
        {notificationPermission === 'default' && settings.isMasterEnabled && (
          <div className="glass-card bg-emerald-950/40 border border-emerald-400/30 rounded-2xl p-3 flex items-center justify-between text-xs text-white backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="font-semibold text-[#C8E6C9]">Enable push alert permissions for device popups</span>
            </div>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && 'Notification' in window) {
                  Notification.requestPermission().then((p) => setNotificationPermission(p));
                }
              }}
              className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-bold text-[11px] shrink-0 cursor-pointer text-glass-lift"
            >
              Allow
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TIME PICKER MODAL DIALOG INTERFACE                             */}
      {/* ============================================================== */}
      {editingShift && (
        <TimePickerModal
          shift={editingShift}
          currentTime={tempTime}
          onClose={() => setEditingShift(null)}
          onSave={handleSaveTime}
          formatTime12h={formatTime12h}
          convertTo24h={convertTo24h}
        />
      )}
    </div>
  );
};

// ============================================================================
// Specialized Time Picker Modal Dialog
// ============================================================================
interface TimePickerModalProps {
  shift: 'morning' | 'evening';
  currentTime: string;
  onClose: () => void;
  onSave: (time24: string) => void;
  formatTime12h: (t: string) => string;
  convertTo24h: (h: number, m: string, p: 'AM' | 'PM') => string;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  shift,
  currentTime,
  onClose,
  onSave,
  formatTime12h,
  convertTo24h,
}) => {
  // Parse initial 24h string
  const [initialH, initialM] = currentTime.split(':');
  let initHNum = parseInt(initialH, 10);
  if (isNaN(initHNum)) initHNum = shift === 'morning' ? 11 : 19;
  const initPeriod: 'AM' | 'PM' = initHNum >= 12 ? 'PM' : 'AM';
  const initH12 = initHNum % 12 === 0 ? 12 : initHNum % 12;

  const [selectedHour, setSelectedHour] = useState<number>(initH12);
  const [selectedMinute, setSelectedMinute] = useState<string>(initialM || '00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initPeriod);

  // Common Pakistani dairy collection time presets
  const presets = shift === 'morning' 
    ? ['06:00', '06:30', '07:00', '08:00', '11:00']
    : ['17:00', '17:30', '18:30', '19:30', '20:30'];

  const handleApply = () => {
    const time24 = convertTo24h(selectedHour, selectedMinute, selectedPeriod);
    onSave(time24);
  };

  const currentPreview = convertTo24h(selectedHour, selectedMinute, selectedPeriod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xs glass-card bg-[#1B4332]/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white/10 text-white p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            {shift === 'morning' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-indigo-300" />}
            <span className="font-bold text-sm text-white text-glass-lift">
              {shift === 'morning' ? 'Morning Shift Alarm' : 'Evening Shift Alarm'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Large Live Preview */}
          <div className="text-center py-2 bg-white/10 rounded-2xl border border-white/15 backdrop-blur-sm">
            <span className="text-xs text-[#C8E6C9] font-semibold block">Scheduled Time</span>
            <span className="text-2xl font-black text-white tracking-tight text-glass-lift font-mono">
              {formatTime12h(currentPreview)}
            </span>
          </div>

          {/* Stepper / Picker Controls */}
          <div className="flex items-center justify-center gap-3">
            {/* Hour Selector */}
            <div className="flex flex-col items-center">
              <label className="text-[10px] font-bold text-[#C8E6C9] uppercase mb-1">Hour</label>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(parseInt(e.target.value, 10))}
                className="w-16 p-2 text-center text-base font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                  <option key={h} value={h}>
                    {h < 10 ? `0${h}` : h}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xl font-bold text-white/60 mt-4">:</span>

            {/* Minute Selector */}
            <div className="flex flex-col items-center">
              <label className="text-[10px] font-bold text-[#C8E6C9] uppercase mb-1">Minute</label>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="w-16 p-2 text-center text-base font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* AM / PM Toggle */}
            <div className="flex flex-col items-center">
              <label className="text-[10px] font-bold text-[#C8E6C9] uppercase mb-1">Period</label>
              <div className="flex flex-col bg-white/10 p-0.5 rounded-xl border border-white/15">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('AM')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedPeriod === 'AM'
                      ? 'bg-white text-emerald-950 font-black shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('PM')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedPeriod === 'PM'
                      ? 'bg-white text-emerald-950 font-black shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[10px] font-bold text-[#C8E6C9] uppercase tracking-wider block mb-1.5 text-glass-lift">
              Quick Shift Times
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const [h, m] = p.split(':');
                    const hNum = parseInt(h, 10);
                    setSelectedPeriod(hNum >= 12 ? 'PM' : 'AM');
                    setSelectedHour(hNum % 12 === 0 ? 12 : hNum % 12);
                    setSelectedMinute(m);
                  }}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer transition-colors border border-white/15 backdrop-blur-sm"
                >
                  {formatTime12h(p)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white/10 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold text-white/70 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:brightness-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer text-glass-lift"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Set Time</span>
          </button>
        </div>
      </div>
    </div>
  );
};
