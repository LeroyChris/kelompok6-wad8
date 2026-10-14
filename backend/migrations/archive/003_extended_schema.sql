-- ArisanKita - Extended business modules
-- This file is loaded after 001_core_schema.sql.
--
-- Includes:
--   - closed-loop crowdfunding and sponsorship
--   - internal loan agreements and repayments
--   - KYC tiering and verification records
--   - controlled risk blocks
--   - reputation event ledger
--   - relief/waiver requests
--   - notification outbox
--
-- Money remains NUMERIC(18,2). Derived totals are calculated from source rows.

ALTER TABLE circles
    ADD COLUMN IF NOT EXISTS kyc_threshold_amount NUMERIC(18, 2)
        NOT NULL DEFAULT 5000000
        CHECK (kyc_threshold_amount > 0);

CREATE TABLE crowdfunding_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE RESTRICT,
    creator_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    related_award_id UUID REFERENCES cycle_awards(award_id) ON DELETE RESTRICT,
    campaign_type VARCHAR(25) NOT NULL
        CHECK (campaign_type IN ('INTERNAL_LOAN', 'DONATION', 'SPONSORSHIP')),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    target_amount NUMERIC(18, 2) NOT NULL CHECK (target_amount > 0),
    campaign_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (campaign_status IN (
            'DRAFT', 'OPEN', 'TARGET_REACHED', 'CLOSED',
            'CANCELLED', 'COMPLETED'
        )),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_campaigns_circle_status
    ON crowdfunding_campaigns (circle_id, campaign_status, created_at DESC);

CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON crowdfunding_campaigns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE campaign_contributions (
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL
        REFERENCES crowdfunding_campaigns(campaign_id) ON DELETE RESTRICT,
    contributor_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    contribution_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (contribution_status IN (
            'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMPTZ
);

CREATE INDEX idx_campaign_contributions_campaign_status
    ON campaign_contributions (campaign_id, contribution_status);

CREATE INDEX idx_campaign_contributions_contributor
    ON campaign_contributions (contributor_user_id, created_at DESC);

CREATE TABLE campaign_contribution_payment_orders (
    payment_order_id UUID PRIMARY KEY
        REFERENCES payment_orders(payment_order_id) ON DELETE RESTRICT,
    contribution_id UUID NOT NULL
        REFERENCES campaign_contributions(contribution_id) ON DELETE RESTRICT
);

CREATE INDEX idx_campaign_payment_orders_contribution
    ON campaign_contribution_payment_orders (contribution_id);

CREATE TABLE loan_agreements (
    loan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL UNIQUE
        REFERENCES crowdfunding_campaigns(campaign_id) ON DELETE RESTRICT,
    borrower_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    principal_amount NUMERIC(18, 2) NOT NULL CHECK (principal_amount > 0),
    service_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (service_fee_percent >= 0 AND service_fee_percent <= 100),
    loan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (loan_status IN (
            'PENDING', 'ACTIVE', 'PAID', 'OVERDUE', 'DEFAULTED', 'CANCELLED'
        )),
    approved_at TIMESTAMPTZ,
    maturity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (maturity_at IS NULL OR approved_at IS NULL OR maturity_at >= approved_at)
);

CREATE TABLE loan_repayment_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loan_agreements(loan_id) ON DELETE RESTRICT,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    due_at TIMESTAMPTZ NOT NULL,
    amount_due NUMERIC(18, 2) NOT NULL CHECK (amount_due > 0),
    schedule_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (schedule_status IN (
            'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'
        )),
    UNIQUE (loan_id, installment_number)
);

CREATE INDEX idx_loan_schedules_due
    ON loan_repayment_schedules (loan_id, schedule_status, due_at);

CREATE TABLE loan_repayments (
    repayment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL
        REFERENCES loan_repayment_schedules(schedule_id) ON DELETE RESTRICT,
    amount_paid NUMERIC(18, 2) NOT NULL CHECK (amount_paid > 0),
    repayment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (repayment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loan_repayments_schedule_status
    ON loan_repayments (schedule_id, repayment_status);

CREATE TABLE loan_repayment_payment_orders (
    payment_order_id UUID PRIMARY KEY
        REFERENCES payment_orders(payment_order_id) ON DELETE RESTRICT,
    repayment_id UUID NOT NULL
        REFERENCES loan_repayments(repayment_id) ON DELETE RESTRICT
);

CREATE INDEX idx_loan_payment_orders_repayment
    ON loan_repayment_payment_orders (repayment_id);

CREATE OR REPLACE FUNCTION validate_payment_order_link_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    actual_order_type VARCHAR(30);
    expected_order_type VARCHAR(30);
BEGIN
    SELECT order_type
    INTO actual_order_type
    FROM payment_orders
    WHERE payment_order_id = NEW.payment_order_id;

    expected_order_type := TG_ARGV[0];

    IF actual_order_type IS NULL OR actual_order_type <> expected_order_type THEN
        RAISE EXCEPTION 'Payment order type must be %', expected_order_type;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_obligation_payment_order_type
BEFORE INSERT OR UPDATE ON obligation_payment_orders
FOR EACH ROW
EXECUTE FUNCTION validate_payment_order_link_type('CYCLE_CONTRIBUTION');

CREATE TRIGGER trg_validate_campaign_payment_order_type
BEFORE INSERT OR UPDATE ON campaign_contribution_payment_orders
FOR EACH ROW
EXECUTE FUNCTION validate_payment_order_link_type('CAMPAIGN_CONTRIBUTION');

CREATE TRIGGER trg_validate_loan_payment_order_type
BEFORE INSERT OR UPDATE ON loan_repayment_payment_orders
FOR EACH ROW
EXECUTE FUNCTION validate_payment_order_link_type('LOAN_REPAYMENT');

CREATE TABLE kyc_verifications (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    verification_level VARCHAR(20) NOT NULL
        CHECK (verification_level IN ('BASIC', 'ADVANCED')),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN (
            'PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED'
        )),
    provider VARCHAR(80),
    provider_reference VARCHAR(200),
    document_storage_ref TEXT,
    name_match_status VARCHAR(20)
        CHECK (name_match_status IS NULL OR name_match_status IN (
            'PENDING', 'MATCHED', 'MISMATCHED'
        )),
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_kyc_user_level_status
    ON kyc_verifications (user_id, verification_level, verification_status);

CREATE TABLE circle_kyc_reviews (
    circle_kyc_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(circle_id) ON DELETE RESTRICT,
    required_level VARCHAR(20) NOT NULL
        CHECK (required_level IN ('BASIC', 'ADVANCED')),
    triggered_amount NUMERIC(18, 2) NOT NULL CHECK (triggered_amount > 0),
    review_status VARCHAR(20) NOT NULL DEFAULT 'REQUIRED'
        CHECK (review_status IN ('REQUIRED', 'IN_PROGRESS', 'COMPLETED', 'WAIVED')),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    UNIQUE (circle_id, required_level)
);

CREATE TABLE risk_block_entries (
    risk_block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    block_type VARCHAR(25) NOT NULL
        CHECK (block_type IN ('USER', 'PHONE', 'BANK_ACCOUNT')),
    value_hash VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    block_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (block_status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    created_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    UNIQUE (block_type, value_hash)
);

CREATE INDEX idx_risk_blocks_user_status
    ON risk_block_entries (user_id, block_status);

CREATE TABLE reputation_events (
    reputation_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    score_delta INTEGER NOT NULL CHECK (score_delta BETWEEN -100 AND 100),
    event_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reputation_events_user
    ON reputation_events (user_id, created_at DESC);

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
    obligation_id UUID NOT NULL
        REFERENCES cycle_obligations(obligation_id) ON DELETE RESTRICT,
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    relief_type VARCHAR(25) NOT NULL
        CHECK (relief_type IN ('REDUCE_AMOUNT', 'EXTEND_DUE_DATE', 'WAIVE')),
    requested_amount_due NUMERIC(18, 2)
        CHECK (requested_amount_due IS NULL OR requested_amount_due >= 0),
    requested_due_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    request_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relief_requests_obligation_status
    ON obligation_relief_requests (obligation_id, request_status);

CREATE TABLE notification_outbox (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    circle_id UUID REFERENCES circles(circle_id) ON DELETE RESTRICT,
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('WHATSAPP', 'EMAIL', 'IN_APP')),
    template_key VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (notification_status IN (
            'PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'
        )),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    provider_message_ref VARCHAR(200),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_outbox_worker
    ON notification_outbox (notification_status, scheduled_at);

-- Cross-table business checks.
CREATE OR REPLACE FUNCTION validate_campaign_creator_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    creator_circle_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO creator_circle_count
    FROM circle_memberships
    WHERE circle_id = NEW.circle_id
      AND user_id = NEW.creator_user_id
      AND membership_status = 'ACTIVE';

    IF creator_circle_count = 0 THEN
        RAISE EXCEPTION 'Campaign creator must be an active member of the circle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_campaign_creator_circle
BEFORE INSERT OR UPDATE ON crowdfunding_campaigns
FOR EACH ROW EXECUTE FUNCTION validate_campaign_creator_circle();

CREATE OR REPLACE FUNCTION validate_loan_campaign_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    campaign_kind VARCHAR(25);
BEGIN
    SELECT campaign_type
    INTO campaign_kind
    FROM crowdfunding_campaigns
    WHERE campaign_id = NEW.campaign_id;

    IF campaign_kind <> 'INTERNAL_LOAN' THEN
        RAISE EXCEPTION 'Loan agreement requires an INTERNAL_LOAN campaign';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_loan_campaign_type
BEFORE INSERT OR UPDATE ON loan_agreements
FOR EACH ROW EXECUTE FUNCTION validate_loan_campaign_type();
