-- ============================================================================
-- Email sandbox OTP identity
-- Apply after 004_audit_events.sql. This is safe for databases already created
-- from the original v2 baseline.
-- ============================================================================

BEGIN;

ALTER TABLE user_auth_identities
    DROP CONSTRAINT IF EXISTS user_auth_identities_provider_check;

ALTER TABLE user_auth_identities
    ADD CONSTRAINT user_auth_identities_provider_check
    CHECK (provider IN ('EMAIL_OTP', 'PHONE_OTP', 'GOOGLE', 'PASSWORD'));

COMMIT;
