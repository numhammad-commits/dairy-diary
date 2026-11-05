import { jsPDF } from 'jspdf';
import { Contact, LedgerEntry, BusinessSettings, PRODUCT_TYPE_LABELS } from '../types/dairy';
import { getEnabledPaymentAccounts } from './paymentAccounts';

// Dairy product entries (see LedgerEntry.entryType in types/dairy.ts) are rendered in the
// same per-entry ledger tables as milk, just with a different category/quantity/rate label.
function entryCategoryLabel(e: LedgerEntry): string {
  if ((e.entryType || 'milk') === 'product') return PRODUCT_TYPE_LABELS[e.productType || 'other'].toUpperCase();
  return (e.milkType || 'other').toUpperCase();
}
function entryQuantityLabel(e: LedgerEntry): string {
  if ((e.entryType || 'milk') === 'product') return `${(e.productQuantity || 0).toFixed(2)} ${e.productUnit === 'kg' ? 'KG' : 'L'}`;
  return `${e.liters.toFixed(2)} L`;
}
function entryRateValue(e: LedgerEntry): number {
  return (e.entryType || 'milk') === 'product' ? (e.productRate || 0) : e.ratePerLiter;
}

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
// Stat-box badge icons for the premium A4 invoice's 4 summary cards — same
// hand-drawn-shape technique as the phone/pin icons above (jsPDF's built-in
// fonts have no emoji glyphs), each centered in a small colored circle badge.
// =========================================================================

function drawDropletBadge(doc: jsPDF, cx: number, cy: number, r: number, bg: [number, number, number]) {
  doc.setFillColor(...bg);
  doc.circle(cx, cy, r, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy + r * 0.25, r * 0.4, 'F');
  doc.triangle(cx - r * 0.4, cy + r * 0.1, cx + r * 0.4, cy + r * 0.1, cx, cy - r * 0.45, 'F');
}

function drawCoinBadge(doc: jsPDF, cx: number, cy: number, r: number, bg: [number, number, number]) {
  doc.setFillColor(...bg);
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r * 0.55, 'S');
  doc.line(cx, cy - r * 0.3, cx, cy + r * 0.3);
}

function drawCheckBadge(doc: jsPDF, cx: number, cy: number, r: number, bg: [number, number, number]) {
  doc.setFillColor(...bg);
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.line(cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.4);
  doc.line(cx - r * 0.1, cy + r * 0.4, cx + r * 0.5, cy - r * 0.35);
}

function drawWarningBadge(doc: jsPDF, cx: number, cy: number, r: number, bg: [number, number, number]) {
  doc.setFillColor(...bg);
  doc.triangle(cx - r, cy + r * 0.75, cx + r, cy + r * 0.75, cx, cy - r, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - 0.3, cy - r * 0.35, 0.6, r * 0.6, 'F');
  doc.circle(cx, cy + r * 0.5, 0.45, 'F');
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

  // Premium A4 invoice palette: dark green header/accents + a gold trim,
  // replacing the plain #1E5631 banner this function used before.
  const GREEN: [number, number, number] = [0, 77, 64]; // #004d40
  const GREEN_LIGHT: [number, number, number] = [209, 250, 229];
  const RED: [number, number, number] = [185, 28, 28];
  const GREEN_DARK_TEXT: [number, number, number] = [21, 128, 61];
  const GOLD: [number, number, number] = [212, 175, 55]; // #D4AF37
  const CREAM: [number, number, number] = [253, 250, 240];

  let yPos = 0;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage();
      yPos = 16;
    }
  };

  // Payment accounts/QR — computed up front since the header now carries this
  // instead of a separate section near the bottom (enabled accounts only; QR
  // is the real uploaded image, never a fabricated placeholder on a real
  // financial document).
  const enabledAccounts = getEnabledPaymentAccounts(businessSettings);
  const qrAccount = enabledAccounts.find((a) => a.qrCodeUrl);

  // =========================================================================
  // 1. HEADER: dark green (#004d40) banner with a gold border/divider, logo
  // in a gold-ringed circle, business name + static taglines on the left, and
  // payment account(s) + QR code on the right (Period/Date moved down into
  // the Billing Information card below).
  // =========================================================================
  const headerY = 12;
  const headerH = 46 + Math.max(0, enabledAccounts.length - 2) * 5;
  doc.setFillColor(...GREEN);
  doc.roundedRect(margin, headerY, contentWidth, headerH, 4, 4, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, headerY, contentWidth, headerH, 4, 4, 'S');
  doc.setLineWidth(0.2);

  const logoCX = margin + 16;
  const logoCY = headerY + headerH / 2;
  const logoR = 10;

  doc.setFillColor(...GOLD);
  doc.circle(logoCX, logoCY, logoR + 1.2, 'F');

  let logoDrawn = false;
  if (businessSettings?.logoUrl) {
    try {
      const imgFormat = businessSettings.logoUrl.startsWith('data:image/jpeg') || businessSettings.logoUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      // No background box/circle behind a real uploaded logo — just the image
      // itself, contain-fit and centered on the same point the fallback
      // emblem below uses, so it stays aligned with the business name
      // regardless of whether the source image is square or rectangular.
      doc.setFillColor(255, 255, 255);
      doc.circle(logoCX, logoCY, logoR, 'F');
      // No manual sizing needed: the image is clipped to the exact logoR
      // circle below, so any square/rectangular source (including a logo
      // with an opaque black background) always ends up a clean circle —
      // corners outside the ring are cropped, never squeezed or distorted.
      const maxDim = 2 * logoR;
      const dims = await loadImageNaturalSize(businessSettings.logoUrl);
      const { w: drawW, h: drawH } = dims
        ? computeContainSize(dims.width, dims.height, maxDim, maxDim)
        : { w: maxDim, h: maxDim };
      // Clip to a circle matching the white backdrop exactly, so the image
      // (scaled to fill the full ring diameter by computeContainSize above)
      // renders as a perfect circle instead of a square poking out.
      doc.saveGraphicsState();
      doc.circle(logoCX, logoCY, logoR, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(businessSettings.logoUrl, imgFormat, logoCX - drawW / 2, logoCY - drawH / 2, drawW, drawH);
      doc.restoreGraphicsState();
      logoDrawn = true;
    } catch (err) {
      console.warn('Failed to render uploaded logo in PDF, using fallback emblem:', err);
    }
  }
  if (!logoDrawn) {
    // Fallback vector droplet emblem needs its own white circular backdrop to
    // read against the green header — only drawn when there's no real logo.
    doc.setFillColor(255, 255, 255);
    doc.circle(logoCX, logoCY, logoR, 'F');
    doc.setFillColor(...GREEN);
    doc.circle(logoCX, logoCY + 1, logoR - 3.5, 'F');
    doc.setFillColor(110, 231, 183);
    doc.circle(logoCX + 2, logoCY - 0.5, logoR - 5, 'F');
  }

  const brandX = margin + 32;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(companyName.toUpperCase(), brandX, headerY + 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text('Fresh Milk Distribution Service', brandX, headerY + 23);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(brandX, headerY + 27, brandX + 55, headerY + 27);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Pure Milk  ·  Healthy Life', brandX, headerY + 33);

  // Right block: payment account(s) + QR code (Period/Date now live in the
  // Billing Information card below instead of here).
  if (enabledAccounts.length > 0) {
    const qrSize = 20;
    const qrX = pageWidth - margin - qrSize - 6;
    const qrY = headerY + 6;
    const textRightX = qrX - 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('PAYMENT DETAILS', textRightX, headerY + 8, { align: 'right' });

    let acctY = headerY + 14;
    doc.setFontSize(8.5);
    enabledAccounts.forEach((acc) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(acc.name, textRightX, acctY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GREEN_LIGHT);
      doc.text(acc.primaryDetail, textRightX, acctY + 4.5, { align: 'right' });
      doc.setFontSize(8.5);
      acctY += 10;
    });

    if (qrAccount?.qrCodeUrl) {
      try {
        const imgFormat = qrAccount.qrCodeUrl.startsWith('data:image/jpeg') || qrAccount.qrCodeUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 1.5, 1.5, 'F');
        const dims = await loadImageNaturalSize(qrAccount.qrCodeUrl);
        const { w: drawW, h: drawH } = dims
          ? computeContainSize(dims.width, dims.height, qrSize, qrSize)
          : { w: qrSize, h: qrSize };
        doc.addImage(qrAccount.qrCodeUrl, imgFormat, qrX + (qrSize - drawW) / 2, qrY + (qrSize - drawH) / 2, drawW, drawH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(...GOLD);
        doc.text('SCAN TO PAY', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
      } catch (err) {
        console.warn('Failed to render payment QR code in PDF header:', err);
      }
    }
  }

  yPos = headerY + headerH + 6;

  // =========================================================================
  // 2. Contact Strip — phone + address, centered, below the header.
  // =========================================================================
  if (companyPhone || companyLocation) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const segments: { text: string; icon?: 'phone' | 'pin' }[] = [];
    if (companyPhone) segments.push({ text: companyPhone, icon: 'phone' });
    if (companyPhone && companyLocation) segments.push({ text: '|' });
    if (companyLocation) segments.push({ text: companyLocation, icon: 'pin' });

    const iconW = 5;
    const gap = 2;
    const totalW = segments.reduce((sum, s) => sum + (s.icon ? iconW : 0) + doc.getTextWidth(s.text) + gap, 0) - gap;
    let curX = (pageWidth - totalW) / 2;
    const textY = yPos + 4;
    segments.forEach((s) => {
      if (s.icon === 'phone') {
        drawPhoneIcon(doc, curX, textY - 3.2, GREEN);
        curX += iconW;
      } else if (s.icon === 'pin') {
        drawPinIcon(doc, curX, textY - 3.6, GREEN);
        curX += iconW;
      }
      doc.setTextColor(60, 60, 60);
      doc.text(s.text, curX, textY);
      curX += doc.getTextWidth(s.text) + gap;
    });
    yPos += 10;
  }

  // =========================================================================
  // 3. Customer Information + Billing Information boxes (side by side)
  // =========================================================================
  const infoBoxW = (contentWidth - 6) / 2;
  const infoBoxH = 32;
  doc.setDrawColor(221, 198, 140);
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
  doc.text(`Period: ${periodTitle}`, billColX, yPos + 13);
  doc.text(`Bill Number: ${billNumber}`, billColX, yPos + 19);
  doc.text(`Bill Date: ${billDateStr}`, billColX, yPos + 25);
  doc.setTextColor(...RED);
  doc.setFont('helvetica', 'bold');
  doc.text(`Payment Due By: ${dueDateStr}`, billColX, yPos + 31);

  yPos += infoBoxH + 6;

  // =========================================================================
  // 4. 4 Summary stat boxes
  // =========================================================================
  const statBoxW = (contentWidth - 9) / 4;
  const statBoxH = 21;
  const statBoxes: {
    label: string;
    value: string;
    fg: [number, number, number];
    icon: (x: number, y: number, r: number) => void;
  }[] = [
    { label: 'TOTAL MILK', value: `${totalMilk.toFixed(2)} L`, fg: [17, 24, 39], icon: (x, y, r) => drawDropletBadge(doc, x, y, r, GREEN) },
    { label: 'TOTAL AMOUNT', value: `${currSym}${Math.round(totalAmount).toLocaleString()}`, fg: [17, 24, 39], icon: (x, y, r) => drawCoinBadge(doc, x, y, r, GREEN) },
    { label: 'RECEIVED', value: `${currSym}${Math.round(totalReceived).toLocaleString()}`, fg: GREEN_DARK_TEXT, icon: (x, y, r) => drawCheckBadge(doc, x, y, r, GREEN) },
    { label: 'REMAINING DUE', value: `${currSym}${Math.round(totalOutstanding).toLocaleString()}`, fg: RED, icon: (x, y, r) => drawWarningBadge(doc, x, y, r, RED) },
  ];
  statBoxes.forEach((b, i) => {
    const x = margin + i * (statBoxW + 3);
    const cx = x + statBoxW / 2;
    doc.setFillColor(253, 251, 245);
    doc.setDrawColor(221, 198, 140);
    doc.roundedRect(x, yPos, statBoxW, statBoxH, 2, 2, 'FD');
    b.icon(cx, yPos + 5, 3);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.text(b.label, cx, yPos + 12, { align: 'center' });
    doc.setTextColor(...b.fg);
    doc.setFontSize(9.5);
    doc.text(b.value, cx, yPos + 18, { align: 'center' });
  });
  yPos += statBoxH + 6;

  // =========================================================================
  // 5. TOTAL PAYABLE OUTSTANDING — gold-bordered cream card: grand total on
  // the left, Payment Due By date on the right, with an optional carryover
  // line above the total when a previous balance is actually owed.
  // =========================================================================
  const hasCarryover = previousDue > 0;
  const outstandingH = hasCarryover ? 24 : 20;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, outstandingH, 3, 3, 'FD');
  doc.setLineWidth(0.2);

  const dividerX = margin + contentWidth * 0.62;
  let outLabelY = yPos + (hasCarryover ? 7 : 8);
  if (hasCarryover) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 96, 15);
    doc.text(
      `Previous Carryover: ${currSym}${Math.round(previousDue).toLocaleString()}  ·  Active Bill: ${currSym}${Math.round(totalAmount).toLocaleString()}`,
      margin + 6,
      outLabelY
    );
    outLabelY += 7;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 96, 15);
  doc.text('TOTAL PAYABLE OUTSTANDING', margin + 6, outLabelY);
  doc.setFontSize(15);
  doc.setTextColor(...RED);
  doc.text(`${currSym} ${Math.round(totalOutstanding).toLocaleString()}`, margin + 6, outLabelY + 8);

  doc.setDrawColor(...GOLD);
  doc.line(dividerX, yPos + 4, dividerX, yPos + outstandingH - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 90, 40);
  doc.text('Payment Due By', dividerX + 8, outLabelY);
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(dueDateStr, dividerX + 8, outLabelY + 8);
  yPos += outstandingH + 8;

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
      doc.text(entryCategoryLabel(e), curX, yPos + 4.5);
      curX += ledgerCols[3].width;
      doc.text(entryQuantityLabel(e), curX, yPos + 4.5);
      curX += ledgerCols[4].width;
      doc.text(`${currSym} ${entryRateValue(e).toFixed(2)}`, curX, yPos + 4.5);
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
  // 7. 7-Day Payment Notice
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
  // 8. "Authorized By" line — replaces the old dual signature lines with a
  // single clean, centered attribution under a short green accent rule.
  // =========================================================================
  checkPageBreak(16);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.line(pageWidth / 2 - 24, yPos, pageWidth / 2 + 24, yPos);
  doc.setLineWidth(0.2);
  yPos += 6;
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Authorized By: ${companyName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // =========================================================================
  // 9. Footer
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
// RECEIPT TEMPLATES — Thermal (58mm, black & white) and Ledger (dense table)
// are fully independent generators, additive alongside generateSawaaPdfDocument
// above (the "Modern" default), which they never call into or modify. A thin
// dispatcher (generateReceiptPdf) picks the right one based on the business's
// selected template.
// =========================================================================

export type ReceiptPdfTemplate = 'modern' | 'thermal' | 'ledger';

// Shared by SettingsView (live preview) and CustomerShareReceiptModal (Share/PDF)
// so the label stored in businessSettings.receiptTemplate maps to one consistent
// variant everywhere.
export function receiptTemplateFromLabel(label?: string): ReceiptPdfTemplate {
  const lower = (label || '').toLowerCase();
  if (lower.includes('thermal')) return 'thermal';
  if (lower.includes('ledger')) return 'ledger';
  return 'modern';
}

interface ReceiptFinancials {
  totalMilk: number;
  totalAmount: number;
  totalReceived: number;
  periodDue: number;
  previousDue: number;
  totalOutstanding: number;
}

// Narrow (58mm) black-and-white receipt styled like a real thermal printer slip:
// Courier font, dashed-line dividers, aggregate totals only (no per-entry table —
// real thermal receipts stay short). The page height is computed from a fixed,
// deterministic line count so there's no blank tail and nothing can overflow.
export async function generateThermalReceiptPdf(
  contact: Contact,
  entries: LedgerEntry[],
  periodTitle: string,
  businessSettings?: BusinessSettings,
  financials?: ReceiptFinancials
): Promise<GeneratedPdfResult> {
  const companyName = businessSettings?.businessName?.trim() || 'Dairy Farm';
  const companyPhone = businessSettings?.phone?.trim() || '';
  const currSym = businessSettings?.currencySymbol?.trim() || 'Rs';

  const totalMilk = financials?.totalMilk ?? entries.reduce((s, e) => s + e.liters, 0);
  const productsAmount = entries.filter((e) => (e.entryType || 'milk') === 'product').reduce((s, e) => s + e.totalAmount, 0);
  const totalAmount = financials?.totalAmount ?? entries.reduce((s, e) => s + e.totalAmount, 0);
  const totalReceived = financials?.totalReceived ?? entries.reduce((s, e) => s + e.receivedAmount, 0);
  const periodDue = financials?.periodDue ?? (totalAmount - totalReceived);
  const previousDue = financials?.previousDue ?? 0;
  const totalOutstanding = financials?.totalOutstanding ?? (periodDue + previousDue);
  const avgRate = totalMilk > 0 ? totalAmount / totalMilk : 0;

  const now = new Date();
  const billDateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  const pageWidth = 58;
  const margin = 3;
  const lineGap = 4.6;
  const topMargin = 6;
  const bottomMargin = 6;

  const lineCount =
    1 + // company name
    (companyPhone ? 1 : 0) +
    1 + // divider
    1 + 1 + 1 + 1 + // Billed To label / customer name / period / date
    1 + // divider
    1 + 1 + (productsAmount > 0 ? 1 : 0) + // milk / rate / products
    1 + // divider
    1 + 1 + (previousDue > 0 ? 1 : 0) + // total amt / received / prev due
    1 + // divider
    1 + 1 + // BALANCE DUE label + amount
    1 + // divider
    1 + // due by
    1 + 1; // thank you / dairy diary

  const pageHeight = topMargin + lineCount * lineGap + bottomMargin;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidth, pageHeight] });
  const center = pageWidth / 2;
  let y = topMargin;
  const divider = '-'.repeat(30);

  doc.setTextColor(0, 0, 0);

  const centerText = (text: string, bold = false, size = 9) => {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, center, y, { align: 'center' });
    y += lineGap;
  };
  const row = (label: string, value: string, bold = false, size = 8) => {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(label, margin, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += lineGap;
  };
  const dividerLine = () => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.text(divider, center, y, { align: 'center' });
    y += lineGap;
  };

  centerText(companyName.toUpperCase(), true, 10);
  if (companyPhone) centerText(companyPhone, false, 8);
  dividerLine();

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('Billed To:', margin, y);
  y += lineGap;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.text(contact.name, margin, y);
  y += lineGap;
  row('Period:', periodTitle);
  row('Date:', billDateStr);
  dividerLine();

  row('Milk', `${totalMilk.toFixed(2)} L`);
  row('Rate', `${currSym}${avgRate.toFixed(1)}/L`);
  if (productsAmount > 0) {
    row('Products', `${currSym}${Math.round(productsAmount).toLocaleString()}`);
  }
  dividerLine();

  row('Total Amt', `${currSym}${Math.round(totalAmount).toLocaleString()}`, true);
  row('Received', `${currSym}${Math.round(totalReceived).toLocaleString()}`);
  if (previousDue > 0) {
    row('Prev. Due', `${currSym}${Math.round(previousDue).toLocaleString()}`);
  }
  dividerLine();

  centerText('BALANCE DUE', true, 8);
  centerText(`${currSym}${Math.round(totalOutstanding).toLocaleString()}`, true, 13);
  dividerLine();

  row('Due By:', dueDateStr);
  centerText('Thank you!', true, 8.5);
  centerText('Dairy Diary', false, 7);

  const pdfBlob = doc.output('blob');
  const filename = `Dairy_Diary_Receipt_${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  return { blob: pdfBlob, url: pdfUrl, filename, file: pdfFile, billDateStr, dueDateStr, isPremium: false };
}

// Dense A4 table reusing the same column layout/pagination approach already proven in
// generateSawaaPdfDocument's transaction ledger, but as a standalone compact document:
// a short header, straight into the table, a totals bar — no QR/signatures/payment
// accounts section, so more real data fits per page.
export async function generateLedgerSheetPdf(
  contact: Contact,
  entries: LedgerEntry[],
  periodTitle: string,
  businessSettings?: BusinessSettings,
  financials?: ReceiptFinancials
): Promise<GeneratedPdfResult> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const companyName = businessSettings?.businessName?.trim() || 'Dairy Farm';
  const currSym = businessSettings?.currencySymbol?.trim() || 'Rs';

  const totalMilk = financials?.totalMilk ?? entries.reduce((s, e) => s + e.liters, 0);
  const totalAmount = financials?.totalAmount ?? entries.reduce((s, e) => s + e.totalAmount, 0);
  const totalReceived = financials?.totalReceived ?? entries.reduce((s, e) => s + e.receivedAmount, 0);
  const periodDue = financials?.periodDue ?? (totalAmount - totalReceived);
  const previousDue = financials?.previousDue ?? 0;
  const totalOutstanding = financials?.totalOutstanding ?? (periodDue + previousDue);

  const now = new Date();
  const billDateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  const GREEN: [number, number, number] = [30, 86, 49];
  const RED: [number, number, number] = [185, 28, 28];

  let yPos = 12;

  doc.setFillColor(...GREEN);
  doc.rect(margin, yPos, contentWidth, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${companyName.toUpperCase()} - LEDGER STATEMENT`, margin + 3, yPos + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${contact.name}  |  ${periodTitle}  |  Generated ${billDateStr}`, margin + 3, yPos + 14.5);

  yPos += 24;

  const ledgerCols = [
    { title: 'Date', width: 22 },
    { title: 'Time', width: 20 },
    { title: 'Shift', width: 16 },
    { title: 'Type', width: 20 },
    { title: 'Qty', width: 22 },
    { title: 'Rate', width: 24 },
    { title: 'Total', width: 26 },
    { title: 'Due', width: 26 },
  ];
  const tableRowH = 6;

  const drawTableHeader = () => {
    doc.setFillColor(...GREEN);
    doc.rect(margin, yPos, contentWidth, tableRowH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let x = margin + 2;
    ledgerCols.forEach((c) => {
      doc.text(c.title, x, yPos + 4.2);
      x += c.width;
    });
    yPos += tableRowH;
  };

  drawTableHeader();

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp));

  if (sorted.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('No transactions recorded for this period.', margin + 3, yPos + 4.5);
    yPos += tableRowH;
  } else {
    sorted.forEach((e, idx) => {
      if (yPos + tableRowH > pageHeight - 20) {
        doc.addPage();
        yPos = 16;
        drawTableHeader();
      }
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 245, isEven ? 255 : 250, isEven ? 255 : 247);
      doc.rect(margin, yPos, contentWidth, tableRowH, 'F');
      doc.setDrawColor(230, 238, 233);
      doc.line(margin, yPos + tableRowH, margin + contentWidth, yPos + tableRowH);

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      let x = margin + 2;
      doc.text(e.date, x, yPos + 4.2);
      x += ledgerCols[0].width;
      doc.text(e.timestamp || '-', x, yPos + 4.2);
      x += ledgerCols[1].width;
      doc.text(e.shift.toUpperCase(), x, yPos + 4.2);
      x += ledgerCols[2].width;
      doc.text(entryCategoryLabel(e), x, yPos + 4.2);
      x += ledgerCols[3].width;
      doc.text(entryQuantityLabel(e), x, yPos + 4.2);
      x += ledgerCols[4].width;
      doc.text(`${currSym}${entryRateValue(e).toFixed(1)}`, x, yPos + 4.2);
      x += ledgerCols[5].width;
      doc.setFont('helvetica', 'bold');
      doc.text(`${currSym}${Math.round(e.totalAmount).toLocaleString()}`, x, yPos + 4.2);
      x += ledgerCols[6].width;
      doc.setTextColor(...RED);
      doc.text(`${currSym}${Math.round(e.dueAmount).toLocaleString()}`, x, yPos + 4.2);

      yPos += tableRowH;
    });
  }

  if (yPos + 10 > pageHeight - 20) {
    doc.addPage();
    yPos = 16;
  }
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.rect(margin, yPos, contentWidth, 8, 'FD');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TOTAL', margin + 2, yPos + 5.3);
  doc.text(`${totalMilk.toFixed(2)} L`, margin + ledgerCols.slice(0, 4).reduce((s, c) => s + c.width, 0) + 2, yPos + 5.3);
  doc.text(
    `${currSym}${Math.round(totalAmount).toLocaleString()}`,
    margin + ledgerCols.slice(0, 6).reduce((s, c) => s + c.width, 0) + 2,
    yPos + 5.3
  );
  doc.setTextColor(...RED);
  doc.text(
    `${currSym}${Math.round(periodDue).toLocaleString()}`,
    margin + ledgerCols.slice(0, 7).reduce((s, c) => s + c.width, 0) + 2,
    yPos + 5.3
  );
  yPos += 14;

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Received: ${currSym}${Math.round(totalReceived).toLocaleString()}`, margin, yPos);
  doc.text(`Prev. Due: ${currSym}${Math.round(previousDue).toLocaleString()}`, margin + 70, yPos);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(totalOutstanding > 0 ? RED : GREEN));
  doc.text(`Outstanding: ${currSym}${Math.round(totalOutstanding).toLocaleString()}`, margin + 140, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Payment due by ${dueDateStr}`, margin, yPos);

  const pdfBlob = doc.output('blob');
  const filename = `Dairy_Diary_Ledger_${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  return { blob: pdfBlob, url: pdfUrl, filename, file: pdfFile, billDateStr, dueDateStr, isPremium: false };
}

// Dispatcher — the only receipt-generating function other files should call. Picks
// the right generator based on the business's selected template, defaulting to the
// existing Modern statement (generateSawaaPdfDocument, untouched by this feature).
export async function generateReceiptPdf(
  contact: Contact,
  entries: LedgerEntry[],
  periodTitle: string,
  businessSettings?: BusinessSettings,
  financials?: ReceiptFinancials,
  isPremium: boolean = false,
  template: ReceiptPdfTemplate = 'modern'
): Promise<GeneratedPdfResult> {
  if (template === 'thermal') {
    return generateThermalReceiptPdf(contact, entries, periodTitle, businessSettings, financials);
  }
  if (template === 'ledger') {
    return generateLedgerSheetPdf(contact, entries, periodTitle, businessSettings, financials);
  }
  return generateSawaaPdfDocument(contact, entries, periodTitle, businessSettings, financials, isPremium);
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
