# ArisanKita 🪙

> **Modern Closed-Loop Community SaaS & Rotating Savings and Credit Association (ROSCA) Platform.**

ArisanKita adalah platform manajemen arisan komunal privat dan patungan modal internal (*Internal Crowdfunding*) yang mendigitalisasi tradisi arisan lokal secara aman, adil, dan transparan. Dirancang khusus untuk komunitas tertutup (rekan kantor, asosiasi UMKM/pedagang pasar, klub olahraga, dan keluarga).

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

### 3. Patungan Modal Internal (*Closed-Loop Crowdfunding*)
- Kampanye pinjaman/patungan modal tambahan antar sesama anggota satu Circle.
- Pembayaran cicilan terpotong otomatis pada iuran putaran berikutnya.

### 4. Zero-Friction Onboarding & Audit Keamanan
- Registrasi ringan tanpa KTP di awal.
- Log transaksi terverifikasi dengan audit trail hash (SHA-256).
- Skor reputasi anggota (*reputation score*) berbasis riwayat pembayaran.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Lucide Icons |
| **Backend** | Go (Golang), Gin Web Framework |
| **Database** | PostgreSQL, `jackc/pgx/v5` (High-Performance Raw SQL Connection Pool) |
| **Security** | JWT Authentication, Bcrypt Password Hashing |
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
# Eksekusi migrasi di instance PostgreSQL Anda
psql -h <HOST> -U <USER> -d <DBNAME> -f backend/migrations/000001_init_schema.sql
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
