-- ==============================================================================
-- ArisanKita Database Schema (PostgreSQL / Supabase)
-- Spesifikasi BAB 5.3: 7 Tabel Utama
-- Copy dan Paste seluruh script ini ke SQL Editor di Supabase Dashboard
-- ==============================================================================

-- Enable UUID extension jika belum aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table Users
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    reputation_score INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table Circles
CREATE TABLE IF NOT EXISTS circles (
    circle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    circle_name VARCHAR(100) NOT NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    track_type VARCHAR(30) NOT NULL, -- 'TRACK_A' (Lelang SPSB) atau 'TRACK_B' (Spin Wheel)
    monthly_dues_amount DECIMAL(12,2) NOT NULL,
    max_members INT NOT NULL,
    circle_status VARCHAR(20) DEFAULT 'RECRUITING', -- RECRUITING, LOCKED, ACTIVE, COMPLETED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table Circle Members
CREATE TABLE IF NOT EXISTS circle_members (
    member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES circles(circle_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER', -- 'LEADER' atau 'MEMBER'
    has_won_arisan BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_circle_user UNIQUE (circle_id, user_id)
);

-- 4. Table Arisan Cycles
CREATE TABLE IF NOT EXISTS arisan_cycles (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES circles(circle_id) ON DELETE CASCADE,
    cycle_number INT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    winner_user_id UUID REFERENCES users(user_id),
    winning_bid_amount DECIMAL(12,2),
    actual_payable_amount DECIMAL(12,2),
    cycle_status VARCHAR(20) DEFAULT 'PENDING' -- PENDING, BIDDING_OPEN, BIDDING_CLOSED, PAYMENT_COLLECTION, DISBURSED, COMPLETED
);

-- 5. Table Bids (Lelang SPSB Track A)
CREATE TABLE IF NOT EXISTS bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES arisan_cycles(cycle_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    bid_amount DECIMAL(12,2) NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_cycle_user_bid UNIQUE (cycle_id, user_id)
);

-- 6. Table Internal Crowdfunding
CREATE TABLE IF NOT EXISTS crowdfunding_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES circles(circle_id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL,
    collected_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, FUNDED, CLOSED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Table Transactions
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    circle_id UUID REFERENCES circles(circle_id),
    transaction_type VARCHAR(30) NOT NULL, -- DUES_PAYMENT, DISBURSEMENT, CROWDFUNDING_CONTRIBUTION
    amount DECIMAL(12,2) NOT NULL,
    payment_gateway_ref VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    audit_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
