# ArisanKita - Backend Service (Go Gin)

REST API untuk platform arisan komunal privat **ArisanKita** menggunakan **Go (Golang)**, framework **Gin**, dan **PostgreSQL (Supabase)** dengan **Raw SQL (`jackc/pgx/v5`)**.

---

## 🚀 Panduan Setup Singkat

### 1. Salin Environment
Di dalam folder `backend/`, copy file template:
```bash
cp .env.example .env
```
Isi variabel `DATABASE_URL` dengan connection string Supabase tim (port `6543` pooler atau `5432` direct).

### 2. Status Skema Database Supabase
Database telah sinkron dengan dokumen resmi **ARISANKITA_API_ERD_DESIGN.pdf** (total 32 tabel):
- **Core Layer (19 Tabel)**: `migrations/001_core_schema.sql`
- **Extended Layer (13 Tabel)**: `migrations/003_extended_schema.sql`
- **Query Reference (pgx contract)**: `docs/sql/002_core_queries.sql` & `docs/sql/004_extended_queries.sql`

### 3. Menjalankan Backend Lokal
```bash
cd backend
go run ./cmd/api/main.go
```
Server akan berjalan di `http://localhost:8080`.

---

## 👥 Pembagian Tugas 3 Orang (Bekerja Asinkron Tanpa Konflik)

| Peran & Branch | Anggota | Fokus Domain & Tabel DB | File Tanggung Jawab |
|---|---|---|---|
| **Track 1**<br>`feat/user-wallet-profile` | **Anggota Awam** | **Auth, Profil, Win History & In-App Wallet**<br>• `users`<br>• `user_auth_identities`<br>• `user_wallets`<br>• `wallet_transactions`<br>• `user_bank_accounts` | • `models/user.go`<br>• `models/wallet.go`<br>• `repository/user_repository.go`<br>• `service/auth_service.go`<br>• `handlers/auth.go`<br>• `handlers/user.go`<br>• `handlers/wallet.go`<br>• `handlers/bank_account.go` |
| **Track 2**<br>`feat/circle-hub` | **Anggota 2** | **Circle Hub, Member & Undangan**<br>• `circles`<br>• `circle_memberships`<br>• `circle_invitations` | • `models/circle.go`<br>• `repository/circle_repository.go`<br>• `service/circle_service.go`<br>• `handlers/circle.go` |
| **Track 3**<br>`feat/arisan-payment-engine` | **Lead / Advanced** | **Core Engine Lelang, Kocokan & Bayar**<br>• `arisan_cycles`, `cycle_participants`<br>• `cycle_obligations`, `bids`<br>• `cycle_awards`, `draw_results`<br>• `payment_orders`, `payment_proofs` | • `models/arisan.go`<br>• `models/payment.go`<br>• `repository/arisan_repository.go`<br>• `service/arisan_service.go`<br>• `handlers/draw.go`<br>• `handlers/payment.go` |

---

## 📂 Struktur Arsitektur (Standard 3-Layer)

```text
backend/
├── cmd/
│   └── api/
│       └── main.go                  # Routing HTTP & entry point
├── internal/
│   ├── config/
│   │   └── database.go              # Koneksi Supabase PostgreSQL (pgxpool)
│   ├── middleware/
│   │   ├── auth.go                  # JWT Auth Middleware (Track 1)
│   │   └── cors.go                  # CORS policy
│   ├── models/                      # Struct Go representasi 32 tabel DB
│   │   ├── user.go                  # (Track 1)
│   │   ├── circle.go                # (Track 2)
│   │   ├── arisan.go                # (Track 3)
│   │   ├── payment.go               # (Track 3)
│   │   ├── crowdfunding.go          # (Extended)
│   │   └── compliance.go            # (Extended)
│   ├── repository/                  # Raw SQL (pgxpool)
│   │   ├── user_repository.go       # (Track 1)
│   │   ├── circle_repository.go     # (Track 2)
│   │   └── arisan_repository.go     # (Track 3)
│   ├── service/                     # Business logic
│   │   ├── auth_service.go          # (Track 1)
│   │   ├── circle_service.go        # (Track 2)
│   │   └── arisan_service.go        # (Track 3)
│   ├── handlers/                    # HTTP Controller
│   │   ├── auth.go, user.go, bank_account.go # (Track 1)
│   │   ├── circle.go, group.go               # (Track 2)
│   │   └── draw.go, payment.go               # (Track 3)
│   └── dto/
│       ├── request.go               # Payload request
│       └── response.go              # APIResponse standar
├── migrations/
│   ├── 001_core_schema.sql          # DDL Core MVP (19 tabel)
│   └── 003_extended_schema.sql      # DDL Extended (13 tabel)
└── docs/
    └── sql/
        ├── 002_core_queries.sql     # Referensi Raw SQL Core siap pakai
        └── 004_extended_queries.sql # Referensi Raw SQL Extended
```

---

## 🌿 Aturan Git Kerja Kelompok
1. **Dilarang keras push langsung ke branch `main`**.
2. Setiap anggota checkout branch fitur masing-masing dari `main`:
   ```bash
   git checkout -b feat/user-bank-profile       # Track 1
   git checkout -b feat/circle-hub             # Track 2
   git checkout -b feat/arisan-payment-engine  # Track 3
   ```
3. Commit berkala dengan pesan jelas (contoh: `feat(auth): implement register query raw sql`).
4. Buka **Pull Request (PR)** ke `main` dan request review ke teman sekelompok sebelum di-merge.
