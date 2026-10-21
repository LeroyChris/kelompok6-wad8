# API Demo Guide

Base URL lokal: `http://localhost:8080/api/v1`. Jalankan migration berurutan
`001_schema_v2.sql` → `002_core_hardening.sql` → `005_email_otp_identity.sql`
→ `003_seed_demo_data.sql` → `004_audit_events.sql` → `006_audit_actor_context.sql`.

## Authentication: email sandbox OTP

Auth resmi hanya memakai email. Meminta OTP untuk email baru akan membuat record
`users` dan `user_auth_identities` (`EMAIL_OTP`); trigger database otomatis
membuat wallet. Kode sandbox adalah `SANDBOX_OTP_CODE` (default `123456`).

```bash
export API_URL=http://localhost:8080/api/v1
export EMAIL=tiara@arisankita.id

curl -sS -X POST "$API_URL/auth/otp/request" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}"

export TOKEN=$(curl -sS -X POST "$API_URL/auth/otp/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"otp_code\":\"123456\"}" \
  | jq -r '.data.token')
export AUTH="Authorization: Bearer $TOKEN"
```

Seed users: `tiara@arisankita.id`, `abda@arisankita.id`,
`leroy@arisankita.id`, dan `nadia@arisankita.id`.

## Core endpoints

```bash
curl -sS "$API_URL/users/me" -H "$AUTH"
curl -sS "$API_URL/wallet" -H "$AUTH"
curl -sS "$API_URL/circles?limit=20" -H "$AUTH"
```

Create circle, join via invitation, lock saat penuh, lalu owner membuat cycle:

```bash
curl -sS -X POST "$API_URL/circles" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"circle_name":"Arisan Demo Baru","track_type":"RANDOM_DRAW","contribution_amount":500000,"member_limit":4,"period_type":"MONTHLY"}'

curl -sS -X POST "$API_URL/circles/<circle_id>/lock" -H "$AUTH"
curl -sS -X POST "$API_URL/circles/<circle_id>/cycles" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"cycle_number":1,"due_at":"2026-12-01T00:00:00Z"}'
```

Pay an owned obligation with an idempotency key, or create a manual order and
upload its proof:

```bash
curl -sS -X POST "$API_URL/obligations/<obligation_id>/payments/wallet" \
  -H "$AUTH" -H 'Idempotency-Key: demo-payment-001'

curl -sS -X POST "$API_URL/obligations/<obligation_id>/payments/manual" -H "$AUTH"
curl -sS -X POST "$API_URL/payments/<payment_order_id>/proof" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"proof_url":"https://example.test/proof.png"}'
```

Resolve a ready cycle. SPSB members submit bids first, and owner/admin closes
bidding before award resolution.

```bash
curl -sS -X POST "$API_URL/cycles/<cycle_id>/award/resolve" -H "$AUTH"
curl -sS "$API_URL/cycles/<cycle_id>/award" -H "$AUTH"
curl -sS "$API_URL/cycles/<cycle_id>/draw-proof" -H "$AUTH"
```
