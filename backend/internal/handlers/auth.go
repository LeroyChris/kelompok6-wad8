package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"sync"
	"time"

	"backend-arisankita/internal/dto"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SMTPConfig konfigurasi SMTP untuk pengiriman OTP
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	FromName string
	FromAddr string
}

// defaultSandboxOTP kode OTP sandbox (digunakan saat SMTP tidak dikonfigurasi)
const defaultSandboxOTP = "123456"

// EmailOTPRequestInput DTO untuk request permintaan OTP
type EmailOTPRequestInput struct {
	Email string `json:"email" binding:"required,email"`
}

// EmailOTPVerifyInput DTO untuk request verifikasi OTP
type EmailOTPVerifyInput struct {
	Email   string `json:"email" binding:"required,email"`
	OTPCode string `json:"otp_code" binding:"required"`
}

// LoginDTO DTO untuk login dengan email + password
type LoginDTO struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// otpTTL adalah masa berlaku kode OTP.
const otpTTL = 5 * time.Minute

// otpEntry menyimpan kode OTP beserta waktu kedaluwarsanya.
type otpEntry struct {
	code    string
	expires time.Time
}

// AuthHandler struct dengan SMTP config
type AuthHandler struct {
	DB   *pgxpool.Pool
	SMTP SMTPConfig

	otpMu    sync.Mutex
	otpCodes map[string]otpEntry
}

// NewAuthHandler membuat handler otentikasi baru
func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	handler := &AuthHandler{DB: db, otpCodes: make(map[string]otpEntry)}

	// Load SMTP config dari environment
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := 587 // default port
	if p := os.Getenv("SMTP_PORT"); p != "" {
		fmt.Sscanf(p, "%d", &smtpPort)
	}
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	fromName := os.Getenv("SMTP_FROM_NAME")
	fromAddr := os.Getenv("SMTP_FROM_ADDR")

	if smtpHost == "" {
		// Jika SMTP tidak dikonfigurasi, handler akan berjalan di mode sandbox
		log.Printf("[WARN] SMTP not configured; running in sandbox mode for OTP")
		return handler
	}

	handler.SMTP = SMTPConfig{
		Host:     smtpHost,
		Port:     smtpPort,
		Username: smtpUser,
		Password: smtpPass,
		FromName: fromName,
		FromAddr: fromAddr,
	}
	return handler
}

// sandboxOTPCode kode OTP sandbox
func sandboxOTPCode() string {
	if code := os.Getenv("SANDBOX_OTP_CODE"); code != "" {
		return code
	}
	return defaultSandboxOTP
}

// sandboxEnabled cek apakah mode sandbox aktif
func sandboxEnabled() bool {
	return !strings.EqualFold(os.Getenv("APP_ENV"), "production")
}

// randomOTPCode menghasilkan kode OTP 6 digit yang aman secara kriptografis.
func randomOTPCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// storeOTP menyimpan kode OTP untuk sebuah email dengan masa berlaku otpTTL.
func (h *AuthHandler) storeOTP(email, code string) {
	h.otpMu.Lock()
	defer h.otpMu.Unlock()
	now := time.Now()
	for e, entry := range h.otpCodes {
		if now.After(entry.expires) {
			delete(h.otpCodes, e)
		}
	}
	h.otpCodes[email] = otpEntry{code: code, expires: now.Add(otpTTL)}
}

// consumeOTP memvalidasi kode OTP dan hanya menghapusnya saat cocok (sekali pakai).
func (h *AuthHandler) consumeOTP(email, code string) bool {
	h.otpMu.Lock()
	defer h.otpMu.Unlock()
	entry, ok := h.otpCodes[email]
	if !ok || time.Now().After(entry.expires) {
		delete(h.otpCodes, email)
		return false
	}
	if subtle.ConstantTimeCompare([]byte(entry.code), []byte(code)) != 1 {
		return false
	}
	delete(h.otpCodes, email)
	return true
}

// sandboxPasswordFallback memutuskan apakah login password (tanpa password_hash)
// boleh jatuh ke kode sandbox. Hanya aktif di mode sandbox, bukan production.
func sandboxPasswordFallback(password string) bool {
	return sandboxEnabled() && password == sandboxOTPCode()
}

// sendOTPEmail mengirim OTP ke email melalui SMTP
func (h *AuthHandler) sendOTPEmail(email, otpCode string) error {
	if h.SMTP.Host == "" {
		// Mode sandbox: tidak kirim email, hanya log
		log.Printf("[SANDBOX] OTP code for %s: %s", email, otpCode)
		return nil
	}

	// Bangun email message
	mimeHeaders := make(map[string]string)
	mimeHeaders["From"] = fmt.Sprintf("%s <%s>", h.SMTP.FromName, h.SMTP.FromAddr)
	mimeHeaders["To"] = email
	mimeHeaders["Subject"] = "Kode OTP ArisanKita"
	mimeHeaders["Content-Type"] = "text/plain; charset=\"UTF-8\""
	mimeHeaders["X-OTP-Expires-In"] = "300"

	msg := "Kode OTP Anda adalah: " + otpCode + "\n"
	msg += "Kode ini berlaku 5 menit.\n"
	msg += "Jika Anda tidak meminta kode ini, abaikan email ini.\n"

	// Konfigurasi auth
	auth := smtp.PlainAuth("", h.SMTP.Username, h.SMTP.Password, h.SMTP.Host)

	// Kirim email
	err := smtp.SendMail(
		fmt.Sprintf("%s:%d", h.SMTP.Host, h.SMTP.Port),
		auth,
		h.SMTP.FromAddr,
		[]string{email},
		[]byte(msg),
	)

	if err != nil {
		return fmt.Errorf("gagal mengirim email: %w", err)
	}

	log.Printf("[INFO] OTP email berhasil dikirim ke %s", email)
	return nil
}

// generateToken membuat JWT token dengan claims lengkap
// Returns token dan jti untuk refresh token support
func generateToken(userID, email, role string) (string, string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if strings.EqualFold(os.Getenv("APP_ENV"), "production") {
			return "", "", errors.New("JWT_SECRET wajib dikonfigurasi di production")
		}
		jwtSecret = "arisankita_secret_key_development_mode_2026"
	}

	jti := fmt.Sprintf("%d", time.Now().UnixNano())
	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"role":    role,
		"jti":     jti,
		"exp":     time.Now().Add(15 * time.Minute).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", "", err
	}

	return tokenString, jti, nil
}

func (h *AuthHandler) findUserByEmail(ctx *gin.Context, email string) (userID, fullName, userEmail string, err error) {
	err = h.DB.QueryRow(ctx.Request.Context(), `
		SELECT u.user_id::text, u.full_name, COALESCE(u.email, '')
		FROM user_auth_identities uai
		JOIN users u ON u.user_id = uai.user_id
		WHERE uai.provider = 'EMAIL_OTP'
		  AND LOWER(uai.provider_subject) = LOWER($1)
		  AND u.account_status = 'ACTIVE'
		LIMIT 1`, strings.TrimSpace(email)).Scan(&userID, &fullName, &userEmail)
	return userID, fullName, userEmail, err
}

func (h *AuthHandler) RequestEmailOTP(c *gin.Context) {
	var input EmailOTPRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Email wajib diisi dan berformat valid", nil))
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(input.Email))

	_, _, _, err := h.findUserByEmail(c, cleanEmail)
	if errors.Is(err, pgx.ErrNoRows) {
		tx, txErr := h.DB.Begin(c.Request.Context())
		if txErr != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai sesi registrasi", nil))
			return
		}
		defer tx.Rollback(c.Request.Context())

		parts := strings.Split(cleanEmail, "@")
		rawName := strings.ReplaceAll(parts[0], ".", " ")
		fullName := strings.Title(rawName)

		var newUserID string
		err = tx.QueryRow(c.Request.Context(), `
			INSERT INTO users (full_name, email, account_status)
			VALUES ($1, $2, 'ACTIVE')
			RETURNING user_id::text`, fullName, cleanEmail).Scan(&newUserID)

		if err == nil {
			_, err = tx.Exec(c.Request.Context(), `
				INSERT INTO user_auth_identities (user_id, provider, provider_subject)
				VALUES ($1, 'EMAIL_OTP', $2)`, newUserID, cleanEmail)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mendaftarkan pengguna baru", nil))
			return
		}

		if err = tx.Commit(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan registrasi pengguna", nil))
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memproses permintaan autentikasi", nil))
		return
	}

	// Generate OTP code: kode sandbox tetap saat mode sandbox, acak saat production.
	otpCode := randomOTPCode()
	if sandboxEnabled() {
		otpCode = sandboxOTPCode()
	}
	h.storeOTP(cleanEmail, otpCode)

	// Kirim email via SMTP (atau sandbox mode)
	if err := h.sendOTPEmail(cleanEmail, otpCode); err != nil {
		log.Printf("[WARN] Gagal mengirim OTP email: %v", err)
	}

	payload := gin.H{
		"email":      cleanEmail,
		"expires_in": 300,
		// otp_code hanya muncul di sandbox mode
	}
	if sandboxEnabled() {
		payload["otp_code"] = sandboxOTPCode()
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Kode OTP berhasil dikirim ke email", payload))
}

func (h *AuthHandler) VerifyEmailOTP(c *gin.Context) {
	var input EmailOTPVerifyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data verifikasi email tidak valid", nil))
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(input.Email))

	// Verifikasi kode OTP.
	// - Mode sandbox: terima kode sandbox tanpa SMTP.
	// - Mode production: cocokkan dengan kode yang dikirim via SMTP lalu hapus.
	if sandboxEnabled() {
		if input.OTPCode != sandboxOTPCode() {
			c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Kode OTP tidak valid", nil))
			return
		}
	} else if !h.consumeOTP(cleanEmail, input.OTPCode) {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Kode OTP tidak valid atau telah kedaluwarsa", nil))
		return
	}

	// Lanjutkan ke verifikasi user di database
	userID, fullName, userEmail, err := h.findUserByEmail(c, cleanEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User dengan email tersebut tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memverifikasi user", nil))
		return
	}

	// Generate access token + refresh token
	accessToken, jti, err := generateToken(userID, userEmail, "USER")
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat token autentikasi", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Verifikasi OTP Email berhasil", gin.H{
		"token": gin.H{
			"access":     accessToken,
			"refresh":    "",
			"token_type": "Bearer",
			"expires_in": 15 * 60, // 15 minutes
		},
		"user": gin.H{
			"user_id":   userID,
			"full_name": fullName,
			"email":     userEmail,
		},
		"jti": jti,
	}))
}

// Login handler untuk login dengan email + password
func (h *AuthHandler) Login(c *gin.Context) {
	var input LoginDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data login tidak valid", nil))
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(input.Email))

	// Cari user by email
	userID, fullName, userEmail, err := h.findUserByEmail(c, cleanEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User dengan email tersebut tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memproses permintaan login", nil))
		return
	}

	// Verify password - cek di database user tabel untuk password_hash
	// Jika user memiliki password_hash, lakukan verifikasi bcrypt
	// Jika tidak (mode lama/OTP only), gunakan sandbox check dengan password tetap

	var storedPasswordHash string
	err = h.DB.QueryRow(c.Request.Context(), `
		SELECT COALESCE(password_hash, '')
		FROM users
		WHERE email = $1`, cleanEmail).Scan(&storedPasswordHash)

	if err == nil && storedPasswordHash != "" {
		// User memiliki password hash, lakukan verifikasi bcrypt
		err = bcrypt.CompareHashAndPassword([]byte(storedPasswordHash), []byte(input.Password))
		if err != nil {
			c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Kata sandi salah", nil))
			return
		}
	} else {
		// Tidak ada password_hash di DB (user demo/seed).
		// Hanya izinkan fallback kode sandbox, dan hanya di mode sandbox.
		if !sandboxPasswordFallback(input.Password) {
			c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Kata sandi salah", nil))
			return
		}
	}

	// Generate access token + refresh token
	accessToken, jti, err := generateToken(userID, userEmail, "USER")
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat token autentikasi", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Login berhasil", gin.H{
		"token": gin.H{
			"access":     accessToken,
			"refresh":    "",
			"token_type": "Bearer",
			"expires_in": 15 * 60,
		},
		"user": gin.H{
			"user_id":   userID,
			"full_name": fullName,
			"email":     userEmail,
		},
		"jti": jti,
	}))
}
