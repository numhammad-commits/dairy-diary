import { 
  Contact, 
  LedgerEntry, 
  ExpenseItem, 
  ReminderSetting, 
  BusinessSettings, 
  PaymentRecord,
  TrackerSession 
} from '../types/dairy';
import {
  INITIAL_CONTACTS,
  INITIAL_LEDGER_ENTRIES,
  INITIAL_EXPENSES,
  INITIAL_REMINDERS,
  INITIAL_BUSINESS_SETTINGS,
  INITIAL_PAYMENT_RECORDS,
} from '../data/mockDairyData';

const KEYS = {
  CONTACTS: 'dairy_diary_contacts_v2',
  ENTRIES: 'dairy_diary_entries_v2',
  EXPENSES: 'dairy_diary_expenses_v2',
  REMINDERS: 'dairy_diary_reminders_v2',
  SETTINGS: 'dairy_diary_settings_v2',
  PAYMENTS: 'dairy_diary_payments_v2',
  PREMIUM_LICENSE: 'dairy_diary_premium_license_v2',
  TRACKER_SESSIONS: 'dairy_diary_tracker_sessions_v2',
};

// Immediately purge legacy dummy caches to ensure 0 orphans remain
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    [
      'dairy_diary_contacts_v1',
      'dairy_diary_entries_v1',
      'dairy_diary_payments_v1',
      'dairy_diary_expenses_v1',
    ].forEach((k) => window.localStorage.removeItem(k));
  }
} catch (_) {
  // Ignore storage access error
}

// 1. Contacts Persistence
export function loadPersistedContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(KEYS.CONTACTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load contacts from storage', e);
  }
  savePersistedContacts(INITIAL_CONTACTS);
  return INITIAL_CONTACTS;
}

export function savePersistedContacts(contacts: Contact[]): void {
  try {
    localStorage.setItem(KEYS.CONTACTS, JSON.stringify(contacts));
  } catch (e) {
    console.error('Failed to save contacts to storage', e);
  }
}

// 2. Ledger Entries Persistence
export function loadPersistedEntries(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.ENTRIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load entries from storage', e);
  }
  savePersistedEntries(INITIAL_LEDGER_ENTRIES);
  return INITIAL_LEDGER_ENTRIES;
}

export function savePersistedEntries(entries: LedgerEntry[]): void {
  try {
    localStorage.setItem(KEYS.ENTRIES, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save entries to storage', e);
  }
}

// 3. Expenses Persistence
export function loadPersistedExpenses(): ExpenseItem[] {
  try {
    const raw = localStorage.getItem(KEYS.EXPENSES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load expenses from storage', e);
  }
  savePersistedExpenses(INITIAL_EXPENSES);
  return INITIAL_EXPENSES;
}

export function savePersistedExpenses(expenses: ExpenseItem[]): void {
  try {
    localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expenses));
  } catch (e) {
    console.error('Failed to save expenses to storage', e);
  }
}

// 4. Reminders Persistence
export function loadPersistedReminders(): ReminderSetting {
  try {
    const raw = localStorage.getItem(KEYS.REMINDERS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load reminders from storage', e);
  }
  savePersistedReminders(INITIAL_REMINDERS);
  return INITIAL_REMINDERS;
}

export function savePersistedReminders(reminders: ReminderSetting): void {
  try {
    localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  } catch (e) {
    console.error('Failed to save reminders to storage', e);
  }
}

// 5. Settings Persistence
export function loadPersistedSettings(): BusinessSettings {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load settings from storage', e);
  }
  savePersistedSettings(INITIAL_BUSINESS_SETTINGS);
  return INITIAL_BUSINESS_SETTINGS;
}

export function savePersistedSettings(settings: BusinessSettings): void {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to storage', e);
  }
}

// 6. Payments Persistence
export function loadPersistedPayments(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.PAYMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load payments from storage', e);
  }
  savePersistedPayments(INITIAL_PAYMENT_RECORDS);
  return INITIAL_PAYMENT_RECORDS;
}

export function savePersistedPayments(payments: PaymentRecord[]): void {
  try {
    localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(payments));
  } catch (e) {
    console.error('Failed to save payments to storage', e);
  }
}

// 7. Premium License Persistence
export function loadPersistedPremiumStatus(): boolean {
  try {
    const raw = localStorage.getItem(KEYS.PREMIUM_LICENSE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Boolean(parsed.active);
    }
  } catch (e) {
    console.error('Failed to load premium status from storage', e);
  }
  return false;
}

export function savePersistedPremiumStatus(active: boolean, licenseKey?: string): void {
  try {
    localStorage.setItem(
      KEYS.PREMIUM_LICENSE,
      JSON.stringify({
        active,
        licenseKey: licenseKey || (active ? 'SAWAA-PRO-ACTIVE' : ''),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.error('Failed to save premium status to storage', e);
  }
}

// 8. Tracker Sessions Persistence
export function loadPersistedTrackerSessions(): TrackerSession[] {
  try {
    const raw = localStorage.getItem(KEYS.TRACKER_SESSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load tracker sessions from storage', e);
  }
  return [];
}

export function savePersistedTrackerSessions(sessions: TrackerSession[]): void {
  try {
    localStorage.setItem(KEYS.TRACKER_SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save tracker sessions to storage', e);
  }
}

// 9. Full Database Export & Import for Genuine Backup/Restore
export function exportFullDatabase() {
  return {
    app: 'Dairy Diary',
    version: '1.0.0',
    developer: 'Developed by SAWAA Networking',
    exportedAt: new Date().toISOString(),
    contacts: loadPersistedContacts(),
    ledgerEntries: loadPersistedEntries(),
    expenses: loadPersistedExpenses(),
    reminders: loadPersistedReminders(),
    businessSettings: loadPersistedSettings(),
    paymentRecords: loadPersistedPayments(),
    isPremium: loadPersistedPremiumStatus(),
    trackerSessions: loadPersistedTrackerSessions(),
  };
}

export function restoreFullDatabase(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.contacts) || !Array.isArray(data.ledgerEntries)) return false;

  if (Array.isArray(data.contacts)) savePersistedContacts(data.contacts);
  if (Array.isArray(data.ledgerEntries)) savePersistedEntries(data.ledgerEntries);
  if (Array.isArray(data.expenses)) savePersistedExpenses(data.expenses);
  if (data.reminders) savePersistedReminders(data.reminders);
  if (data.businessSettings) savePersistedSettings(data.businessSettings);
  if (Array.isArray(data.paymentRecords)) savePersistedPayments(data.paymentRecords);
  if (typeof data.isPremium === 'boolean') savePersistedPremiumStatus(data.isPremium);
  if (Array.isArray(data.trackerSessions)) savePersistedTrackerSessions(data.trackerSessions);

  return true;
}
