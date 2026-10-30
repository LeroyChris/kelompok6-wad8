# ArisanKita — Frontend (React + Vite)

SPA untuk backend ArisanKita (Go/Gin, `/api/v1`). Plain JavaScript + React 19 + Vite.
Kontrak API mengikuti [`../prd.md`](../prd.md) dan implementasi nyata di `../backend`.

## Menjalankan

```bash
cp .env.example .env       # opsional: ubah VITE_API_BASE_URL
npm install
npm run dev                # http://localhost:5173
```

Backend harus berjalan di `http://localhost:8080` (default) dengan database yang
sudah di-seed. Lihat `../backend/docs/API_DEMO.md` untuk akun demo dan alur login.

## Akun demo & OTP

Login memakai email + OTP. Di lingkungan non-production kode sandbox `123456`.
Akun seed: `tiara@`, `abda@`, `leroy@`, `nadia@arisankita.id`.

## Struktur

```text
src/
├── App.jsx                 # shell: sidebar, routing state, auth gate
├── main.jsx                # entrypoint
├── index.css               # seluruh styling
├── lib/util.js             # formatter + hook (useApi, useCursorList)
├── services/api.js         # klien API (unwrap envelope { code, status, message, data })
└── pages/
    ├── AuthPage.jsx        # OTP request + verify
    ├── OverviewPage.jsx    # ringkasan wallet, reputasi, circle, aktivitas
    ├── CirclesPage.jsx     # list, buat, gabung via kode undangan
    ├── CircleDetailPage.jsx# info, anggota, siklus, undangan, review pembayaran
    ├── CyclePage.jsx       # kewajiban + bayar, bidding SPSB, hasil & draw proof
    ├── WalletPage.jsx      # saldo, top-up, mutasi, rekening bank
    └── ProfilePage.jsx     # profil, reputasi, riwayat kemenangan
```

## Skrip

```bash
npm run dev      # dev server
npm run build    # produksi (vite build)
npm run lint     # oxlint
npm run preview  # pratinjau hasil build
```
