import React, { useRef, useState } from 'react';
import { X, Cloud, Download, Upload, AlertCircle, Mail, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Contact, LedgerEntry, ExpenseItem } from '../types/dairy';
import { exportFullDatabase, restoreFullDatabase, loadPersistedSettings } from '../utils/storage';
import { getDeviceTodayDate } from '../utils/formatters';

interface BackupModalProps {
  contacts: Contact[];
  entries: LedgerEntry[];
  expenses: ExpenseItem[];
  onClose: () => void;
  onRestoreSuccess?: () => void;
  showToast?: (message: string) => void;
}

type BackupFrequency = 'daily' | '3days' | 'weekly';

export const BackupModal: React.FC<BackupModalProps> = ({
  contacts,
  entries,
  expenses,
  onClose,
  onRestoreSuccess,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState<BackupFrequency>('daily');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [businessSettings] = useState(() => loadPersistedSettings());
  const savedEmail = businessSettings.email?.trim();

  // Real JSON Export
  const handleExportJSON = () => {
    const data = exportFullDatabase();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dairy-diary-backup-${getDeviceTodayDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (showToast) showToast('Backup saved to device successfully');
  };

  // Real JSON Restore
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const success = restoreFullDatabase(parsed);
        if (success) {
          if (showToast) showToast('Database successfully restored from backup file!');
          if (onRestoreSuccess) {
            onRestoreSuccess();
          }
          onClose();
        } else {
          setRestoreError('Invalid backup file format. Please upload a valid Dairy Diary JSON backup.');
        }
      } catch (err) {
        setRestoreError('Failed to parse backup file. Please select a valid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleConnectGoogle = () => {
    if (showToast) {
      showToast(
        savedEmail
          ? 'Update your email in Settings → Business Profile'
          : 'Add your email in Settings → Business Profile to connect'
      );
    }
  };

  const frequencyOptions: { value: BackupFrequency; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: '3days', label: 'Every 3 Days' },
    { value: 'weekly', label: 'Weekly' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-md bg-glass-gradient rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B4332] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-white" />
            <h3 className="font-extrabold text-base tracking-tight text-white">Cloud Backup &amp; Restore</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-[#163B32]">
          {/* Account Section */}
          <div className="p-4 rounded-2xl glass-card border border-[#D6E9E1] shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center shrink-0 shadow-inner">
                <Mail className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-[#163B32]">Google Account</h4>
                {savedEmail ? (
                  <p className="text-xs text-[#0B8F68] font-semibold truncate flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{savedEmail}</span>
                  </p>
                ) : (
                  <p className="text-xs text-[#55756D] truncate">Not Connected</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="px-3.5 py-2 bg-white border border-[#0B8F68] text-[#0B8F68] text-xs font-extrabold rounded-xl hover:bg-[#E1F3EA] transition-colors cursor-pointer shrink-0"
            >
              {savedEmail ? 'Change' : 'Connect'}
            </button>
          </div>

          {/* Auto-Backup Settings */}
          <div className="p-4 rounded-2xl glass-card border border-[#D6E9E1] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#163B32]">Auto Backup</h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B8F68]"></div>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-[#D6E9E1]">
              {frequencyOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#D6E9E1] text-xs font-bold text-[#163B32] cursor-pointer has-[:checked]:bg-[#E1F3EA] has-[:checked]:border-[#0B8F68] has-[:checked]:text-[#0B8F68] transition-colors"
                >
                  <input
                    type="radio"
                    name="backupFrequency"
                    value={opt.value}
                    checked={backupFrequency === opt.value}
                    onChange={() => setBackupFrequency(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {restoreError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{restoreError}</span>
            </div>
          )}

          {/* Big Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#097A59] text-white text-sm font-extrabold rounded-2xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Cloud className="w-4 h-4" />
              BACK UP NOW (CLOUD)
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreFile}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3.5 bg-white border-2 border-[#0B8F68] text-[#0B8F68] text-sm font-extrabold rounded-2xl hover:bg-[#E1F3EA] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              RESTORE DATA FROM CLOUD
            </button>
            <p className="text-center text-[11px] text-[#55756D]">
              {contacts.length} customers · {entries.length} entries · {expenses.length} expenses
            </p>
          </div>

          {/* Advanced / File Operations */}
          <div className="pt-2 border-t border-[#D6E9E1]">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-[#55756D] cursor-pointer py-1"
            >
              <span>Advanced / File Operations</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-1.5 pt-2">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl hover:bg-slate-50 text-left cursor-pointer text-xs font-bold text-[#163B32]"
                >
                  <Download className="w-3.5 h-3.5 text-[#0B8F68]" />
                  Export JSON Backup File
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl hover:bg-slate-50 text-left cursor-pointer text-xs font-bold text-[#163B32]"
                >
                  <Upload className="w-3.5 h-3.5 text-[#0B8F68]" />
                  Restore from JSON File
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#D6E9E1] flex justify-end shadow-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#163B32] text-xs font-bold rounded-xl border border-[#D6E9E1] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
