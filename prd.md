# ArisanKita Core — Product Requirements Document

**Status:** Final project scope / single source of truth (SSOT)  
**Product:** ArisanKita  
**Architecture:** React + TypeScript frontend, Go Gin REST API, PostgreSQL/Supabase, `pgxpool`, raw SQL  
**API prefix:** `/api/v1`

---

## 1. Product Definition

ArisanKita adalah aplikasi arisan privat untuk komunitas tepercaya. Pengguna dapat membuat atau bergabung ke circle, membayar iuran, mengikuti mekanisme pemenang, dan menerima/melihat pencairan secara transparan melalui wallet internal sandbox.

Produk mendukung dua jenis circle:

- **Random Draw:** anggota yang belum pernah menang dipilih secara acak dan dapat diverifikasi.
- **SPSB (Second-Price Sealed-Bid):** anggota memasukkan bid tertutup; bid tertinggi menang dan rate yang dibayar mengikuti bid tertinggi kedua.

### Scope final release

- OTP sandbox untuk user yang sudah terdaftar di database, JWT, profil, dan bank account sandbox.
- Wallet internal, ledger transaksi, dan top-up demo.
- Circle, member, invitation, serta role owner/admin/member.
- Cycle, participant snapshot, obligation/iuran, dan payment proof.
- Pembayaran wallet dan manual transfer review.
- Random draw, SPSB, award, disbursement, dan win history.
- RBAC, pagination cursor, audit event untuk aksi penting, dan automated test core flow.

### Out of scope final release

Crowdfunding, loan, KYC provider nyata, risk blocking, relief request, real payment gateway, withdrawal bank nyata, dan notification worker. Tabel extended dapat dipertahankan sebagai rancangan roadmap, tetapi endpoint/UI-nya bukan bagian dari definition of done.

---

## 2. Core Business Rules

1. Circle bersifat privat; hanya member aktif dapat melihat detail circle dan cycle-nya.
2. Circle hanya dapat dikunci oleh `OWNER`, setelah jumlah member aktif memenuhi `member_limit`.
3. Saat cycle dibuat, member aktif disnapshot sebagai `cycle_participants` dan seluruh participant menerima obligation.
4. `EXCLUDED` berarti tidak eligible untuk menang, **bukan** bebas dari iuran.
5. Pemenang sebelumnya otomatis tidak eligible pada cycle berikutnya dalam circle yang sama.
6. Hanya pemilik obligation yang dapat membuat pembayaran atau mengunggah bukti transfernya.
7. Wallet payment harus atomic: lock wallet, cek saldo, buat payment order, debit wallet, tulis ledger, lalu ubah obligation menjadi `PAID` dalam satu transaksi database.
8. Approval manual transfer tidak pernah mendebit wallet; approval hanya memperbarui payment order dan obligation menjadi `PAID`.
9. Award/disbursement hanya dapat terjadi sekali untuk setiap cycle dan harus idempotent.
10. Pot cycle dihitung dari obligation yang telah `PAID`, bukan dari `member_limit`.
11. Random draw hanya memilih participant `ELIGIBLE` yang belum memiliki award sebelumnya pada circle yang sama.
12. SPSB hanya menerima bid pada window bidding aktif dan di antara `bid_floor_percent` dan `bid_ceiling_percent` circle.
13. Pada SPSB, bid tertinggi menang; `payable_bid_rate_percent` adalah bid tertinggi kedua. Tie-break menggunakan `submitted_at` paling awal lalu `bid_id` paling kecil.
14. Semua nominal uang menggunakan `NUMERIC(18,2)` dan tidak boleh mengandalkan `float`.

---

## 3. State Machine

### Circle

```text
DRAFT → RECRUITING → LOCKED → RUNNING → COMPLETED
                    ↘ SUSPENDED / CANCELLED / ARCHIVED
```

### Random Draw cycle

```text
PENDING → PAYMENT_COLLECTION → READY_FOR_DISBURSEMENT → DISBURSED → COMPLETED
```

### SPSB cycle

```text
PENDING → PAYMENT_COLLECTION → BIDDING_OPEN → BIDDING_CLOSED
        → READY_FOR_DISBURSEMENT → DISBURSED → COMPLETED
```

State transition hanya dilakukan oleh service layer setelah authorization dan kondisi bisnis dipenuhi.

---

## 4. Roles and Access Control

| Action | Authenticated | Member | Admin | Owner |
|---|:---:|:---:|:---:|:---:|
| Create circle | ✓ | ✓ | ✓ | ✓ |
| Read private circle | — | ✓ | ✓ | ✓ |
| Join with invitation | ✓ | ✓ | ✓ | ✓ |
| Create/revoke invitation | — | — | ✓ | ✓ |
| Approve/reject membership | — | — | ✓ | ✓ |
| Lock circle / create cycle | — | — | — | ✓ |
| Submit bid / pay own obligation | — | ✓ | ✓ | ✓ |
| Review manual payment proof | — | — | ✓ | ✓ |
| Resolve award / disbursement | — | — | ✓ | ✓ |

Resource authorization selalu memakai user ID dari JWT, bukan dari request body atau path yang tidak diverifikasi.

---

## 5. API Contract

### Common conventions

- Semua endpoint privat memakai `Authorization: Bearer <JWT>`.
- Semua list memakai cursor pagination: `?limit=20&cursor=<cursor>`; default 20, maksimum 100.
- Request pembayaran mendukung `Idempotency-Key`.
- Response list:

```json
{
  "data": [],
  "meta": { "limit": 20, "next_cursor": null }
}
```

- Response error:

```json
{
  "error": { "code": "FORBIDDEN", "message": "Access denied." }
}
```

### Authentication and user

```text
POST   /auth/otp/request
POST   /auth/otp/verify
GET    /users/me
PATCH  /users/me
GET    /users/me/win-history
GET    /users/me/reputation
```

### Wallet and bank account

```text
GET    /wallet
GET    /wallet/transactions
POST   /wallet/topups                    # DEMO/SANDBOX only
GET    /bank-accounts
POST   /bank-accounts
DELETE /bank-accounts/:bankAccountID
```

### Circle and membership

```text
POST   /circles
GET    /circles
GET    /circles/:circleID
PATCH  /circles/:circleID
POST   /circles/:circleID/lock
POST   /circles/join
POST   /circles/:circleID/invitations
GET    /circles/:circleID/invitations
GET    /circles/:circleID/members
PATCH  /circles/:circleID/members/:userID/role
PATCH  /circles/:circleID/members/:userID/status
```

### Cycle, payment, and award

```text
POST   /circles/:circleID/cycles
GET    /circles/:circleID/cycles
GET    /cycles/:cycleID
GET    /cycles/:cycleID/obligations
POST   /obligations/:obligationID/payments/wallet
POST   /obligations/:obligationID/payments/manual
POST   /payment-orders/:paymentOrderID/proof
POST   /payment-proofs/:paymentProofID/review
POST   /cycles/:cycleID/bids
GET    /cycles/:cycleID/bids/me
POST   /cycles/:cycleID/bidding/close
POST   /cycles/:cycleID/award/resolve
GET    /cycles/:cycleID/award
GET    /cycles/:cycleID/draw-proof
```

---

## 6. Database Requirements

`backend/migrations/001_schema_v2.sql` is the baseline schema. `backend/migrations/000_reset_public_schema.sql` is a destructive local/demo reset script and must not be used as an application migration. The exact run order is documented in [`backend/migrations/README.md`](./backend/migrations/README.md).

Create a new non-destructive hardening migration with the following changes:

1. Add to `draw_results`:
   - `random_seed_reveal`
   - `participant_snapshot_hash`
   - `algorithm_version` default `SHA256_MOD_V1`
2. Add to `cycle_awards`:
   - `penalty_amount NUMERIC(18,2) NOT NULL DEFAULT 0`
   - `net_award_amount NUMERIC(18,2) NOT NULL`
3. Add `UNIQUE (award_id)` to `disbursements`.
4. Add nullable `idempotency_key` to `payment_orders` with a unique partial index.
5. Add cursor indexes for wallet transactions, cycles, memberships, payment orders, and obligations.
6. Enforce or validate these cross-table invariants transactionally:
   - participant membership belongs to the cycle's circle;
   - award participant belongs to the award's cycle;
   - winner is eligible;
   - no duplicate payment/disbursement on retried requests.
7. For final scope, payment is full-payment only; do not expose `PARTIAL` obligation behavior until allocation amounts are modeled.

### Seed requirements

The demo seed must be internally consistent:

- Completed cycle 1 includes obligations, paid payment orders, wallet debits, and wallet ledger records for every contributing member.
- Abda's balance includes both award credit and any paid obligation debit.
- Seeded running circles have `member_limit` equal to their active member count, or include enough demo users to fill their configured capacity.
- SPSB demo has a complete cycle flow: active bids, valid participant snapshot, and a documented next step to close bidding and collect payment before award resolution.
- Seed setup runs inside a transaction and can be re-run safely in local/demo environments.

---

## 7. Non-functional Requirements

- Clean three-layer backend: handler → service → repository.
- Raw SQL through `pgxpool`; services own database transactions.
- JWT signing method is explicitly validated; no hard-coded production fallback secret.
- Password/OTP/demo settings are environment-gated.
- No hard-coded user, circle, wallet, or payment response data outside seed/demo fixtures.
- All money-changing endpoints are atomic, idempotent, and tested.
- Audit events are created for circle locking, manual payment review, award resolution, and disbursement.
- `go build ./...`, backend tests, and frontend build must pass before merge.

---

## 8. Definition of Done

The project is complete when the following demo works against a fresh migration + seed database:

1. A seeded database user logs in through OTP and sees their wallet/profile.
2. Tiara creates a new circle, shares an invite, and a user joins it.
3. Owner locks a full circle and starts a cycle; obligations are created.
4. A member pays an obligation with wallet; transaction appears once in wallet ledger even if the request is retried.
5. A member submits manual proof; owner/admin approves it without wallet debit.
6. Random Draw resolves only eligible unpaid-history-safe participants and records verifiable draw metadata.
7. SPSB selects highest bid and charges the second-highest rate.
8. Award credits winner wallet once, creates a disbursement, and appears in win history.
9. Non-member and non-owner authorization attempts return correct `401`/`403` responses.
10. Paginated list endpoints return deterministic cursor metadata.

---

## 9. Team Ownership

### Tiara — Foundation User Experience (Easy)

**Branch:** `feat/tiara-user-wallet`

**Ownership:**

- OTP request/verify untuk user terdaftar dan JWT integration; tidak membuat user otomatis saat verifikasi.
- User profile read/update.
- Wallet balance, wallet transaction history, and sandbox top-up.
- Bank account CRUD.
- Win history and reputation read endpoint.
- Frontend screens for login, profile, wallet, transaction history, and win history.

**Primary files:**

```text
backend/internal/models/user.go
backend/internal/models/wallet.go
backend/internal/repository/user_repository.go
backend/internal/service/auth_service.go
backend/internal/handlers/auth.go
backend/internal/handlers/user.go
backend/internal/handlers/wallet.go
backend/internal/handlers/bank_account.go
frontend/src/pages/Login*
frontend/src/pages/Profile*
frontend/src/pages/Wallet*
```

### Abda — Core Backend and Circle Hub (Intermediate)

**Branch:** `feat/abda-circle-rbac`

**Ownership:**

- Circle create/detail/list/update.
- Owner membership creation, invitation generation, join flow, member list, and circle lock.
- Circle authorization helper/middleware: member, admin, owner.
- Cursor pagination utility and list endpoint integration.
- Circle/membership/invitation validation and repository queries.
- Frontend screens for circle list, detail, member list, invite, and join circle.

**Primary files:**

```text
backend/internal/models/circle.go
backend/internal/repository/circle_repository.go
backend/internal/service/circle_service.go
backend/internal/handlers/circle.go
backend/internal/middleware/circle_rbac.go
backend/internal/dto/pagination.go
frontend/src/pages/Circles*
frontend/src/pages/CircleDetail*
```

### Leroy — Arisan Application Logic (Advanced)

**Branch:** `feat/leroy-arisan-engine`

**Ownership:**

- Hardening migration and consistent demo seed.
- Cycle creation, participant snapshot, obligation issuance, and cycle state transitions.
- Wallet/manual payment order flows, payment proof review, idempotency, and transaction locking.
- SPSB bid/resolve algorithm and Random Draw commit–reveal algorithm.
- Award calculation, penalty/net award, disbursement, audit event, and winner wallet credit.
- Core engine tests and API route integration in `main.go` after peer PRs merge.
- Frontend screens for obligation payment, owner payment review, bidding, draw result, and award result.

**Primary files:**

```text
backend/migrations/002_core_hardening.sql
backend/migrations/003_seed_demo_data.sql
backend/internal/models/arisan.go
backend/internal/models/payment.go
backend/internal/repository/arisan_repository.go
backend/internal/repository/draw_repository.go
backend/internal/service/arisan_service.go
backend/internal/service/draw_service.go
backend/internal/handlers/payment.go
backend/internal/handlers/draw.go
backend/cmd/api/main.go
frontend/src/pages/Cycle*
frontend/src/pages/Payment*
frontend/src/pages/Bidding*
frontend/src/pages/Award*
```

### Merge order

1. Leroy merges migration and seed hardening first.
2. Tiara and Abda merge independently after building against the hardened schema.
3. Leroy integrates routes, completes engine authorization checks, and runs end-to-end flow tests.
4. Every PR targets `main`, requires another team member review, and must not push directly to `main`.
