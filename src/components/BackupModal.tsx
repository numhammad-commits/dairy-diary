import React, { useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { X, Cloud, Download, Upload, AlertCircle, Mail, CheckCircle2, ChevronDown, ChevronUp, Loader2, Send } from 'lucide-react';
import { Contact, LedgerEntry, ExpenseItem, BusinessSettings } from '../types/dairy';
import { exportFullDatabase, restoreFullDatabase } from '../utils/storage';
import { getDeviceTodayDate } from '../utils/formatters';

interface BackupModalProps {
  contacts: Contact[];
  entries: LedgerEntry[];
  expenses: ExpenseItem[];
  onClose: () => void;
  onRestoreSuccess?: () => void;
  showToast?: (message: string) => void;
  businessSettings: BusinessSettings;
  onUpdateSettings: (settings: BusinessSettings) => void;
}

type BackupFrequency = 'daily' | '3days' | 'weekly';

// drive.appdata: the hidden per-app folder, invisible in the user's normal Drive UI.
// userinfo.email/profile: needed to show which account is connected (appdata alone
// carries no identity info).
const GOOGLE_DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
const DRIVE_BACKUP_FILENAME_PREFIX = 'dairy-diary-backup';

// On-device snapshot used as a local fallback when Google isn't connected — stored in
// localStorage (not a downloaded file) so no browser download prompt appears.
const CLOUD_BACKUP_KEY = 'dairy_diary_cloud_backup_v1';

// Persisted Google connection (email, access token, expiry) so "Connect" survives
// closing/reopening the modal. Only drive.appdata + read-only identity scopes are ever
// requested, so the low blast radius of keeping the token in localStorage is acceptable.
const GOOGLE_AUTH_KEY = 'dairy_diary_google_auth_v1';
const AUTO_BACKUP_SETTINGS_KEY = 'dairy_diary_auto_backup_settings_v1';
const LAST_BACKUP_TIME_KEY = 'dairy_diary_last_backup_time';

interface StoredGoogleAuth {
  email: string | null;
  accessToken: string | null;
  expiresAt: number | null;
}

function loadGoogleAuth(): StoredGoogleAuth {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        email: parsed.email || null,
        accessToken: parsed.accessToken || null,
        expiresAt: parsed.expiresAt || null,
      };
    }
  } catch (err) {
    console.error('Failed to load saved Google auth', err);
  }
  return { email: null, accessToken: null, expiresAt: null };
}

// Keeping the email even when accessToken/expiresAt are null lets the UI remember which
// account was connected after the token expires, instead of reverting to "Not Connected".
function saveGoogleAuth(email: string | null, accessToken: string | null, expiresAt: number | null): void {
  try {
    if (email) {
      localStorage.setItem(GOOGLE_AUTH_KEY, JSON.stringify({ email, accessToken, expiresAt }));
    } else {
      localStorage.removeItem(GOOGLE_AUTH_KEY);
    }
  } catch (err) {
    console.error('Failed to save Google auth', err);
  }
}

function loadAutoBackupSettings(): { enabled: boolean; frequency: BackupFrequency } {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validFrequencies: BackupFrequency[] = ['daily', '3days', 'weekly'];
      return {
        enabled: Boolean(parsed.enabled),
        frequency: validFrequencies.includes(parsed.frequency) ? parsed.frequency : 'daily',
      };
    }
  } catch (err) {
    console.error('Failed to load auto-backup settings', err);
  }
  return { enabled: false, frequency: 'daily' };
}

function saveAutoBackupSettings(enabled: boolean, frequency: BackupFrequency): void {
  try {
    localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify({ enabled, frequency }));
  } catch (err) {
    console.error('Failed to save auto-backup settings', err);
  }
}

function formatLastBackupTime(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Never';
  }
}

// Multipart upload straight to the hidden appDataFolder.
async function uploadBackupToDrive(accessToken: string, filename: string, jsonData: string): Promise<void> {
  const metadata = { name: filename, parents: ['appDataFolder'] };
  const boundary = `dairy_diary_boundary_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonData}\r\n` +
    `--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err = new Error(`Drive upload failed (${res.status}): ${errBody.slice(0, 300)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
}

// Lists files in the hidden appDataFolder and downloads the most recently modified one.
async function fetchLatestDriveBackup(accessToken: string): Promise<string> {
  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) {
    const errBody = await listRes.text().catch(() => '');
    const err = new Error(`Drive list failed (${listRes.status}): ${errBody.slice(0, 300)}`) as Error & {
      status?: number;
    };
    err.status = listRes.status;
    throw err;
  }
  const listData = await listRes.json();
  const latest = listData.files?.[0];
  if (!latest) throw new Error('No backups found in Google Drive');

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    const errBody = await fileRes.text().catch(() => '');
    const err = new Error(`Drive download failed (${fileRes.status}): ${errBody.slice(0, 300)}`) as Error & {
      status?: number;
    };
    err.status = fileRes.status;
    throw err;
  }
  return fileRes.text();
}

export const BackupModal: React.FC<BackupModalProps> = ({
  contacts,
  entries,
  expenses,
  onClose,
  onRestoreSuccess,
  showToast,
  businessSettings,
  onUpdateSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => loadAutoBackupSettings().enabled);
  const [backupFrequency, setBackupFrequency] = useState<BackupFrequency>(() => loadAutoBackupSettings().frequency);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_BACKUP_TIME_KEY);
    } catch {
      return null;
    }
  });

  // Real Google account connection state (implicit OAuth flow — no backend, so the
  // access token is short-lived (~1hr)). Persisted to localStorage so the connected
  // account survives closing/reopening the modal; the email is kept even once the
  // token itself expires, so "which account" is never forgotten.
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => loadGoogleAuth().accessToken);
  const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState<number | null>(() => loadGoogleAuth().expiresAt);
  const [googleEmail, setGoogleEmail] = useState<string | null>(() => loadGoogleAuth().email);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBackingUpCloud, setIsBackingUpCloud] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);

  // hasGoogleAccount: do we know which account was ever connected (persists past expiry).
  // isGoogleTokenValid: is that connection actually usable right now.
  const hasGoogleAccount = Boolean(googleEmail);
  const isGoogleTokenValid = Boolean(
    googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt
  );

  const recordBackupSuccess = () => {
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(LAST_BACKUP_TIME_KEY, nowIso);
    } catch (err) {
      console.error('Failed to save last backup time', err);
    }
    setLastBackupTime(nowIso);
  };

  // A real 401 means the token is dead, but we keep remembering which account it was.
  const invalidateGoogleToken = () => {
    setGoogleAccessToken(null);
    setGoogleTokenExpiresAt(null);
    saveGoogleAuth(googleEmail, null, null);
  };

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    scope: GOOGLE_DRIVE_SCOPE,
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse.access_token;
      const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
      setGoogleAccessToken(accessToken);
      setGoogleTokenExpiresAt(expiresAt);

      let email: string | null = null;
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const profile = await res.json();
          email = profile.email || null;
          setGoogleEmail(email);
        }
      } catch (err) {
        console.error('Failed to fetch Google profile', err);
      }

      saveGoogleAuth(email, accessToken, expiresAt);

      // Verify Drive access was actually granted — a misconfigured OAuth consent
      // screen (drive.appdata not registered as a scope) can let login succeed while
      // silently not granting Drive access, which would otherwise only surface later
      // as a confusing failure on upload. Catch it here instead, with a clear reason.
      let scopeWarning: string | null = null;
      try {
        const tokenInfoRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${tokenResponse.access_token}`
        );
        const tokenInfo = await tokenInfoRes.json();
        const grantedScope: string = tokenInfo.scope || '';
        if (!grantedScope.includes('drive.appdata')) {
          scopeWarning =
            "Google connected, but Drive access wasn't granted. In Google Cloud Console → OAuth consent screen, add the scope '.../auth/drive.appdata' and make sure your account is a test user, then reconnect.";
        }
      } catch (err) {
        console.error('Failed to verify granted Drive scope', err);
      }

      setIsConnecting(false);
      setRestoreError(scopeWarning);
      if (showToast) showToast(scopeWarning ? 'Google connected, but Drive access is missing' : 'Google account connected');
    },
    onError: () => {
      setIsConnecting(false);
      if (showToast) showToast('Google sign-in failed or was cancelled');
    },
  });

  const handleConnectGoogle = () => {
    setIsConnecting(true);
    googleLogin();
  };

  // Real JSON Export (file) — used by the "Advanced / File Operations" section for a
  // portable backup file that survives clearing browser/app data.
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

  // "Backup to Telegram" — sends the full export as a .json document to a user-configured
  // Telegram bot/chat via the Bot API's sendDocument endpoint. Native fetch + FormData only.
  const handleBackupToTelegram = async () => {
    const token = businessSettings.telegramBotToken?.trim();
    const chatId = businessSettings.telegramChatId?.trim();
    if (!token || !chatId) {
      setRestoreError('Enter both your Telegram Bot Token and Chat ID first.');
      return;
    }

    setIsSendingTelegram(true);
    setRestoreError(null);
    try {
      const data = exportFullDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', `Dairy Diary backup — ${getDeviceTodayDate()}`);
      formData.append('document', blob, `dairy-diary-backup-${getDeviceTodayDate()}.json`);

      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        throw new Error(result.description || `Telegram API error (${res.status})`);
      }

      recordBackupSuccess();
      if (showToast) showToast('Backup sent to Telegram successfully');
    } catch (err) {
      console.error('Telegram backup failed', err);
      setRestoreError(`Failed to send backup to Telegram: ${(err as Error)?.message || 'unknown error'}`);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  // "BACK UP NOW (CLOUD)" — uploads to the connected Google account's hidden Drive
  // appDataFolder. Falls back to an on-device localStorage snapshot if Google has never
  // been connected, so the button still works without requiring a Google account. If a
  // previously-connected account's token has just expired, the button is disabled in the
  // UI instead (see JSX) rather than silently falling back.
  const handleBackupNow = async () => {
    const data = exportFullDatabase();

    if (!hasGoogleAccount) {
      try {
        localStorage.setItem(CLOUD_BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data }));
        recordBackupSuccess();
        if (showToast) showToast('Connect Google for real cloud backup — saved to this device for now');
      } catch (err) {
        console.error('Failed to save backup to localStorage', err);
        if (showToast) showToast('Failed to save backup');
      }
      return;
    }

    if (!isGoogleTokenValid) {
      if (showToast) showToast('Your Google connection expired. Tap Connect to reconnect.');
      return;
    }

    setIsBackingUpCloud(true);
    setRestoreError(null);
    try {
      const filename = `${DRIVE_BACKUP_FILENAME_PREFIX}-${getDeviceTodayDate()}.json`;
      await uploadBackupToDrive(googleAccessToken!, filename, JSON.stringify(data));
      recordBackupSuccess();
      if (showToast) showToast('Backup uploaded to Google Drive successfully');
    } catch (err) {
      console.error('Google Drive backup failed', err);
      const status = (err as { status?: number } | undefined)?.status;
      if (status === 401) {
        invalidateGoogleToken();
        setRestoreError('Your Google connection expired. Tap Connect again, then retry the backup.');
      } else {
        setRestoreError(`Failed to upload backup to Google Drive: ${(err as Error)?.message || 'unknown error'}`);
      }
    } finally {
      setIsBackingUpCloud(false);
    }
  };

  // "RESTORE DATA FROM CLOUD" — downloads the most recent backup from the connected
  // Google account's Drive appDataFolder. Falls back to the on-device snapshot (or the
  // file picker) if Google isn't connected.
  const handleRestoreFromCloud = async () => {
    setRestoreError(null);

    if (!hasGoogleAccount) {
      try {
        const raw = localStorage.getItem(CLOUD_BACKUP_KEY);
        if (!raw) {
          if (showToast) showToast('Connect Google, or pick a JSON backup file instead');
          fileInputRef.current?.click();
          return;
        }
        const parsed = JSON.parse(raw);
        const success = restoreFullDatabase(parsed.data);
        if (success) {
          if (showToast) showToast('Database successfully restored from on-device backup!');
          if (onRestoreSuccess) onRestoreSuccess();
          onClose();
        } else {
          setRestoreError('The saved on-device backup is invalid or corrupted.');
        }
      } catch (err) {
        setRestoreError('Failed to read the on-device backup.');
      }
      return;
    }

    if (!isGoogleTokenValid) {
      if (showToast) showToast('Your Google connection expired. Tap Connect to reconnect.');
      return;
    }

    setIsRestoringCloud(true);
    try {
      const json = await fetchLatestDriveBackup(googleAccessToken!);
      const parsed = JSON.parse(json);
      const success = restoreFullDatabase(parsed);
      if (success) {
        if (showToast) showToast('Database successfully restored from Google Drive!');
        if (onRestoreSuccess) onRestoreSuccess();
        onClose();
      } else {
        setRestoreError('The Google Drive backup is invalid or corrupted.');
      }
    } catch (err) {
      console.error('Google Drive restore failed', err);
      const status = (err as { status?: number } | undefined)?.status;
      if (status === 401) {
        invalidateGoogleToken();
        setRestoreError('Your Google connection expired. Tap Connect again, then retry the restore.');
      } else {
        setRestoreError(`Failed to restore from Google Drive: ${(err as Error)?.message || 'unknown error'}`);
      }
    } finally {
      setIsRestoringCloud(false);
    }
  };

  // Real JSON Restore — parses the file and stages it behind a confirmation dialog rather
  // than overwriting localStorage immediately (see pendingRestoreData + confirmRestoreFromFile).
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setPendingRestoreData(parsed);
      } catch (err) {
        setRestoreError('Failed to parse backup file. Please select a valid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestoreFromFile = () => {
    const success = restoreFullDatabase(pendingRestoreData);
    setPendingRestoreData(null);
    if (success) {
      if (showToast) showToast('Database successfully restored from backup file!');
      if (onRestoreSuccess) {
        onRestoreSuccess();
      }
      onClose();
    } else {
      setRestoreError('Invalid backup file format. Please upload a valid Dairy Diary JSON backup.');
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
                {hasGoogleAccount ? (
                  isGoogleTokenValid ? (
                    <p className="text-xs text-[#0B8F68] font-semibold truncate flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{googleEmail}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 font-semibold truncate flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{googleEmail} (Reconnect needed)</span>
                    </p>
                  )
                ) : (
                  <p className="text-xs text-[#55756D] truncate">Not Connected</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="px-3.5 py-2 bg-white border border-[#0B8F68] text-[#0B8F68] text-xs font-extrabold rounded-xl hover:bg-[#E1F3EA] transition-colors cursor-pointer shrink-0 disabled:opacity-60 flex items-center gap-1.5"
            >
              {isConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isGoogleTokenValid ? 'Change' : 'Connect'}
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
                  onChange={(e) => {
                    setAutoBackupEnabled(e.target.checked);
                    saveAutoBackupSettings(e.target.checked, backupFrequency);
                  }}
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
                    onChange={() => {
                      setBackupFrequency(opt.value);
                      saveAutoBackupSettings(autoBackupEnabled, opt.value);
                    }}
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
              onClick={handleBackupNow}
              disabled={isBackingUpCloud || (hasGoogleAccount && !isGoogleTokenValid)}
              className="w-full py-3.5 bg-[#0B8F68] hover:bg-[#097A59] text-white text-sm font-extrabold rounded-2xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isBackingUpCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              BACK UP NOW (CLOUD)
            </button>
            <p className="text-center text-[10px] text-[#55756D]">
              Last backup: {formatLastBackupTime(lastBackupTime)}
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreFile}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={handleRestoreFromCloud}
              disabled={isRestoringCloud || (hasGoogleAccount && !isGoogleTokenValid)}
              className="w-full py-3.5 bg-white border-2 border-[#0B8F68] text-[#0B8F68] text-sm font-extrabold rounded-2xl hover:bg-[#E1F3EA] transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isRestoringCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                {/* Telegram Bot Backup */}
                <div className="p-3 rounded-xl glass-card border border-[#D6E9E1] space-y-2">
                  <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-[#55756D]">
                    Telegram Bot Backup
                  </h5>
                  <div>
                    <label className="block text-[10px] font-bold text-[#55756D] mb-1">Telegram Bot Token</label>
                    <input
                      type="password"
                      value={businessSettings.telegramBotToken || ''}
                      onChange={(e) =>
                        onUpdateSettings({ ...businessSettings, telegramBotToken: e.target.value })
                      }
                      placeholder="123456:ABC-DEF..."
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#55756D] mb-1">Telegram Chat ID</label>
                    <input
                      type="text"
                      value={businessSettings.telegramChatId || ''}
                      onChange={(e) =>
                        onUpdateSettings({ ...businessSettings, telegramChatId: e.target.value })
                      }
                      placeholder="e.g. 123456789"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBackupToTelegram}
                    disabled={isSendingTelegram}
                    className="w-full py-2.5 bg-[#229ED9] hover:bg-[#1c8ac0] text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSendingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Backup to Telegram
                  </button>
                </div>

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

      {/* Strong confirmation before a JSON import overwrites ALL local data */}
      {pendingRestoreData && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none"
          onClick={() => setPendingRestoreData(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-rose-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">Overwrite All Data?</h3>
                <p className="text-[11px] text-slate-500 font-medium">This cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Importing this file will{' '}
              <span className="font-bold text-rose-700">permanently replace ALL current data</span> — every
              customer, entry, payment, and setting — with the contents of this backup file. This cannot be
              undone.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingRestoreData(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestoreFromFile}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
              >
                Overwrite &amp; Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
