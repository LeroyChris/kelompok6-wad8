package handlers

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultSandboxOTP = "123456"

type AuthHandler struct {
	DB *pgxpool.Pool
}

func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{DB: db}
}

type EmailOTPRequestInput struct {
	Email string `json:"email" binding:"required,email"`
}

type EmailOTPVerifyInput struct {
	Email   string `json:"email" binding:"required,email"`
	OTPCode string `json:"otp_code" binding:"required"`
}

func sandboxOTPCode() string {
	if code := os.Getenv("SANDBOX_OTP_CODE"); code != "" {
		return code
	}
	return defaultSandboxOTP
}

func sandboxEnabled() bool {
	return !strings.EqualFold(os.Getenv("APP_ENV"), "production")
}

func generateToken(userID, email string) (string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	// Fallback secret untuk environment development/lokal agar tidak crash
	if jwtSecret == "" {
		jwtSecret = "arisankita_secret_key_development_mode_2026"
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"role":    "USER",
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func (h *AuthHandler) findUserByEmail(ctx *gin.Context, email string) (userID, fullName, userEmail string, err error) {
	err = h.DB.QueryRow(ctx.Request.Context(), `
		SELECT u.user_id::text, u.full_name, COALESCE(u.email, '')
		FROM user_auth_identities uai
		JOIN users u ON u.user_id = uai.user_id
		WHERE uai.provider = 'GOOGLE'
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
				VALUES ($1, 'GOOGLE', $2)`, newUserID, cleanEmail)
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

	payload := gin.H{
		"email":      cleanEmail,
		"expires_in": 300,
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

	if !sandboxEnabled() {
		c.JSON(http.StatusServiceUnavailable, dto.BuildResponse(http.StatusServiceUnavailable, "error", "OTP provider belum dikonfigurasi", nil))
		return
	}
	if input.OTPCode != sandboxOTPCode() {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Kode OTP tidak valid", nil))
		return
	}

	userID, fullName, userEmail, err := h.findUserByEmail(c, cleanEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User dengan email tersebut tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memverifikasi user", nil))
		return
	}

	token, err := generateToken(userID, userEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat token autentikasi", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Verifikasi OTP Email berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"user_id":   userID,
			"full_name": fullName,
			"email":     userEmail,
		},
	}))
}
