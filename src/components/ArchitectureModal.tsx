import React, { useState } from 'react';
import { X, Copy, Check, Server, Database, Layers } from 'lucide-react';

interface ArchitectureModalProps {
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'schema'>('architecture');
  const [copied, setCopied] = useState(false);

  const postgresDDL = `-- ============================================================================
-- DAIRY DIARY (MILK LEDGER) - PRODUCTION POSTGRESQL DDL SCHEMA
-- Target Market: Pakistan Dairy Sector
-- Units: Liters (NUMERIC(10,2)), Currency: PKR/Rs. (NUMERIC(12,2))
-- Timezone: Asia/Karachi (PKT, UTC+5)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS FOR BUSINESS LOGIC
CREATE TYPE contact_role_enum AS ENUM ('seller', 'buyer', 'both');
CREATE TYPE shift_type_enum AS ENUM ('morning', 'evening');
CREATE TYPE milk_type_enum AS ENUM ('buffalo', 'cow', 'mix');
CREATE TYPE payment_mode_enum AS ENUM ('cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'credit');
CREATE TYPE expense_category_enum AS ENUM ('feed_wanda', 'transport', 'medicine', 'labor', 'chiller_electricity', 'other');

-- 2. USERS TABLE (Dairy Farm / Shop Operator)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(120) NOT NULL DEFAULT 'Al-Madina Milk Center',
    owner_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    city VARCHAR(60) DEFAULT 'Rawalpindi',
    province VARCHAR(60) DEFAULT 'Punjab',
    currency_code VARCHAR(10) DEFAULT 'PKR',
    currency_symbol VARCHAR(10) DEFAULT 'Rs.',
    default_buffalo_rate NUMERIC(10,2) DEFAULT 240.00,
    default_cow_rate NUMERIC(10,2) DEFAULT 200.00,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CONTACTS TABLE (Sellers / Farmers & Buyers / Customers)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    role contact_role_enum NOT NULL DEFAULT 'seller',
    phone VARCHAR(25),
    address TEXT,
    default_rate NUMERIC(10,2) NOT NULL DEFAULT 240.00,
    morning_quota_liters NUMERIC(10,2) DEFAULT 0.00,
    evening_quota_liters NUMERIC(10,2) DEFAULT 0.00,
    opening_balance NUMERIC(12,2) DEFAULT 0.00,
    current_month_due NUMERIC(12,2) DEFAULT 0.00,
    total_lifetime_due NUMERIC(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_user_role ON contacts(user_id, role);
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_due ON contacts(total_lifetime_due DESC);

-- 4. LEDGER ENTRIES TABLE (Daily Milk Shift Volume & Billings)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    shift shift_type_enum NOT NULL DEFAULT 'morning',
    milk_type milk_type_enum NOT NULL DEFAULT 'buffalo',
    liters NUMERIC(10,2) NOT NULL CHECK (liters >= 0),
    rate_per_liter NUMERIC(10,2) NOT NULL CHECK (rate_per_liter >= 0),
    total_amount NUMERIC(12,2) GENERATED ALWAYS AS (liters * rate_per_liter) STORED,
    received_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (received_amount >= 0),
    due_amount NUMERIC(12,2) GENERATED ALWAYS AS ((liters * rate_per_liter) - received_amount) STORED,
    fat_percentage NUMERIC(4,2),
    snf_percentage NUMERIC(4,2),
    payment_mode payment_mode_enum DEFAULT 'credit',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_entries_user_date ON ledger_entries(user_id, entry_date);
CREATE INDEX idx_ledger_entries_contact_date ON ledger_entries(contact_id, entry_date);

-- 5. TRANSACTIONS TABLE (Cash settlements & Advance payments)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('payment_received', 'payout_given', 'advance_advance')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_mode payment_mode_enum NOT NULL DEFAULT 'cash',
    reference_number VARCHAR(60),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. INVENTORY / MONTHLY SUMMARY TABLE (Pre-aggregated Metrics)
CREATE TABLE inventory_monthly_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- e.g. '2026-10'
    total_liters_bought NUMERIC(12,2) DEFAULT 0.00,
    total_liters_sold NUMERIC(12,2) DEFAULT 0.00,
    total_amount_billed NUMERIC(14,2) DEFAULT 0.00,
    total_amount_received NUMERIC(14,2) DEFAULT 0.00,
    total_month_due NUMERIC(14,2) DEFAULT 0.00,
    total_cumulative_outstanding NUMERIC(14,2) DEFAULT 0.00,
    active_sellers_count INT DEFAULT 0,
    active_buyers_count INT DEFAULT 0,
    last_recalculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, month_year)
);

-- 7. EXPENSES TABLE (Feed, Veterinary, Chiller Maintenance, Wages)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL,
    title VARCHAR(120) NOT NULL,
    category expense_category_enum NOT NULL DEFAULT 'feed_wanda',
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    paid_to VARCHAR(100),
    payment_mode payment_mode_enum DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(postgresDDL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#F4FBF7] rounded-2xl shadow-2xl overflow-hidden border border-[#D6E9E1] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006B52] to-[#1B4332] text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[#A9DFBF]" />
            <h3 className="font-bold text-sm tracking-tight text-white">Technical Blueprint &amp; System Architecture</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#E1F3EA] border-b border-[#D6E9E1] px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'border-[#0B8F68] text-[#163B32] bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Viewport Layout &amp; State Flow</span>
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'schema'
                ? 'border-[#0B8F68] text-[#163B32] bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-[#55756D] hover:text-[#163B32]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>2. PostgreSQL Production Schema DDL</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 text-xs bg-[#F4FBF7]">
          {activeTab === 'architecture' ? (
            <div className="space-y-4 text-[#55756D]">
              <div className="p-3.5 bg-white rounded-xl border border-[#D6E9E1] shadow-xs">
                <h4 className="font-bold text-[#163B32] text-sm mb-1">Viewport Containment &amp; Sticky Navigation</h4>
                <p className="text-[#55756D] leading-relaxed">
                  The mobile viewport is structured with a root <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">h-screen flex flex-col overflow-hidden</code> container. The top app bar (<code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">shrink-0</code>) and bottom navigation bar (<code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">shrink-0 sticky bottom-0</code>) are pinned to the viewport boundaries. Only the central record list has <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">flex-1 overflow-y-auto min-h-0</code>, ensuring the bottom menu is permanently visible on load without page-level scrolling.
                </p>
              </div>

              {/* Architecture Diagram Steps */}
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-xl border border-[#D6E9E1] shadow-xs">
                  <div className="flex items-center gap-2 text-[#163B32] font-bold mb-1">
                    <span className="w-5 h-5 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center text-[10px] font-black">1</span>
                    <span>Temporal Scoping: Month Navigation</span>
                  </div>
                  <p className="text-[#55756D] pl-7 text-[11px] leading-relaxed">
                    Selecting a month (e.g. <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">Oct 2026</code>) triggers the dynamic ledger metric engine. It computes total volume (256.5 L), billed amount (Rs 59,413), and month due (Rs 59,413), maintaining separation from the cumulative lifetime outstanding debt (Rs 209,313).
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#D6E9E1] shadow-xs">
                  <div className="flex items-center gap-2 text-[#163B32] font-bold mb-1">
                    <span className="w-5 h-5 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center text-[10px] font-black">2</span>
                    <span>Deterministic Filtering Pipeline</span>
                  </div>
                  <p className="text-[#55756D] pl-7 text-[11px] leading-relaxed">
                    Contacts flow through role filters (All / Buy Milk / Sell Milk), live text search (Name, Phone, Address), and sorting comparators (Latest Timestamp, Alphabetical, Highest Due, Lowest Due).
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#D6E9E1] shadow-xs">
                  <div className="flex items-center gap-2 text-[#163B32] font-bold mb-1">
                    <span className="w-5 h-5 rounded-full bg-[#E1F3EA] border border-[#D6E9E1] text-[#0B8F68] flex items-center justify-center text-[10px] font-black">3</span>
                    <span>Decimal Precision in Liters</span>
                  </div>
                  <p className="text-[#55756D] pl-7 text-[11px] leading-relaxed">
                    Milk measurements account for precise fractions (e.g. <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">35.5 L</code>, <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">256.5 L</code>). All internal representations use <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">NUMERIC(10,2)</code> to prevent floating-point calculation errors when computing <code className="text-[#0B8F68] bg-[#E1F3EA] px-1 py-0.5 rounded">Liters × Rate/L = Total PKR</code>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#55756D] font-medium">PostgreSQL 14+ DDL Script (src/schema/schema.sql)</span>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-[#0B8F68] hover:bg-[#087A58] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>

              <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto leading-relaxed max-h-96 border border-slate-800 shadow-inner">
                {postgresDDL}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-[#D6E9E1] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-emerald-50 text-[#55756D] hover:text-[#163B32] text-xs font-bold rounded-lg border border-[#D6E9E1] transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
