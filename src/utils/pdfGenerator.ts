import { jsPDF } from 'jspdf';
import { Contact, LedgerEntry, BusinessSettings } from '../types/dairy';
import { getEnabledPaymentAccounts } from './paymentAccounts';

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

// =========================================================================
// Month-title parsing — used to derive a stable YYYYMM suffix for the
// generated Bill Number below from a "Month YYYY" period title.
// =========================================================================

function tryParseMonthTitle(title: string): { year: number; month: number } | null {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const match = title.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const monthIdx = months.indexOf(match[1]);
  if (monthIdx === -1) return null;
  return { year: parseInt(match[2], 10), month: monthIdx + 1 };
}

// =========================================================================
// Aspect-ratio-preserving image sizing — jsPDF's addImage always stretches
// the source bitmap to fill the exact width/height given to it, so any
// uploaded logo/QR image that isn't already a perfect square gets visibly
// distorted unless we first measure its real pixel size and fit it into
// the target box ourselves.
// =========================================================================

function loadImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function computeContainSize(naturalW: number, naturalH: number, maxW: number, maxH: number): { w: number; h: number } {
  const aspect = naturalW / naturalH || 1;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

// =========================================================================
// CUSTOMER STATEMENT PDF — the long formal itemized bill: green header, bill
// number + due-date card, 4 summary stat boxes, carryover reconciliation bar,
// paginated transaction ledger table, payment accounts + QR, 7-day payment
// notice, and dual signature lines.
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

  // Dates: Bill Generated Today + 7 Days Payment Due (also returned for callers like
  // ReportPeriodBottomSheet that display these alongside the PDF)
  const now = new Date();
  const billDateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  // Unobtrusive free-tier notice
  if (!isPremium) {
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DAIRY DIARY · UPGRADE TO PREMIUM TO REMOVE THIS NOTICE', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  // Stable-looking Bill Number: timestamp + the period's YYYYMM (or today's, for
  // non-month period titles like "Last 3 Months" / "All Time History").
  const billMonthMatch = tryParseMonthTitle(periodTitle);
  const billMonthKey = billMonthMatch
    ? `${billMonthMatch.year}${String(billMonthMatch.month).padStart(2, '0')}`
    : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const billNumber = `BILL-${now.getTime()}-${billMonthKey}`;

  const GREEN: [number, number, number] = [30, 86, 49]; // #1E5631 — app brand green
  const GREEN_LIGHT: [number, number, number] = [209, 250, 229];
  const RED: [number, number, number] = [185, 28, 28];
  const GREEN_DARK_TEXT: [number, number, number] = [21, 128, 61];

  let yPos = 0;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage();
      yPos = 16;
    }
  };

  // =========================================================================
  // 1. HEADER: Green banner (#1E5631) with logo, business name, phone,
  // address, and generation date.
  // =========================================================================
  const headerY = 12;
  const headerH = companyLocation || companyPhone ? 46 : 30;
  doc.setFillColor(...GREEN);
  doc.roundedRect(margin, headerY, contentWidth, headerH, 4, 4, 'F');

  const logoCX = margin + 13;
  const logoCY = headerY + 14;
  const logoR = 9;
  doc.setFillColor(255, 255, 255);
  doc.circle(logoCX, logoCY, logoR, 'F');

  let logoDrawn = false;
  if (businessSettings?.logoUrl) {
    try {
      const imgFormat = businessSettings.logoUrl.startsWith('data:image/jpeg') || businessSettings.logoUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      const maxDim = (logoR - 1.5) * 2;
      const dims = await loadImageNaturalSize(businessSettings.logoUrl);
      const { w: drawW, h: drawH } = dims
        ? computeContainSize(dims.width, dims.height, maxDim, maxDim)
        : { w: maxDim, h: maxDim };
      doc.addImage(businessSettings.logoUrl, imgFormat, logoCX - drawW / 2, logoCY - drawH / 2, drawW, drawH);
      logoDrawn = true;
    } catch (err) {
      console.warn('Failed to render uploaded logo in PDF, using fallback emblem:', err);
    }
  }
  if (!logoDrawn) {
    doc.setFillColor(...GREEN);
    doc.circle(logoCX, logoCY + 1, logoR - 3.5, 'F');
    doc.setFillColor(110, 231, 183);
    doc.circle(logoCX + 2, logoCY - 0.5, logoR - 5, 'F');
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(companyName.toUpperCase(), margin + 26, headerY + 15);

  let headerRowY = headerY + 27;
  if (companyPhone) {
    drawPhoneIcon(doc, margin + 4, headerRowY - 3.2, GREEN_LIGHT);
    doc.setTextColor(...GREEN_LIGHT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Phone: ${companyPhone}`, margin + 11, headerRowY);
    headerRowY += 8;
  }
  if (companyLocation) {
    drawPinIcon(doc, margin + 4, headerRowY - 3.6, GREEN_LIGHT);
    doc.setTextColor(...GREEN_LIGHT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(companyLocation, margin + 11, headerRowY);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Date: ${billDateStr}`, pageWidth - margin - 4, headerY + 15, { align: 'right' });

  yPos = headerY + headerH + 10;

  // =========================================================================
  // 2. "MONTHLY FRESH MILK BILL" title + period
  // =========================================================================
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MONTHLY FRESH MILK BILL', margin, yPos);
  doc.setFontSize(9);
  doc.text(`Period: ${periodTitle}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 8;

  // =========================================================================
  // 3. Customer Information + Billing Information boxes (side by side)
  // =========================================================================
  const infoBoxW = (contentWidth - 6) / 2;
  const infoBoxH = 28;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, yPos, infoBoxW, infoBoxH, 3, 3, 'S');
  doc.roundedRect(margin + infoBoxW + 6, yPos, infoBoxW, infoBoxH, 3, 3, 'S');

  const labelStyle = () => {
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
  };
  const valueStyle = () => {
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
  };
  const smallValueStyle = () => {
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
  };

  labelStyle();
  doc.text('CUSTOMER INFORMATION', margin + 4, yPos + 6);
  valueStyle();
  doc.text(contact.name, margin + 4, yPos + 13);
  smallValueStyle();
  doc.text(`Phone: ${contact.phone || 'N/A'}`, margin + 4, yPos + 19);
  doc.text(`Address: ${contact.address || 'N/A'}`, margin + 4, yPos + 25);

  const billColX = margin + infoBoxW + 6 + 4;
  labelStyle();
  doc.text('BILLING INFORMATION', billColX, yPos + 6);
  smallValueStyle();
  doc.text(`Bill Number: ${billNumber}`, billColX, yPos + 13);
  doc.text(`Bill Date: ${billDateStr}`, billColX, yPos + 19);
  doc.setTextColor(...RED);
  doc.setFont('helvetica', 'bold');
  doc.text(`Payment Due By: ${dueDateStr}`, billColX, yPos + 25);

  yPos += infoBoxH + 6;

  // =========================================================================
  // 4. 4 Summary stat boxes
  // =========================================================================
  const statBoxW = (contentWidth - 9) / 4;
  const statBoxH = 17;
  const statBoxes: { label: string; value: string; fg: [number, number, number] }[] = [
    { label: 'TOTAL MILK', value: `${totalMilk.toFixed(2)} L`, fg: [17, 24, 39] },
    { label: 'TOTAL AMOUNT', value: `${currSym}${Math.round(totalAmount).toLocaleString()}`, fg: [17, 24, 39] },
    { label: 'TOTAL RECEIVED', value: `${currSym}${Math.round(totalReceived).toLocaleString()}`, fg: GREEN_DARK_TEXT },
    { label: 'REMAINING DUE', value: `${currSym}${Math.round(totalOutstanding).toLocaleString()}`, fg: RED },
  ];
  statBoxes.forEach((b, i) => {
    const x = margin + i * (statBoxW + 3);
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, yPos, statBoxW, statBoxH, 2, 2, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.text(b.label, x + statBoxW / 2, yPos + 6, { align: 'center' });
    doc.setTextColor(...b.fg);
    doc.setFontSize(9.5);
    doc.text(b.value, x + statBoxW / 2, yPos + 13, { align: 'center' });
  });
  yPos += statBoxH + 6;

  // =========================================================================
  // 5. Carryover + Total Payable Outstanding bar
  // =========================================================================
  const carryH = previousDue > 0 ? 18 : 12;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(margin, yPos, contentWidth, carryH, 3, 3, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 96, 15);
  if (previousDue > 0) {
    doc.text(`PREVIOUS CARRYOVER BALANCE: ${currSym}${Math.round(previousDue).toLocaleString()}  |  ACTIVE BILL: ${currSym}${Math.round(totalAmount).toLocaleString()}`, margin + 4, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text(`TOTAL PAYABLE OUTSTANDING: ${currSym}${Math.round(totalOutstanding).toLocaleString()}`, margin + 4, yPos + 13);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text(`TOTAL PAYABLE OUTSTANDING: ${currSym}${Math.round(totalOutstanding).toLocaleString()}`, margin + 4, yPos + 8);
  }
  yPos += carryH + 8;

  // =========================================================================
  // 6. TRANSACTION LEDGER DETAILS — paginated table, newest entries first
  // =========================================================================
  checkPageBreak(14);
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TRANSACTION LEDGER DETAILS', margin, yPos);
  yPos += 5;

  const ledgerCols = [
    { title: 'Date', width: 20 },
    { title: 'Time', width: 20 },
    { title: 'Shift', width: 20 },
    { title: 'Category', width: 22 },
    { title: 'Quantity', width: 24 },
    { title: 'Rate (Rs.)', width: 24 },
    { title: 'Total (Rs.)', width: 26 },
    { title: 'Due (Rs.)', width: 26 },
  ];
  const tableRowH = 6.5;

  const drawLedgerHeader = () => {
    doc.setFillColor(...GREEN);
    doc.rect(margin, yPos, contentWidth, tableRowH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let curX = margin + 2;
    ledgerCols.forEach((c) => {
      doc.text(c.title, curX, yPos + 4.3);
      curX += c.width;
    });
    yPos += tableRowH;
  };

  drawLedgerHeader();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp));

  if (sortedEntries.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.text('No transactions recorded for this period.', margin + 3, yPos + 4.5);
    yPos += tableRowH;
  } else {
    sortedEntries.forEach((e, idx) => {
      if (yPos + tableRowH > pageHeight - 20) {
        doc.addPage();
        yPos = 16;
        drawLedgerHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 245, isEven ? 255 : 250, isEven ? 255 : 247);
      doc.rect(margin, yPos, contentWidth, tableRowH, 'F');
      doc.setDrawColor(230, 238, 233);
      doc.line(margin, yPos + tableRowH, margin + contentWidth, yPos + tableRowH);

      doc.setTextColor(30, 41, 59);
      let curX = margin + 2;
      doc.text(e.date, curX, yPos + 4.5);
      curX += ledgerCols[0].width;
      doc.text(e.timestamp || '-', curX, yPos + 4.5);
      curX += ledgerCols[1].width;
      doc.text(e.shift.toUpperCase(), curX, yPos + 4.5);
      curX += ledgerCols[2].width;
      doc.text((e.milkType || 'other').toUpperCase(), curX, yPos + 4.5);
      curX += ledgerCols[3].width;
      doc.text(`${e.liters.toFixed(2)} L`, curX, yPos + 4.5);
      curX += ledgerCols[4].width;
      doc.text(`${currSym} ${e.ratePerLiter.toFixed(2)}`, curX, yPos + 4.5);
      curX += ledgerCols[5].width;
      doc.setFont('helvetica', 'bold');
      doc.text(`${currSym} ${Math.round(e.totalAmount).toLocaleString()}`, curX, yPos + 4.5);
      curX += ledgerCols[6].width;
      doc.setTextColor(...RED);
      doc.text(`${currSym} ${Math.round(e.dueAmount).toLocaleString()}`, curX, yPos + 4.5);
      doc.setFont('helvetica', 'normal');

      yPos += tableRowH;
    });
  }

  checkPageBreak(tableRowH + 2);
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.rect(margin, yPos, contentWidth, tableRowH + 1, 'FD');
  doc.setTextColor(...GREEN_DARK_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('TOTAL PERIOD TRANSACTIONS', margin + 2, yPos + 4.8);
  doc.text(`${totalMilk.toFixed(2)} L`, margin + ledgerCols[0].width + ledgerCols[1].width + ledgerCols[2].width + ledgerCols[3].width + 2, yPos + 4.8);
  doc.text(`${currSym} ${Math.round(totalAmount).toLocaleString()}`, margin + ledgerCols.slice(0, 6).reduce((s, c) => s + c.width, 0) + 2, yPos + 4.8);
  doc.setTextColor(...RED);
  doc.text(`${currSym} ${Math.round(periodDue).toLocaleString()}`, margin + ledgerCols.slice(0, 7).reduce((s, c) => s + c.width, 0) + 2, yPos + 4.8);
  yPos += tableRowH + 1 + 8;

  // =========================================================================
  // 7. PAYMENT DETAILS + QR (enabled accounts only; QR is the real uploaded
  // image, never a fabricated placeholder graphic on a real financial document)
  // =========================================================================
  const enabledAccounts = getEnabledPaymentAccounts(businessSettings);
  const qrAccount = enabledAccounts.find((a) => a.qrCodeUrl);
  const qrMaxSize = 26;
  // Reserve extra room when a QR is present: image + two label lines below it
  // (method name + account title), so neither gets clipped by a page break.
  const paymentBoxH =
    enabledAccounts.length === 0 ? 0 : Math.max(enabledAccounts.length * 6 + 6, qrAccount ? 42 : 32);
  checkPageBreak(enabledAccounts.length === 0 ? 20 : paymentBoxH + 16);
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PAYMENT DETAILS', margin, yPos);
  yPos += 6;

  if (enabledAccounts.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('No payment account has been enabled for this business.', margin, yPos);
    yPos += 10;
  } else {
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, paymentBoxH, 3, 3, 'S');

    let lineY = yPos + 7;
    doc.setFontSize(8.5);
    enabledAccounts.forEach((acc) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      const label = `${acc.name}: `;
      doc.text(label, margin + 4, lineY);
      const labelW = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const detail = `${acc.accountTitle} (${acc.primaryDetail}${acc.secondaryDetail ? ` · ${acc.secondaryDetail}` : ''})`;
      doc.text(detail, margin + 4 + labelW, lineY);
      lineY += 6;
    });

    const qrX = pageWidth - margin - qrMaxSize - 4;
    const qrY = yPos + 4;
    if (qrAccount?.qrCodeUrl) {
      try {
        const imgFormat = qrAccount.qrCodeUrl.startsWith('data:image/jpeg') || qrAccount.qrCodeUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
        const dims = await loadImageNaturalSize(qrAccount.qrCodeUrl);
        const { w: drawW, h: drawH } = dims
          ? computeContainSize(dims.width, dims.height, qrMaxSize, qrMaxSize)
          : { w: qrMaxSize, h: qrMaxSize };
        doc.addImage(
          qrAccount.qrCodeUrl,
          imgFormat,
          qrX + (qrMaxSize - drawW) / 2,
          qrY + (qrMaxSize - drawH) / 2,
          drawW,
          drawH
        );
        // Our own labels, drawn fresh every time — never dependent on whatever
        // text (if any) happens to already be baked into the uploaded image.
        doc.setTextColor(...GREEN);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text(`SCAN TO PAY VIA ${qrAccount.name.toUpperCase()}`, qrX + qrMaxSize / 2, qrY + qrMaxSize + 4, { align: 'center' });
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(`Account: ${qrAccount.accountTitle}`, qrX + qrMaxSize / 2, qrY + qrMaxSize + 8, { align: 'center' });
      } catch (err) {
        console.warn('Failed to render payment QR code in PDF:', err);
      }
    } else {
      // No account has an uploaded QR image yet — reserve the same space with a
      // neutral placeholder so the layout stays balanced until one is added in
      // Settings, instead of silently leaving a gap.
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(qrX, qrY, qrMaxSize, qrMaxSize, 2, 2, 'FD');
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('No QR Code', qrX + qrMaxSize / 2, qrY + qrMaxSize / 2 - 1, { align: 'center' });
      doc.text('Uploaded', qrX + qrMaxSize / 2, qrY + qrMaxSize / 2 + 3, { align: 'center' });
    }

    yPos += paymentBoxH + 6;
  }

  // =========================================================================
  // 8. 7-Day Payment Notice
  // =========================================================================
  checkPageBreak(18);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(252, 211, 77);
  doc.roundedRect(margin, yPos, contentWidth, 16, 3, 3, 'FD');
  doc.setTextColor(120, 53, 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PAYMENT NOTICE', margin + 4, yPos + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('After the bill is generated, the customer has 7 days to pay the outstanding dues.', margin + 4, yPos + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bill Generated Date: ${billDateStr}  |  Payment Due Date: ${dueDateStr} (Strict 7-Day Window)`, margin + 4, yPos + 15.5);
  yPos += 24;

  // =========================================================================
  // 9. Dual Signatures
  // =========================================================================
  checkPageBreak(26);
  const sigColW = contentWidth / 2;
  const drawSignature = (x: number, title: string, subtitle: string) => {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(x + sigColW * 0.15, yPos, x + sigColW * 0.85, yPos);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(title, x + sigColW / 2, yPos + 6, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(subtitle, x + sigColW / 2, yPos + 11, { align: 'center' });
  };
  drawSignature(margin, 'Authorized Signature', companyName);
  drawSignature(margin + sigColW, 'Customer Signature', contact.name);
  yPos += 18;

  // =========================================================================
  // 10. Footer
  // =========================================================================
  checkPageBreak(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `${companyName} · Generated by Dairy Diary · Developed by SAWAA Networking`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

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
