import { BusinessSettings } from '../types/dairy';
import { getActiveRegionConfig } from './regionalPaymentConfig';

export interface EnabledPaymentAccount {
  id: string;
  type: string;
  name: string;
  accountTitle: string;
  primaryDetail: string; // e.g. "Mobile: 03315183002" or "IBAN: PK36MEZN00010023456789"
  secondaryDetail?: string; // e.g. "Bank: Meezan Bank Ltd"
  qrCodeUrl?: string;
  qrLabel: string;
}

/**
 * Single source of truth for payment accounts enabled for customer-facing documents.
 * Evaluates `showOnPdf === true` directly from the active region configuration
 * and BusinessSettings state.
 */
export function getEnabledPaymentAccounts(settings?: BusinessSettings): EnabledPaymentAccount[] {
  if (!settings) return [];
  const list: EnabledPaymentAccount[] = [];

  const regionCfg = getActiveRegionConfig(settings.currency, settings.currencySymbol);
  const regionCode = regionCfg.code;
  const regionData = settings.savedRegionPayments?.[regionCode];

  // 1. If PKR region: check both legacy top-level properties and savedRegionPayments
  if (regionCode === 'PKR') {
    const epData = regionData?.easypaisa || settings.easypaisa;
    if (epData?.showOnPdf) {
      list.push({
        id: 'easypaisa',
        type: 'EasyPaisa',
        name: 'EasyPaisa',
        accountTitle: epData.accountTitle || settings.businessName || 'Authorized Distributor',
        primaryDetail: `Mobile: ${epData.mobileNumber || settings.phone || '03315183002'}`,
        qrCodeUrl: epData.qrCodeUrl,
        qrLabel: 'EasyPaisa QR',
      });
    }

    const jcData = regionData?.jazzcash || settings.jazzcash;
    if (jcData?.showOnPdf) {
      list.push({
        id: 'jazzcash',
        type: 'JazzCash',
        name: 'JazzCash',
        accountTitle: jcData.accountTitle || settings.businessName || 'Authorized Distributor',
        primaryDetail: `Mobile: ${jcData.mobileNumber || '03001234567'}`,
        qrCodeUrl: jcData.qrCodeUrl,
        qrLabel: 'JazzCash QR',
      });
    }

    const bankData = regionData?.bankTransfer || settings.bankTransfer;
    if (bankData?.showOnPdf) {
      list.push({
        id: 'bankTransfer',
        type: 'Bank Transfer',
        name: 'Bank Transfer',
        accountTitle: bankData.accountTitle || settings.businessName || 'Authorized Distributor',
        primaryDetail: `IBAN: ${bankData.iban || 'PK36MEZN00010023456789'}`,
        secondaryDetail: bankData.bankName ? `Bank: ${bankData.bankName}` : 'Bank: Meezan Bank Ltd',
        qrLabel: 'Bank QR',
      });
    }

    return list;
  }

  // 2. Non-PKR regions: evaluate enabled methods dynamically for the selected region
  for (const method of regionCfg.methods) {
    const methodData = regionData?.[method.id];
    if (methodData?.showOnPdf) {
      let primary = '';
      let secondary: string | undefined = undefined;

      if (method.id === 'upi') {
        primary = `UPI ID: ${methodData.upiId || ''}`;
      } else if (method.id === 'in_bank') {
        primary = `A/C: ${methodData.accountNumber || ''} (IFSC: ${methodData.ifsc || ''})`;
        if (methodData.bankName) secondary = `Bank: ${methodData.bankName}`;
      } else if (method.id === 'sepa') {
        primary = `IBAN: ${methodData.iban || ''}`;
        if (methodData.bic) secondary = `BIC/SWIFT: ${methodData.bic}`;
        if (methodData.bankName) secondary = secondary ? `${secondary} · ${methodData.bankName}` : `Bank: ${methodData.bankName}`;
      } else if (method.id === 'ach_bank') {
        primary = `A/C: ${methodData.accountNumber || ''} (Routing: ${methodData.routingNumber || ''})`;
        if (methodData.bankName) secondary = `Bank: ${methodData.bankName}`;
      } else if (method.id === 'faster_payments') {
        primary = `A/C: ${methodData.accountNumber || ''} (Sort Code: ${methodData.sortCode || ''})`;
        if (methodData.bankName) secondary = `Bank: ${methodData.bankName}`;
      } else if (methodData.iban) {
        primary = `IBAN: ${methodData.iban}`;
        if (methodData.bankName) secondary = `Bank: ${methodData.bankName}`;
      } else if (methodData.mobileNumber) {
        primary = `Mobile: ${methodData.mobileNumber}`;
      } else if (methodData.paypalEmail) {
        primary = `PayPal: ${methodData.paypalEmail}`;
      } else if (methodData.emailOrPhone) {
        primary = `Zelle: ${methodData.emailOrPhone}`;
      } else if (methodData.venmoHandle) {
        primary = `Venmo: ${methodData.venmoHandle}`;
      } else if (methodData.accountNumber) {
        primary = `A/C: ${methodData.accountNumber}`;
        if (methodData.bankName) secondary = `Bank: ${methodData.bankName}`;
      } else {
        primary = method.name;
      }

      list.push({
        id: method.id,
        type: method.name,
        name: method.name,
        accountTitle: methodData.accountTitle || settings.businessName || 'Authorized Distributor',
        primaryDetail: primary,
        secondaryDetail: secondary,
        qrCodeUrl: methodData.qrCodeUrl,
        qrLabel: `${method.name} QR`,
      });
    }
  }

  return list;
}
