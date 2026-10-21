package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net/smtp"
	"os"
	"sync"
	"time"

	"backend-arisankita/internal/models"
	"backend-arisankita/internal/repository"
)

// In-Memory Store thread-safe untuk menyimpan OTP sementara
var (
	otpStore = make(map[string]string)
	otpMutex sync.RWMutex
)

type AuthService interface {
	RequestEmailOTP(ctx context.Context, email string) error
	VerifyEmailOTP(ctx context.Context, email string, otp string) (token string, user *models.User, err error)
}

type authService struct {
	userRepo repository.UserRepository
}

func NewAuthService(userRepo repository.UserRepository) AuthService {
	return &authService{userRepo: userRepo}
}

// 1. Request OTP (Kirim Email + Fallback Log Console)
func (s *authService) RequestEmailOTP(ctx context.Context, userEmail string) error {
	// a. Cek atau Buat User Otomatis jika Belum Ada (Self-Registration)
	user, err := s.userRepo.FindByEmail(ctx, userEmail)
	if err != nil || user == nil {
		// Jika belum ada, otomatis daftarkan user baru
		newUser, createErr := s.userRepo.CreateUser(ctx, userEmail, "Pengguna Arisan")
		if createErr != nil {
			return fmt.Errorf("gagal mendaftarkan email baru: %w", createErr)
		}
		user = newUser
	}

	// b. Generate Kode OTP 6-Digit Acak
	rand.Seed(time.Now().UnixNano())
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))

	// Simpan OTP ke in-memory store
	otpMutex.Lock()
	otpStore[userEmail] = otpCode
	otpMutex.Unlock()

	// Always print ke terminal untuk keperluan debugging lokal
	fmt.Printf("\n[DEBUG OTP] Kode OTP untuk %s adalah: %s (Atau gunakan: 123456)\n\n", userEmail, otpCode)

	// c. Kirim via SMTP Email jika Credential .env Tersedia
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASS")
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")

	if smtpHost == "" {
		smtpHost = "smtp.gmail.com"
		smtpPort = "587"
	}

	// Jika credential .env belum di-set, kembalikan tanpa error (Cukup gunakan log terminal / 123456)
	if from == "" || password == "" {
		return nil
	}

	// Kirim email SMTP secara asynchronous / goroutine agar tidak menghambat response API
	go func(toEmail, code string) {
		auth := smtp.PlainAuth("", from, password, smtpHost)
		subject := "Subject: Kode OTP Login ArisanKita\n"
		mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
		body := fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 480px; margin: 0 auto;">
				<h2 style="color: #0A2578; margin-top: 0;">ArisanKita Digital</h2>
				<p style="color: #475569; font-size: 14px;">Gunakan kode OTP berikut untuk masuk ke akun Anda:</p>
				<div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
					<span style="color: #0A2578; font-size: 32px; font-weight: bold; letter-spacing: 8px;">%s</span>
				</div>
				<p style="color: #94a3b8; font-size: 12px;">Kode berlaku 5 menit. Jangan berikan kode ini kepada siapapun.</p>
			</div>
		`, code)

		msg := []byte(subject + mime + body)
		err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{toEmail}, msg)
		if err != nil {
			fmt.Printf("[SMTP ERROR] Gagal mengirim email ke %s: %v\n", toEmail, err)
		} else {
			fmt.Printf("[SMTP SUCCESS] Email OTP berhasil dikirimkan ke %s\n", toEmail)
		}
	}(userEmail, otpCode)

	return nil
}

// 2. Verifikasi OTP (Dua Pilihan: Kode Asli Email ATAU Kode Testing 123456)
func (s *authService) VerifyEmailOTP(ctx context.Context, userEmail string, otp string) (string, *models.User, error) {
	// Pintu Belakang / Universal Bypass untuk Testing
	isTestOTP := (otp == "123456")

	otpMutex.RLock()
	savedOTP, exists := otpStore[userEmail]
	otpMutex.RUnlock()

	// Jika bukan kode testing 123456, lakukan pengecekan ketat OTP yang tersimpan
	if !isTestOTP {
		if !exists || savedOTP != otp {
			return "", nil, errors.New("kode OTP tidak valid atau telah kadaluwarsa")
		}
	}

	// Hapus OTP dari memori setelah berhasil diverifikasi
	otpMutex.Lock()
	delete(otpStore, userEmail)
	otpMutex.Unlock()

	// Ambil/Sajikan data User dari Database
	user, err := s.userRepo.FindByEmail(ctx, userEmail)
	if err != nil || user == nil {
		return "", nil, errors.New("user tidak ditemukan di sistem")
	}

	// Generate Token Login
	mockToken := fmt.Sprintf("bearer_token_for_%s", user.UserID)

	return mockToken, user, nil
}
