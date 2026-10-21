-- ============================================================================
-- Audit actor context
-- Application transactions set app.actor_user_id before mutating audited rows.
-- ============================================================================

BEGIN;

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

COMMIT;
