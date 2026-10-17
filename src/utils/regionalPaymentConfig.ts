/**
 * Regional Payment Methods & Currency Configuration
 * Provides region-appropriate payment methods, field labels, formatting guides,
 * and currency symbols for international support.
 */

export interface PaymentFieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'select';
  options?: string[];
  isMono?: boolean;
  helpText?: string;
  validate?: (val: string) => string | null; // Returns warning string if imperfect
}

export interface RegionalPaymentMethodDef {
  id: string;
  name: string;
  shortBadge: string;
  badgeBg: string;
  badgeText?: string;
  subtitle: string;
  hasQr: boolean;
  defaultEnabledPdf?: boolean;
  fields: PaymentFieldDef[];
}

export interface RegionConfig {
  code: string;
  country: string;
  currencyName: string;
  currencySymbol: string;
  flagEmoji: string;
  phoneFormatGuide?: string;
  methods: RegionalPaymentMethodDef[];
}

export const REGIONAL_CONFIGS: Record<string, RegionConfig> = {
  PKR: {
    code: 'PKR',
    country: 'Pakistan',
    currencyName: 'Pakistani Rupee',
    currencySymbol: 'Rs.',
    flagEmoji: '🇵🇰',
    phoneFormatGuide: 'e.g. 03315183002 or +92 301 5541290',
    methods: [
      {
        id: 'easypaisa',
        name: 'EasyPaisa Account',
        shortBadge: 'EP',
        badgeBg: 'bg-emerald-600',
        subtitle: 'Mobile wallet payment',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Account Title',
            placeholder: 'e.g. Hammad Nisar Satti',
          },
          {
            key: 'mobileNumber',
            label: 'EasyPaisa Mobile Number',
            placeholder: '03315183002',
            isMono: true,
            validate: (v) => {
              if (v && !/^(03\d{9}|\+923\d{9})$/.test(v.replace(/[\s-]/g, ''))) {
                return 'Expected 11-digit Pakistani mobile number (03XX-XXXXXXX)';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'jazzcash',
        name: 'JazzCash Account',
        shortBadge: 'JC',
        badgeBg: 'bg-rose-600',
        subtitle: 'Mobile wallet payment',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Account Title',
            placeholder: 'e.g. Hammad Nisar Satti',
          },
          {
            key: 'mobileNumber',
            label: 'JazzCash Mobile Number',
            placeholder: '03001234567',
            isMono: true,
            validate: (v) => {
              if (v && !/^(03\d{9}|\+923\d{9})$/.test(v.replace(/[\s-]/g, ''))) {
                return 'Expected 11-digit Pakistani mobile number (03XX-XXXXXXX)';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'bankTransfer',
        name: 'Bank Transfer / IBAN',
        shortBadge: 'BANK',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'Direct Pakistan bank account',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'Select Bank',
            type: 'select',
            options: [
              'Meezan Bank',
              'Habib Bank Limited (HBL)',
              'United Bank Limited (UBL)',
              'MCB Bank Limited',
              'Allied Bank Limited (ABL)',
              'Bank Alfalah',
              'Askari Bank',
              'Standard Chartered Pakistan',
              'Bank of Punjab (BOP)',
              'Faysal Bank',
              'National Bank of Pakistan (NBP)',
              'Soneri Bank',
              'JS Bank',
            ],
          },
          {
            key: 'accountTitle',
            label: 'Account Title',
            placeholder: 'e.g. Dairy Business Title',
          },
          {
            key: 'iban',
            label: 'Account Number / IBAN',
            placeholder: 'PK36MEZN00010023456789',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/[\s-]/g, '').toUpperCase();
              if (clean && clean.startsWith('PK') && clean.length !== 24) {
                return 'Pakistani IBAN should typically be 24 characters (e.g. PK36MEZN...)';
              }
              return null;
            },
          },
        ],
      },
    ],
  },

  INR: {
    code: 'INR',
    country: 'India',
    currencyName: 'Indian Rupee',
    currencySymbol: '₹',
    flagEmoji: '🇮🇳',
    phoneFormatGuide: 'e.g. 9876543210 (10 digits)',
    methods: [
      {
        id: 'upi',
        name: 'UPI / Google Pay / PhonePe',
        shortBadge: 'UPI',
        badgeBg: 'bg-emerald-600',
        subtitle: 'Instant UPI VPA transfer',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Account / Payee Name',
            placeholder: 'e.g. Ramesh Dairy Farm',
          },
          {
            key: 'upiId',
            label: 'UPI ID / VPA',
            placeholder: 'e.g. ramesh@okhdfcbank or 9876543210@paytm',
            isMono: true,
            validate: (v) => {
              if (v && !v.includes('@')) {
                return 'UPI ID typically contains "@" (e.g. username@bank)';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'paytm',
        name: 'Paytm Wallet',
        shortBadge: 'Paytm',
        badgeBg: 'bg-sky-600',
        subtitle: 'Paytm wallet & merchant number',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Paytm Account Title',
            placeholder: 'e.g. Ramesh Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'Paytm Mobile Number',
            placeholder: '9876543210',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/[\s-+]/g, '');
              if (clean && clean.length !== 10 && clean.length !== 12) {
                return 'Expected 10-digit Indian phone number';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'in_bank',
        name: 'Bank Transfer (NEFT/IMPS)',
        shortBadge: 'BANK',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'Direct Indian bank account (IFSC)',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'Select Bank',
            type: 'select',
            options: [
              'State Bank of India (SBI)',
              'HDFC Bank',
              'ICICI Bank',
              'Punjab National Bank (PNB)',
              'Bank of Baroda',
              'Axis Bank',
              'Kotak Mahindra Bank',
              'Canara Bank',
              'Union Bank of India',
              'Other Bank',
            ],
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Ramesh Kumar',
          },
          {
            key: 'accountNumber',
            label: 'Bank Account Number',
            placeholder: 'e.g. 10023456789',
            isMono: true,
          },
          {
            key: 'ifsc',
            label: 'IFSC Code',
            placeholder: 'e.g. SBIN0001234',
            isMono: true,
            validate: (v) => {
              const clean = v.trim().toUpperCase();
              if (clean && clean.length !== 11) {
                return 'Indian IFSC code must be exactly 11 characters (e.g. SBIN0001234)';
              }
              return null;
            },
          },
        ],
      },
    ],
  },

  BDT: {
    code: 'BDT',
    country: 'Bangladesh',
    currencyName: 'Bangladeshi Taka',
    currencySymbol: '৳',
    flagEmoji: '🇧🇩',
    phoneFormatGuide: 'e.g. 01712345678 (11 digits)',
    methods: [
      {
        id: 'bkash',
        name: 'bKash Personal / Merchant',
        shortBadge: 'bKash',
        badgeBg: 'bg-pink-600',
        subtitle: 'bKash mobile wallet',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'bKash Account Title',
            placeholder: 'e.g. Rafiq Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'bKash Mobile Number',
            placeholder: '01712345678',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/[\s-]/g, '');
              if (clean && !/^01[3-9]\d{8}$/.test(clean)) {
                return 'Expected 11-digit Bangladeshi mobile number starting with 01';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'nagad',
        name: 'Nagad Account',
        shortBadge: 'Nagad',
        badgeBg: 'bg-orange-600',
        subtitle: 'Nagad mobile financial service',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Nagad Account Title',
            placeholder: 'e.g. Rafiq Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'Nagad Mobile Number',
            placeholder: '01812345678',
            isMono: true,
          },
        ],
      },
      {
        id: 'rocket',
        name: 'Rocket (DBBL)',
        shortBadge: 'Rocket',
        badgeBg: 'bg-purple-600',
        subtitle: 'Dutch-Bangla Bank Rocket account',
        hasQr: false,
        fields: [
          {
            key: 'accountTitle',
            label: 'Rocket Account Title',
            placeholder: 'e.g. Rafiq Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'Rocket Account / Mobile (12 digits)',
            placeholder: '017123456789',
            isMono: true,
          },
        ],
      },
      {
        id: 'bd_bank',
        name: 'Bank Transfer',
        shortBadge: 'BANK',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'Direct Bangladesh bank account',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'Select Bank',
            type: 'select',
            options: [
              'Islami Bank Bangladesh',
              'Dutch-Bangla Bank (DBBL)',
              'BRAC Bank',
              'Sonali Bank',
              'Eastern Bank Ltd (EBL)',
              'City Bank',
              'Other Bank',
            ],
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Rafiqul Islam',
          },
          {
            key: 'accountNumber',
            label: 'Account Number',
            placeholder: 'e.g. 2050123456789',
            isMono: true,
          },
          {
            key: 'branchName',
            label: 'Branch Name / Routing',
            placeholder: 'e.g. Gulshan Branch',
          },
        ],
      },
    ],
  },

  NPR: {
    code: 'NPR',
    country: 'Nepal',
    currencyName: 'Nepalese Rupee',
    currencySymbol: '₨',
    flagEmoji: '🇳🇵',
    phoneFormatGuide: 'e.g. 9841234567 (10 digits)',
    methods: [
      {
        id: 'esewa',
        name: 'eSewa Digital Wallet',
        shortBadge: 'eSewa',
        badgeBg: 'bg-emerald-600',
        subtitle: 'eSewa mobile wallet & QR',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'eSewa Account Title',
            placeholder: 'e.g. Shrestha Dairy Farm',
          },
          {
            key: 'mobileNumber',
            label: 'eSewa ID / Mobile Number',
            placeholder: '9841234567',
            isMono: true,
          },
        ],
      },
      {
        id: 'khalti',
        name: 'Khalti Digital Wallet',
        shortBadge: 'Khalti',
        badgeBg: 'bg-indigo-600',
        subtitle: 'Khalti payment service',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Khalti Account Title',
            placeholder: 'e.g. Shrestha Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'Khalti Mobile Number',
            placeholder: '9801234567',
            isMono: true,
          },
        ],
      },
      {
        id: 'np_bank',
        name: 'Bank Transfer',
        shortBadge: 'BANK',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'Direct Nepal bank account',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'Select Bank',
            type: 'select',
            options: [
              'Nabil Bank',
              'NIC Asia Bank',
              'Global IME Bank',
              'Rastriya Banijya Bank',
              'Nepal Investment Mega Bank',
              'Standard Chartered Nepal',
              'Other Bank',
            ],
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Bikash Shrestha',
          },
          {
            key: 'accountNumber',
            label: 'Bank Account Number',
            placeholder: 'e.g. 01020304050607',
            isMono: true,
          },
        ],
      },
    ],
  },

  AED: {
    code: 'AED',
    country: 'UAE',
    currencyName: 'UAE Dirham',
    currencySymbol: 'د.إ',
    flagEmoji: '🇦🇪',
    phoneFormatGuide: 'e.g. 050 123 4567 (+971)',
    methods: [
      {
        id: 'apple_pay_ae',
        name: 'Apple Pay / Google Pay / Card',
        shortBadge: 'PAY',
        badgeBg: 'bg-slate-900',
        subtitle: 'Digital wallet / card collection',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Payee / Business Name',
            placeholder: 'e.g. Al-Ain Dairy Store',
          },
          {
            key: 'mobileNumber',
            label: 'Registered Mobile Number',
            placeholder: '+971 50 123 4567',
            isMono: true,
          },
        ],
      },
      {
        id: 'ae_bank',
        name: 'Bank Transfer (IBAN)',
        shortBadge: 'IBAN',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'UAE local bank account via IBAN',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'Select Bank',
            type: 'select',
            options: [
              'Emirates NBD',
              'Abu Dhabi Commercial Bank (ADCB)',
              'First Abu Dhabi Bank (FAB)',
              'Dubai Islamic Bank (DIB)',
              'Mashreq Bank',
              'Other Bank',
            ],
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Title',
            placeholder: 'e.g. Al-Ain Fresh Milk LLC',
          },
          {
            key: 'iban',
            label: 'UAE IBAN (23 characters)',
            placeholder: 'AE070331234567890123456',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/[\s-]/g, '').toUpperCase();
              if (clean && clean.startsWith('AE') && clean.length !== 23) {
                return 'UAE IBAN should be exactly 23 characters (e.g. AE...)';
              }
              return null;
            },
          },
        ],
      },
    ],
  },

  SAR: {
    code: 'SAR',
    country: 'Saudi Arabia',
    currencyName: 'Saudi Riyal',
    currencySymbol: 'SAR',
    flagEmoji: '🇸🇦',
    phoneFormatGuide: 'e.g. 050 123 4567 (+966)',
    methods: [
      {
        id: 'mada',
        name: 'Mada / Debit Card',
        shortBadge: 'mada',
        badgeBg: 'bg-emerald-700',
        subtitle: 'Mada national payment scheme',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Merchant / Account Title',
            placeholder: 'e.g. Al-Marai Fresh Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'Mobile / Mada ID',
            placeholder: '+966 50 123 4567',
            isMono: true,
          },
        ],
      },
      {
        id: 'stc_pay',
        name: 'STC Pay',
        shortBadge: 'stc',
        badgeBg: 'bg-purple-700',
        subtitle: 'STC Pay digital wallet',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'STC Pay Account Title',
            placeholder: 'e.g. Al-Qassim Dairy',
          },
          {
            key: 'mobileNumber',
            label: 'STC Pay Mobile Number',
            placeholder: '055 123 4567',
            isMono: true,
          },
        ],
      },
      {
        id: 'sa_bank',
        name: 'Bank Transfer (IBAN)',
        shortBadge: 'IBAN',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'Saudi local bank account via IBAN',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'Select Bank',
            type: 'select',
            options: [
              'Al Rajhi Bank',
              'Saudi National Bank (SNB / NCB)',
              'Riyad Bank',
              'Banque Saudi Fransi',
              'Alinma Bank',
              'Arab National Bank',
              'Other Bank',
            ],
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Al-Marai Dairy Farm',
          },
          {
            key: 'iban',
            label: 'Saudi IBAN (24 characters)',
            placeholder: 'SA0380000000608010167519',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/[\s-]/g, '').toUpperCase();
              if (clean && clean.startsWith('SA') && clean.length !== 24) {
                return 'Saudi IBAN should be exactly 24 characters (e.g. SA...)';
              }
              return null;
            },
          },
        ],
      },
    ],
  },

  EUR: {
    code: 'EUR',
    country: 'Europe',
    currencyName: 'Euro',
    currencySymbol: '€',
    flagEmoji: '🇪🇺',
    methods: [
      {
        id: 'sepa',
        name: 'SEPA Transfer (IBAN)',
        shortBadge: 'SEPA',
        badgeBg: 'bg-blue-700',
        subtitle: 'Single Euro Payments Area bank transfer',
        hasQr: false,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'e.g. Deutsche Bank, BNP Paribas, ING',
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Hans Müller Dairy Gmbh',
          },
          {
            key: 'iban',
            label: 'International Bank Account Number (IBAN)',
            placeholder: 'e.g. DE89 3704 0044 0532 0130 00',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/[\s-]/g, '');
              if (clean && (clean.length < 15 || clean.length > 34)) {
                return 'European IBAN is typically between 15 and 34 characters';
              }
              return null;
            },
          },
          {
            key: 'bic',
            label: 'BIC / SWIFT Code',
            placeholder: 'e.g. DEUTDEDBFXX',
            isMono: true,
            validate: (v) => {
              const clean = v.trim().toUpperCase();
              if (clean && clean.length !== 8 && clean.length !== 11) {
                return 'BIC/SWIFT code should be 8 or 11 characters';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'paypal_eu',
        name: 'PayPal',
        shortBadge: 'PP',
        badgeBg: 'bg-sky-700',
        subtitle: 'PayPal.me or business email',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'PayPal Account Title / Me Link',
            placeholder: 'e.g. paypal.me/HansDairy',
          },
          {
            key: 'paypalEmail',
            label: 'PayPal Email Address',
            placeholder: 'payments@hansdairy.de',
            isMono: true,
            validate: (v) => {
              if (v && !v.includes('@')) {
                return 'Expected valid email address';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'apple_pay_eu',
        name: 'Apple Pay / Google Pay',
        shortBadge: 'PAY',
        badgeBg: 'bg-slate-900',
        subtitle: 'Direct contactless / wallet collection',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Business / Payee Name',
            placeholder: 'e.g. Alpine Dairy Farm',
          },
          {
            key: 'mobileNumber',
            label: 'Registered Phone or ID',
            placeholder: '+49 151 23456789',
            isMono: true,
          },
        ],
      },
    ],
  },

  USD: {
    code: 'USD',
    country: 'United States',
    currencyName: 'US Dollar',
    currencySymbol: '$',
    flagEmoji: '🇺🇸',
    phoneFormatGuide: 'e.g. (555) 123-4567 (10 digits)',
    methods: [
      {
        id: 'zelle',
        name: 'Zelle',
        shortBadge: 'Zelle',
        badgeBg: 'bg-purple-600',
        subtitle: 'Instant US bank-to-bank transfer',
        hasQr: true,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Zelle Enrolled Name',
            placeholder: 'e.g. John Miller Dairy Farm',
          },
          {
            key: 'emailOrPhone',
            label: 'Zelle Email or US Phone Number',
            placeholder: 'e.g. billing@millerdairy.com or (555) 123-4567',
            isMono: true,
          },
        ],
      },
      {
        id: 'venmo',
        name: 'Venmo',
        shortBadge: 'Venmo',
        badgeBg: 'bg-sky-500',
        subtitle: 'Venmo @handle or phone number',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'Venmo Account Title',
            placeholder: 'e.g. John Miller Dairy',
          },
          {
            key: 'venmoHandle',
            label: 'Venmo Username (@handle)',
            placeholder: '@Miller-Dairy-Farm',
            isMono: true,
          },
        ],
      },
      {
        id: 'paypal_us',
        name: 'PayPal',
        shortBadge: 'PayPal',
        badgeBg: 'bg-blue-600',
        subtitle: 'PayPal business or personal account',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'PayPal Account Title',
            placeholder: 'e.g. Miller Dairy LLC',
          },
          {
            key: 'paypalEmail',
            label: 'PayPal Email Address',
            placeholder: 'payments@millerdairy.com',
            isMono: true,
          },
        ],
      },
      {
        id: 'ach_bank',
        name: 'Bank Transfer (ACH / Wire)',
        shortBadge: 'ACH',
        badgeBg: 'bg-[#1E5631]',
        subtitle: 'Direct US checking / savings account',
        hasQr: false,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'e.g. Chase Bank, Bank of America, Wells Fargo',
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Miller Dairy LLC',
          },
          {
            key: 'routingNumber',
            label: 'Routing Transit Number (ABA - 9 digits)',
            placeholder: 'e.g. 021000021',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/\D/g, '');
              if (clean && clean.length !== 9) {
                return 'US Routing number must be exactly 9 digits';
              }
              return null;
            },
          },
          {
            key: 'accountNumber',
            label: 'Account Number',
            placeholder: 'e.g. 123456789012',
            isMono: true,
          },
        ],
      },
    ],
  },

  GBP: {
    code: 'GBP',
    country: 'United Kingdom',
    currencyName: 'British Pound',
    currencySymbol: '£',
    flagEmoji: '🇬🇧',
    methods: [
      {
        id: 'faster_payments',
        name: 'Faster Payments (UK Bank)',
        shortBadge: 'FP',
        badgeBg: 'bg-teal-700',
        subtitle: 'Direct UK bank transfer (Sort Code)',
        hasQr: false,
        defaultEnabledPdf: true,
        fields: [
          {
            key: 'bankName',
            label: 'Bank Name',
            placeholder: 'e.g. Barclays, HSBC, Lloyds Bank, NatWest',
          },
          {
            key: 'accountTitle',
            label: 'Account Holder Name',
            placeholder: 'e.g. Arthur Smith Dairy Ltd',
          },
          {
            key: 'sortCode',
            label: 'Sort Code (6 digits)',
            placeholder: 'e.g. 20-00-00',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/\D/g, '');
              if (clean && clean.length !== 6) {
                return 'UK Sort Code must be 6 digits (e.g. 20-00-00)';
              }
              return null;
            },
          },
          {
            key: 'accountNumber',
            label: 'Account Number (8 digits)',
            placeholder: 'e.g. 12345678',
            isMono: true,
            validate: (v) => {
              const clean = v.replace(/\D/g, '');
              if (clean && clean.length !== 8) {
                return 'UK Account Number must be 8 digits';
              }
              return null;
            },
          },
        ],
      },
      {
        id: 'paypal_uk',
        name: 'PayPal',
        shortBadge: 'PP',
        badgeBg: 'bg-blue-600',
        subtitle: 'PayPal.me or business email',
        hasQr: true,
        fields: [
          {
            key: 'accountTitle',
            label: 'PayPal Account Title',
            placeholder: 'e.g. Smith Dairy Farm',
          },
          {
            key: 'paypalEmail',
            label: 'PayPal Email Address',
            placeholder: 'billing@smithdairy.co.uk',
            isMono: true,
          },
        ],
      },
    ],
  },
};

/**
 * Determine region code from currency string or currencySymbol.
 * Falls back to 'PKR' as default per WARNING 10.
 */
export function getRegionCodeFromSettings(currency?: string, currencySymbol?: string): string {
  if (!currency && !currencySymbol) return 'PKR';

  // Direct code match
  if (currency && REGIONAL_CONFIGS[currency.toUpperCase()]) {
    return currency.toUpperCase();
  }

  // Symbol or name match
  for (const [code, cfg] of Object.entries(REGIONAL_CONFIGS)) {
    if (cfg.currencySymbol === currencySymbol) return code;
    if (cfg.currencyName.toLowerCase() === currency?.toLowerCase()) return code;
    if (cfg.code.toLowerCase() === currency?.toLowerCase()) return code;
  }

  // Symbol fallback checks
  if (currencySymbol === '₹') return 'INR';
  if (currencySymbol === '৳') return 'BDT';
  if (currencySymbol === '₨') return 'NPR';
  if (currencySymbol === 'د.إ') return 'AED';
  if (currencySymbol === 'SAR') return 'SAR';
  if (currencySymbol === '€') return 'EUR';
  if (currencySymbol === '$') return 'USD';
  if (currencySymbol === '£') return 'GBP';
  if (currencySymbol === 'Rs.' || currencySymbol === 'Rs') return 'PKR';

  return 'PKR';
}

/**
 * Get active RegionConfig from BusinessSettings.
 */
export function getActiveRegionConfig(currency?: string, currencySymbol?: string): RegionConfig {
  const code = getRegionCodeFromSettings(currency, currencySymbol);
  return REGIONAL_CONFIGS[code] || REGIONAL_CONFIGS.PKR;
}
