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
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Lucide Icons |
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
│   ├── internal/             # Core logic (models, repository, service, handlers)
│   ├── migrations/           # Database DDL & schema migrations
│   └── README.md             # Dokumentasi internal backend
├── frontend/                 # Client Single Page Application (SPA)
│   ├── src/                  # React components, pages & UI
│   └── package.json
├── .gitignore                # Repository ignore rules
└── README.md                 # Dokumentasi publik proyek
```

---

## 🚀 Memulai (Getting Started)

### Prasyarat
- [Go](https://go.dev/) (versi 1.22 atau lebih baru)
- [Node.js](https://nodejs.org/) (versi 20 atau lebih baru) & npm
- PostgreSQL database (lokal atau cloud instance seperti Supabase/Neon)

### 1. Kloning Repositori
```bash
git clone https://github.com/roychrstpr/kelompok6-wad8.git
cd kelompok6-wad8
```

### 2. Setup Database
Jalankan file SQL DDL yang tersedia untuk menginisialisasi skema tabel:
```bash
# Jalankan berurutan pada database lokal/demo yang kosong
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/000_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/001_schema_v2.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/002_core_hardening.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/003_seed_demo_data.sql
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
npm install
npm run dev
```
Aplikasi web aktif di `http://localhost:5173`.

---

## 📄 Lisensi

Proyek ini dikembangkan di bawah lisensi [MIT License](LICENSE).
