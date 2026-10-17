import React from 'react';
import { SawaaLogo } from './SawaaLogo';

export interface ReceiptTemplateProps {
  businessName: string;
  businessPhone?: string;
  businessLocation?: string;
  logoUrl?: string;
  customerName: string;
  customerAddress?: string;
  periodTitle: string;
  totalMilk: number;
  avgRate: number;
  daysTaken: number;
  missedDaysLabel: string;
  totalAmount: number;
  totalReceived: number;
  totalOutstanding: number;
  currencySymbol?: string;
}

// Pure presentational receipt card, rendered off-screen and captured via html2canvas
// in CustomerShareReceiptModal.tsx. Real emoji (📞📍❤️) are used directly as text here
// (not drawn as shapes) since the browser's own font renders them in full color —
// html2canvas then captures exactly what's on screen, emoji included.
//
// IMPORTANT: every color here is set via inline `style`, not Tailwind color classNames.
// Tailwind CSS v4 (this project's version) generates its color utilities using the
// modern CSS `oklch()` color function, which html2canvas 1.4.x's CSS parser does not
// understand — any element using a Tailwind color class inside this subtree makes the
// whole capture throw ("Attempting to parse an unsupported color function oklch") and
// silently fall back to a text-only share. Non-color layout classes (flex, grid,
// spacing, rounding, font-size/weight) are unaffected and safe to keep as Tailwind.
export const ReceiptTemplate = React.forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  (
    {
      businessName,
      businessPhone,
      businessLocation,
      logoUrl,
      customerName,
      customerAddress,
      periodTitle,
      totalMilk,
      avgRate,
      daysTaken,
      missedDaysLabel,
      totalAmount,
      totalReceived,
      totalOutstanding,
      currencySymbol = 'Rs',
    },
    ref
  ) => {
    const isAllClear = totalOutstanding <= 0;
    const fmt = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString('en-PK')}`;

    const labelStyle: React.CSSProperties = {
      fontSize: '10px',
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      display: 'block',
    };
    const valueStyle: React.CSSProperties = {
      fontSize: '14px',
      fontWeight: 900,
      color: '#0f172a',
      display: 'block',
      marginTop: '2px',
    };

    return (
      <div
        ref={ref}
        style={{
          width: '390px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
        className="rounded-3xl overflow-hidden"
      >
        {/* 1. Header: app's dark green theme, real logo, business name, phone/address */}
        <div style={{ backgroundColor: '#006B52' }} className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              style={{ backgroundColor: '#ffffff' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <SawaaLogo variant="icon" size="md" theme="color" />
              )}
            </div>
            <h1
              style={{ color: '#ffffff', fontSize: '20px', lineHeight: 1.15 }}
              className="font-black tracking-tight flex-1 min-w-0 break-words"
            >
              {businessName.toUpperCase()}
            </h1>
          </div>

          <div className="mt-3 space-y-1">
            {businessPhone && (
              <div style={{ color: '#d1fae5', fontSize: '12px', fontWeight: 500 }} className="flex items-center gap-1.5">
                <span>📞</span>
                <span>{businessPhone}</span>
              </div>
            )}
            {businessLocation && (
              <div style={{ color: '#d1fae5', fontSize: '12px', fontWeight: 500 }} className="flex items-center gap-1.5">
                <span>📍</span>
                <span>{businessLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Billed To + period pill (green) */}
        <div style={{ backgroundColor: '#ffffff' }} className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span style={labelStyle}>Billed To</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }} className="block truncate">
              {customerName}
            </span>
            {customerAddress && (
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }} className="block">
                {customerAddress}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            <span
              style={{ backgroundColor: '#E1F3EA', color: '#0B8F68', fontSize: '10px', fontWeight: 700 }}
              className="inline-block px-2.5 py-1 rounded-full whitespace-nowrap"
            >
              STATEMENT
            </span>
            <span style={{ color: '#006B52', fontSize: '14px', fontWeight: 900, marginTop: '4px' }} className="block whitespace-nowrap">
              {periodTitle}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #e2e8f0', margin: '0 20px' }} />

        {/* 3. Details grid (2 columns) */}
        <div style={{ backgroundColor: '#ffffff' }} className="px-5 py-4 grid grid-cols-2 gap-y-4 gap-x-3">
          <div>
            <span style={labelStyle}>Total Milk</span>
            <span style={valueStyle}>{totalMilk.toFixed(2)} L</span>
          </div>
          <div>
            <span style={labelStyle}>Rate</span>
            <span style={valueStyle}>{currencySymbol}{avgRate.toFixed(0)} / L</span>
          </div>
          <div>
            <span style={labelStyle}>Days Taken</span>
            <span style={valueStyle}>{daysTaken} Day{daysTaken === 1 ? '' : 's'}</span>
          </div>
          <div>
            <span style={labelStyle}>Days Missed</span>
            <span style={valueStyle}>{missedDaysLabel}</span>
          </div>
          <div>
            <span style={labelStyle}>Total Amount</span>
            <span style={valueStyle}>{fmt(totalAmount)}</span>
          </div>
          <div>
            <span style={labelStyle}>Received</span>
            <span style={valueStyle}>{fmt(totalReceived)}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #e2e8f0', margin: '0 20px' }} />

        {/* 4. Total Bill box: light grey, green total text */}
        <div className="px-5 pt-4">
          <div
            style={{ backgroundColor: '#f1f5f9' }}
            className="rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span style={{ color: '#006B52', fontSize: '12px', fontWeight: 900 }} className="uppercase tracking-wide">
              Total Bill
            </span>
            <span style={{ color: '#006B52', fontSize: '20px', fontWeight: 900 }}>{fmt(totalAmount)}</span>
          </div>
        </div>

        {/* 5. Balance box: green if all clear, red if due */}
        <div className="px-5 pt-3 pb-5">
          <div
            style={{ backgroundColor: isAllClear ? '#E1F3EA' : '#fff1f2' }}
            className="rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span
              style={{ color: isAllClear ? '#0B8F68' : '#e11d48', fontSize: '12px', fontWeight: 900 }}
              className="uppercase tracking-wide"
            >
              {isAllClear ? 'Balance (All Clear)' : 'Balance Due'}
            </span>
            <span style={{ color: isAllClear ? '#0B8F68' : '#e11d48', fontSize: '16px', fontWeight: 900 }}>
              {fmt(totalOutstanding)}
            </span>
          </div>
        </div>

        {/* 6. Footer */}
        <div style={{ backgroundColor: '#ffffff' }} className="px-5 pb-6 text-center">
          <div style={{ fontSize: '20px', marginBottom: '4px' }}>❤️</div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Thank you for your business!</p>
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Have a wonderful day.</p>
          <p style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', marginTop: '10px' }}>
            Powered by Dairy Diary
          </p>
        </div>
      </div>
    );
  }
);

ReceiptTemplate.displayName = 'ReceiptTemplate';
