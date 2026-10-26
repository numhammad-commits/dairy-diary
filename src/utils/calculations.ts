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

export type DeliveryPredictionReason = 'daily' | 'weekday' | 'cadence' | 'new' | 'irregular';

export interface DeliveryPrediction {
  predicted: boolean;
  reason: DeliveryPredictionReason;
}

const ROUTE_HISTORY_WINDOW_DAYS = 30;

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Smart Next-Day/5-Day Route prediction: does this customer usually take milk on
 * `targetDate`? Looks at the 30 days of milk entries ending the day before `today`
 * (future days obviously have none yet, so the window is always anchored to "today").
 *
 * Checked in order:
 * 1. Too little history (<5 milk entries ever) -> predict YES ("new" customer, safer to
 *    show than silently drop from the route).
 * 2. Delivers on >=85% of days in the window -> predict YES every day ("daily"),
 *    regardless of weekday noise (Warning 4: daily customers must never be hidden).
 * 3. That weekday occurred >=2 times in the window and was hit >=60% of the time ->
 *    predict YES ("weekday" pattern, e.g. only Mon/Thu).
 * 4. Otherwise, for "every N days" customers with no single clean weekday: predict YES
 *    if targetDate lands within 1 day of the next expected multiple of their average
 *    delivery gap ("cadence").
 * 5. Otherwise predict NO ("irregular") — still shown in the UI with an unchecked,
 *    overridable checkbox (Warning 5).
 */
export function predictDeliveryForDate(
  contact: Contact,
  entries: LedgerEntry[],
  targetDate: string,
  today: string
): DeliveryPrediction {
  const todayD = parseLocalDate(today);
  const targetD = parseLocalDate(targetDate);
  const targetWeekday = targetD.getDay();

  const windowStart = new Date(todayD);
  windowStart.setDate(windowStart.getDate() - ROUTE_HISTORY_WINDOW_DAYS);

  // Only real milk deliveries count — product entries (Yogurt, Ghee, etc.) always report
  // liters: 0 and aren't part of the milk route.
  const milkEntries = entries.filter(
    (e) => e.contactId === contact.id && (e.entryType === 'milk' || e.entryType === undefined)
  );

  if (milkEntries.length < 5) {
    return { predicted: true, reason: 'new' };
  }

  const windowEntries = milkEntries.filter((e) => {
    const d = parseLocalDate(e.date);
    return d >= windowStart && d < todayD;
  });

  // Distinct delivery DATES (a contact can have both a morning and evening entry on one
  // date — that still only counts as one delivery day).
  const deliveryDates = Array.from(new Set(windowEntries.map((e) => e.date))).sort();

  const frequencyRatio = deliveryDates.length / ROUTE_HISTORY_WINDOW_DAYS;
  if (frequencyRatio >= 0.85) {
    return { predicted: true, reason: 'daily' };
  }

  const weekdayOccurrences = new Array(7).fill(0);
  const weekdayHits = new Array(7).fill(0);
  for (let i = 1; i <= ROUTE_HISTORY_WINDOW_DAYS; i++) {
    const d = new Date(todayD);
    d.setDate(d.getDate() - i);
    weekdayOccurrences[d.getDay()]++;
  }
  deliveryDates.forEach((dateStr) => {
    weekdayHits[parseLocalDate(dateStr).getDay()]++;
  });

  const isWeekdayPattern =
    weekdayOccurrences[targetWeekday] >= 2 &&
    weekdayHits[targetWeekday] / weekdayOccurrences[targetWeekday] >= 0.6;
  if (isWeekdayPattern) {
    return { predicted: true, reason: 'weekday' };
  }

  if (deliveryDates.length >= 2 && frequencyRatio >= 0.25) {
    const gaps: number[] = [];
    for (let i = 1; i < deliveryDates.length; i++) {
      gaps.push(daysBetween(parseLocalDate(deliveryDates[i - 1]), parseLocalDate(deliveryDates[i])));
    }
    const avgGap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    if (avgGap >= 2) {
      const lastDeliveryDate = parseLocalDate(deliveryDates[deliveryDates.length - 1]);
      const daysSinceLast = daysBetween(lastDeliveryDate, targetD);
      const remainder = ((daysSinceLast % avgGap) + avgGap) % avgGap;
      const distanceToMultiple = Math.min(remainder, avgGap - remainder);
      if (distanceToMultiple <= 1) {
        return { predicted: true, reason: 'cadence' };
      }
    }
  }

  return { predicted: false, reason: 'irregular' };
}
