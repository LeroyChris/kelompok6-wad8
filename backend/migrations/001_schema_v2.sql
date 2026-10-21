-- ============================================================================
-- ArisanKita Database Schema v2 (Consolidated Baseline)
-- Termasuk modul:
--   1. Users & Identitas Auth (Email OTP)
--   2. In-App Wallet & Transaksi Ledger
--   3. Circles, Memberships & Invitations
--   4. Arisan Cycles, Participants, Obligations, Bids & Awards (SPSB & Draw)
--   5. Payment Orders, Proofs & Disbursements
--   6. Audit Events
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
    email VARCHAR(254),
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
        CHECK (provider IN ('EMAIL_OTP')),
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
        CHECK (tx_type IN ('INITIAL_BALANCE', 'TOPUP', 'DUES_PAYMENT', 'DISBURSEMENT')),
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
        CHECK (order_type IN ('CYCLE_CONTRIBUTION')),
    payment_method VARCHAR(25) NOT NULL
        CHECK (payment_method IN ('WALLET', 'MANUAL_TRANSFER')),
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    idempotency_key VARCHAR(100),
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

CREATE UNIQUE INDEX uq_payment_orders_idempotency
    ON payment_orders (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

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

CREATE TABLE disbursements (
    disbursement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL REFERENCES cycle_awards(award_id) ON DELETE RESTRICT,
    provider VARCHAR(50) DEFAULT 'IN_APP_WALLET',
    requested_amount NUMERIC(18, 2) NOT NULL CHECK (requested_amount > 0),
    platform_fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
    net_amount NUMERIC(18, 2) NOT NULL CHECK (net_amount > 0),
    disbursement_status VARCHAR(25) NOT NULL DEFAULT 'PAID'
        CHECK (disbursement_status IN ('REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (net_amount = requested_amount - platform_fee_amount),
    UNIQUE (award_id)
);

-- ----------------------------------------------------------------------------
-- 6. AUDIT EVENTS
-- ----------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION audit_event_hash(p_event_type TEXT, p_entity_id UUID, p_payload JSONB)
RETURNS TEXT
LANGUAGE sql
AS $$
    SELECT encode(digest(p_event_type || ':' || p_entity_id::text || ':' || p_payload::text || ':' || clock_timestamp()::text || ':' || random()::text, 'sha256'), 'hex');
$$;

-- Application transactions set app.actor_user_id before mutating audited rows.
CREATE OR REPLACE FUNCTION audit_actor_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.actor_user_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION trg_audit_circle_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSONB; payload_hash TEXT; event_hash TEXT;
BEGIN
    IF NEW.circle_status = 'LOCKED' AND OLD.circle_status IS DISTINCT FROM 'LOCKED' THEN
        payload := jsonb_build_object('previous_status', OLD.circle_status, 'circle_status', NEW.circle_status);
        payload_hash := encode(digest(payload::text, 'sha256'), 'hex');
        event_hash := audit_event_hash('CIRCLE_LOCKED', NEW.circle_id, payload);
        INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, payload_hash, event_hash)
        VALUES (audit_actor_user_id(), 'CIRCLE_LOCKED', 'CIRCLE', NEW.circle_id, payload_hash, event_hash);
    END IF;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION trg_audit_payment_proof_review()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSONB; payload_hash TEXT; event_hash TEXT;
BEGIN
    IF NEW.reviewed_at IS NOT NULL AND OLD.reviewed_at IS NULL THEN
        payload := jsonb_build_object('review_status', NEW.review_status, 'payment_order_id', NEW.payment_order_id);
        payload_hash := encode(digest(payload::text, 'sha256'), 'hex');
        event_hash := audit_event_hash('PAYMENT_PROOF_REVIEWED', NEW.payment_proof_id, payload);
        INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, payload_hash, event_hash)
        VALUES (NEW.reviewed_by_user_id, 'PAYMENT_PROOF_REVIEWED', 'PAYMENT_PROOF', NEW.payment_proof_id, payload_hash, event_hash);
    END IF;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION trg_audit_cycle_award()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSONB; payload_hash TEXT; event_hash TEXT;
BEGIN
    payload := jsonb_build_object('cycle_id', NEW.cycle_id, 'award_method', NEW.award_method, 'gross_amount', NEW.gross_amount, 'net_award_amount', NEW.net_award_amount);
    payload_hash := encode(digest(payload::text, 'sha256'), 'hex');
    event_hash := audit_event_hash('CYCLE_AWARD_RESOLVED', NEW.award_id, payload);
    INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, payload_hash, event_hash)
    VALUES (audit_actor_user_id(), 'CYCLE_AWARD_RESOLVED', 'CYCLE_AWARD', NEW.award_id, payload_hash, event_hash);
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION trg_audit_disbursement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSONB; payload_hash TEXT; event_hash TEXT;
BEGIN
    IF NEW.disbursement_status = 'PAID' THEN
        payload := jsonb_build_object('award_id', NEW.award_id, 'net_amount', NEW.net_amount, 'provider', NEW.provider);
        payload_hash := encode(digest(payload::text, 'sha256'), 'hex');
        event_hash := audit_event_hash('DISBURSEMENT_PAID', NEW.disbursement_id, payload);
        INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, payload_hash, event_hash)
        VALUES (audit_actor_user_id(), 'DISBURSEMENT_PAID', 'DISBURSEMENT', NEW.disbursement_id, payload_hash, event_hash);
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_circle_lock AFTER UPDATE OF circle_status ON circles FOR EACH ROW EXECUTE FUNCTION trg_audit_circle_lock();
CREATE TRIGGER trg_audit_payment_proof_review AFTER UPDATE ON payment_proofs FOR EACH ROW EXECUTE FUNCTION trg_audit_payment_proof_review();
CREATE TRIGGER trg_audit_cycle_award AFTER INSERT ON cycle_awards FOR EACH ROW EXECUTE FUNCTION trg_audit_cycle_award();
CREATE TRIGGER trg_audit_disbursement AFTER INSERT OR UPDATE OF disbursement_status ON disbursements FOR EACH ROW EXECUTE FUNCTION trg_audit_disbursement();

-- ----------------------------------------------------------------------------
-- 7. DRAW PROVENANCE & FINANCIAL INVARIANTS (core hardening)
-- ----------------------------------------------------------------------------

-- Preserve enough data to verify a completed random draw after the seed is
-- revealed, including the deterministic participant snapshot it was based on.
ALTER TABLE draw_results
    ADD COLUMN random_seed_reveal TEXT,
    ADD COLUMN participant_snapshot_hash VARCHAR(128),
    ADD COLUMN algorithm_version VARCHAR(50) NOT NULL DEFAULT 'SHA256_MOD_V1';

-- gross_amount is the paid cycle pot. A SPSB award retains both the penalty
-- and the amount actually credited to the winner.
ALTER TABLE cycle_awards
    ADD COLUMN penalty_amount NUMERIC(18, 2) NOT NULL DEFAULT 0
        CHECK (penalty_amount >= 0),
    ADD COLUMN net_award_amount NUMERIC(18, 2);

UPDATE cycle_awards
SET net_award_amount = gross_amount - penalty_amount
WHERE net_award_amount IS NULL;

ALTER TABLE cycle_awards
    ALTER COLUMN net_award_amount SET NOT NULL;

ALTER TABLE cycle_awards
    ADD CONSTRAINT chk_cycle_awards_net_amount
    CHECK (net_award_amount > 0 AND net_award_amount = gross_amount - penalty_amount);

-- Cursor pagination indexes.
CREATE INDEX idx_wallet_transactions_wallet_cursor
    ON wallet_transactions (wallet_id, created_at DESC, wallet_tx_id DESC);

CREATE INDEX idx_arisan_cycles_circle_cursor
    ON arisan_cycles (circle_id, created_at DESC, cycle_id DESC);

CREATE INDEX idx_circle_memberships_circle_cursor
    ON circle_memberships (circle_id, membership_status, joined_at ASC, circle_membership_id ASC);

CREATE INDEX idx_cycle_obligations_status_cursor
    ON cycle_obligations (obligation_status, created_at DESC, obligation_id DESC);

CREATE INDEX idx_payment_orders_status_cursor
    ON payment_orders (payment_status, created_at DESC, payment_order_id DESC);

-- Foreign keys alone cannot ensure that snapshots and awards belong to the
-- same cycle/circle. Keep those financial invariants in the database too.
CREATE OR REPLACE FUNCTION enforce_cycle_participant_membership_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM arisan_cycles ac
        JOIN circle_memberships cm ON cm.circle_id = ac.circle_id
        WHERE ac.cycle_id = NEW.cycle_id
          AND cm.circle_membership_id = NEW.circle_membership_id
    ) THEN
        RAISE EXCEPTION 'cycle participant membership must belong to the cycle circle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cycle_participant_membership_circle
BEFORE INSERT OR UPDATE OF cycle_id, circle_membership_id ON cycle_participants
FOR EACH ROW EXECUTE FUNCTION enforce_cycle_participant_membership_circle();

CREATE OR REPLACE FUNCTION enforce_cycle_award_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM cycle_participants cp
        WHERE cp.cycle_participant_id = NEW.cycle_participant_id
          AND cp.cycle_id = NEW.cycle_id
          AND cp.participation_status = 'ELIGIBLE'
    ) THEN
        RAISE EXCEPTION 'award participant must be eligible in the award cycle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cycle_award_participant
BEFORE INSERT OR UPDATE OF cycle_id, cycle_participant_id ON cycle_awards
FOR EACH ROW EXECUTE FUNCTION enforce_cycle_award_participant();
