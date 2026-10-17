import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Contact, LedgerEntry, BusinessSettings } from '../types/dairy';
import { formatPKR } from './formatters';
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
  const companySubtitle = 'Fresh Milk Distribution & Dairy Management';
  const companyPhone = businessSettings?.phone?.trim() || '';
  const companyLocation = businessSettings?.location?.trim() || '';
  const companyTagline = 'Developed by SAWAA Networking';

  // Enabled Payment Accounts (Single Source of Truth based on showOnPdf)
  const enabledAccounts = getEnabledPaymentAccounts(businessSettings);
  const currSym = businessSettings?.currencySymbol?.trim() || 'Rs';

  // Financial Calculations (Single Source of Truth)
  const totalMilk = financials?.totalMilk ?? entries.reduce((s, e) => s + e.liters, 0);
  const totalAmount = financials?.totalAmount ?? entries.reduce((s, e) => s + e.totalAmount, 0);
  const totalReceived = financials?.totalReceived ?? entries.reduce((s, e) => s + e.receivedAmount, 0);
  const periodDue = financials?.periodDue ?? (totalAmount - totalReceived);
  const previousDue = financials?.previousDue ?? 0;
  const totalOutstanding = financials?.totalOutstanding ?? (periodDue + previousDue);

  // Dates: Bill Generated Today + 7 Days Payment Due
  const now = new Date();
  const billDateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  // Bill Number
  const billNum = `BILL-${contact.id.replace(/[^0-9]/g, '').padStart(3, '0')}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Helper for Free-tier subtle watermark
  const drawBackgroundWatermark = () => {
    if (!isPremium) {
      const centerX = pageWidth / 2;
      const centerY = pageHeight / 2 - 10;

      doc.setDrawColor(30, 86, 49);
      doc.setFillColor(242, 248, 244);
      doc.roundedRect(centerX - 42, centerY - 45, 84, 80, 16, 16, 'FD');

      doc.setTextColor(30, 86, 49);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('DAIRY DIARY', centerX, centerY, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('OFFICIAL STATEMENT · DEVELOPED BY SAWAA NETWORKING', centerX, centerY + 8, { align: 'center' });
      doc.text('UPGRADE TO PREMIUM TO REMOVE WATERMARK', centerX, centerY + 14, { align: 'center' });
    }
  };

  // Draw initial page watermark
  drawBackgroundWatermark();

  // =========================================================================
  // 1. TOP HEADER APP BAR (Deep Corporate Green #1E5631)
  // =========================================================================
  doc.setFillColor(30, 86, 49);
  doc.rect(margin, 12, contentWidth, 24, 'F');

  // BUSINESS BRAND LOGO (Uploaded from Settings with fallback to default emblem)
  const logoX = margin + 4;
  const logoY = 15;
  const logoBoxSize = 18;

  let isLogoRendered = false;
  if (businessSettings?.logoUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX, logoY, logoBoxSize, logoBoxSize, 3, 3, 'F');
      const imgFormat = businessSettings.logoUrl.startsWith('data:image/jpeg') || businessSettings.logoUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(businessSettings.logoUrl, imgFormat, logoX + 1, logoY + 1, logoBoxSize - 2, logoBoxSize - 2);
      isLogoRendered = true;
    } catch (err) {
      console.warn('Failed to render uploaded logo in PDF, using fallback emblem:', err);
      isLogoRendered = false;
    }
  }

  if (!isLogoRendered) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(logoX, logoY, 18, 18, 4, 4, 'F');

    // Default Fallback Emblem: Logo A (The Ledger Droplet)
    doc.setFillColor(27, 67, 50);
    doc.circle(logoX + 8, logoY + 10, 5, 'F');
    doc.setFillColor(45, 106, 79);
    doc.circle(logoX + 10.5, logoY + 9, 4, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(logoX + 9, logoY + 9.5, 2.5, 'F');
    doc.setFillColor(245, 158, 11);
    doc.circle(logoX + 9.5, logoY + 12, 1.2, 'F');
  }

  // Header Business Information
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), logoX + 22, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(companySubtitle, logoX + 22, 26);

  doc.setFontSize(7.5);
  doc.setTextColor(167, 243, 208);
  doc.text(companyTagline, logoX + 22, 31);

  // Right side of Header: Phone, Location, Premium/Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  if (companyPhone) {
    doc.text(`Phone: ${companyPhone}`, pageWidth - margin - 5, 20, { align: 'right' });
  }
  if (companyLocation) {
    doc.text(companyLocation, pageWidth - margin - 5, 25, { align: 'right' });
  }

  if (isPremium) {
    doc.setTextColor(253, 230, 138);
    doc.setFont('helvetica', 'bold');
    doc.text(`★ PREMIUM ACCOUNT · ${billDateStr}`, pageWidth - margin - 5, 30, { align: 'right' });
  } else {
    doc.setTextColor(255, 255, 255);
    doc.text(`Date: ${billDateStr}`, pageWidth - margin - 5, 30, { align: 'right' });
  }

  // =========================================================================
  // 2. MAIN DOCUMENT TITLE: "MONTHLY FRESH MILK BILL" (Section 7)
  // =========================================================================
  let yPos = 41;

  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MONTHLY FRESH MILK BILL', margin, yPos);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${periodTitle}`, pageWidth - margin, yPos, { align: 'right' });

  yPos += 5;

  // =========================================================================
  // 3. CUSTOMER INFORMATION & BILLING INFORMATION BOXES (Section 7)
  // =========================================================================
  const infoBoxWidth = (contentWidth - 4) / 2;
  const infoBoxH = 21;

  // Left: Customer Information
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(220, 230, 224);
  doc.roundedRect(margin, yPos, infoBoxWidth, infoBoxH, 2, 2, 'FD');

  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CUSTOMER INFORMATION', margin + 4, yPos + 4.5);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(contact.name, margin + 4, yPos + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${contact.phone || 'N/A'}`, margin + 4, yPos + 14);
  doc.text(`Address: ${contact.address || 'Local Distribution Area'}`, margin + 4, yPos + 18.5);

  // Right: Billing Information
  const rightBoxX = margin + infoBoxWidth + 4;
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(220, 230, 224);
  doc.roundedRect(rightBoxX, yPos, infoBoxWidth, infoBoxH, 2, 2, 'FD');

  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BILLING INFORMATION', rightBoxX + 4, yPos + 4.5);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bill Number:`, rightBoxX + 4, yPos + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(billNum, rightBoxX + infoBoxWidth - 4, yPos + 9.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Bill Date:`, rightBoxX + 4, yPos + 14);
  doc.text(billDateStr, rightBoxX + infoBoxWidth - 4, yPos + 14, { align: 'right' });

  doc.text(`Payment Due By:`, rightBoxX + 4, yPos + 18.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(dueDateStr, rightBoxX + infoBoxWidth - 4, yPos + 18.5, { align: 'right' });

  yPos += infoBoxH + 4;

  // =========================================================================
  // 4. MONTHLY SUMMARY BOXES (Section 8)
  // 4 Prominent Summary Boxes: TOTAL MILK, TOTAL AMOUNT, TOTAL RECEIVED, REMAINING DUE
  // =========================================================================
  const sumBoxW = (contentWidth - 9) / 4;
  const sumBoxH = 17;

  // Box 1: TOTAL MILK
  doc.setFillColor(241, 248, 243);
  doc.setDrawColor(180, 215, 195);
  doc.roundedRect(margin, yPos, sumBoxW, sumBoxH, 2, 2, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('TOTAL MILK', margin + sumBoxW / 2, yPos + 5.5, { align: 'center' });
  doc.setTextColor(30, 86, 49);
  doc.setFontSize(10.5);
  doc.text(`${totalMilk.toFixed(2)} L`, margin + sumBoxW / 2, yPos + 12.5, { align: 'center' });

  // Box 2: TOTAL AMOUNT
  const s2X = margin + sumBoxW + 3;
  doc.setFillColor(241, 248, 243);
  doc.roundedRect(s2X, yPos, sumBoxW, sumBoxH, 2, 2, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.text('TOTAL AMOUNT', s2X + sumBoxW / 2, yPos + 5.5, { align: 'center' });
  doc.setTextColor(30, 86, 49);
  doc.setFontSize(10.5);
  doc.text(`${currSym} ${Math.round(totalAmount).toLocaleString()}`, s2X + sumBoxW / 2, yPos + 12.5, { align: 'center' });

  // Box 3: TOTAL RECEIVED
  const s3X = s2X + sumBoxW + 3;
  doc.setFillColor(241, 248, 243);
  doc.roundedRect(s3X, yPos, sumBoxW, sumBoxH, 2, 2, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.text('TOTAL RECEIVED', s3X + sumBoxW / 2, yPos + 5.5, { align: 'center' });
  doc.setTextColor(15, 118, 110);
  doc.setFontSize(10.5);
  doc.text(`${currSym} ${Math.round(totalReceived).toLocaleString()}`, s3X + sumBoxW / 2, yPos + 12.5, { align: 'center' });

  // Box 4: REMAINING DUE (Period Due)
  const s4X = s3X + sumBoxW + 3;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(s4X, yPos, sumBoxW, sumBoxH, 2, 2, 'FD');
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(7);
  doc.text('REMAINING DUE', s4X + sumBoxW / 2, yPos + 5.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(`${currSym} ${Math.round(periodDue).toLocaleString()}`, s4X + sumBoxW / 2, yPos + 12.5, { align: 'center' });

  yPos += sumBoxH + 4;

  // Prominently Highlighted Outstanding Balance Banner (Section 10)
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'FD');

  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`PREVIOUS CARRYOVER BALANCE: ${currSym} ${previousDue.toLocaleString()}   |   ACTIVE BILL: ${currSym} ${Math.round(totalAmount).toLocaleString()}`, margin + 4, yPos + 4.2);

  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text(`TOTAL PAYABLE OUTSTANDING: ${currSym} ${Math.round(totalOutstanding).toLocaleString()}`, margin + 4, yPos + 8.2);

  yPos += 14;

  // =========================================================================
  // 5. TRANSACTION LEDGER TABLE (Section 9)
  // Clean table columns: Date, Shift, Milk Category, Liters, Rate, Total, Received, Due
  // =========================================================================
  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`TRANSACTION LEDGER DETAILS`, margin, yPos);

  yPos += 3.5;

  const cols = [
    { title: 'Date', width: 22, align: 'left' },
    { title: 'Time', width: 17, align: 'left' },
    { title: 'Shift', width: 20, align: 'left' },
    { title: 'Category', width: 25, align: 'left' },
    { title: 'Quantity', width: 22, align: 'right' },
    { title: `Rate (${currSym})`, width: 24, align: 'right' },
    { title: `Total (${currSym})`, width: 26, align: 'right' },
    { title: `Due (${currSym})`, width: 26, align: 'right' },
  ];

  // Helper to draw Table Header
  const drawTableHeader = (topY: number) => {
    doc.setFillColor(30, 86, 49);
    doc.rect(margin, topY, contentWidth, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    let curX = margin + 2;
    cols.forEach((c) => {
      if (c.align === 'right') {
        doc.text(c.title, curX + c.width - 4, topY + 4.5, { align: 'right' });
      } else {
        doc.text(c.title, curX, topY + 4.5);
      }
      curX += c.width;
    });
  };

  drawTableHeader(yPos);
  yPos += 6.5;

  // Render Table Rows (Section 9 & 17 Multi-page Behavior)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  entries.forEach((entry, idx) => {
    // Check if we need page break (Section 17)
    if (yPos > pageHeight - 55) {
      doc.addPage();
      drawBackgroundWatermark();
      yPos = 16;
      drawTableHeader(yPos);
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
    // Date
    doc.text(entry.date, curX, yPos + 3.8);
    curX += cols[0].width;

    // Time
    doc.text(entry.timestamp || '-', curX, yPos + 3.8);
    curX += cols[1].width;

    // Shift
    doc.text(entry.shift.toUpperCase(), curX, yPos + 3.8);
    curX += cols[2].width;

    // Category
    doc.text((entry.milkType || 'Buffalo').toUpperCase(), curX, yPos + 3.8);
    curX += cols[3].width;

    // Quantity (L)
    doc.setFont('helvetica', 'bold');
    doc.text(`${entry.liters.toFixed(2)} L`, curX + cols[4].width - 4, yPos + 3.8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    curX += cols[4].width;

    // Rate
    doc.text(`${currSym} ${entry.ratePerLiter.toFixed(2)}`, curX + cols[5].width - 4, yPos + 3.8, { align: 'right' });
    curX += cols[5].width;

    // Total Amount
    doc.setFont('helvetica', 'bold');
    doc.text(`${currSym} ${Math.round(entry.totalAmount).toLocaleString()}`, curX + cols[6].width - 4, yPos + 3.8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    curX += cols[6].width;

    // Due Amount
    doc.text(`${currSym} ${Math.round(entry.dueAmount).toLocaleString()}`, curX + cols[7].width - 4, yPos + 3.8, { align: 'right' });

    yPos += 5.5;
  });

  // Table Period Summary Row
  doc.setFillColor(235, 245, 238);
  doc.rect(margin, yPos, contentWidth, 6.5, 'F');
  doc.setDrawColor(180, 215, 195);
  doc.rect(margin, yPos, contentWidth, 6.5, 'S');

  doc.setTextColor(30, 86, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('TOTAL PERIOD TRANSACTIONS', margin + 3, yPos + 4.5);

  const litColX = margin + cols[0].width + cols[1].width + cols[2].width + cols[3].width;
  doc.text(`${totalMilk.toFixed(2)} L`, litColX + cols[4].width - 4, yPos + 4.5, { align: 'right' });

  const amtColX = litColX + cols[4].width + cols[5].width;
  doc.text(`${currSym} ${Math.round(totalAmount).toLocaleString()}`, amtColX + cols[6].width - 4, yPos + 4.5, { align: 'right' });

  const dueColX = amtColX + cols[6].width;
  doc.text(`${currSym} ${Math.round(periodDue).toLocaleString()}`, dueColX + cols[7].width - 4, yPos + 4.5, { align: 'right' });

  yPos += 11;

  // Check if we need room for Payment, Terms & Signature
  if (yPos > pageHeight - 55) {
    doc.addPage();
    drawBackgroundWatermark();
    yPos = 16;
  }

  // =========================================================================
  // 6. PAYMENT SECTION & QR CODE (Sections 11, 12, 13)
  // Separate payment details from calculations, strictly showing ONLY enabled accounts
  // =========================================================================
  if (enabledAccounts.length === 0) {
    const boxH = 13;
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(220, 230, 224);
    doc.roundedRect(margin, yPos, contentWidth, boxH, 2, 2, 'FD');

    doc.setTextColor(30, 86, 49);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PAYMENT DETAILS', margin + 4, yPos + 5);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text('No payment account has been enabled for this business.', margin + 4, yPos + 9.5);

    yPos += boxH + 4;
  } else {
    const boxH = Math.max(30, 11 + enabledAccounts.length * 5);
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(220, 230, 224);
    doc.roundedRect(margin, yPos, contentWidth, boxH, 2, 2, 'FD');

    // Title
    doc.setTextColor(30, 86, 49);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PAYMENT DETAILS', margin + 4, yPos + 5.5);

    // List ONLY Enabled Accounts (Section 12)
    let accY = yPos + 10.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    enabledAccounts.forEach((acc) => {
      let lineText = '';
      if (acc.id === 'bank_transfer') {
        lineText = `${acc.name}: ${acc.secondaryDetail || ''}  |  Title: ${acc.accountTitle}  |  IBAN/Acc: ${acc.primaryDetail}`;
      } else {
        lineText = `${acc.name}: Title: ${acc.accountTitle}  |  Acc/Mobile: ${acc.primaryDetail}`;
      }
      doc.text(lineText, margin + 4, accY);
      accY += 5;
    });

    // Real QR Code on right side (Section 13) - High Clarity, Non-overlapping Layout
    const primaryAcc = enabledAccounts[0];
    const qrBoxW = 32;
    const qrBoxH = boxH - 4;
    const qrBoxX = pageWidth - margin - qrBoxW - 2;
    const qrBoxY = yPos + 2;

    let qrImageDataUrl: string | undefined = primaryAcc.qrCodeUrl;

    if (!qrImageDataUrl && primaryAcc.primaryDetail) {
      try {
        qrImageDataUrl = await QRCode.toDataURL(
          `${primaryAcc.name}: ${primaryAcc.primaryDetail} (Title: ${primaryAcc.accountTitle})`,
          {
            margin: 4,
            width: 256,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
          }
        );
      } catch (err) {
        console.warn('QR generation warning:', err);
      }
    }

    if (qrImageDataUrl) {
      // Clean white high-contrast card background with subtle green border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(180, 215, 195);
      doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 2, 2, 'FD');

      // 1. Text Label strictly positioned ABOVE the QR code (no overlap)
      doc.setTextColor(30, 86, 49);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      const qrLabel = primaryAcc.name ? `SCAN TO PAY (${primaryAcc.name.toUpperCase()})` : 'SCAN TO PAY';
      doc.text(qrLabel, qrBoxX + qrBoxW / 2, qrBoxY + 4, { align: 'center' });

      // 2. High-contrast QR code image cleanly placed below the label with quiet zone
      const qrSize = Math.min(qrBoxW - 6, qrBoxH - 6.5);
      const qrImgX = qrBoxX + (qrBoxW - qrSize) / 2;
      const qrImgY = qrBoxY + 5;

      try {
        doc.addImage(qrImageDataUrl, 'PNG', qrImgX, qrImgY, qrSize, qrSize);
      } catch (e) {
        // Image embedding fallback
      }
    }

    yPos += boxH + 3.5;
  }

  // =========================================================================
  // 7. 7-DAY PAYMENT DEADLINE NOTICE (Section 14)
  // =========================================================================
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, yPos, contentWidth, 9.5, 2, 2, 'FD');

  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PAYMENT NOTICE: After the bill is generated, the customer has 7 days to pay the outstanding dues.', margin + 4, yPos + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Bill Generated Date: ${billDateStr}   |   Payment Due Date: ${dueDateStr} (Strict 7-Day Window)`, margin + 4, yPos + 7.5);

  yPos += 14;

  // =========================================================================
  // 8. SIGNATURES AREA (Section 15)
  // =========================================================================
  const sigLineY = yPos + 7;
  const sigWidth = 52;

  // Left: Authorized Signature
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin + 4, sigLineY, margin + 4 + sigWidth, sigLineY);
  doc.setLineDashPattern([], 0);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Authorized Signature', margin + 4 + sigWidth / 2, sigLineY + 3.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(companyName, margin + 4 + sigWidth / 2, sigLineY + 7, { align: 'center' });

  // Right: Customer Signature
  const custSigX = pageWidth - margin - sigWidth - 4;
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(custSigX, sigLineY, custSigX + sigWidth, sigLineY);
  doc.setLineDashPattern([], 0);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Customer Signature', custSigX + sigWidth / 2, sigLineY + 3.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(contact.name, custSigX + sigWidth / 2, sigLineY + 7, { align: 'center' });

  // =========================================================================
  // 9. FOOTER (Section 18 & 22)
  // Official branding: "Dairy Diary · Developed by SAWAA Networking"
  // =========================================================================
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `${companyName} — Fresh Milk Distribution  ·  Generated by Dairy Diary  ·  Developed by SAWAA Networking`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );

  // Return generated result
  const pdfBlob = doc.output('blob');
  const filename = `Dairy_Diary_Monthly_Bill_${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}_${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
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
