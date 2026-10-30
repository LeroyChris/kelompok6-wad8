# ArisanKita 🪙

> **Platform arisan privat dengan wallet sandbox dan mekanisme Random Draw/SPSB.**

ArisanKita adalah platform manajemen arisan komunal privat yang mendigitalisasi iuran, penentuan pemenang, dan pencairan dana secara transparan. Dirancang untuk komunitas tertutup seperti keluarga, rekan kantor, atau komunitas hobi.

Product scope dan kontrak backend resmi tersedia di [`prd.md`](./prd.md).

---

## ✨ Fitur Utama

### 1. Dual-Track Arisan Engine
- **Track A (Bisnis & UMKM):** Menggunakan mekanisme lelang rahasia **SPSB (*Second-Price Sealed-Bid*)**. Anggota yang membutuhkan modal darurat mengajukan penawaran bunga secara tertutup; pemenang membayar bunga senilai penawaran tertinggi kedua.
- **Track B (Sosial & Komunitas):** Menggunakan sistem **Undian Acak (*Random Spin Wheel*)** yang adil, transparan, dan tanpa bunga untuk arisan keluarga atau komunitas hobi.

### 2. Inner Circle Management
- Undangan privat berbasis **Invite Code**.
- Approval queue anggota baru oleh Leader/Ketua Circle.
- Status siklus otomatis: *Recruiting* ➔ *Locked* ➔ *Bidding/Spin* ➔ *Payment* ➔ *Disbursed* ➔ *Completed*.
- Matriks monitoring iuran (Lunas, Pending, Menunggak).

### 3. Wallet Sandbox & Audit
- Pembayaran iuran melalui wallet internal atau bukti transfer manual.
- Mutasi wallet, payment order, dan disbursement tercatat untuk kebutuhan demo dan audit.
- Registrasi ringan tanpa KTP di awal.

### Roadmap (bukan scope final)
- Crowdfunding internal, loan, KYC provider, payment gateway sungguhan, dan withdrawal bank.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | React 19, Vite (JavaScript SPA, CSS kustom) |
| **Backend** | Go (Golang), Gin Web Framework |
| **Database** | PostgreSQL, `jackc/pgx/v5` (High-Performance Raw SQL Connection Pool) |
| **Security** | JWT Authentication, resource-level RBAC |
| **Architecture** | 3-Tier Layered Architecture (Handler, Service, Repository) |

---

## 🏗️ Struktur Proyek

```text
.
├── backend/                  # RESTful API Go Gin
│   ├── cmd/api/main.go       # Server entry point & routing
│   ├── internal/             # Core logic (models, handlers, service, middleware)
│   ├── migrations/           # Database DDL & schema migrations
│   ├── docs/                 # Panduan API & query referensi
│   ├── .env.example          # Template environment backend
│   └── README.md             # Dokumentasi internal backend
├── frontend/                 # Client Single Page Application (SPA)
│   ├── src/                  # React pages, komponen, API client
│   ├── .env.example          # Template environment frontend
│   ├── package.json
│   └── README.md             # Dokumentasi internal frontend
├── prd.md                    # Product & API contract (SSOT)
├── .gitignore                # Repository ignore rules
└── README.md                 # Dokumentasi publik proyek
```

---

## 🚀 Memulai (Getting Started)

### Prasyarat
- [Go](https://go.dev/) (versi 1.27 atau lebih baru)
- [Node.js](https://nodejs.org/) (versi 20 atau lebih baru) & npm
- PostgreSQL database (lokal atau cloud instance seperti Supabase/Neon)

### 1. Kloning Repositori
```bash
git clone https://github.com/LeroyChris/kelompok6-wad8.git
cd kelompok6-wad8
```

### 2. Setup Database
Jalankan file SQL DDL yang tersedia untuk menginisialisasi skema tabel:
```bash
# Jalankan berurutan pada database lokal/demo yang kosong
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/000_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/001_schema_v2.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/002_seed_demo_data.sql
```

### 3. Menjalankan Backend
```bash
cd backend
cp .env.example .env
# Sesuaikan DATABASE_URL dan JWT_SECRET di file .env

go run ./cmd/api/main.go
```
API server aktif di `http://localhost:8080`.

### 4. Menjalankan Frontend
```bash
cd ../frontend
cp .env.example .env       # opsional: sesuaikan VITE_API_BASE_URL
npm install
npm run dev
```
Aplikasi web aktif di `http://localhost:5173`.

### 5. Login Demo
Backend harus berjalan di `http://localhost:8080` dengan database yang sudah di-seed.
Login memakai **email + OTP**. Saat `APP_ENV=development` (sandbox), kode OTP-nya
`123456`. Akun seed:

| Email | Peran |
|---|---|
| `tiara@arisankita.id` | Owner circle Random Draw |
| `abda@arisankita.id` | Owner circle SPSB |
| `leroy@arisankita.id` | Anggota |
| `nadia@arisankita.id` | Anggota |

Alur login, endpoint, dan contoh `curl` ada di [`backend/docs/API_DEMO.md`](./backend/docs/API_DEMO.md).

---

## 📄 Lisensi

Proyek ini dikembangkan di bawah lisensi [MIT License](LICENSE).
