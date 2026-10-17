import { jsPDF } from 'jspdf';
import { Contact, LedgerEntry, BusinessSettings } from '../types/dairy';

export interface GeneratedPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  file: File;
  billDateStr: string;
  dueDateStr: string;
  isPremium: boolean;
}

// =========================================================================
// Small vector icon helpers — jsPDF's built-in fonts (Helvetica/Times/Courier)
// don't include emoji glyphs, so icons the reference design shows as emoji
// (📞 📍 ❤️) are drawn as simple shapes instead of relying on font support.
// =========================================================================

function drawPhoneIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y, 2.6, 4.2, 0.6, 0.6, 'F');
}

function drawPinIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(x + 1.3, y + 1.3, 1.3, 'F');
  doc.triangle(x + 0.1, y + 2.0, x + 2.5, y + 2.0, x + 1.3, y + 4.6, 'F');
}

function drawHeartIcon(doc: jsPDF, cx: number, cy: number, size: number, color: [number, number, number]) {
  const r = size / 2;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(cx - r * 0.5, cy - r * 0.3, r * 0.55, 'F');
  doc.circle(cx + r * 0.5, cy - r * 0.3, r * 0.55, 'F');
  doc.triangle(cx - r, cy - r * 0.1, cx + r, cy - r * 0.1, cx, cy + r, 'F');
}

// =========================================================================
// Days Taken / Days Missed — a new display-only metric computed straight from
// the raw entries array (never touches calculations.ts or any due/amount math).
// For a plain "Month YYYY" statement, the full calendar month is used; for any
// other period title (3-month/yearly/custom-range callers), the actual date
// span covered by the entries themselves is used instead.
// =========================================================================

function tryParseMonthTitle(title: string): { year: number; month: number } | null {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const match = title.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const monthIdx = months.indexOf(match[1]);
  if (monthIdx === -1) return null;
  return { year: parseInt(match[2], 10), month: monthIdx + 1 };
}

function computeDeliveryDayStats(entries: LedgerEntry[], periodTitle: string): { daysTaken: number; missedDaysLabel: string } {
  if (entries.length === 0) {
    return { daysTaken: 0, missedDaysLabel: 'None' };
  }

  const takenDates = Array.from(new Set(entries.map((e) => e.date))).sort();
  const daysTaken = takenDates.length;

  let rangeStart: Date;
  let rangeEnd: Date;

  const monthMatch = tryParseMonthTitle(periodTitle);
  if (monthMatch) {
    rangeStart = new Date(monthMatch.year, monthMatch.month - 1, 1);
    rangeEnd = new Date(monthMatch.year, monthMatch.month, 0);
  } else {
    const [fy, fm, fd] = takenDates[0].split('-').map(Number);
    const [ly, lm, ld] = takenDates[takenDates.length - 1].split('-').map(Number);
    rangeStart = new Date(fy, fm - 1, fd);
    rangeEnd = new Date(ly, lm - 1, ld);
  }

  const takenSet = new Set(takenDates);
  const missedDayNumbers: number[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    if (!takenSet.has(`${y}-${m}-${d}`)) {
      missedDayNumbers.push(cursor.getDate());
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  let missedDaysLabel: string;
  if (missedDayNumbers.length === 0) {
    missedDaysLabel = 'None';
  } else if (missedDayNumbers.length > 8) {
    missedDaysLabel = `${missedDayNumbers.slice(0, 6).join(', ')} +${missedDayNumbers.length - 6} more`;
  } else {
    missedDaysLabel = missedDayNumbers.join(', ');
  }

  return { daysTaken, missedDaysLabel };
}

// =========================================================================
// CUSTOMER STATEMENT PDF — clean, modern summary-statement design (blue header,
// billed-to card, 2-column details grid, total bill + balance boxes, friendly
// footer). Replaces the previous formal itemized-bill layout; the QR/payment
// accounts section, line-item transaction table, and 7-day payment notice were
// intentionally dropped since the new reference is a pure summary statement.
// =========================================================================

export async function generateSawaaPdfDocument(
  contact: Contact,
  entries: LedgerEntry[],
  periodTitle: string,
  businessSettings?: BusinessSettings,
  financials?: {
    totalMilk: number;
    totalAmount: number;
    totalReceived: number;
    periodDue: number;
    previousDue: number;
    totalOutstanding: number;
  },
  isPremium: boolean = false
): Promise<GeneratedPdfResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Company Information (Business settings configured by user)
  const companyName = businessSettings?.businessName?.trim() || 'Dairy Farm';
  const companyPhone = businessSettings?.phone?.trim() || '';
  const companyLocation = businessSettings?.location?.trim() || '';
  const currSym = businessSettings?.currencySymbol?.trim() || 'Rs';

  // Financial Calculations (Single Source of Truth — passed in from getCustomerMonthDue
  // via the caller's `financials` object; never recalculated here)
  const totalMilk = financials?.totalMilk ?? entries.reduce((s, e) => s + e.liters, 0);
  const totalAmount = financials?.totalAmount ?? entries.reduce((s, e) => s + e.totalAmount, 0);
  const totalReceived = financials?.totalReceived ?? entries.reduce((s, e) => s + e.receivedAmount, 0);
  const periodDue = financials?.periodDue ?? (totalAmount - totalReceived);
  const previousDue = financials?.previousDue ?? 0;
  const totalOutstanding = financials?.totalOutstanding ?? (periodDue + previousDue);
  const avgRate = totalMilk > 0 ? totalAmount / totalMilk : 0;

  // Dates: Bill Generated Today + 7 Days Payment Due (still returned for callers like
  // ReportPeriodBottomSheet that display these alongside the PDF, even though the new
  // design itself doesn't print a bill number/due-date line)
  const now = new Date();
  const billDateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  const { daysTaken, missedDaysLabel } = computeDeliveryDayStats(entries, periodTitle);

  // Unobtrusive free-tier notice, kept out of the way of the new minimal layout
  if (!isPremium) {
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DAIRY DIARY · UPGRADE TO PREMIUM TO REMOVE THIS NOTICE', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  // =========================================================================
  // 1. HEADER: Blue card (#1E3A8A) with logo, business name, phone, address
  // =========================================================================
  const headerY = 12;
  const headerH = 46;
  doc.setFillColor(30, 58, 138);
  doc.roundedRect(margin, headerY, contentWidth, headerH, 6, 6, 'F');

  const logoCX = margin + 14;
  const logoCY = headerY + 14;
  const logoR = 9;
  doc.setFillColor(255, 255, 255);
  doc.circle(logoCX, logoCY, logoR, 'F');

  let logoDrawn = false;
  if (businessSettings?.logoUrl) {
    try {
      const imgFormat = businessSettings.logoUrl.startsWith('data:image/jpeg') || businessSettings.logoUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      const d = (logoR - 1.5) * 2;
      doc.addImage(businessSettings.logoUrl, imgFormat, logoCX - d / 2, logoCY - d / 2, d, d);
      logoDrawn = true;
    } catch (err) {
      console.warn('Failed to render uploaded logo in PDF, using fallback emblem:', err);
    }
  }
  if (!logoDrawn) {
    doc.setFillColor(30, 58, 138);
    doc.circle(logoCX, logoCY + 1, logoR - 3.5, 'F');
    doc.setFillColor(96, 165, 250);
    doc.circle(logoCX + 2, logoCY - 0.5, logoR - 5, 'F');
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyName.toUpperCase(), margin + 28, headerY + 17);

  if (companyPhone) {
    const rowY = headerY + 27;
    drawPhoneIcon(doc, margin + 4, rowY - 3.2, [219, 234, 254]);
    doc.setTextColor(219, 234, 254);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(companyPhone, margin + 9, rowY);
  }

  if (companyLocation) {
    const rowY = headerY + 35;
    drawPinIcon(doc, margin + 4, rowY - 3.6, [219, 234, 254]);
    doc.setTextColor(219, 234, 254);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(companyLocation, margin + 9, rowY);
  }

  let yPos = headerY + headerH + 10;

  // =========================================================================
  // 2. BILLED TO + STATEMENT pill
  // =========================================================================
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BILLED TO', margin, yPos);

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(contact.name, margin, yPos + 7);

  if (contact.address) {
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(contact.address, margin, yPos + 13);
  }

  const pillW = 48;
  const pillH = 8;
  const pillX = pageWidth - margin - pillW;
  doc.setFillColor(219, 234, 254);
  doc.roundedRect(pillX, yPos - 6, pillW, pillH, 3, 3, 'F');
  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('STATEMENT', pillX + pillW / 2, yPos - 1, { align: 'center' });

  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(periodTitle, pillX + pillW, yPos + 7, { align: 'right' });

  yPos += 20;

  // Dashed separator helper (same technique as the signature lines in the old design)
  const drawDashedLine = (y: number) => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
  };
  drawDashedLine(yPos);
  yPos += 8;

  // =========================================================================
  // 3. Details grid (2 columns)
  // =========================================================================
  const colLeftX = margin;
  const colRightX = margin + contentWidth / 2;
  const rowH = 14;

  const drawGridRow = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string, rowY: number) => {
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(leftLabel, colLeftX, rowY);
    if (rightLabel) doc.text(rightLabel, colRightX, rowY);

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(leftValue, colLeftX, rowY + 6);
    if (rightValue) doc.text(rightValue, colRightX, rowY + 6);
  };

  drawGridRow('Total Milk', `${totalMilk.toFixed(2)} L`, 'Rate', `${currSym}${avgRate.toFixed(0)} / L`, yPos);
  yPos += rowH;
  drawGridRow('Days Taken', `${daysTaken} Day${daysTaken === 1 ? '' : 's'}`, 'Days Missed', missedDaysLabel, yPos);
  yPos += rowH;
  drawGridRow('Total Amount', `${currSym}${Math.round(totalAmount).toLocaleString()}`, 'Received', `${currSym}${Math.round(totalReceived).toLocaleString()}`, yPos);
  yPos += rowH;

  // Only shown when there's a real carryover balance, keeping the common zero-previous-due
  // case visually identical to the reference's exact 3-row grid.
  if (previousDue > 0) {
    drawGridRow('Previous Balance', `${currSym}${Math.round(previousDue).toLocaleString()}`, '', '', yPos);
    yPos += rowH;
  }

  yPos -= 4;
  drawDashedLine(yPos);
  yPos += 10;

  // =========================================================================
  // 4. Total Bill box
  // =========================================================================
  const boxH = 16;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, yPos, contentWidth, boxH, 3, 3, 'F');
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL BILL', margin + 6, yPos + boxH / 2 + 2);
  doc.setFontSize(18);
  doc.text(`${currSym}${Math.round(totalAmount).toLocaleString()}`, pageWidth - margin - 6, yPos + boxH / 2 + 2.5, { align: 'right' });
  yPos += boxH + 5;

  // =========================================================================
  // 5. Balance box — green "All Clear" when fully paid, red "Balance Due" otherwise.
  // Uses totalOutstanding (period due + previous due) as the authoritative "what's
  // still owed" figure, consistent with how the rest of the app treats it.
  // =========================================================================
  const isAllClear = totalOutstanding <= 0;
  if (isAllClear) {
    doc.setFillColor(220, 252, 231);
  } else {
    doc.setFillColor(254, 226, 226);
  }
  doc.roundedRect(margin, yPos, contentWidth, boxH, 3, 3, 'F');
  if (isAllClear) {
    doc.setTextColor(21, 128, 61);
  } else {
    doc.setTextColor(185, 28, 28);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(isAllClear ? 'Balance (All Clear)' : 'Balance Due', margin + 6, yPos + boxH / 2 + 2);
  doc.setFontSize(14);
  doc.text(`${currSym}${Math.round(totalOutstanding).toLocaleString()}`, pageWidth - margin - 6, yPos + boxH / 2 + 2.5, { align: 'right' });
  yPos += boxH + 14;

  // =========================================================================
  // 6. Footer
  // =========================================================================
  drawHeartIcon(doc, pageWidth / 2, yPos, 4, [239, 68, 68]);
  yPos += 8;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Have a wonderful day.', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('Powered by Dairy Diary', pageWidth / 2, yPos, { align: 'center' });

  // Return generated result
  const pdfBlob = doc.output('blob');
  const filename = `Dairy_Diary_Statement_${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  return {
    blob: pdfBlob,
    url: pdfUrl,
    filename,
    file: pdfFile,
    billDateStr,
    dueDateStr,
    isPremium,
  };
}

// =========================================================================
// REPORTS PAGE PDF — a period-wide summary across all customers, distinct from
// generateSawaaPdfDocument above (which is always scoped to one customer's bill).
// =========================================================================

export interface ReportsPdfLineItem {
  date: string;
  time?: string;
  typeLabel: 'Milk' | 'Payment' | 'Expense';
  label: string;
  detail: string;
  amount: number;
}

export interface ReportsPdfSummary {
  periodTitle: string;
  milkLiters: number;
  buySellAmount: number;
  paidReceived: number;
  entriesCount: number;
  due: number;
}

export interface GeneratedReportsPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  file: File;
}

export async function generateReportsPdf(
  summary: ReportsPdfSummary,
  items: ReportsPdfLineItem[],
  businessSettings?: BusinessSettings
): Promise<GeneratedReportsPdfResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const companyName = businessSettings?.businessName?.trim() || 'Dairy Diary';
  const currSym = businessSettings?.currencySymbol?.trim() || 'Rs';

  const now = new Date();
  const generatedDateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  // 1. Header Bar
  doc.setFillColor(30, 86, 49);
  doc.rect(margin, 12, contentWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(companyName.toUpperCase(), margin + 4, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Period Summary Report', margin + 4, 27);
  doc.text(`Generated: ${generatedDateStr}`, pageWidth - margin - 4, 21, { align: 'right' });

  let yPos = 38;

  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(summary.periodTitle, margin, yPos);
  yPos += 6;

  // 2. 4 Summary Boxes (Milk, Buy & Sell, Paid/Received, Entries)
  const boxW = (contentWidth - 9) / 4;
  const boxH = 17;
  const boxData: { label: string; value: string; bg: [number, number, number]; fg: [number, number, number] }[] = [
    { label: 'MILK', value: `${summary.milkLiters.toFixed(2)} L`, bg: [241, 248, 243], fg: [30, 86, 49] },
    { label: 'BUY & SELL', value: `${currSym} ${Math.round(summary.buySellAmount).toLocaleString()}`, bg: [241, 248, 243], fg: [30, 86, 49] },
    { label: 'PAID/RECEIVED', value: `${currSym} ${Math.round(summary.paidReceived).toLocaleString()}`, bg: [236, 253, 245], fg: [15, 118, 110] },
    { label: 'ENTRIES', value: `${summary.entriesCount}`, bg: [255, 247, 237], fg: [180, 83, 9] },
  ];
  boxData.forEach((b, i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(b.bg[0], b.bg[1], b.bg[2]);
    doc.roundedRect(x, yPos, boxW, boxH, 2, 2, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(b.label, x + boxW / 2, yPos + 5.5, { align: 'center' });
    doc.setTextColor(b.fg[0], b.fg[1], b.fg[2]);
    doc.setFontSize(9.5);
    doc.text(b.value, x + boxW / 2, yPos + 12.5, { align: 'center' });
  });
  yPos += boxH + 4;

  if (summary.due > 0) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, yPos, contentWidth, 9, 2, 2, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`OUTSTANDING DUE FOR PERIOD: ${currSym} ${Math.round(summary.due).toLocaleString()}`, margin + 4, yPos + 6);
    yPos += 13;
  } else {
    yPos += 2;
  }

  // 3. Transaction Details Table (Milk + Payment + Expense, mixed)
  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TRANSACTION DETAILS', margin, yPos);
  yPos += 3.5;

  const cols = [
    { title: 'Date', width: 20, align: 'left' as const },
    { title: 'Time', width: 16, align: 'left' as const },
    { title: 'Type', width: 20, align: 'left' as const },
    { title: 'Description', width: 68, align: 'left' as const },
    { title: `Amount (${currSym})`, width: 58, align: 'right' as const },
  ];

  const drawHeader = (topY: number) => {
    doc.setFillColor(30, 86, 49);
    doc.rect(margin, topY, contentWidth, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let curX = margin + 2;
    cols.forEach((c) => {
      if (c.align === 'right') doc.text(c.title, curX + c.width - 4, topY + 4.5, { align: 'right' });
      else doc.text(c.title, curX, topY + 4.5);
      curX += c.width;
    });
  };

  drawHeader(yPos);
  yPos += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  if (items.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.text('No transactions recorded for this period.', margin + 3, yPos + 4);
    yPos += 8;
  } else {
    items.forEach((item, idx) => {
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = 16;
        drawHeader(yPos);
        yPos += 6.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 249, isEven ? 255 : 251, isEven ? 255 : 250);
      doc.rect(margin, yPos, contentWidth, 5.5, 'F');
      doc.setDrawColor(230, 238, 233);
      doc.line(margin, yPos + 5.5, margin + contentWidth, yPos + 5.5);

      doc.setTextColor(30, 41, 59);
      let curX = margin + 2;
      doc.text(item.date, curX, yPos + 3.8);
      curX += cols[0].width;
      doc.text(item.time || '-', curX, yPos + 3.8);
      curX += cols[1].width;
      doc.text(item.typeLabel, curX, yPos + 3.8);
      curX += cols[2].width;

      const desc = `${item.label}${item.detail ? ' - ' + item.detail : ''}`;
      doc.text(desc.length > 42 ? `${desc.substring(0, 39)}...` : desc, curX, yPos + 3.8);
      curX += cols[3].width;

      doc.setFont('helvetica', 'bold');
      doc.text(`${currSym} ${Math.round(item.amount).toLocaleString()}`, curX + cols[4].width - 4, yPos + 3.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      yPos += 5.5;
    });
  }

  yPos += 8;
  if (yPos > pageHeight - 20) {
    doc.addPage();
    yPos = 16;
  }

  // 4. Footer
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `${companyName} · Generated by Dairy Diary · Developed by SAWAA Networking`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );

  const pdfBlob = doc.output('blob');
  const filename = `Dairy_Diary_Report_${summary.periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  return {
    blob: pdfBlob,
    url: pdfUrl,
    filename,
    file: pdfFile,
  };
}
