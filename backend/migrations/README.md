# Database Setup Order

The following reset is destructive: it deletes all ArisanKita tables and data in the Supabase `public` schema. It does not delete Supabase `auth` or `storage` data.

From the repository root, with `DATABASE_URL` exported or loaded from `backend/.env`, run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/000_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/001_schema_v2.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/002_core_hardening.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/003_seed_demo_data.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/004_audit_events.sql
```

If using the Supabase SQL Editor, paste and run the files in exactly the same order. Do not run the reset file on a database that contains data you need to retain.

## Seeded users

All demo accounts are persisted in `users` and `user_auth_identities`; the authentication flow must look them up and must not create an arbitrary user during OTP verification.

| User | Phone | Email | Demo circle role |
|---|---|---|---|
| Tiara Maharani | `081234567890` | `tiara@arisankita.id` | Owner — Arisan Keluarga RT 05; member — Arisan Fintech Squad |
| Abda Pratama | `081298765432` | `abda@arisankita.id` | Owner — Arisan Fintech Squad; winner cycle 1 RT 05 |
| Leroy Wijaya | `081311223344` | `leroy@arisankita.id` | Member in both circles |
| Nadia Putri | `081599887766` | `nadia@arisankita.id` | Member — Arisan Keluarga RT 05 |
