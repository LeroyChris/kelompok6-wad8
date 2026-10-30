# Iteration Notes

Handoff untuk iterasi berikutnya. SSOT produk & API: [`prd.md`](./prd.md).

**Status: stabil & sudah masuk `main`.** Tidak ada pekerjaan yang tertahan.

---

## 1. Kondisi saat ini

- Branch kerja: `prod-enhanced` (isinya identik dengan `main`).
- PR #54 & #55 sudah di-merge ke `main`. `git diff --stat origin/prod-enhanced origin/main` → kosong.
- Yang sudah beres di iterasi ini:
  - `frontend/` (React 19 + Vite SPA) menggantikan app Next.js lama; semua layar DoD terhubung API nyata.
  - Fix RBAC: route `/cycles/:id/*` pakai `RequireCycleRole` (sebelumnya `RequireCircleRole` → semua aksi owner 403).
  - Fix produksi OTP: `/auth/otp/verify` benar-benar menyimpan & memvalidasi kode (TTL 5 menit, constant-time, sekali pakai).
  - Fix auth: fallback password sandbox di `/auth/login` di-gate hanya untuk mode sandbox.
  - Polish repo: README, LICENSE (MIT), `.gitignore` per-folder, `.env.example`; hapus file root mati (`docker-compose.yml`, `go.work*`, `SUPABASE_MIGRATION.md`).

## 2. Cara menjalankan (lokal)

```bash
# DB (kosong/demo)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/000_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/001_schema_v2.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/002_seed_demo_data.sql

# Backend
cd backend && cp .env.example .env   # set DATABASE_URL + JWT_SECRET
go run ./cmd/api/main.go             # :8080

# Frontend
cd frontend && cp .env.example .env
npm install && npm run dev           # :5173
```

Login memakai **email + OTP**. `APP_ENV=development` → kode sandbox `123456`.
Akun seed: `tiara@`, `abda@`, `leroy@`, `nadia@arisankita.id`.

## 3. Verifikasi yang sudah lulus

- `go build ./...`, `go vet ./...`, `go test ./...` (6 unit test OTP + fallback).
- `frontend`: `vite build` + `oxlint`.
- E2E backend live (scratch DB): random-draw flow **24/24**, SPSB second-price **19/19**.
- Login gating: `development` → `123456` 200 / salah 401; `production` → semua 401.

> Skrip smoke E2E masih di `/tmp/opencode/{e2e.py,spsb.py,check_login.sh}` (belum di-commit, `/tmp` bisa hilang). Pertimbangkan pindahkan ke `backend/docs/` atau `scripts/` di iterasi berikut.

## 4. Utang teknis / langkah berikutnya (prioritas)

1. **`JWT_SECRET`** — `generateToken` punya fallback dev hardcoded (`arisankita_secret_key_development_mode_2026`). Ganti jadi random-per-boot atau tolak start bila `JWT_SECRET` kosong kecuali mode dev eksplisit. `.env.example` juga masih pakai secret contoh yang gampang dipakai apa adanya.
2. **OTP store in-memory** (`AuthHandler.otpCodes`) — hilang saat restart, tidak aman multi-replica. Untuk produksi: pindah ke Redis/DB.
3. **Rate limit** `/auth/otp/request` — belum ada; `RequestEmailOTP` juga auto-register email apa pun (by design, tapi bisa di-spam).
4. **Token disimpan di `localStorage`** — tradeoff XSS standar; pertimbangkan httpOnly cookie bila perlu.
5. **CI + test** — belum ada workflow; frontend belum ada test. Gin masih "trust all proxies".

## 5. Catatan penting (jangan terkejut)

- **Deviasi path backend vs PRD §5** — frontend ikut backend aktual:
  - `PATCH /circles/:id/members/:userID` (role + status digabung, bukan dua endpoint).
  - `POST /payments/:id/proof` (bukan `/payment-orders/:id/proof`).
- **Envelope response**: `{ code, status, message, data }`. List menaruh `items` + `meta` di dalam `data`. Login/verify: token di `data.token.access`, user di `data.user`.
- `backend/.env` gitignored. Sandbox OTP butuh `APP_ENV=development` (atau `SANDBOX_OTP_CODE` diset).
- Migrasi **wajib** urut `000` → `001` → `002`; `000` destruktif (reset schema `public`).
- Path backend: `RequireCircleRole`, `RequireCycleRole` di `backend/cmd/api/main.go`; handler di `backend/internal/handlers/`.

## 6. Peta file kunci

- Backend: `cmd/api/main.go` (route + middleware), `internal/handlers/{auth,circle,draw,payment,wallet,user,bank_account}.go`, `internal/middleware/{auth,rbac}.go`.
- Frontend: `src/App.jsx` (shell + routing state), `src/services/api.js` (klien API), `src/lib/util.js` (hook + formatter), `src/pages/*`.
- Docs: `prd.md` (SSOT), `backend/README.md`, `backend/docs/API_DEMO.md`, `frontend/README.md`.
