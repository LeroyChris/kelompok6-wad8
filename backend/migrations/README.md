# Database Setup Order

The migration chain is a clean three-file baseline. The reset is destructive: it deletes all ArisanKita tables and data in the Supabase `public` schema. It does not delete Supabase `auth` or `storage` data.

From the repository root, with `DATABASE_URL` exported or loaded from `backend/.env`, run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/000_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/001_schema_v2.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/002_seed_demo_data.sql
```

If using the Supabase SQL Editor, paste and run the files in exactly the same order. Do not run the reset file on a database that contains data you need to retain.

## Seeded users

All demo accounts are persisted in `users` and `user_auth_identities` using `EMAIL_OTP`. Email OTP requests may auto-register a new user; verification only issues a token for the persisted user.

| User | Email | Demo circle role |
|---|---|---|
| Tiara Maharani | `tiara@arisankita.id` | Owner — Arisan Keluarga RT 05; member — Arisan Fintech Squad |
| Abda Pratama | `abda@arisankita.id` | Owner — Arisan Fintech Squad; winner cycle 1 RT 05 |
| Leroy Wijaya | `leroy@arisankita.id` | Member in both circles |
| Nadia Putri | `nadia@arisankita.id` | Member — Arisan Keluarga RT 05 |
