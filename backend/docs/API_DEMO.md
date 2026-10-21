# API Demo Guide

Base URL lokal: `http://localhost:8080/api/v1`

Seluruh user demo sudah tersedia di database seed. OTP sandbox adalah nilai `SANDBOX_OTP_CODE` (default `123456`).

| User | Phone | Circle |
|---|---|---|
| Tiara Maharani | `081234567890` | Owner RT 05, member Fintech Squad |
| Abda Pratama | `081298765432` | Owner Fintech Squad, pemenang RT 05 cycle 1 |
| Leroy Wijaya | `081311223344` | Member kedua circle |
| Nadia Putri | `081599887766` | Member RT 05 |

## 1. Login dan token

```bash
export API_URL=http://localhost:8080/api/v1
export PHONE=081234567890

curl -sS -X POST "$API_URL/auth/otp/request" \
  -H 'Content-Type: application/json' \
  -d "{\"phone_number\":\"$PHONE\"}"

export TOKEN=$(curl -sS -X POST "$API_URL/auth/otp/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"phone_number\":\"$PHONE\",\"otp_code\":\"123456\"}" \
  | jq -r '.data.token')
```

All protected requests use:

```bash
export AUTH="Authorization: Bearer $TOKEN"
```

## 2. User dan wallet

```bash
curl -sS "$API_URL/users/me" -H "$AUTH"
curl -sS "$API_URL/users/me/win-history" -H "$AUTH"
curl -sS "$API_URL/users/me/reputation" -H "$AUTH"
curl -sS "$API_URL/wallet" -H "$AUTH"
curl -sS "$API_URL/wallet/transactions?limit=20" -H "$AUTH"
```

Sandbox top-up hanya boleh digunakan di environment non-production:

```bash
curl -sS -X POST "$API_URL/wallet/topups" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":100000}'
```

## 3. Circle dan invitation

```bash
curl -sS "$API_URL/circles?limit=20" -H "$AUTH"

curl -sS -X POST "$API_URL/circles" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "circle_name":"Arisan Demo Baru",
    "track_type":"RANDOM_DRAW",
    "contribution_amount":500000,
    "member_limit":4,
    "period_type":"MONTHLY"
  }'
```

Untuk SPSB, payload wajib memuat `bid_floor_percent` dan `bid_ceiling_percent`:

```json
{
  "track_type": "SPSB",
  "bid_floor_percent": 1,
  "bid_ceiling_percent": 20
}
```

## 4. Siklus, pembayaran, dan award

Owner membuat cycle, kemudian setiap member membayar obligation miliknya. Setelah semua obligation `PAID`, backend mengubah status cycle otomatis menjadi `READY_FOR_DISBURSEMENT` (Random Draw) atau `BIDDING_OPEN` (SPSB).

```bash
# Random Draw: owner/admin resolve setelah READY_FOR_DISBURSEMENT
curl -sS -X POST "$API_URL/cycles/<cycle_id>/draw" -H "$AUTH"

# SPSB: member submit bid, owner/admin tutup bidding, lalu resolve.
curl -sS -X POST "$API_URL/cycles/<cycle_id>/bids" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"bid_rate_percent":7.5}'

curl -sS -X POST "$API_URL/cycles/<cycle_id>/bidding/close" -H "$AUTH"
curl -sS -X POST "$API_URL/cycles/<cycle_id>/draw" -H "$AUTH"
```

## Authorization summary

- Member aktif: profile sendiri, wallet sendiri, circle/cycle sendiri, bid sendiri, obligation sendiri.
- Owner/admin: invitation, review proof, close bidding, resolve award.
- Owner: lock circle, create cycle, update member role/status.
