# ArisanKita - Backend Service (Go Gin)

REST API untuk platform arisan komunal privat **ArisanKita** menggunakan **Go (Golang)**, framework **Gin**, dan **PostgreSQL (Supabase)** dengan **Raw SQL (`jackc/pgx/v5`)**.

---

## 🚀 Panduan Setup Singkat (Untuk Semua Anggota)

### 1. Salin Environment
Di dalam folder `backend/`, copy file template env:
```bash
cp .env.example .env
```
Isi variabel `DATABASE_URL` dengan connection string Supabase tim.

### 2. Setup Database Supabase (Cukup 1 Orang yang Eksekusi)
1. Buka dashboard Supabase project kelompok.
2. Masuk ke menu **SQL Editor**.
3. Buka file `migrations/000001_init_schema.sql`, copy semua isinya dan jalankan di SQL Editor Supabase.
4. Semua 7 tabel (`users`, `circles`, `circle_members`, `arisan_cycles`, `bids`, `crowdfunding_campaigns`, `transactions`) akan langsung terbuat.

### 3. Menjalankan Backend Lokal
```bash
cd backend
go run ./cmd/api/main.go
```
Server akan berjalan di `http://localhost:8080`.

---

## 👥 Pembagian Tugas 3 Orang (Bekerja Asinkron Tanpa Konflik)

Setiap anggota memiliki domain fitur dan file sendiri dari layer Model -> Repository (SQL) -> Service (Logic) -> Handler (HTTP).

| Peran | Anggota | Fokus Domain | File Tanggung Jawab |
|---|---|---|---|
| **Track 1** | **Anggota 1** | Auth, Profile & JWT | `models/user.go`<br>`repository/user_repository.go`<br>`service/auth_service.go`<br>`middleware/auth.go`<br>`handlers/auth.go`, `handlers/user.go` |
| **Track 2** | **Anggota 2** | Circle Hub & Membership | `models/circle.go`<br>`repository/circle_repository.go`<br>`service/circle_service.go`<br>`handlers/group.go` |
| **Track 3** | **Anggota 3** | Core Engine Lelang, Spin & Bayar | `models/arisan.go`<br>`repository/arisan_repository.go`<br>`service/arisan_service.go`<br>`handlers/draw.go`, `handlers/payment.go` |

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
│   │   └── auth.go                  # JWT Auth Middleware (Track 1)
│   ├── models/                      # Struct tabel DB
│   │   ├── user.go                  # (Track 1)
│   │   ├── circle.go                # (Track 2)
│   │   └── arisan.go                # (Track 3)
│   ├── repository/                  # Raw SQL (pgxpool)
│   │   ├── user_repository.go       # (Track 1)
│   │   ├── circle_repository.go     # (Track 2)
│   │   └── arisan_repository.go     # (Track 3)
│   ├── service/                     # Business logic
│   │   ├── auth_service.go          # (Track 1)
│   │   ├── circle_service.go        # (Track 2)
│   │   └── arisan_service.go        # (Track 3)
│   ├── handlers/                    # HTTP Controller (Request & Response)
│   │   ├── auth.go & user.go        # (Track 1)
│   │   ├── group.go                 # (Track 2)
│   │   └── draw.go & payment.go     # (Track 3)
│   └── dto/
│       └── response.go              # Format JSON APIResponse standar
└── migrations/
    └── 000001_init_schema.sql       # 7 Tabel PostgreSQL siap pakai di Supabase
```

---

## 🌿 Aturan Git Kerja Kelompok
1. **Jangan commit langsung ke `main`**.
2. Buat branch masing-masing:
   - Anggota 1: `git checkout -b feat/auth-user`
   - Anggota 2: `git checkout -b feat/circle-membership`
   - Anggota 3: `git checkout -b feat/arisan-engine`
3. Push branch masing-masing dan buka **Pull Request (PR)** ke branch `main`.
