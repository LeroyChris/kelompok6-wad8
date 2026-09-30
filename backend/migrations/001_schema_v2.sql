-- ============================================================================
-- ArisanKita Database Schema v2 (Consolidated & Streamlined)
-- Termasuk modul:
--   1. Users & Identitas Auth
--   2. In-App Wallet & Transaksi Ledger
--   3. Circles, Memberships & Invitations
--   4. Arisan Cycles, Participants, Obligations, Bids & Awards (SPSB & Draw)
--   5. Payment Orders, Proofs & Disbursements
--   6. Extended modules (Crowdfunding, Loan, KYC, Risk, Reputation, Relief, Audit)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. USERS & AUTH
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    email VARCHAR(254),
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_users_phone
    ON users (phone_number)
    WHERE phone_number IS NOT NULL;

CREATE UNIQUE INDEX uq_users_email
    ON users (LOWER(email))
    WHERE email IS NOT NULL;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_auth_identities (
    identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL
        CHECK (provider IN ('PHONE_OTP', 'GOOGLE', 'PASSWORD')),
    provider_subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_subject)
);

CREATE INDEX idx_user_auth_identities_user ON user_auth_identities (user_id);

CREATE TABLE user_bank_accounts (
    bank_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL
        CHECK (account_type IN ('BANK', 'E_WALLET')),
    account_number_token VARCHAR(255) NOT NULL,
    account_number_masked VARCHAR(50) NOT NULL,
    account_name_from_provider VARCHAR(150),
    validation_status VARCHAR(20) NOT NULL DEFAULT 'MATCHED'
        CHECK (validation_status IN ('PENDING', 'MATCHED', 'MISMATCHED', 'FAILED')),
    authorization_type VARCHAR(25) NOT NULL DEFAULT 'SELF'
        CHECK (authorization_type IN ('SELF', 'FAMILY_AUTHORIZED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_bank_accounts_user ON user_bank_accounts (user_id, validation_status);

-- ----------------------------------------------------------------------------
-- 2. IN-APP WALLET & LEDGER
-- ----------------------------------------------------------------------------
CREATE TABLE user_wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 5000000.00 CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_user_wallets_updated_at
BEFORE UPDATE ON user_wallets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE wallet_transactions (
    wallet_tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES user_wallets(wallet_id) ON DELETE CASCADE,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    tx_type VARCHAR(30) NOT NULL
        CHECK (tx_type IN ('INITIAL_BALANCE', 'TOPUP', 'DUES_PAYMENT', 'DISBURSEMENT', 'WITHDRAWAL')),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions (wallet_id, created_at DESC);

-- Trigger: Otomatis buat wallet saat user baru terdaftar
CREATE OR REPLACE FUNCTION trg_fn_auto_create_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_wallet_id UUID;
BEGIN
    INSERT INTO user_wallets (user_id, balance)
    VALUES (NEW.user_id, 5000000.00)
    RETURNING wallet_id INTO new_wallet_id;

    INSERT INTO wallet_transactions (wallet_id, amount, tx_type, description)
    VALUES (new_wallet_id, 5000000.00, 'INITIAL_BALANCE', 'Saldo Awal Akun Demo');

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_user_insert_wallet
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION trg_fn_auto_create_user_wallet();

-- ----------------------------------------------------------------------------
-- 3. CIRCLES & MEMBERSHIPS
-- ----------------------------------------------------------------------------
CREATE TABLE circles (
    circle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_name VARCHAR(150) NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    circle_status VARCHAR(20) NOT NULL DEFAULT 'RECRUITING'
        CHECK (circle_status IN (
            'DRAFT', 'RECRUITING', 'LOCKED', 'RUNNING',
            'COMPLETED', 'CANCELLED', 'SUSPENDED', 'ARCHIVED'
        )),
    track_type VARCHAR(20) NOT NULL
        CHECK (track_type IN ('SPSB', 'RANDOM_DRAW')),
    contribution_amount NUMERIC(18, 2) NOT NULL
        CHECK (contribution_amount > 0),
    member_limit INTEGER NOT NULL
        CHECK (member_limit > 1),
    period_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'
        CHECK (period_type IN ('WEEKLY', 'MONTHLY')),
    bid_floor_percent NUMERIC(5, 2),
    bid_ceiling_percent NUMERIC(5, 2),
    partial_disbursement_threshold_percent NUMERIC(5, 2) NOT NULL DEFAULT 90.00
        CHECK (
            partial_disbursement_threshold_percent > 0
            AND partial_disbursement_threshold_percent <= 100
        ),
    kyc_threshold_amount NUMERIC(18, 2) NOT NULL DEFAULT 5000000
        CHECK (kyc_threshold_amount > 0),
    starts_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (
            track_type = 'SPSB'
            AND bid_floor_percent IS NOT NULL
            AND bid_ceiling_percent IS NOT NULL
            AND bid_floor_percent >= 1
            AND bid_ceiling_percent <= 25
            AND bid_floor_percent <= bid_ceiling_percent
        )
        OR (
            track_type = 'RANDOM_DRAW'
            AND bid_floor_percent IS NULL
            AND bid_ceiling_percent IS NULL
        )
    )
);

CREATE INDEX idx_circles_created_by ON circles (created_by_user_id);

CREATE TRIGGER trg_circles_updated_at
BEFORE UPDATE ON circles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE circle_memberships (
    circle_membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    membership_role VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
        CHECK (membership_role IN ('OWNER', 'ADMIN', 'MEMBER')),
    membership_status VARCHAR(25) NOT NULL DEFAULT 'PENDING'
        CHECK (membership_status IN (
            'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'LEFT', 'REMOVED'
        )),
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (membership_status = 'ACTIVE' AND joined_at IS NOT NULL)
        OR membership_status <> 'ACTIVE'
    ),
    CHECK (left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at),
    UNIQUE (circle_id, user_id)
);

CREATE INDEX idx_circle_memberships_user ON circle_memberships (user_id, membership_status);
CREATE INDEX idx_circle_memberships_circle ON circle_memberships (circle_id, membership_status);

CREATE TABLE circle_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    invited_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    invite_code VARCHAR(30) NOT NULL UNIQUE,
    invite_code_hash VARCHAR(128) NOT NULL,
    invitation_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (invitation_status IN ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_circle_invitations_code ON circle_invitations (invite_code, invitation_status);

-- ----------------------------------------------------------------------------
-- 4. CYCLES, PARTICIPANTS, OBLIGATIONS, BIDS & AWARDS
-- ----------------------------------------------------------------------------
CREATE TABLE arisan_cycles (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
    cycle_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (cycle_status IN (
            'PENDING', 'BIDDING_OPEN', 'BIDDING_CLOSED',
            'PAYMENT_COLLECTION', 'READY_FOR_DISBURSEMENT',
            'PARTIALLY_DISBURSED', 'DISBURSED', 'COMPLETED', 'CANCELLED'
        )),
    bidding_open_at TIMESTAMPTZ,
    bidding_close_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (circle_id, cycle_number)
);

CREATE INDEX idx_arisan_cycles_circle ON arisan_cycles (circle_id, cycle_status);

CREATE TABLE cycle_participants (
    cycle_participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES arisan_cycles(cycle_id) ON DELETE CASCADE,
    circle_membership_id UUID NOT NULL REFERENCES circle_memberships(circle_membership_id) ON DELETE RESTRICT,
    participation_status VARCHAR(20) NOT NULL DEFAULT 'ELIGIBLE'
        CHECK (participation_status IN ('ELIGIBLE', 'EXCLUDED', 'REPLACED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_id, circle_membership_id)
);

CREATE INDEX idx_cycle_participants_cycle ON cycle_participants (cycle_id, participation_status);

CREATE TABLE cycle_participant_substitutions (
    substitution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES arisan_cycles(cycle_id) ON DELETE CASCADE,
    original_cycle_participant_id UUID NOT NULL REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    replacement_cycle_participant_id UUID NOT NULL REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    approved_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_id, original_cycle_participant_id)
);

CREATE TABLE cycle_obligations (
    obligation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_participant_id UUID NOT NULL REFERENCES cycle_participants(cycle_participant_id) ON DELETE CASCADE,
    amount_due NUMERIC(18, 2) NOT NULL CHECK (amount_due > 0),
    due_at TIMESTAMPTZ NOT NULL,
    obligation_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (obligation_status IN (
            'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_participant_id)
);

CREATE INDEX idx_cycle_obligations_status ON cycle_obligations (obligation_status);

CREATE TABLE bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_participant_id UUID NOT NULL REFERENCES cycle_participants(cycle_participant_id) ON DELETE CASCADE,
    bid_rate_percent NUMERIC(5, 2) NOT NULL CHECK (bid_rate_percent >= 0 AND bid_rate_percent <= 100),
    bid_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (bid_status IN ('ACTIVE', 'WITHDRAWN', 'INVALID')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_participant_id)
);

CREATE TABLE cycle_awards (
    award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES arisan_cycles(cycle_id) ON DELETE CASCADE,
    cycle_participant_id UUID NOT NULL REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    award_method VARCHAR(20) NOT NULL
        CHECK (award_method IN ('SPSB', 'RANDOM_DRAW')),
    gross_amount NUMERIC(18, 2) NOT NULL CHECK (gross_amount > 0),
    winning_bid_rate_percent NUMERIC(5, 2) CHECK (winning_bid_rate_percent >= 0),
    payable_bid_rate_percent NUMERIC(5, 2) CHECK (payable_bid_rate_percent >= 0),
    decision_hash VARCHAR(128),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_id),
    CHECK (
        (award_method = 'SPSB' AND winning_bid_rate_percent IS NOT NULL AND payable_bid_rate_percent IS NOT NULL)
        OR (award_method = 'RANDOM_DRAW' AND winning_bid_rate_percent IS NULL AND payable_bid_rate_percent IS NULL)
    )
);

CREATE TABLE draw_results (
    draw_result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL UNIQUE REFERENCES cycle_awards(award_id) ON DELETE CASCADE,
    random_seed_commitment VARCHAR(128) NOT NULL,
    random_source VARCHAR(100) NOT NULL,
    participant_count INTEGER NOT NULL CHECK (participant_count > 0),
    drawn_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. PAYMENT ORDERS, PROOFS & DISBURSEMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE payment_orders (
    payment_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type VARCHAR(30) NOT NULL
        CHECK (order_type IN ('CYCLE_CONTRIBUTION', 'CAMPAIGN_CONTRIBUTION', 'LOAN_REPAYMENT')),
    payment_method VARCHAR(25) NOT NULL
        CHECK (payment_method IN ('WALLET', 'MANUAL_TRANSFER', 'GATEWAY', 'E_WALLET')),
    provider VARCHAR(50),
    provider_order_ref VARCHAR(150) UNIQUE,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    payment_status VARCHAR(25) NOT NULL DEFAULT 'CREATED'
        CHECK (payment_status IN (
            'CREATED', 'PENDING', 'PENDING_REVIEW', 'PAID',
            'FAILED', 'EXPIRED', 'REFUNDED', 'REJECTED'
        )),
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_payment_orders_updated_at
BEFORE UPDATE ON payment_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE obligation_payment_orders (
    payment_order_id UUID PRIMARY KEY REFERENCES payment_orders(payment_order_id) ON DELETE CASCADE,
    obligation_id UUID NOT NULL REFERENCES cycle_obligations(obligation_id) ON DELETE RESTRICT,
    UNIQUE (obligation_id, payment_order_id)
);

CREATE TABLE payment_proofs (
    payment_proof_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL UNIQUE REFERENCES payment_orders(payment_order_id) ON DELETE CASCADE,
    proof_url TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    review_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE payment_events (
    payment_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID REFERENCES payment_orders(payment_order_id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(200) NOT NULL,
    provider_order_ref VARCHAR(150),
    event_type VARCHAR(100) NOT NULL,
    payload_hash VARCHAR(128) NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'
        CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    UNIQUE (provider, provider_event_id)
);

CREATE TABLE disbursements (
    disbursement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL REFERENCES cycle_awards(award_id) ON DELETE RESTRICT,
    bank_account_id UUID REFERENCES user_bank_accounts(bank_account_id) ON DELETE SET NULL,
    provider VARCHAR(50) DEFAULT 'IN_APP_WALLET',
    provider_disbursement_ref VARCHAR(150) UNIQUE,
    requested_amount NUMERIC(18, 2) NOT NULL CHECK (requested_amount > 0),
    platform_fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
    net_amount NUMERIC(18, 2) NOT NULL CHECK (net_amount > 0),
    disbursement_status VARCHAR(25) NOT NULL DEFAULT 'PAID'
        CHECK (disbursement_status IN ('REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (net_amount = requested_amount - platform_fee_amount)
);

-- ----------------------------------------------------------------------------
-- 6. EXTENDED BUSINESS & AUDIT TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE crowdfunding_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE RESTRICT,
    creator_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    related_award_id UUID REFERENCES cycle_awards(award_id) ON DELETE RESTRICT,
    campaign_type VARCHAR(25) NOT NULL CHECK (campaign_type IN ('INTERNAL_LOAN', 'DONATION', 'SPONSORSHIP')),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    target_amount NUMERIC(18, 2) NOT NULL CHECK (target_amount > 0),
    campaign_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (campaign_status IN ('DRAFT', 'OPEN', 'TARGET_REACHED', 'CLOSED', 'CANCELLED', 'COMPLETED')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaign_contributions (
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES crowdfunding_campaigns(campaign_id) ON DELETE RESTRICT,
    contributor_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    contribution_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (contribution_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMPTZ
);

CREATE TABLE loan_agreements (
    loan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL UNIQUE REFERENCES crowdfunding_campaigns(campaign_id) ON DELETE RESTRICT,
    borrower_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    principal_amount NUMERIC(18, 2) NOT NULL CHECK (principal_amount > 0),
    service_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    loan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (loan_status IN ('PENDING', 'ACTIVE', 'PAID', 'OVERDUE', 'DEFAULTED', 'CANCELLED')),
    approved_at TIMESTAMPTZ,
    maturity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loan_repayment_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loan_agreements(loan_id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    due_at TIMESTAMPTZ NOT NULL,
    amount_due NUMERIC(18, 2) NOT NULL CHECK (amount_due > 0),
    schedule_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (schedule_status IN ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED')),
    UNIQUE (loan_id, installment_number)
);

CREATE TABLE loan_repayments (
    repayment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES loan_repayment_schedules(schedule_id) ON DELETE RESTRICT,
    amount_paid NUMERIC(18, 2) NOT NULL CHECK (amount_paid > 0),
    repayment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (repayment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kyc_verifications (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    verification_level VARCHAR(20) NOT NULL CHECK (verification_level IN ('BASIC', 'ADVANCED')),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED')),
    provider VARCHAR(80),
    provider_reference VARCHAR(200),
    document_storage_ref TEXT,
    name_match_status VARCHAR(20),
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE TABLE circle_kyc_reviews (
    circle_kyc_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    required_level VARCHAR(20) NOT NULL CHECK (required_level IN ('BASIC', 'ADVANCED')),
    triggered_amount NUMERIC(18, 2) NOT NULL CHECK (triggered_amount > 0),
    review_status VARCHAR(20) NOT NULL DEFAULT 'REQUIRED'
        CHECK (review_status IN ('REQUIRED', 'IN_PROGRESS', 'COMPLETED', 'WAIVED')),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    UNIQUE (circle_id, required_level)
);

CREATE TABLE risk_block_entries (
    risk_block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    block_type VARCHAR(25) NOT NULL CHECK (block_type IN ('USER', 'PHONE', 'BANK_ACCOUNT')),
    value_hash VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    block_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (block_status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    UNIQUE (block_type, value_hash)
);

CREATE TABLE reputation_events (
    reputation_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    score_delta INTEGER NOT NULL CHECK (score_delta BETWEEN -100 AND 100),
    event_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW v_user_reputation AS
SELECT
    u.user_id,
    u.full_name,
    100 + COALESCE(SUM(re.score_delta), 0)::INTEGER AS reputation_score
FROM users u
LEFT JOIN reputation_events re ON re.user_id = u.user_id
GROUP BY u.user_id, u.full_name;

CREATE TABLE obligation_relief_requests (
    relief_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obligation_id UUID NOT NULL REFERENCES cycle_obligations(obligation_id) ON DELETE CASCADE,
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    relief_type VARCHAR(25) NOT NULL CHECK (relief_type IN ('REDUCE_AMOUNT', 'EXTEND_DUE_DATE', 'WAIVE')),
    requested_amount_due NUMERIC(18, 2),
    requested_due_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    request_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_outbox (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(circle_id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL', 'IN_APP')),
    template_key VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (notification_status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    provider_message_ref VARCHAR(200),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_events (
    audit_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    payload_hash VARCHAR(128) NOT NULL,
    previous_event_hash VARCHAR(128),
    event_hash VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_events_entity ON audit_events (entity_type, entity_id, created_at);
