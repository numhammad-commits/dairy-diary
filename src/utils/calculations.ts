import { Contact, LedgerEntry, PaymentRecord } from '../types/dairy';

export interface CustomerMonthFinancials {
  customerId: string;
  monthKey: string;
  liters: number;
  amount: number;
  received: number;
  due: number; // max(0, amount - received)
  previousDue: number;
  totalOutstanding: number;
  entriesCount: number;
}

/**
 * Single source of truth for ONE customer's monthly financials:
 * Due = Amount - Received (for a given customer, given month)
 */
export function getCustomerMonthDue(
  contact: Contact,
  monthKey: string,
  entries: LedgerEntry[],
  paymentRecords: PaymentRecord[] = []
): CustomerMonthFinancials {
  const cEntries = entries.filter(
    (e) => e.contactId === contact.id && e.date.startsWith(monthKey)
  );

  const cPayments = paymentRecords.filter(
    (p) =>
      (p.contactId === contact.id || p.contactName === contact.name) &&
      (p.billingMonth ? p.billingMonth === monthKey : p.date.startsWith(monthKey))
  );

  // De-duplicate any duplicate payment records with identical signature
  const seenPayments = new Set<string>();
  const uniquePayments = cPayments.filter((p) => {
    const sig = `${p.id}_${p.date}_${p.timestamp || ''}_${p.amount}`;
    if (seenPayments.has(sig)) return false;
    seenPayments.add(sig);
    return true;
  });

  // This sums `totalAmount`/`receivedAmount` generically across every entry, so dairy
  // product entries (Yogurt, Paneer, Ghee, etc. — see LedgerEntry.entryType in
  // types/dairy.ts) are already included here exactly like milk, with no formula changes
  // needed. Only `liters` below stays milk-specific (product entries always report
  // liters: 0).
  const liters = cEntries.reduce((sum, e) => sum + e.liters, 0);
  const amount = cEntries.reduce((sum, e) => sum + e.totalAmount, 0);
  const entriesReceived = cEntries.reduce((sum, e) => sum + (e.receivedAmount || 0), 0);
  const paymentsReceived = uniquePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const received = entriesReceived + paymentsReceived;

  // Due = Amount - Received (until it reaches 0)
  const due = Math.max(0, amount - received);

  // Previous balance = sum of unpaid due for ALL months BEFORE the selected month
  const priorEntries = entries.filter(
    (e) => (e.contactId === contact.id || (Boolean(e.contactName && contact.name) && e.contactName!.trim().toLowerCase() === contact.name.trim().toLowerCase())) && e.date.substring(0, 7) < monthKey
  );
  const priorPayments = paymentRecords.filter(
    (p) =>
      (p.contactId === contact.id || p.contactName === contact.name) &&
      (p.billingMonth || p.date.substring(0, 7)) < monthKey
  );

  const seenPrior = new Set<string>();
  const uniquePriorPayments = priorPayments.filter((p) => {
    const sig = `${p.id}_${p.date}_${p.timestamp || ''}_${p.amount}_${p.billingMonth || ''}`;
    if (seenPrior.has(sig)) return false;
    seenPrior.add(sig);
    return true;
  });

  const priorAmount = priorEntries.reduce((sum, e) => sum + e.totalAmount, 0);
  const priorReceived =
    priorEntries.reduce((sum, e) => sum + (e.receivedAmount || 0), 0) +
    uniquePriorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const previousDue = Math.max(0, priorAmount - priorReceived);

  // Current Month Outstanding = (Milk Amount for current month) - (Payments Received in current month)
  const totalOutstanding = due;

  return {
    customerId: contact.id,
    monthKey,
    liters,
    amount,
    received,
    due,
    previousDue,
    totalOutstanding,
    entriesCount: cEntries.length,
  };
}

/**
 * Tab Summary calculation across a group of contacts (Buy, Sell, or All).
 * CRITICAL RULE (Warning 5):
 * Total Due = SUM of each customer's (Amount - Received)
 * NOT a global Amount minus global Received.
 */
export function getTabSummary(
  targetContacts: Contact[],
  monthKey: string,
  entries: LedgerEntry[],
  paymentRecords: PaymentRecord[] = []
) {
  let totalLiters = 0;
  let totalAmount = 0;
  let totalReceived = 0;
  let totalDue = 0;
  let totalOutstanding = 0;
  let totalPreviousDue = 0;

  for (const contact of targetContacts) {
    const fin = getCustomerMonthDue(contact, monthKey, entries, paymentRecords);
    totalLiters += fin.liters;
    totalAmount += fin.amount;
    totalReceived += fin.received;
    totalDue += fin.due; // SUM of each customer's Due!
    totalOutstanding += fin.due; // Current Month Outstanding (live entries - payments)
    totalPreviousDue += fin.previousDue;
  }

  return {
    totalLiters,
    totalAmount,
    totalReceived,
    totalDue,
    totalOutstanding,
    totalPreviousDue,
  };
}
