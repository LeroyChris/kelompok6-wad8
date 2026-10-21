-- ============================================================================
-- Canonicalize existing demo/development identities to the official EMAIL_OTP
-- flow. Legacy identities are removed only after an EMAIL_OTP identity exists.
-- ============================================================================

BEGIN;

INSERT INTO user_auth_identities (user_id, provider, provider_subject)
SELECT u.user_id, 'EMAIL_OTP', LOWER(u.email)
FROM users u
WHERE u.email IS NOT NULL
  AND BTRIM(u.email) <> ''
ON CONFLICT (provider, provider_subject) DO NOTHING;

DELETE FROM user_auth_identities legacy
WHERE legacy.provider IN ('PHONE_OTP', 'GOOGLE')
  AND EXISTS (
      SELECT 1
      FROM user_auth_identities email_identity
      WHERE email_identity.user_id = legacy.user_id
        AND email_identity.provider = 'EMAIL_OTP'
  );

COMMIT;
