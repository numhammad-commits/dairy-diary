import React, { useRef, useState } from 'react';
import { X, Cloud, Download, FileText, CheckCircle2, Upload, AlertCircle, Database } from 'lucide-react';
import { Contact, LedgerEntry, ExpenseItem } from '../types/dairy';
import { exportFullDatabase, restoreFullDatabase } from '../utils/storage';
import { getDeviceTodayDate } from '../utils/formatters';

interface BackupModalProps {
  contacts: Contact[];
  entries: LedgerEntry[];
  expenses: ExpenseItem[];
  onClose: () => void;
  onRestoreSuccess?: () => void;
  showToast?: (message: string) => void;
}

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
    if (showToast) showToast('Backup file downloaded successfully');
  };

  // Real CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Entry ID',
      'Contact Name',
      'Role',
      'Date',
      'Shift',
      'Liters',
      'Rate/L',
      'Total Amount',
      'Received Amount',
      'Due Amount',
    ];
    const rows = entries.map((e) => [
      e.id,
      `"${e.contactName.replace(/"/g, '""')}"`,
      e.contactRole,
      e.date,
      e.shift,
      e.liters,
      e.ratePerLiter,
      e.totalAmount,
      e.receivedAmount,
      e.dueAmount,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dairy-diary-ledger-${getDeviceTodayDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (showToast) showToast('CSV ledger exported successfully');
  };

  // Real JSON Restore (Section 14 & 15)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="w-full max-w-md bg-glass-gradient rounded-3xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B4332] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-white" />
            <h3 className="font-extrabold text-base tracking-tight text-white">Database Backup &amp; Export</h3>
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
          {/* Real Storage Status Box (Honest Platform Status, Section 15 & 20) */}
          <div className="p-4 rounded-2xl glass-card border border-[#D6E9E1] shadow-xs space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center shrink-0 shadow-inner">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#163B32]">Local Persistent Storage: Active</h4>
                <p className="text-xs text-[#55756D] mt-0.5 leading-relaxed">
                  Your customers, transactions, rates, and accounts are automatically saved to your device's persistent storage on every change.
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#D6E9E1] flex items-center justify-between text-xs font-semibold text-[#55756D]">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-[#0B8F68]" />
                Remote Cloud Sync:
              </span>
              <span className="text-slate-500 font-normal">Offline (Local Only)</span>
            </div>
          </div>

          {/* Quick stats on backed up data */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 glass-card border border-[#D6E9E1] shadow-xs rounded-xl">
              <span className="text-[10px] text-[#55756D] font-semibold block uppercase">Customers</span>
              <span className="text-sm font-black text-[#163B32]">{contacts.length}</span>
            </div>
            <div className="p-2.5 glass-card border border-[#D6E9E1] shadow-xs rounded-xl">
              <span className="text-[10px] text-[#55756D] font-semibold block uppercase">Milk Logs</span>
              <span className="text-sm font-black text-[#163B32]">{entries.length}</span>
            </div>
            <div className="p-2.5 glass-card border border-[#D6E9E1] shadow-xs rounded-xl">
              <span className="text-[10px] text-[#55756D] font-semibold block uppercase">Expenses</span>
              <span className="text-sm font-black text-[#163B32]">{expenses.length}</span>
            </div>
          </div>

          {restoreError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{restoreError}</span>
            </div>
          )}

          {/* Real Actions */}
          <div className="space-y-2 pt-1">
            <h5 className="text-xs font-extrabold uppercase tracking-wider text-[#55756D]">
              Real File Operations
            </h5>

            {/* 1. Export JSON */}
            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl glass-card border border-[#D6E9E1] hover:bg-slate-50 shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-[#163B32] block">Export Full Database (JSON)</span>
                  <span className="text-[11px] text-[#55756D]">Download complete raw backup file for safe storage</span>
                </div>
              </div>
            </button>

            {/* 2. Restore JSON */}
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
              className="w-full flex items-center justify-between p-3.5 rounded-2xl glass-card border border-[#D6E9E1] hover:bg-slate-50 shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-[#163B32] block">Restore Database from Backup</span>
                  <span className="text-[11px] text-[#55756D]">Upload and restore from a previously exported JSON</span>
                </div>
              </div>
            </button>

            {/* 3. Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl glass-card border border-[#D6E9E1] hover:bg-slate-50 shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-[#163B32] block">Export Ledger Spreadsheet (CSV)</span>
                  <span className="text-[11px] text-[#55756D]">Open in Microsoft Excel or Google Sheets</span>
                </div>
              </div>
            </button>
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
