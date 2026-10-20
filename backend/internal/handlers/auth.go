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

type OTPRequestInput struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
}

type OTPVerifyInput struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	OTPCode     string `json:"otp_code" binding:"required"`
}

func normalizePhoneNumber(raw string) (string, error) {
	var digits strings.Builder
	for _, char := range raw {
		if char >= '0' && char <= '9' {
			digits.WriteRune(char)
		}
	}

	phone := digits.String()
	switch {
	case strings.HasPrefix(phone, "62"):
		phone = "0" + strings.TrimPrefix(phone, "62")
	case !strings.HasPrefix(phone, "0"):
		phone = "0" + phone
	}

	if len(phone) < 10 || len(phone) > 15 {
		return "", errors.New("nomor telepon tidak valid")
	}

	return phone, nil
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
	if jwtSecret == "" {
		return "", errors.New("JWT_SECRET belum dikonfigurasi")
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

func (h *AuthHandler) findUserByPhone(ctx *gin.Context, phone string) (userID, fullName, email string, err error) {
	err = h.DB.QueryRow(ctx.Request.Context(), `
		SELECT u.user_id::text, u.full_name, COALESCE(u.email, '')
		FROM user_auth_identities uai
		JOIN users u ON u.user_id = uai.user_id
		WHERE uai.provider = 'PHONE_OTP'
		  AND uai.provider_subject = $1
		  AND u.account_status = 'ACTIVE'
		LIMIT 1`, phone).Scan(&userID, &fullName, &email)
	return userID, fullName, email, err
}

// RequestOTP issues a sandbox OTP only for a registered active user.
func (h *AuthHandler) RequestOTP(c *gin.Context) {
	var input OTPRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Nomor telepon wajib diisi", nil))
		return
	}

	phone, err := normalizePhoneNumber(input.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	if _, _, _, err := h.findUserByPhone(c, phone); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User dengan nomor telepon tersebut tidak terdaftar", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memproses permintaan OTP", nil))
		return
	}

	payload := gin.H{
		"phone_number": phone,
		"expires_in":   300,
	}
	if sandboxEnabled() {
		payload["otp_code"] = sandboxOTPCode()
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Kode OTP berhasil dikirim", payload))
}

// VerifyOTP authenticates an existing seeded/registered user. It never creates users.
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var input OTPVerifyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data verifikasi tidak valid", nil))
		return
	}

	phone, err := normalizePhoneNumber(input.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	if !sandboxEnabled() {
		c.JSON(http.StatusServiceUnavailable, dto.BuildResponse(http.StatusServiceUnavailable, "error", "OTP provider belum dikonfigurasi", nil))
		return
	}
	if input.OTPCode != sandboxOTPCode() {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Kode OTP tidak valid", nil))
		return
	}

	userID, fullName, email, err := h.findUserByPhone(c, phone)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User dengan nomor telepon tersebut tidak terdaftar", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memverifikasi user", nil))
		return
	}

	token, err := generateToken(userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat token autentikasi", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Verifikasi OTP berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"user_id":      userID,
			"full_name":    fullName,
			"phone_number": phone,
			"email":        email,
		},
	}))
}
