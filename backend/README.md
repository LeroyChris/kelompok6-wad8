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

### 2. Setup Database
Jalankan migration dan seed berurutan pada database lokal/demo yang kosong:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/000_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_schema_v2.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/002_core_hardening.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/003_seed_demo_data.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/004_audit_events.sql
```

`001_schema_v2.sql` adalah baseline schema, `002_core_hardening.sql` menguatkan invariant core dan pagination, sedangkan `003_seed_demo_data.sql` hanya untuk demo. Lihat [`migrations/README.md`](./migrations/README.md) untuk urutan lengkap dan peringatan reset. Product/API contract resmi tersedia di [`../prd.md`](../prd.md).

Panduan login, akun seed, dan curl endpoint demo tersedia di [`docs/API_DEMO.md`](./docs/API_DEMO.md).

### 3. Menjalankan Backend Lokal
```bash
cd backend
go run ./cmd/api/main.go
```
Server akan berjalan di `http://localhost:8080`.

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
│   │   └── auth.go                  # JWT Auth Middleware & RBAC helpers
│   ├── models/                      # Struct Go representasi tabel DB core
│   │   ├── user.go                  # (Track 1)
│   │   ├── circle.go                # (Track 2)
│   │   ├── arisan.go                # (Track 3)
│   │   ├── payment.go               # (Track 3)
│   │   └── wallet.go                # Wallet ledger
│   ├── handlers/                    # HTTP Controller (query SQL langsung via pgxpool)
│   │   ├── auth.go, user.go, bank_account.go, wallet.go # (Track 1)
│   │   ├── circle.go                          # (Track 2)
│   │   └── draw.go, payment.go                # (Track 3)
│   └── dto/
│       ├── request.go               # Payload request
│       └── response.go              # APIResponse standar
├── migrations/
│   ├── 000_reset_public_schema.sql    # Reset destruktif (dev/demo saja)
│   ├── 001_schema_v2.sql              # Baseline DDL + hardening + audit
│   └── 002_seed_demo_data.sql         # Seed local/demo
└── docs/
    ├── API_DEMO.md              # Panduan flow API end-to-end
    └── sql/
        └── 002_core_queries.sql     # Referensi Raw SQL Core siap pakai
```

---

## 🌿 Aturan Git Kerja Kelompok
1. **Dilarang keras push langsung ke branch `main`**.
2. Setiap anggota checkout branch fitur masing-masing dari `main`:
   ```bash
   git checkout -b feat/tiara-user-wallet       # Tiara
   git checkout -b feat/abda-circle-rbac        # Abda
   git checkout -b feat/leroy-arisan-engine     # Leroy
   ```
3. Commit berkala dengan pesan jelas (contoh: `feat(auth): implement register query raw sql`).
4. Buka **Pull Request (PR)** ke `main` dan request review ke teman sekelompok sebelum di-merge.
