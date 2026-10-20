-- ============================================================================
-- ArisanKita Audit Event Triggers
-- Apply after 002_core_hardening.sql. These triggers record immutable audit
-- events for the core state changes required by the PRD.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION audit_event_hash(p_event_type TEXT, p_entity_id UUID, p_payload JSONB)
RETURNS TEXT
LANGUAGE sql
AS $$
    SELECT encode(digest(p_event_type || ':' || p_entity_id::text || ':' || p_payload::text || ':' || clock_timestamp()::text || ':' || random()::text, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION trg_audit_circle_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSONB; payload_hash TEXT; event_hash TEXT;
BEGIN
    IF NEW.circle_status = 'LOCKED' AND OLD.circle_status IS DISTINCT FROM 'LOCKED' THEN
        payload := jsonb_build_object('previous_status', OLD.circle_status, 'circle_status', NEW.circle_status);
        payload_hash := encode(digest(payload::text, 'sha256'), 'hex');
        event_hash := audit_event_hash('CIRCLE_LOCKED', NEW.circle_id, payload);
        INSERT INTO audit_events (event_type, entity_type, entity_id, payload_hash, event_hash)
        VALUES ('CIRCLE_LOCKED', 'CIRCLE', NEW.circle_id, payload_hash, event_hash);
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
    INSERT INTO audit_events (event_type, entity_type, entity_id, payload_hash, event_hash)
    VALUES ('CYCLE_AWARD_RESOLVED', 'CYCLE_AWARD', NEW.award_id, payload_hash, event_hash);
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
        INSERT INTO audit_events (event_type, entity_type, entity_id, payload_hash, event_hash)
        VALUES ('DISBURSEMENT_PAID', 'DISBURSEMENT', NEW.disbursement_id, payload_hash, event_hash);
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_circle_lock ON circles;
CREATE TRIGGER trg_audit_circle_lock AFTER UPDATE OF circle_status ON circles FOR EACH ROW EXECUTE FUNCTION trg_audit_circle_lock();
DROP TRIGGER IF EXISTS trg_audit_payment_proof_review ON payment_proofs;
CREATE TRIGGER trg_audit_payment_proof_review AFTER UPDATE ON payment_proofs FOR EACH ROW EXECUTE FUNCTION trg_audit_payment_proof_review();
DROP TRIGGER IF EXISTS trg_audit_cycle_award ON cycle_awards;
CREATE TRIGGER trg_audit_cycle_award AFTER INSERT ON cycle_awards FOR EACH ROW EXECUTE FUNCTION trg_audit_cycle_award();
DROP TRIGGER IF EXISTS trg_audit_disbursement ON disbursements;
CREATE TRIGGER trg_audit_disbursement AFTER INSERT OR UPDATE OF disbursement_status ON disbursements FOR EACH ROW EXECUTE FUNCTION trg_audit_disbursement();

COMMIT;
