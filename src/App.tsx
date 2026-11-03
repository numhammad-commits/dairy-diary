import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MobileFrame } from './components/MobileFrame';
import { SawaaLogo } from './components/SawaaLogo';
import { TopAppBar } from './components/TopAppBar';
import { MonthSelector } from './components/MonthSelector';
import { FinancialSummaryCard } from './components/FinancialSummaryCard';
import { SearchAndFilter } from './components/SearchAndFilter';
import { SegmentedTabs } from './components/SegmentedTabs';
import { ContactLedgerList } from './components/ContactLedgerList';
import { BottomNavBar } from './components/BottomNavBar';
import { AddEntryScreen } from './components/AddEntryScreen';
import { ContactDetailModal } from './components/ContactDetailModal';
import { AddUserModal } from './components/AddUserModal';
import { ReminderModal } from './components/ReminderModal';
import { BackupModal } from './components/BackupModal';
import { PremiumModal } from './components/PremiumModal';
import { OutstandingInfoModal } from './components/OutstandingInfoModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { NavigationDrawer } from './components/NavigationDrawer';
import { ReportsView } from './components/ReportsView';
import { ExpensesView } from './components/ExpensesView';
import { SettingsView } from './components/SettingsView';
import { CalculatorView } from './components/CalculatorView';
import { CalculatorModal } from './components/CalculatorModal';
import { RemindersView } from './components/RemindersView';
import { PaymentHistoryView } from './components/PaymentHistoryView';
import { PaymentHistoryModal } from './components/PaymentHistoryModal';
import { ExportView } from './components/ExportView';
import { AddUserView } from './components/AddUserView';
import { AboutModal } from './components/AboutModal';
import { EditCustomerScreen } from './components/EditCustomerScreen';
import { MonthlyBillingModal } from './components/MonthlyBillingModal';
import { TrackerView } from './components/TrackerView';
import { NextDayRouteModal } from './components/NextDayRouteModal';
import { Route } from 'lucide-react';

import {
  Contact,
  LedgerEntry,
  ExpenseItem,
  ReminderSetting,
  BusinessSettings,
  PaymentRecord,
  SortOption,
  CustomerStatusFilter,
  FilterTab,
  ActiveNavTab,
} from './types/dairy';

import {
  INITIAL_CONTACTS,
  INITIAL_LEDGER_ENTRIES,
  INITIAL_EXPENSES,
  INITIAL_REMINDERS,
  INITIAL_MONTH_SUMMARIES,
  INITIAL_BUSINESS_SETTINGS,
  INITIAL_PAYMENT_RECORDS,
} from './data/mockDairyData';

import { getMonthDisplay, getDeviceTodayDate, getDeviceCurrentMonthKey } from './utils/formatters';
import { getTabSummary, getCustomerMonthDue } from './utils/calculations';
import {
  loadPersistedContacts,
  savePersistedContacts,
  loadPersistedEntries,
  savePersistedEntries,
  loadPersistedExpenses,
  savePersistedExpenses,
  loadPersistedReminders,
  savePersistedReminders,
  loadPersistedSettings,
  savePersistedSettings,
  loadPersistedPayments,
  savePersistedPayments,
  loadPersistedPremiumStatus,
  savePersistedPremiumStatus,
} from './utils/storage';

// Shared hardware-back-button stack (matching helper duplicated in
// ContactDetailModal.tsx and EditEntryScreen.tsx, since there's no existing
// shared-utils file in this task's write access). Any open overlay anywhere
// in the app pushes its own close-handler here; the single popstate listener
// below always closes whichever one is currently on top, one level at a time.
function getBackStack(): Array<() => void> {
  const w = window as any;
  if (!w.__ddBackStack) w.__ddBackStack = [];
  return w.__ddBackStack;
}

export default function App() {
  // Brief in-app splash shown on first load, under the (frozen) logo mark.
  // Two-step so the fade-out transition actually plays before unmounting.
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [splashFadingOut, setSplashFadingOut] = useState<boolean>(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFadingOut(true), 900);
    const removeTimer = setTimeout(() => setShowSplash(false), 1400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // 1. Core Persistent State (Real Database, Section 3)
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(getDeviceCurrentMonthKey);
  const [contacts, setContacts] = useState<Contact[]>(loadPersistedContacts);
  const [entries, setEntries] = useState<LedgerEntry[]>(loadPersistedEntries);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(loadPersistedExpenses);
  const [reminders, setReminders] = useState<ReminderSetting>(loadPersistedReminders);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(loadPersistedSettings);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>(loadPersistedPayments);
  const [isPremium, setIsPremium] = useState<boolean>(loadPersistedPremiumStatus);

  // Sync to real persistent storage on any modification
  React.useEffect(() => {
    savePersistedContacts(contacts);
  }, [contacts]);

  React.useEffect(() => {
    savePersistedEntries(entries);
  }, [entries]);

  React.useEffect(() => {
    savePersistedExpenses(expenses);
  }, [expenses]);

  React.useEffect(() => {
    savePersistedReminders(reminders);
  }, [reminders]);

  React.useEffect(() => {
    savePersistedSettings(businessSettings);
  }, [businessSettings]);

  React.useEffect(() => {
    savePersistedPayments(paymentRecords);
  }, [paymentRecords]);

  React.useEffect(() => {
    savePersistedPremiumStatus(isPremium);
  }, [isPremium]);

  // Full reload when restoring from JSON backup
  const handleReloadFromStorage = () => {
    setContacts(loadPersistedContacts());
    setEntries(loadPersistedEntries());
    setExpenses(loadPersistedExpenses());
    setReminders(loadPersistedReminders());
    setBusinessSettings(loadPersistedSettings());
    setPaymentRecords(loadPersistedPayments());
    setIsPremium(loadPersistedPremiumStatus());
  };

  // 2. Navigation State
  const [activeNavTab, setActiveNavTab] = useState<ActiveNavTab>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('tab=')) {
      const match = window.location.search.match(/tab=([a-z_]+)/);
      if (match && ['home', 'reports', 'expenses', 'settings', 'calculator', 'reminders', 'payment_history', 'export', 'add_user', 'tracker'].includes(match[1])) {
        return match[1] as ActiveNavTab;
      }
    }
    return 'home';
  });

  // 3. Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>('active');
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('all');
  const [addressFilter, setAddressFilter] = useState<string>('all');

  // Dynamic set of unique customer addresses/areas for Address Order filter
  const availableAddresses = useMemo(() => {
    const unique = new Set<string>();
    let hasNoArea = false;
    contacts.forEach((c) => {
      const area = c.area?.trim();
      if (area) {
        unique.add(area);
      } else {
        hasNoArea = true;
      }
    });
    return {
      addresses: Array.from(unique).sort((a, b) => a.localeCompare(b)),
      hasNoAddress: hasNoArea,
    };
  }, [contacts]);

  // 4. Modal & Drawer Triggers
  const [quickAddContact, setQuickAddContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [showNextDayRouteModal, setShowNextDayRouteModal] = useState<boolean>(false);
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  const [showOutstandingModal, setShowOutstandingModal] = useState<boolean>(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState<boolean>(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Set when "Record Custom Route" is tapped for a customer in ContactDetailModal;
  // read by TrackerView to pre-link the recording session to that customer, and
  // cleared once the route is actually saved back onto them.
  const [pendingRouteContactId, setPendingRouteContactId] = useState<string | null>(null);

  // Monthly Billing with Permission State (Feature 2)
  const [monthlyBillingState, setMonthlyBillingState] = useState<{
    isOpen: boolean;
    mode: 'permission' | 'queue';
  }>({
    isOpen: false,
    mode: 'permission',
  });

  // Check on 1st of the month if monthly billing permission should be prompted
  useEffect(() => {
    try {
      const today = new Date();
      const isFirstOfMonth = today.getDate() === 1;
      const lastPromptedMonth = localStorage.getItem('dairy_diary_last_monthly_billing_prompt');
      if (isFirstOfMonth && lastPromptedMonth !== currentMonthKey) {
        setMonthlyBillingState({ isOpen: true, mode: 'permission' });
      }
    } catch (e) {
      console.warn('Billing prompt check error:', e);
    }
  }, [currentMonthKey]);

  // Keep the app's layout height in sync with the real visible viewport (not just the
  // browser chrome) so the on-screen keyboard doesn't bury content behind it. Neither
  // Android Chrome nor iOS Safari shrink 100dvh for the keyboard by default, but
  // window.visualViewport reports the true visible height on both — index.css's
  // .h-screen rule prefers this value (via --vvh) over 100dvh whenever it's available.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const setVvh = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    };
    setVvh();
    vv.addEventListener('resize', setVvh);
    return () => vv.removeEventListener('resize', setVvh);
  }, []);

  // Android fallback for the same keyboard-overlap problem: Android doesn't reliably
  // resize the layout (or report it via visualViewport) when its on-screen keyboard
  // opens, so instead we directly scroll the customer list into view a moment after
  // the search input is focused, once the keyboard has finished sliding up.
  const contactListRef = useRef<HTMLDivElement | null>(null);
  const handleSearchFocus = () => {
    setTimeout(() => {
      contactListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  // Hardware back button / swipe-back gesture support. Single app-wide
  // popstate listener: pops whichever close-handler is on top of the shared
  // stack (pushed by this effect below, or by ContactDetailModal.tsx /
  // EditEntryScreen.tsx for their own nested overlays) and calls it.
  useEffect(() => {
    const handlePopState = () => {
      const w = window as any;
      if (w.__ddSyntheticBack) {
        w.__ddSyntheticBack = false;
        return;
      }
      const stack = getBackStack();
      const top = stack.pop();
      if (top) top();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Priority-ordered: the first truthy one here is what hardware back closes
  // next. Non-'home' tabs collapse to a single "back to Home" step rather
  // than replaying every tab visited.
  const closeTopOverlay = () => {
    if (editingContact) { setEditingContact(null); return; }
    if (selectedContact) { setSelectedContact(null); return; }
    if (quickAddContact) { setQuickAddContact(null); return; }
    if (showAddUserModal) { setShowAddUserModal(false); return; }
    if (showDrawer) { setShowDrawer(false); return; }
    if (monthlyBillingState.isOpen) { setMonthlyBillingState((prev) => ({ ...prev, isOpen: false })); return; }
    if (showBackupModal) { setShowBackupModal(false); return; }
    if (showReminderModal) { setShowReminderModal(false); return; }
    if (showNextDayRouteModal) { setShowNextDayRouteModal(false); return; }
    if (showPremiumModal) { setShowPremiumModal(false); return; }
    if (showOutstandingModal) { setShowOutstandingModal(false); return; }
    if (showArchitectureModal) { setShowArchitectureModal(false); return; }
    if (showCalculatorModal) { setShowCalculatorModal(false); return; }
    if (showPaymentHistoryModal) { setShowPaymentHistoryModal(false); return; }
    if (showAboutModal) { setShowAboutModal(false); return; }
    if (activeNavTab !== 'home') { setActiveNavTab('home'); return; }
  };

  const isAnyOverlayOpen =
    !!editingContact || !!selectedContact || !!quickAddContact || showAddUserModal ||
    showDrawer || monthlyBillingState.isOpen || showBackupModal || showReminderModal ||
    showNextDayRouteModal || showPremiumModal || showOutstandingModal || showArchitectureModal ||
    showCalculatorModal || showPaymentHistoryModal || showAboutModal || activeNavTab !== 'home';

  const closeTopOverlayRef = useRef(closeTopOverlay);
  closeTopOverlayRef.current = closeTopOverlay;
  const stableBackHandlerRef = useRef(() => closeTopOverlayRef.current());
  const wasOverlayOpenRef = useRef(false);
  const isFirstOverlayCheckRef = useRef(true);

  useEffect(() => {
    if (isFirstOverlayCheckRef.current) {
      // Skip the very first run so a deep-linked `?tab=` initial load doesn't
      // push a spurious history entry.
      isFirstOverlayCheckRef.current = false;
      wasOverlayOpenRef.current = isAnyOverlayOpen;
      return;
    }
    const stack = getBackStack();
    if (isAnyOverlayOpen && !wasOverlayOpenRef.current) {
      stack.push(stableBackHandlerRef.current);
      window.history.pushState({ ddBack: true }, '');
    } else if (!isAnyOverlayOpen && wasOverlayOpenRef.current) {
      if (stack[stack.length - 1] === stableBackHandlerRef.current) {
        stack.pop();
        (window as any).__ddSyntheticBack = true;
        window.history.back();
      }
    }
    wasOverlayOpenRef.current = isAnyOverlayOpen;
  }, [isAnyOverlayOpen]);

  // Trigger Toast Notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 5. Dynamic Calculations for Selected Month (Single source of truth via getTabSummary)
  const currentSummary = useMemo(() => {
    const targetContacts = contacts.filter((c) => {
      if (activeFilterTab === 'buy_milk') return c.role === 'seller';
      if (activeFilterTab === 'sell_milk') return c.role === 'buyer';
      return true;
    });

    // Area filter: same predicate already used by filteredContacts/countLabel, applied
    // here too so the summary tiles/outstanding bar match whichever area is selected.
    const areaFiltered = targetContacts.filter((c) => {
      if (addressFilter === 'all') return true;
      if (addressFilter === 'no_address') return !c.area || !c.area.trim();
      return c.area?.trim() === addressFilter;
    });

    const summary = getTabSummary(areaFiltered, currentMonthKey, entries, paymentRecords);

    return {
      monthKey: currentMonthKey,
      monthDisplay: getMonthDisplay(currentMonthKey),
      totalLiters: summary.totalLiters,
      totalAmount: summary.totalAmount,
      totalDue: summary.totalDue,
      totalReceived: summary.totalReceived,
      totalOutstanding: summary.totalOutstanding,
      totalPreviousDue: summary.totalPreviousDue,
    };
  }, [currentMonthKey, entries, contacts, activeFilterTab, addressFilter, paymentRecords]);

  // 6. Filter and Sort Contacts Pipeline
  const filteredContacts = useMemo(() => {
    return contacts
      .filter((contact) => {
        // Customer Status filter: active (default) | inactive | all
        if (statusFilter === 'active' && contact.status !== 'active') return false;
        if (statusFilter === 'inactive' && contact.status !== 'inactive') return false;

        // Role Tab filter: buy_milk (sellers) | sell_milk (buyers) | all
        if (activeFilterTab === 'buy_milk' && contact.role !== 'seller') return false;
        if (activeFilterTab === 'sell_milk' && contact.role !== 'buyer') return false;

        // Address Order / Area filter: all | no_address | specific address
        if (addressFilter !== 'all') {
          if (addressFilter === 'no_address') {
            if (contact.area && contact.area.trim()) return false;
          } else {
            if (!contact.area || contact.area.trim() !== addressFilter) return false;
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = contact.name.toLowerCase().includes(q);
          const matchPhone = contact.phone.toLowerCase().includes(q);
          const matchAddress = contact.address?.toLowerCase().includes(q);
          return matchName || matchPhone || matchAddress;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'alphabetical') {
          return a.name.localeCompare(b.name);
        }
        if (sortOption === 'highest_due') {
          const aFin = getCustomerMonthDue(a, currentMonthKey, entries, paymentRecords);
          const bFin = getCustomerMonthDue(b, currentMonthKey, entries, paymentRecords);
          return (bFin.due + bFin.previousDue) - (aFin.due + aFin.previousDue);
        }
        if (sortOption === 'lowest_due') {
          const aFin = getCustomerMonthDue(a, currentMonthKey, entries, paymentRecords);
          const bFin = getCustomerMonthDue(b, currentMonthKey, entries, paymentRecords);
          return (aFin.due + aFin.previousDue) - (bFin.due + bFin.previousDue);
        }
        return new Date(b.lastActivityIso).getTime() - new Date(a.lastActivityIso).getTime();
      });
  }, [contacts, statusFilter, activeFilterTab, addressFilter, searchQuery, sortOption, currentMonthKey, entries, paymentRecords]);

  const countLabel = useMemo(() => {
    const statusMatching = contacts.filter((c) => {
      if (statusFilter === 'active' && c.status !== 'active') return false;
      if (statusFilter === 'inactive' && c.status !== 'inactive') return false;
      if (addressFilter !== 'all') {
        if (addressFilter === 'no_address') {
          if (c.area && c.area.trim()) return false;
        } else {
          if (!c.area || c.area.trim() !== addressFilter) return false;
        }
      }
      return true;
    });

    if (activeFilterTab === 'buy_milk') {
      const sellerCount = statusMatching.filter((c) => c.role === 'seller').length;
      return `${sellerCount} Sellers`;
    }
    if (activeFilterTab === 'sell_milk') {
      const buyerCount = statusMatching.filter((c) => c.role === 'buyer').length;
      return `${buyerCount} Buyers`;
    }
    const sellerCount = statusMatching.filter((c) => c.role === 'seller').length;
    return `${sellerCount} Sellers`;
  }, [contacts, statusFilter, activeFilterTab, addressFilter]);

  // 7. Handlers for Ledger Mutations
  const handleSaveEntry = (newEntryData: Omit<LedgerEntry, 'id'>) => {
    // Requirement 3: Check for duplicate customer delivery (database-level check).
    // Type-aware: a milk entry and a product entry (or two different products) on the
    // same contactId+date+shift are NOT duplicates of each other — only an exact
    // same-kind match is (unchanged behavior for milk-vs-milk).
    const newKind = newEntryData.entryType || 'milk';
    const isDuplicate = entries.some((e) => {
      if (e.contactId !== newEntryData.contactId || e.date !== newEntryData.date || e.shift !== newEntryData.shift) {
        return false;
      }
      const existingKind = e.entryType || 'milk';
      if (existingKind !== newKind) return false;
      if (newKind === 'product') return e.productType === newEntryData.productType;
      return true;
    });
    if (isDuplicate) {
      showToast("⚠️ Delivery already entered for this customer on this shift");
      return;
    }

    const newId = `le-${Date.now()}`;
    const newEntry: LedgerEntry = {
      ...newEntryData,
      id: newId,
    };

    setEntries((prev) => [newEntry, ...prev]);

    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === newEntry.contactId) {
          const updatedCurrentMonth = (c.currentMonthDue || 0) + newEntry.dueAmount;
          const updatedLifetime = (c.totalLifetimeDue || 0) + newEntry.dueAmount;
          return {
            ...c,
            currentMonthDue: updatedCurrentMonth,
            totalLifetimeDue: updatedLifetime,
            lastActivityTimestamp: `Today, ${newEntry.timestamp}`,
            lastActivityIso: new Date().toISOString(),
          };
        }
        return c;
      })
    );
    showToast(`Entry added for ${newEntry.contactName}`);
  };

  const handleSaveBulkEntries = (newEntriesData: Omit<LedgerEntry, 'id'>[]) => {
    if (!newEntriesData || newEntriesData.length === 0) return;

    // Filter out any duplicates against current database to guarantee zero duplicates
    const validEntriesData = newEntriesData.filter(
      (newEntry) =>
        !entries.some(
          (e) =>
            e.contactId === newEntry.contactId &&
            e.date === newEntry.date &&
            e.shift === newEntry.shift
        )
    );

    if (validEntriesData.length === 0) {
      showToast('⚠️ All selected dates already have delivery entries');
      return;
    }

    const createdEntries: LedgerEntry[] = validEntriesData.map((entryData, idx) => ({
      ...entryData,
      id: `le-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    }));

    setEntries((prev) => [...createdEntries, ...prev]);

    const contactId = createdEntries[0].contactId;
    const totalDueAdded = createdEntries.reduce((sum, e) => sum + e.dueAmount, 0);

    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === contactId) {
          const updatedCurrentMonth = (c.currentMonthDue || 0) + totalDueAdded;
          const updatedLifetime = (c.totalLifetimeDue || 0) + totalDueAdded;
          return {
            ...c,
            currentMonthDue: updatedCurrentMonth,
            totalLifetimeDue: updatedLifetime,
            lastActivityTimestamp: `Today, ${createdEntries[createdEntries.length - 1].timestamp}`,
            lastActivityIso: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    showToast(`Saved ${createdEntries.length} bulk entries successfully!`);
  };

  // Bulk-creates entries for MULTIPLE different customers at once (Next Day Route),
  // unlike handleSaveBulkEntries above which is scoped to one customer across many dates.
  const handleSaveRouteEntries = (routeEntries: Omit<LedgerEntry, 'id'>[]) => {
    const validEntries = routeEntries.filter(
      (ne) => !entries.some((e) => e.contactId === ne.contactId && e.date === ne.date && e.shift === ne.shift)
    );
    if (validEntries.length === 0) {
      showToast('⚠️ All selected customers already have a delivery for that date/shift');
      return;
    }

    const createdEntries: LedgerEntry[] = validEntries.map((entryData, idx) => ({
      ...entryData,
      id: `le-route-${Date.now()}-${idx}`,
    }));
    setEntries((prev) => [...createdEntries, ...prev]);

    const dueByContact = new Map<string, number>();
    createdEntries.forEach((e) => dueByContact.set(e.contactId, (dueByContact.get(e.contactId) || 0) + e.dueAmount));

    setContacts((prev) =>
      prev.map((c) => {
        const addedDue = dueByContact.get(c.id);
        if (addedDue === undefined) return c;
        const matchingEntry = createdEntries.find((e) => e.contactId === c.id)!;
        return {
          ...c,
          currentMonthDue: (c.currentMonthDue || 0) + addedDue,
          totalLifetimeDue: (c.totalLifetimeDue || 0) + addedDue,
          lastActivityTimestamp: `Tomorrow, ${matchingEntry.timestamp}`,
          lastActivityIso: new Date(`${matchingEntry.date}T00:00:00`).toISOString(),
        };
      })
    );

    showToast('All deliveries for tomorrow saved!');
  };

  const handleSettlePayment = (
    contactId: string,
    amount: number,
    paymentDate?: string,
    paymentMethod?: string,
    notes?: string,
    targetMonth?: string
  ) => {
    const contact = contacts.find((c) => c.id === contactId);
    const resolvedMonth = targetMonth || (paymentDate ? paymentDate.substring(0, 7) : currentMonthKey);
    const isCurrentMonth = resolvedMonth === currentMonthKey;

    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === contactId) {
          const updatedCurrent = isCurrentMonth
            ? Math.max(0, (c.currentMonthDue || 0) - amount)
            : (c.currentMonthDue || 0);
          const updatedLifetime = Math.max(0, (c.totalLifetimeDue || 0) - amount);
          return {
            ...c,
            currentMonthDue: updatedCurrent,
            totalLifetimeDue: updatedLifetime,
            lastActivityTimestamp: `Today, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          };
        }
        return c;
      })
    );

    setSelectedContact((prev) => {
      if (prev && prev.id === contactId) {
        return {
          ...prev,
          currentMonthDue: isCurrentMonth
            ? Math.max(0, (prev.currentMonthDue || 0) - amount)
            : (prev.currentMonthDue || 0),
          totalLifetimeDue: Math.max(0, (prev.totalLifetimeDue || 0) - amount),
        };
      }
      return prev;
    });

    if (contact) {
      const now = new Date();
      const dateStr = paymentDate || getDeviceTodayDate();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const displayDateStr = `${dateStr}, ${timeStr}`;
      const newPay: PaymentRecord = {
        id: `pay-${Date.now()}`,
        contactId,
        contactName: contact.name,
        date: dateStr,
        timestamp: timeStr,
        displayDate: displayDateStr,
        amount,
        paymentMethod: paymentMethod || 'Cash',
        notes,
        status: 'Received',
        billingMonth: resolvedMonth,
      };
      setPaymentRecords((prev) => {
        const isRecentDup = prev.some(
          (p) =>
            p.contactId === contactId &&
            p.date === dateStr &&
            p.amount === amount &&
            p.timestamp === timeStr &&
            p.billingMonth === resolvedMonth
        );
        if (isRecentDup) return prev;
        return [newPay, ...prev];
      });
    }

    showToast(`Payment of Rs ${amount.toLocaleString('en-PK')} received.`);
  };

  const handleEditPayment = (
    paymentId: string,
    updates: { amount: number; paymentMethod: string }
  ) => {
    const existing = paymentRecords.find((p) => p.id === paymentId);
    if (!existing) return;

    const amountDelta = updates.amount - existing.amount;
    const resolvedMonth = existing.billingMonth || existing.date.substring(0, 7);
    const isCurrentMonth = resolvedMonth === currentMonthKey;

    if (amountDelta !== 0) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === existing.contactId
            ? {
                ...c,
                currentMonthDue: isCurrentMonth
                  ? Math.max(0, (c.currentMonthDue || 0) - amountDelta)
                  : (c.currentMonthDue || 0),
                totalLifetimeDue: Math.max(0, (c.totalLifetimeDue || 0) - amountDelta),
              }
            : c
        )
      );
      setSelectedContact((prev) =>
        prev && prev.id === existing.contactId
          ? {
              ...prev,
              currentMonthDue: isCurrentMonth
                ? Math.max(0, (prev.currentMonthDue || 0) - amountDelta)
                : (prev.currentMonthDue || 0),
              totalLifetimeDue: Math.max(0, (prev.totalLifetimeDue || 0) - amountDelta),
            }
          : prev
      );
    }

    setPaymentRecords((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, amount: updates.amount, paymentMethod: updates.paymentMethod }
          : p
      )
    );
    showToast('Payment updated');
  };

  const handleDeletePayment = (paymentId: string) => {
    const existing = paymentRecords.find((p) => p.id === paymentId);
    if (!existing) return;

    const resolvedMonth = existing.billingMonth || existing.date.substring(0, 7);
    const isCurrentMonth = resolvedMonth === currentMonthKey;

    setContacts((prev) =>
      prev.map((c) =>
        c.id === existing.contactId
          ? {
              ...c,
              currentMonthDue: isCurrentMonth
                ? (c.currentMonthDue || 0) + existing.amount
                : (c.currentMonthDue || 0),
              totalLifetimeDue: (c.totalLifetimeDue || 0) + existing.amount,
            }
          : c
      )
    );
    setSelectedContact((prev) =>
      prev && prev.id === existing.contactId
        ? {
            ...prev,
            currentMonthDue: isCurrentMonth
              ? (prev.currentMonthDue || 0) + existing.amount
              : (prev.currentMonthDue || 0),
            totalLifetimeDue: (prev.totalLifetimeDue || 0) + existing.amount,
          }
        : prev
    );

    setPaymentRecords((prev) => prev.filter((p) => p.id !== paymentId));
    showToast('Payment deleted');
  };

  const handleUpdateContactRate = (contactId: string, newRate: number) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, defaultRate: newRate } : c))
    );
    showToast('Price rate updated');
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === updatedContact.id ? updatedContact : c))
    );
    setSelectedContact(updatedContact);
    showToast('Customer details updated successfully.');
  };

  // "Record Custom Route" tapped in ContactDetailModal: switch to the Tracker tab,
  // pre-linked to this customer, closing the modal in the same batch.
  const handleRecordCustomRoute = (contactId: string) => {
    setPendingRouteContactId(contactId);
    setActiveNavTab('tracker');
    setSelectedContact(null);
  };

  // Tracker's "Stop & Save" finished a session that was linked to a customer: persist
  // the raw GPS trail onto them (via the existing contacts-save effect) and unlink.
  const handleSaveCustomRoute = (contactId: string, route: { lat: number; lng: number }[]) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, savedRoute: route } : c))
    );
    setPendingRouteContactId(null);
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleUpdateEntry = (updatedEntry: LedgerEntry) => {
    const oldEntry = entries.find((e) => e.id === updatedEntry.id);
    if (!oldEntry) return;

    const isDuplicate = entries.some(
      (e) =>
        e.id !== updatedEntry.id &&
        e.contactId === updatedEntry.contactId &&
        e.date === updatedEntry.date &&
        e.shift === updatedEntry.shift
    );
    if (isDuplicate) {
      showToast('Delivery already exists for this customer on this date.');
      return;
    }

    const dueDiff = updatedEntry.dueAmount - oldEntry.dueAmount;

    setEntries((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );

    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === updatedEntry.contactId) {
          const updatedCurrent = Math.max(0, (c.currentMonthDue || 0) + dueDiff);
          const updatedLifetime = Math.max(0, (c.totalLifetimeDue || 0) + dueDiff);
          return {
            ...c,
            currentMonthDue: updatedCurrent,
            totalLifetimeDue: updatedLifetime,
            lastActivityTimestamp: `Today, ${updatedEntry.timestamp}`,
            lastActivityIso: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    setSelectedContact((prev) => {
      if (prev && prev.id === updatedEntry.contactId) {
        const updatedCurrent = Math.max(0, (prev.currentMonthDue || 0) + dueDiff);
        const updatedLifetime = Math.max(0, (prev.totalLifetimeDue || 0) + dueDiff);
        return {
          ...prev,
          currentMonthDue: updatedCurrent,
          totalLifetimeDue: updatedLifetime,
        };
      }
      return prev;
    });

    showToast('Entry updated successfully');
  };

  const handleDeleteEntry = (entryId: string) => {
    const entryToDelete = entries.find((e) => e.id === entryId);
    if (!entryToDelete) return;

    setEntries((prev) => prev.filter((e) => e.id !== entryId));

    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === entryToDelete.contactId) {
          const updatedCurrent = Math.max(0, (c.currentMonthDue || 0) - entryToDelete.dueAmount);
          const updatedLifetime = Math.max(0, (c.totalLifetimeDue || 0) - entryToDelete.dueAmount);
          return {
            ...c,
            currentMonthDue: updatedCurrent,
            totalLifetimeDue: updatedLifetime,
          };
        }
        return c;
      })
    );

    setSelectedContact((prev) => {
      if (prev && prev.id === entryToDelete.contactId) {
        const updatedCurrent = Math.max(0, (prev.currentMonthDue || 0) - entryToDelete.dueAmount);
        const updatedLifetime = Math.max(0, (prev.totalLifetimeDue || 0) - entryToDelete.dueAmount);
        return {
          ...prev,
          currentMonthDue: updatedCurrent,
          totalLifetimeDue: updatedLifetime,
        };
      }
      return prev;
    });

    showToast('Entry deleted successfully');
  };

  const handleDeleteContact = (contactId: string) => {
    const contactToDelete = contacts.find((c) => c.id === contactId);
    const contactName = contactToDelete?.name;

    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setEntries((prev) =>
      prev.filter(
        (e) => e.contactId !== contactId && (!contactName || e.contactName !== contactName)
      )
    );
    setPaymentRecords((prev) =>
      prev.filter(
        (p) => p.contactId !== contactId && (!contactName || p.contactName !== contactName)
      )
    );

    setSelectedContact(null);
    showToast('Customer deleted.');
  };

  const handleAddUser = (
    newContactData: Omit<Contact, 'id' | 'currentMonthDue' | 'totalLifetimeDue' | 'lastActivityTimestamp' | 'lastActivityIso' | 'createdAt'>,
    openingBalance: number
  ) => {
    const newId = `c-${Date.now()}`;
    const now = new Date();
    const timeStr = `Today, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const newContact: Contact = {
      ...newContactData,
      id: newId,
      currentMonthDue: openingBalance,
      totalLifetimeDue: openingBalance,
      lastActivityTimestamp: timeStr,
      lastActivityIso: now.toISOString(),
      createdAt: getDeviceTodayDate(),
    };

    setContacts((prev) => [newContact, ...prev]);
    showToast(`Contact "${newContact.name}" created`);
  };

  const handleAddExpense = (expenseData: Omit<ExpenseItem, 'id'>) => {
    const newExpense: ExpenseItem = {
      ...expenseData,
      id: `exp-${Date.now()}`,
    };
    setExpenses((prev) => [newExpense, ...prev]);
    showToast('Expense recorded successfully');
  };

  const handleUpdateExpense = (updatedExpense: ExpenseItem) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e))
    );
    showToast('Expense updated successfully');
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    showToast('Expense deleted');
  };

  const handleMarkCustomerBilled = (contactId: string, monthKey: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, lastBilledMonth: monthKey } : c))
    );
  };

  const handleOpenMonthlyBillingQueue = () => {
    setMonthlyBillingState({ isOpen: true, mode: 'queue' });
  };

  const handleShareApp = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Dairy Diary',
        text: 'Download Dairy Diary - Your Daily Milk Diary and Ledger Management app for Pakistan.',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('App link copied to clipboard!');
    }
  };

  return (
    <MobileFrame>
      {/* 0. Brief Splash Screen (fades out after first load) */}
      {showSplash && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-[#1B4332] transition-opacity duration-500 ${
            splashFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <SawaaLogo variant="stacked" size="xl" theme="white" />
          <p className="text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">
            Developed by SAWAA Networking
          </p>
        </div>
      )}

      {/* 1. Primary Top App Bar (Pinned to top, Greenish #1E5631 theme - shown on home and expenses tabs) */}
      {activeNavTab !== 'settings' && activeNavTab !== 'calculator' && activeNavTab !== 'reminders' && activeNavTab !== 'payment_history' && activeNavTab !== 'export' && activeNavTab !== 'reports' && activeNavTab !== 'add_user' && (
        <TopAppBar
          onOpenDrawer={() => setShowDrawer(true)}
          onOpenReminder={() => setActiveNavTab('reminders')}
          onOpenBackup={() => setShowBackupModal(true)}
          onOpenPremium={() => setShowPremiumModal(true)}
          isPremium={isPremium}
        />
      )}

      {/* 2. Main Central Viewport - Scrollable internal area */}
      <div className={`flex-1 min-h-0 flex flex-col bg-transparent ${activeNavTab === 'settings' || activeNavTab === 'calculator' || activeNavTab === 'reminders' || activeNavTab === 'payment_history' || activeNavTab === 'export' || activeNavTab === 'reports' || activeNavTab === 'add_user' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {activeNavTab === 'home' && (
          <div className="flex flex-col pb-40">
            {/* Financial Summary Card — hidden while actively searching so the keyboard-open
                scroll (handleSearchFocus) has room to bring the customer list into view
                instead of just filling the screen with these tiles. */}
            {!searchQuery.trim() && (
              <FinancialSummaryCard
                currentMonthKey={currentMonthKey}
                onMonthChange={(newKey) => setCurrentMonthKey(newKey)}
                liters={currentSummary.totalLiters}
                amount={currentSummary.totalAmount}
                due={currentSummary.totalDue}
                received={currentSummary.totalReceived}
                totalOutstanding={currentSummary.totalOutstanding}
                previousBalance={currentSummary.totalPreviousDue}
                onOpenOutstandingInfo={() => setShowOutstandingModal(true)}
                onOpenTracker={() => setActiveNavTab('tracker')}
              />
            )}

            {/* Search & Filter Controls */}
            <SearchAndFilter
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortOption={sortOption}
              onSortChange={setSortOption}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              addressFilter={addressFilter}
              onAddressFilterChange={setAddressFilter}
              availableAddresses={availableAddresses}
              countLabel={countLabel}
              onSearchFocus={handleSearchFocus}
            />

            {/* Segmented Tabs (All / Buy Milk / Sell Milk) */}
            <SegmentedTabs
              activeTab={activeFilterTab}
              onTabChange={setActiveFilterTab}
            />

            {/* Next Day Route — one-click bulk delivery entry for tomorrow */}
            <div className="px-4 pt-2">
              <button
                type="button"
                onClick={() => setShowNextDayRouteModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#E1F3EA] hover:bg-[#d6ecdf] border border-[#B8E0CC] text-[#0B8F68] text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Route className="w-4 h-4" />
                Next Day Route
              </button>
            </div>

            {/* Dynamic Contact / Ledger List */}
            <div className="flex-1" ref={contactListRef}>
              <ContactLedgerList
                contacts={filteredContacts}
                entries={entries}
                paymentRecords={paymentRecords}
                currentMonthKey={currentMonthKey}
                onSelectContact={(contact) => handleSelectContact(contact)}
                onQuickAdd={(contact) => setQuickAddContact(contact)}
                onOpenAddUser={() => setShowAddUserModal(true)}
                onEditContact={(contact) => setEditingContact(contact)}
                onDeleteContact={handleDeleteContact}
              />
            </div>
          </div>
        )}

        {activeNavTab === 'reports' && (
          <ReportsView
            currentMonthKey={currentMonthKey}
            contacts={contacts}
            entries={entries}
            expenses={expenses}
            paymentRecords={paymentRecords}
          />
        )}

        {activeNavTab === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            entries={entries}
            businessSettings={businessSettings}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            currentMonthKey={currentMonthKey}
            onMonthChange={(newMonth) => setCurrentMonthKey(newMonth)}
            showToast={showToast}
          />
        )}

        {activeNavTab === 'settings' && (
          <SettingsView
            settings={businessSettings}
            onUpdateSettings={(newSettings) => {
              setBusinessSettings(newSettings);
              showToast('Settings saved successfully');
            }}
            onBack={() => setActiveNavTab('home')}
            onOpenBackup={() => setShowBackupModal(true)}
            onOpenArchitectureModal={() => setShowArchitectureModal(true)}
            onOpenMonthlyBilling={handleOpenMonthlyBillingQueue}
          />
        )}

        {activeNavTab === 'calculator' && (
          <CalculatorView
            onBack={() => setActiveNavTab('home')}
            onUseRate={(rate, liters) => {
              setActiveNavTab('home');
              showToast(`Applied rate: Rs${rate.toFixed(2)}/L (${liters}L)`);
            }}
          />
        )}

        {activeNavTab === 'reminders' && (
          <RemindersView
            reminders={reminders}
            onUpdateReminders={(updated) => setReminders(updated)}
            onBack={() => setActiveNavTab('home')}
            showToast={showToast}
            onOpenMonthlyBilling={handleOpenMonthlyBillingQueue}
          />
        )}

        {activeNavTab === 'payment_history' && (
          <PaymentHistoryView
            paymentRecords={paymentRecords}
            initialMonthKey={currentMonthKey}
            onBack={() => setActiveNavTab('home')}
            showToast={showToast}
          />
        )}

        {activeNavTab === 'export' && (
          <ExportView
            entries={entries}
            contacts={contacts}
            onBack={() => setActiveNavTab('home')}
            showToast={showToast}
          />
        )}

        {activeNavTab === 'add_user' && (
          <AddUserView
            onBack={() => setActiveNavTab('home')}
            onSave={handleAddUser}
            existingContacts={contacts}
            onSelectExistingContact={(c) => {
              setActiveNavTab('home');
              setSelectedContact(c);
            }}
            showToast={showToast}
          />
        )}

        {activeNavTab === 'tracker' && (
          <TrackerView
            contacts={contacts}
            businessSettings={businessSettings}
            onBack={() => setActiveNavTab('home')}
            onOpenSettings={() => setActiveNavTab('settings')}
            showToast={showToast}
            pendingRouteContactId={pendingRouteContactId}
            onSaveCustomRoute={handleSaveCustomRoute}
          />
        )}
      </div>

      {/* 3. Persistent Sticky Bottom Navigation Bar (Permanently pinned to viewport bottom) */}
      <BottomNavBar
        activeTab={activeNavTab}
        onTabSelect={(tab) => setActiveNavTab(tab)}
        onOpenAddUser={() => setShowAddUserModal(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-18 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Modals & Dialogs */}
      {quickAddContact && (
        <AddEntryScreen
          customer={quickAddContact}
          source="customer-list"
          existingEntries={entries}
          onClose={() => setQuickAddContact(null)}
          onSave={handleSaveEntry}
          showToast={showToast}
        />
      )}

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          entries={entries}
          monthDisplay={getMonthDisplay(currentMonthKey)}
          currentMonthKey={currentMonthKey}
          businessSettings={businessSettings}
          paymentRecords={paymentRecords}
          isPremium={isPremium}
          onOpenPremium={() => setShowPremiumModal(true)}
          onClose={() => setSelectedContact(null)}
          onQuickAdd={(c) => {
            setSelectedContact(null);
            setQuickAddContact(c);
          }}
          onSettlePayment={handleSettlePayment}
          onEditPayment={handleEditPayment}
          onDeletePayment={handleDeletePayment}
          onSaveNewEntry={handleSaveEntry}
          onSaveBulkEntries={handleSaveBulkEntries}
          onUpdateContactRate={handleUpdateContactRate}
          onUpdateContact={handleUpdateContact}
          onUpdateEntry={handleUpdateEntry}
          onDeleteEntry={handleDeleteEntry}
          onDeleteContact={handleDeleteContact}
          onRecordCustomRoute={handleRecordCustomRoute}
        />
      )}

      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
          <div 
            className="w-full max-w-md h-full bg-[#f8faf9] shadow-2xl flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <EditCustomerScreen
              contact={editingContact}
              onBack={() => setEditingContact(null)}
              onSave={(updated) => {
                handleUpdateContact(updated);
                setEditingContact(null);
              }}
            />
          </div>
        </div>
      )}

      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSave={handleAddUser}
          existingContacts={contacts}
          onSelectExistingContact={(c) => {
            setShowAddUserModal(false);
            setSelectedContact(c);
          }}
          showToast={showToast}
        />
      )}

      {showReminderModal && (
        <ReminderModal
          reminders={reminders}
          onClose={() => setShowReminderModal(false)}
          onSave={(updated) => setReminders(updated)}
        />
      )}

      {showBackupModal && (
        <BackupModal
          contacts={contacts}
          entries={entries}
          expenses={expenses}
          onClose={() => setShowBackupModal(false)}
          onRestoreSuccess={handleReloadFromStorage}
          showToast={showToast}
          businessSettings={businessSettings}
          onUpdateSettings={setBusinessSettings}
        />
      )}

      {showNextDayRouteModal && (
        <NextDayRouteModal
          contacts={contacts}
          entries={entries}
          onClose={() => setShowNextDayRouteModal(false)}
          onConfirm={(routeEntries) => {
            handleSaveRouteEntries(routeEntries);
            setShowNextDayRouteModal(false);
          }}
        />
      )}

      {showPremiumModal && (
        <PremiumModal
          onClose={() => setShowPremiumModal(false)}
          isPremium={isPremium}
          onTogglePremium={(status) => {
            setIsPremium(status);
          }}
          showToast={showToast}
        />
      )}

      {showOutstandingModal && (
        <OutstandingInfoModal
          currentMonthDue={currentSummary.totalDue}
          totalOutstanding={currentSummary.totalOutstanding}
          previousBalance={currentSummary.totalPreviousDue}
          monthDisplay={getMonthDisplay(currentMonthKey)}
          contacts={contacts}
          entries={entries}
          paymentRecords={paymentRecords}
          currentMonthKey={currentMonthKey}
          onClose={() => setShowOutstandingModal(false)}
          onSelectContact={(c) => setSelectedContact(c)}
        />
      )}

      {showArchitectureModal && (
        <ArchitectureModal onClose={() => setShowArchitectureModal(false)} />
      )}

      {showCalculatorModal && (
        <CalculatorModal onClose={() => setShowCalculatorModal(false)} />
      )}

      {showPaymentHistoryModal && (
        <PaymentHistoryModal
          contacts={contacts}
          entries={entries}
          onClose={() => setShowPaymentHistoryModal(false)}
        />
      )}

      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}

      {monthlyBillingState.isOpen && (
        <MonthlyBillingModal
          isOpen={monthlyBillingState.isOpen}
          initialMode={monthlyBillingState.mode}
          contacts={contacts}
          entries={entries}
          paymentRecords={paymentRecords}
          currentMonthKey={currentMonthKey}
          activeMonthDisplay={getMonthDisplay(currentMonthKey)}
          businessSettings={businessSettings}
          isPremium={isPremium}
          onClose={() => setMonthlyBillingState((prev) => ({ ...prev, isOpen: false }))}
          onMarkCustomerBilled={handleMarkCustomerBilled}
          showToast={showToast}
        />
      )}

      {/* Screen 1: Sidebar Navigation Drawer */}
      <NavigationDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSelectNav={(tab) => setActiveNavTab(tab)}
        onOpenCalculator={() => setActiveNavTab('calculator')}
        onOpenReminder={() => setActiveNavTab('reminders')}
        onOpenPaymentHistory={() => setActiveNavTab('payment_history')}
        onOpenExport={() => setActiveNavTab('export')}
        onOpenBackup={() => setShowBackupModal(true)}
        onOpenAbout={() => setShowAboutModal(true)}
        onShareApp={handleShareApp}
      />
    </MobileFrame>
  );
}
