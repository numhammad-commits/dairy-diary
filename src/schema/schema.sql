-- ============================================================================
-- DAIRY DIARY (MILK LEDGER) - PRODUCTION POSTGRESQL DDL SCHEMA
-- Target Market: Pakistan Dairy Sector
-- Units: Liters (NUMERIC(10,2)), Currency: PKR/Rs. (NUMERIC(12,2))
-- Timezone: Asia/Karachi (PKT, UTC+5)
-- Language & Terminology: Strictly Standard English
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ENUMS FOR BUSINESS LOGIC
-- ----------------------------------------------------------------------------
CREATE TYPE contact_role_enum AS ENUM ('seller', 'buyer', 'both');
CREATE TYPE shift_type_enum AS ENUM ('morning', 'evening');
CREATE TYPE milk_type_enum AS ENUM ('buffalo', 'cow', 'mix');
CREATE TYPE payment_mode_enum AS ENUM ('cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'credit');
CREATE TYPE expense_category_enum AS ENUM ('feed_wanda', 'transport', 'medicine', 'labor', 'chiller_electricity', 'other');

-- ----------------------------------------------------------------------------
-- 2. USERS TABLE (Dairy Farm / Milk Shop Operator)
-- ----------------------------------------------------------------------------
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
    morning_shift_time TIME DEFAULT '06:30:00',
    evening_shift_time TIME DEFAULT '17:30:00',
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. CONTACTS TABLE (Sellers / Farmers & Buyers / Customers)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. LEDGER ENTRIES TABLE (Daily Milk Shift Volume & Billings)
-- ----------------------------------------------------------------------------
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    shift shift_type_enum NOT NULL DEFAULT 'morning',
    milk_type milk_type_enum NOT NULL DEFAULT 'buffalo',
    
    -- Precise Decimal Liter measurement (e.g. 256.5 L, 10.25 L)
    liters NUMERIC(10,2) NOT NULL CHECK (liters >= 0),
    rate_per_liter NUMERIC(10,2) NOT NULL CHECK (rate_per_liter >= 0),
    
    -- Calculated Financials in PKR
    total_amount NUMERIC(12,2) GENERATED ALWAYS AS (liters * rate_per_liter) STORED,
    received_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (received_amount >= 0),
    due_amount NUMERIC(12,2) GENERATED ALWAYS AS ((liters * rate_per_liter) - received_amount) STORED,
    
    -- Quality Parameters (Optional Fat % and SNF)
    fat_percentage NUMERIC(4,2),
    snf_percentage NUMERIC(4,2),
    payment_mode payment_mode_enum DEFAULT 'credit',
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_entries_user_date ON ledger_entries(user_id, entry_date);
CREATE INDEX idx_ledger_entries_contact_date ON ledger_entries(contact_id, entry_date);
CREATE INDEX idx_ledger_entries_shift ON ledger_entries(shift);

-- ----------------------------------------------------------------------------
-- 5. TRANSACTIONS TABLE (Cash-in, Advance Payouts, Settlement Vouchers)
-- ----------------------------------------------------------------------------
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('payment_received', 'payout_given', 'advance_advance', 'adjustment')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_mode payment_mode_enum NOT NULL DEFAULT 'cash',
    reference_number VARCHAR(60),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_contact ON transactions(contact_id, transaction_date);

-- ----------------------------------------------------------------------------
-- 6. INVENTORY / MONTHLY SUMMARY TABLE (Aggregated Performance)
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_inventory_summary_user_month ON inventory_monthly_summary(user_id, month_year);

-- ----------------------------------------------------------------------------
-- 7. EXPENSES TABLE (Feed, Veterinary, Chiller Maintenance, Fuel)
-- ----------------------------------------------------------------------------
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL,
    title VARCHAR(120) NOT NULL,
    category expense_category_enum NOT NULL DEFAULT 'feed_wanda',
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    paid_to VARCHAR(100),
    payment_mode payment_mode_enum DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, expense_date);

-- ----------------------------------------------------------------------------
-- 8. TRIGGER: AUTO-UPDATE CONTACT LIFETIME DUE ON LEDGER INSERT/UPDATE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_contact_balances()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contacts
    SET total_lifetime_due = (
        COALESCE(opening_balance, 0) + 
        COALESCE((SELECT SUM(due_amount) FROM ledger_entries WHERE contact_id = NEW.contact_id), 0) -
        COALESCE((SELECT SUM(amount) FROM transactions WHERE contact_id = NEW.contact_id AND transaction_type = 'payment_received'), 0)
    ),
    last_activity_at = CURRENT_TIMESTAMP
    WHERE id = NEW.contact_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contact_balances
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION update_contact_balances();
