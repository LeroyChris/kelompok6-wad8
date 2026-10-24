============================================================
   SUPABASE DATABASE MIGRATION - Password Auth
============================================================

Tutorial untuk menambahkan dukungan password ke database Supabase.

============================================================
   1. TAMBAHKAN KOLOM password_hash KE TABLE users
============================================================

Jalankan SQL ini di Supabase Dashboard -> SQL Editor:

```sql
-- Add password_hash column to users table
-- Kolom ini nullable untuk migrasi bertahap, nanti diisi untuk user yang login pakai password

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Opsional: Buat index untuk performa pencarian password
CREATE INDEX IF NOT EXISTS idx_users_password_hash ON users(password_hash);
```

============================================================
   2. GENERATE BCRYPT HASH
============================================================

Gunakan Go atau tool lainnya untuk generate hash bcrypt:

```go
package main

import (
    "fmt"
    "golang.org/x/crypto/bcrypt"
)

func main() {
    // Generate hash untuk password "123456" dengan cost factor 12
    hash, err := bcrypt.GenerateFromPassword(
        []byte("123456"), 
        bcrypt.DefaultCost,  // atau bcrypt.Cost(12) untuk produksi
    )
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(string(hash))
}
```

Atau gunakan CLI:
```bash
echo -n "123456" | bcrypt \
  # atau gunakan online bcrypt generator
```

Result hash example:
```
$2a$10$XSoifYbTLaRu7954eBip1eBX.NifJVUpjTSW8bdeBI977UpL5tyM6
```

============================================================
   3. INSERT HASH KE DATABASE
============================================================

Setelah generate hash, simpan ke users table:

```sql
UPDATE users
SET password_hash = '$2a$10$XSoifYbTLaRu7954eBip1eBX.NifJVUpjTSW8bdeBI977UpL5tyM6'
WHERE email = 'admin@arisankita.id';
```

============================================================
   4. VERIFIKASI LOGIN
============================================================

Setelah hash disimpan, coba login pakai password:
- POST /api/v1/auth/login dengan body: {"email": "admin@arisankita.id", "password": "123456"}
- Akan berhasil menghasilkan JWT token jika password benar

============================================================
   5. PRODUCTION SETUP SESELSIANA
============================================================

# Ubah di backend/.env production:
APP_ENV=production

# Nonaktifkan sandbox fallback (opsional)
# Gunakan hanya password/hash, atau biarkan fallback ke SANDBOX_OTP_CODE untuk emergency

# Pastikan JWT_SECRET kuat dan tidak ada di codebase
JWT_SECRET=uat-secret-key-change-immediately

# CORS diproduction harus hanya domain yang valid
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-domain.com

# SMTP harus konfigurasi ke SendGrid/SES untuk produksi
# Mailpit hanya bekerja di development (APP_ENV != production)
# Jika SMTP_HOST = mailpit dan APP_ENV = production, 
# sistem akan error karena mailpit bukan SMTP production

# Test full flow:
# 1. Register via /api/v1/auth/otp/request
# 2. Cek email di Mailpit (dev) atau kirim email ke user (prod)
# 3. Verifikasi OTP di /api/v1/auth/otp/verify
# 4. Atau login pakai password di /api/v1/auth/login
# 5. Akses protected route dengan Bearer token
```

============================================================
   6. CEKLIST DEPLOYMENT PRODUKSI
============================================================

✅ DATABASE:
- [ ] Supabase project created
- [ ] DATABASE_URL terisi benar di .env
- [ ] Kolom password_hash ditambahkan ke users table (opsional, untuk password login)
- [ ] Indexes dieksekusi (opsional, untuk performa)

✅ SMTP:
- [ ] SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD diisi
- [ ] Jika produksi: SendGrid/SES dicek koneksi
- [ ] Jika development: Mailpit dijalankan (mailpit serve)
- [ ] SMTP_FROM_NAME dan SMTP_FROM_ADDR diisi

✅ JWT & SECURITY:
- [ ] JWT_SECRET digenerate acak (32+ karakter)
- [ ] BUKAN gunakan nilai default di produksi
- [ ] APP_ENV = "production"

✅ FRONTEND:
- [ ] npm run build sukses
- [ ] VITE_API_BASE_URL terisi (atau gunakan default http://localhost:8080)
- [ ] Halaman login/OTP berfungsi

✅ BACKEND:
- [ ] go build ./... lulus
- [ ] go test ./... lulus
- [ ] Server start: go run ./cmd/api/main.go
- [ ] Semua endpoint terproteksi middleware

✅ MAILPIT (dev only):
- [ ] mailpit serve jalan di port 1025
- [ ] http://localhost:8025 bisa diakses untuk lihat email terkirim
- [ ] Uji flow: register → cek mail → verifikasi OTP

✅ TESTING:
- [ ] Register baru dengan email → dapatkan OTP
- [ ] Masukkan OTP → login berhasil
- [ ] Login pakai password (jika diaktifkan) → login berhasil
- [ ] Protected routes (/users/me, /wallet, /circles) butuh token
- [ ] Rate limiting aktif (header X-RateLimit-Remaining)
- [ ] Request ID terlihat di header X-Request-ID

============================================================
   7. DEPLOYMENT COMMANDS
============================================================

# Backend (Docker atau langsung)
docker build -t arisankita/backend ./backend
# Atau langsung:
cd backend && go build ./cmd/api/main.go
# Jalankan:
PORT=8080 APP_ENV=production go run ./cmd/api/main.go

# Atau pakai docker-compose:
# lihat di bawah untuk sample docker-compose.yml

# Frontend (Vercel/Netlify/Docker)
cd frontend
npm run build
# Deploy hasil folder .next/ ke Vercel/Netlify

# Sample docker-compose.yml:
# services:
#   backend:
#     build: ./backend
#     ports: ["8080:8080"]
#     environment:
#       - DATABASE_URL=postgresql://...
#       - APP_ENV=production
#       - SMTP_HOST=smtp.sendgrid.net
#       - ...
#   mailpit:
#     image: axllent/mailpit
#     ports: ["1025:1025", "8025:8025"]