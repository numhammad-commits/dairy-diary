/**
 * Utility functions for Dairy Diary (Pakistan Milk Ledger)
 */

export function formatPKR(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs0';
  const rounded = Math.round(amount);
  return `Rs${rounded.toLocaleString('en-PK')}`;
}

export function formatPKRWithSpace(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0';
  const rounded = Math.round(amount);
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
}

export interface ReceiptTextOptions {
  customerName: string;
  date: string;
  milkLiters?: number;
  ratePerLiter?: number;
  totalAmount: number;
  received: number;
  due: number;
  previousDue?: number;
  footerBusinessName?: string;
}

/**
 * Beautifully formatted WhatsApp/share-sheet text receipt (emoji + bold/italic markdown),
 * used in place of a PDF for quick Share actions. All figures are passed in by the caller
 * from the already-computed getCustomerMonthDue()/metrics values — this never recalculates.
 */
export function formatDairyReceiptText(opts: ReceiptTextOptions): string {
  const lines: string[] = [];
  lines.push('*DAIRY DIARY RECEIPT* 🥛');
  lines.push('-------------------------');
  lines.push(`👤 *Customer:* ${opts.customerName}`);
  lines.push(`📅 *Date:* ${opts.date}`);
  if (opts.milkLiters !== undefined) {
    const rateSuffix = opts.ratePerLiter !== undefined ? ` @ Rs${opts.ratePerLiter.toFixed(1)}/L` : '';
    lines.push(`📦 *Milk:* ${opts.milkLiters.toFixed(2)} L${rateSuffix}`);
  }
  lines.push(`💰 *Total Amount:* ${formatPKR(opts.totalAmount)}`);
  lines.push(`✅ *Received:* ${formatPKR(opts.received)}`);
  lines.push(`⚠️ *Remaining Due:* ${formatPKR(opts.due)}`);
  lines.push('-------------------------');
  if (opts.previousDue !== undefined && opts.previousDue > 0) {
    lines.push(`_Previous Balance: ${formatPKR(opts.previousDue)}_`);
    lines.push('-------------------------');
  }
  lines.push('Thank you for your business!');
  lines.push(`_${opts.footerBusinessName || 'SAWAA'} Dairy Diary_`);
  return lines.join('\n');
}

export function formatLiters(liters: number): string {
  if (liters === undefined || liters === null || isNaN(liters)) return '0 L';
  const formatted = Number.isInteger(liters) ? liters.toString() : liters.toFixed(1);
  return `${formatted} L`;
}

export function formatTime24(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getMonthDisplay(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getFullMonthDisplay(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + delta;

  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  const formattedMonth = month < 10 ? `0${month}` : `${month}`;
  return `${year}-${formattedMonth}`;
}

export function getDeviceTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDeviceCurrentMonthKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatReportDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Today';

  const today = getDeviceTodayDate();
  const yest = shiftDateString(today, -1);

  try {
    const [year, month, day] = dateStr.split('-');
    const mIdx = parseInt(month, 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = `${day} ${months[mIdx] || ''}`;

    if (dateStr === today) return `Today, ${formatted}`;
    if (dateStr === yest) return `Yesterday, ${formatted}`;
    return formatted;
  } catch {
    return dateStr;
  }
}

export function shiftDateString(dateStr: string, deltaDays: number): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + deltaDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

export function generateWhatsAppMessage(
  contactName: string,
  role: string,
  currentDue: number,
  totalDue: number,
  milkLiters: number,
  monthDisplay: string
): string {
  const isSeller = role === 'seller';
  const header = isSeller ? '*Milk Ledger Statement*' : '*Customer Milk Invoice*';

  const text = `${header}
*Dairy Diary - Al-Madina Milk Center*
--------------------------------
Account Name: ${contactName}
Billing Month: ${monthDisplay}
Total Milk Volume: ${milkLiters} Liters
Current Month Balance: ${formatPKR(currentDue)}
Total Outstanding Balance: ${formatPKR(totalDue)}
--------------------------------
Thank you for your business.
Contact: +92 301 5541290`;

  return encodeURIComponent(text);
}

export function parseEntryDateTime(dateStr: string, timeStr?: string): Date {
  if (!dateStr) return new Date(0);
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 12;
  let minutes = 0;

  if (timeStr) {
    const cleanTime = timeStr.replace(/^(Today|Yesterday),\s*/i, '').trim();
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
    }
  }

  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Exact relative time formatting per WARNING 7:
 * - Less than 1 minute ago → "Just now"
 * - 1 to 59 minutes ago → "[N] min ago"
 * - 1 to 23 hours ago on the same calendar day → "Today, [H:MM AM/PM]"
 * - 1 day ago (yesterday's calendar date) → "Yesterday, [H:MM AM/PM]"
 * - 2 to 6 days ago → "[N] days ago"
 * - 7 days ago or more → "[Mon DD]" (e.g., "Oct 03")
 * - 1 year or more → "[Mon DD, YYYY]"
 * Uses user's local timezone and calendar dates.
 */
export function formatRelativeActivityTime(entryDate: Date, timeStr?: string): string {
  const now = new Date();

  const diffMs = now.getTime() - entryDate.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));

  const displayTime =
    timeStr && timeStr.trim()
      ? timeStr.trim().replace(/^(Today|Yesterday),\s*/i, '')
      : entryDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

  // Calendar dates at midnight (local timezone)
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const entryMidnight = new Date(
    entryDate.getFullYear(),
    entryDate.getMonth(),
    entryDate.getDate()
  ).getTime();
  const calendarDaysDiff = Math.round((nowMidnight - entryMidnight) / (24 * 60 * 60 * 1000));

  // 1. Same calendar day
  if (calendarDaysDiff === 0) {
    if (diffMins < 1 && diffMs >= 0) {
      return 'Just now';
    }
    if (diffMins >= 1 && diffMins < 60) {
      return `${diffMins} min ago`;
    }
    return `Today, ${displayTime}`;
  }

  // 2. Yesterday (1 calendar day ago)
  if (calendarDaysDiff === 1) {
    return `Yesterday, ${displayTime}`;
  }

  // 2b. Tomorrow (1 calendar day in the future)
  if (calendarDaysDiff === -1) {
    return `Tomorrow, ${displayTime}`;
  }

  // 3. 2 to 6 calendar days ago
  if (calendarDaysDiff >= 2 && calendarDaysDiff <= 6) {
    return `${calendarDaysDiff} days ago`;
  }

  // 4. 7 days or more
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[entryDate.getMonth()];
  const dayStr = String(entryDate.getDate()).padStart(2, '0');

  // 4b. Any future date beyond tomorrow — "[Mon DD], [Time]" (plus year if it differs)
  if (calendarDaysDiff < 0) {
    if (now.getFullYear() < entryDate.getFullYear()) {
      return `${monthName} ${dayStr}, ${entryDate.getFullYear()}, ${displayTime}`;
    }
    return `${monthName} ${dayStr}, ${displayTime}`;
  }

  // 1 year or more (different calendar year or 365+ days)
  if (now.getFullYear() > entryDate.getFullYear() || calendarDaysDiff >= 365) {
    return `${monthName} ${dayStr}, ${entryDate.getFullYear()}`;
  }

  return `${monthName} ${dayStr}`;
}

