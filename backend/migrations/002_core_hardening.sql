-- ============================================================================
-- ArisanKita Core Hardening
-- Non-destructive migration for the final-project core flow.
-- Apply after 001_schema_v2.sql and before 003_seed_demo_data.sql.
-- ============================================================================

BEGIN;

-- Preserve enough data to verify a completed random draw after the seed is
-- revealed, including the deterministic participant snapshot it was based on.
ALTER TABLE draw_results
    ADD COLUMN IF NOT EXISTS random_seed_reveal TEXT,
    ADD COLUMN IF NOT EXISTS participant_snapshot_hash VARCHAR(128),
    ADD COLUMN IF NOT EXISTS algorithm_version VARCHAR(50) NOT NULL DEFAULT 'SHA256_MOD_V1';

-- gross_amount is the paid cycle pot. A SPSB award retains both the penalty
-- and the amount actually credited to the winner.
ALTER TABLE cycle_awards
    ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(18, 2) NOT NULL DEFAULT 0
        CHECK (penalty_amount >= 0),
    ADD COLUMN IF NOT EXISTS net_award_amount NUMERIC(18, 2);

UPDATE cycle_awards
SET net_award_amount = gross_amount - penalty_amount
WHERE net_award_amount IS NULL;

ALTER TABLE cycle_awards
    ALTER COLUMN net_award_amount SET NOT NULL;

ALTER TABLE cycle_awards
    ADD CONSTRAINT chk_cycle_awards_net_amount
    CHECK (net_award_amount > 0 AND net_award_amount = gross_amount - penalty_amount);

-- The core product has one payout per award. Retries are handled by the
-- service using the unique constraint and an idempotency key.
ALTER TABLE disbursements
    ADD CONSTRAINT uq_disbursements_award UNIQUE (award_id);

ALTER TABLE payment_orders
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_orders_idempotency
    ON payment_orders (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Cursor pagination indexes.
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_cursor
    ON wallet_transactions (wallet_id, created_at DESC, wallet_tx_id DESC);

CREATE INDEX IF NOT EXISTS idx_arisan_cycles_circle_cursor
    ON arisan_cycles (circle_id, created_at DESC, cycle_id DESC);

CREATE INDEX IF NOT EXISTS idx_circle_memberships_circle_cursor
    ON circle_memberships (circle_id, membership_status, joined_at ASC, circle_membership_id ASC);

CREATE INDEX IF NOT EXISTS idx_cycle_obligations_status_cursor
    ON cycle_obligations (obligation_status, created_at DESC, obligation_id DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status_cursor
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

DROP TRIGGER IF EXISTS trg_cycle_participant_membership_circle ON cycle_participants;
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

DROP TRIGGER IF EXISTS trg_cycle_award_participant ON cycle_awards;
CREATE TRIGGER trg_cycle_award_participant
BEFORE INSERT OR UPDATE OF cycle_id, cycle_participant_id ON cycle_awards
FOR EACH ROW EXECUTE FUNCTION enforce_cycle_award_participant();

COMMIT;
