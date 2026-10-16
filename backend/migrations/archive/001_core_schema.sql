-- ArisanKita - Core MVP PostgreSQL schema
-- Scope:
--   - users and authentication identities
--   - circles and memberships
--   - one active arisan program per circle
--   - cycles, obligations, SPSB bids, random draws
--   - payment orders, gateway events, manual payment proofs
--   - partial disbursement and audit events
--
-- The final installer loads 003_extended_schema.sql after this core layer.
-- Deliberately excluded from this core layer:
--   - crowdfunding/loan repayment
--   - automated KYC provider integration
--   - reputation scoring rules
--
-- Money is NUMERIC, timestamps are TIMESTAMPTZ, and derived totals are
-- intentionally calculated from source rows rather than stored redundantly.

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
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL
        CHECK (provider IN ('PHONE_OTP', 'GOOGLE')),
    provider_subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_subject)
);

CREATE INDEX idx_user_auth_identities_user
    ON user_auth_identities (user_id);

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

CREATE INDEX idx_circles_created_by
    ON circles (created_by_user_id);

CREATE TRIGGER trg_circles_updated_at
BEFORE UPDATE ON circles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE circle_memberships (
    circle_membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE RESTRICT,
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

CREATE INDEX idx_circle_memberships_user
    ON circle_memberships (user_id, membership_status);

CREATE INDEX idx_circle_memberships_circle_status
    ON circle_memberships (circle_id, membership_status);

CREATE TABLE circle_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE RESTRICT,
    invited_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    invite_code_hash VARCHAR(128) NOT NULL UNIQUE,
    invitation_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (invitation_status IN ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (invitation_status = 'USED'
            AND accepted_by_user_id IS NOT NULL
            AND accepted_at IS NOT NULL)
        OR invitation_status <> 'USED'
    )
);

CREATE INDEX idx_circle_invitations_circle
    ON circle_invitations (circle_id, invitation_status);

CREATE TABLE arisan_cycles (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE RESTRICT,
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
    UNIQUE (circle_id, cycle_number),
    CHECK (
        bidding_close_at IS NULL
        OR bidding_open_at IS NULL
        OR bidding_close_at > bidding_open_at
    )
);

CREATE INDEX idx_arisan_cycles_circle_status
    ON arisan_cycles (circle_id, cycle_status, cycle_number);

-- Snapshot peserta pada siklus tertentu.
-- Ini menjaga histori ketika anggota circle berubah atau digantikan.
CREATE TABLE cycle_participants (
    cycle_participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES arisan_cycles(cycle_id) ON DELETE RESTRICT,
    circle_membership_id UUID NOT NULL
        REFERENCES circle_memberships(circle_membership_id) ON DELETE RESTRICT,
    participation_status VARCHAR(20) NOT NULL DEFAULT 'ELIGIBLE'
        CHECK (participation_status IN ('ELIGIBLE', 'EXCLUDED', 'REPLACED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_id, circle_membership_id)
);

CREATE INDEX idx_cycle_participants_cycle_status
    ON cycle_participants (cycle_id, participation_status);

CREATE TABLE cycle_participant_substitutions (
    substitution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES arisan_cycles(cycle_id) ON DELETE RESTRICT,
    original_cycle_participant_id UUID NOT NULL
        REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    replacement_cycle_participant_id UUID NOT NULL
        REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    approved_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (original_cycle_participant_id <> replacement_cycle_participant_id),
    UNIQUE (cycle_id, original_cycle_participant_id)
);

CREATE INDEX idx_cycle_substitutions_cycle
    ON cycle_participant_substitutions (cycle_id, created_at);

CREATE TABLE cycle_obligations (
    obligation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_participant_id UUID NOT NULL
        REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    amount_due NUMERIC(18, 2) NOT NULL CHECK (amount_due > 0),
    due_at TIMESTAMPTZ NOT NULL,
    obligation_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (obligation_status IN (
            'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_participant_id)
);

CREATE INDEX idx_cycle_obligations_participant_status
    ON cycle_obligations (cycle_participant_id, obligation_status);

CREATE TABLE bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_participant_id UUID NOT NULL
        REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    bid_rate_percent NUMERIC(5, 2) NOT NULL
        CHECK (bid_rate_percent >= 0 AND bid_rate_percent <= 100),
    bid_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (bid_status IN ('ACTIVE', 'WITHDRAWN', 'INVALID')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_participant_id)
);

CREATE INDEX idx_bids_cycle_status
    ON bids (cycle_participant_id, bid_status, bid_rate_percent DESC);

CREATE TABLE cycle_awards (
    award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL
        REFERENCES arisan_cycles(cycle_id) ON DELETE RESTRICT,
    cycle_participant_id UUID NOT NULL
        REFERENCES cycle_participants(cycle_participant_id) ON DELETE RESTRICT,
    award_method VARCHAR(20) NOT NULL
        CHECK (award_method IN ('SPSB', 'RANDOM_DRAW')),
    gross_amount NUMERIC(18, 2) NOT NULL CHECK (gross_amount > 0),
    winning_bid_rate_percent NUMERIC(5, 2)
        CHECK (winning_bid_rate_percent >= 0),
    payable_bid_rate_percent NUMERIC(5, 2)
        CHECK (payable_bid_rate_percent >= 0),
    decision_hash VARCHAR(128),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cycle_id),
    CHECK (
        (
            award_method = 'SPSB'
            AND winning_bid_rate_percent IS NOT NULL
            AND payable_bid_rate_percent IS NOT NULL
        )
        OR (
            award_method = 'RANDOM_DRAW'
            AND winning_bid_rate_percent IS NULL
            AND payable_bid_rate_percent IS NULL
        )
    )
);

CREATE INDEX idx_cycle_awards_participant
    ON cycle_awards (cycle_participant_id);

CREATE TABLE draw_results (
    draw_result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL UNIQUE
        REFERENCES cycle_awards(award_id) ON DELETE RESTRICT,
    random_seed_commitment VARCHAR(128) NOT NULL,
    random_source VARCHAR(100) NOT NULL,
    participant_count INTEGER NOT NULL CHECK (participant_count > 0),
    drawn_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_bank_accounts (
    bank_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL
        CHECK (account_type IN ('BANK', 'E_WALLET')),
    account_number_token VARCHAR(255) NOT NULL,
    account_number_masked VARCHAR(50) NOT NULL,
    account_name_from_provider VARCHAR(150),
    validation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (validation_status IN ('PENDING', 'MATCHED', 'MISMATCHED', 'FAILED')),
    authorization_type VARCHAR(25) NOT NULL DEFAULT 'SELF'
        CHECK (authorization_type IN ('SELF', 'FAMILY_AUTHORIZED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ
);

CREATE INDEX idx_user_bank_accounts_user_status
    ON user_bank_accounts (user_id, validation_status);

CREATE TABLE payment_orders (
    payment_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type VARCHAR(30) NOT NULL
        CHECK (order_type IN (
            'CYCLE_CONTRIBUTION',
            'CAMPAIGN_CONTRIBUTION',
            'LOAN_REPAYMENT'
        )),
    payment_method VARCHAR(25) NOT NULL
        CHECK (payment_method IN ('GATEWAY', 'MANUAL_TRANSFER', 'E_WALLET')),
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

CREATE TABLE obligation_payment_orders (
    payment_order_id UUID PRIMARY KEY
        REFERENCES payment_orders(payment_order_id) ON DELETE RESTRICT,
    obligation_id UUID NOT NULL
        REFERENCES cycle_obligations(obligation_id) ON DELETE RESTRICT,
    UNIQUE (obligation_id, payment_order_id)
);

CREATE INDEX idx_obligation_payment_orders_obligation
    ON obligation_payment_orders (obligation_id);

CREATE TRIGGER trg_payment_orders_updated_at
BEFORE UPDATE ON payment_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment_proofs (
    payment_proof_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL UNIQUE
        REFERENCES payment_orders(payment_order_id) ON DELETE RESTRICT,
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
    payment_order_id UUID
        REFERENCES payment_orders(payment_order_id) ON DELETE RESTRICT,
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

CREATE INDEX idx_payment_events_order
    ON payment_events (payment_order_id, received_at);

CREATE TABLE disbursements (
    disbursement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL REFERENCES cycle_awards(award_id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL
        REFERENCES user_bank_accounts(bank_account_id) ON DELETE RESTRICT,
    provider VARCHAR(50),
    provider_disbursement_ref VARCHAR(150) UNIQUE,
    requested_amount NUMERIC(18, 2) NOT NULL CHECK (requested_amount > 0),
    platform_fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0
        CHECK (platform_fee_amount >= 0),
    net_amount NUMERIC(18, 2) NOT NULL CHECK (net_amount > 0),
    disbursement_status VARCHAR(25) NOT NULL DEFAULT 'REQUESTED'
        CHECK (disbursement_status IN (
            'REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED'
        )),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CHECK (net_amount = requested_amount - platform_fee_amount)
);

CREATE INDEX idx_disbursements_award_status
    ON disbursements (award_id, disbursement_status);

CREATE TABLE audit_events (
    audit_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    payload_hash VARCHAR(128) NOT NULL,
    previous_event_hash VARCHAR(128),
    event_hash VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_events_entity
    ON audit_events (entity_type, entity_id, created_at);

CREATE INDEX idx_audit_events_actor
    ON audit_events (actor_user_id, created_at);

-- Cross-entity integrity checks which cannot be represented by a simple FK.
CREATE OR REPLACE FUNCTION validate_cycle_participant_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    cycle_circle_id UUID;
    membership_circle_id UUID;
BEGIN
    SELECT circle_id
    INTO cycle_circle_id
    FROM arisan_cycles
    WHERE cycle_id = NEW.cycle_id;

    SELECT circle_id
    INTO membership_circle_id
    FROM circle_memberships
    WHERE circle_membership_id = NEW.circle_membership_id;

    IF cycle_circle_id IS NULL
       OR membership_circle_id IS NULL
       OR cycle_circle_id <> membership_circle_id THEN
        RAISE EXCEPTION 'Cycle participant must belong to the cycle circle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cycle_participant_circle
BEFORE INSERT OR UPDATE ON cycle_participants
FOR EACH ROW EXECUTE FUNCTION validate_cycle_participant_circle();

CREATE OR REPLACE FUNCTION validate_cycle_participant_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    participant_cycle_id UUID;
BEGIN
    SELECT cycle_id
    INTO participant_cycle_id
    FROM cycle_participants
    WHERE cycle_participant_id = NEW.cycle_participant_id;

    IF participant_cycle_id IS NULL THEN
        RAISE EXCEPTION 'Cycle record must reference a valid cycle participant';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_substitution_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    original_cycle_id UUID;
    replacement_cycle_id UUID;
BEGIN
    SELECT cycle_id
    INTO original_cycle_id
    FROM cycle_participants
    WHERE cycle_participant_id = NEW.original_cycle_participant_id;

    SELECT cycle_id
    INTO replacement_cycle_id
    FROM cycle_participants
    WHERE cycle_participant_id = NEW.replacement_cycle_participant_id;

    IF original_cycle_id IS NULL
       OR replacement_cycle_id IS NULL
       OR original_cycle_id <> NEW.cycle_id
       OR replacement_cycle_id <> NEW.cycle_id THEN
        RAISE EXCEPTION 'Substitution participants must belong to the same cycle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_substitution_cycle
BEFORE INSERT OR UPDATE ON cycle_participant_substitutions
FOR EACH ROW EXECUTE FUNCTION validate_substitution_cycle();

CREATE OR REPLACE FUNCTION validate_bid_for_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    cycle_track_type VARCHAR(20);
    floor_percent NUMERIC(5, 2);
    ceiling_percent NUMERIC(5, 2);
BEGIN
    SELECT c.track_type, c.bid_floor_percent, c.bid_ceiling_percent
    INTO cycle_track_type, floor_percent, ceiling_percent
    FROM cycle_participants cp
    JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
    JOIN circles c ON c.circle_id = ac.circle_id
    WHERE cp.cycle_participant_id = NEW.cycle_participant_id;

    IF cycle_track_type <> 'SPSB' THEN
        RAISE EXCEPTION 'Bids are only allowed for SPSB circles';
    END IF;

    IF NEW.bid_rate_percent < floor_percent
       OR NEW.bid_rate_percent > ceiling_percent THEN
        RAISE EXCEPTION 'Bid rate is outside the configured floor and ceiling';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_bid_for_circle
BEFORE INSERT OR UPDATE ON bids
FOR EACH ROW EXECUTE FUNCTION validate_bid_for_circle();

CREATE OR REPLACE FUNCTION validate_award_participant_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    participant_cycle_id UUID;
    circle_track_type VARCHAR(20);
BEGIN
    SELECT cycle_id
    INTO participant_cycle_id
    FROM cycle_participants
    WHERE cycle_participant_id = NEW.cycle_participant_id;

    IF participant_cycle_id IS NULL
       OR participant_cycle_id <> NEW.cycle_id THEN
        RAISE EXCEPTION 'Award participant must belong to the award cycle';
    END IF;

    SELECT c.track_type
    INTO circle_track_type
    FROM arisan_cycles ac
    JOIN circles c ON c.circle_id = ac.circle_id
    WHERE ac.cycle_id = NEW.cycle_id;

    IF circle_track_type <> NEW.award_method THEN
        RAISE EXCEPTION 'Award method must match the circle track';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cycle_obligation_participant
BEFORE INSERT OR UPDATE ON cycle_obligations
FOR EACH ROW EXECUTE FUNCTION validate_cycle_participant_reference();

CREATE TRIGGER trg_validate_bid_participant
BEFORE INSERT OR UPDATE ON bids
FOR EACH ROW EXECUTE FUNCTION validate_cycle_participant_reference();

CREATE TRIGGER trg_validate_award_participant
BEFORE INSERT OR UPDATE ON cycle_awards
FOR EACH ROW EXECUTE FUNCTION validate_award_participant_cycle();

-- Payment matrix: derived read model for the frontend.
CREATE OR REPLACE VIEW v_payment_matrix AS
WITH paid AS (
    SELECT
        opo.obligation_id,
        SUM(po.amount) AS amount_paid
    FROM obligation_payment_orders opo
    JOIN payment_orders po ON po.payment_order_id = opo.payment_order_id
    WHERE po.payment_status = 'PAID'
    GROUP BY opo.obligation_id
)
SELECT
    c.circle_id,
    c.circle_name,
    c.track_type,
    ac.cycle_id,
    ac.cycle_number,
    ac.cycle_status,
    ac.due_at AS cycle_due_at,
    cp.cycle_participant_id,
    cm.circle_membership_id,
    u.user_id,
    u.full_name,
    co.obligation_id,
    co.amount_due,
    COALESCE(p.amount_paid, 0.00)::NUMERIC(18, 2) AS amount_paid,
    GREATEST(co.amount_due - COALESCE(p.amount_paid, 0.00), 0.00)
        ::NUMERIC(18, 2) AS amount_remaining,
    CASE
        WHEN co.obligation_status IN ('WAIVED', 'CANCELLED')
            THEN co.obligation_status
        WHEN COALESCE(p.amount_paid, 0.00) >= co.amount_due
            THEN 'PAID'
        WHEN COALESCE(p.amount_paid, 0.00) > 0
            THEN 'PARTIAL'
        WHEN CURRENT_TIMESTAMP > co.due_at
            THEN 'OVERDUE'
        ELSE 'UNPAID'
    END AS payment_status
FROM cycle_obligations co
JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
JOIN circles c ON c.circle_id = ac.circle_id
JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
JOIN users u ON u.user_id = cm.user_id
LEFT JOIN paid p ON p.obligation_id = co.obligation_id;
