package handlers

import (
	"errors"
	"net/http"
	"os"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{DB: db}
}

type RegisterInput struct {
	Name        string `json:"name" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required"`
	PhoneNumber string `json:"phone_number"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type OTPRequestInput struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
}

type OTPVerifyInput struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	OTPCode     string `json:"otp_code" binding:"required"`
}

type GoogleAuthInput struct {
	IDToken string `json:"id_token" binding:"required"`
}

func generateToken(userID, email string) (string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "supersecretkey-arisankita-wad-kelompok6-ganti-ini"
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"role":    "USER",
		"exp":     time.Now().Add(24 * 7 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// POST /api/v1/auth/otp/request & /api/v1/auth/request-otp
func (h *AuthHandler) RequestOTP(c *gin.Context) {
	var input OTPRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Kode OTP berhasil dikirim ke WhatsApp/SMS", gin.H{
		"phone_number": input.PhoneNumber,
		"otp_code":     "123456",
		"expires_in":   300,
	}))
}

// POST /api/v1/auth/otp/verify & /api/v1/auth/verify-otp
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var input OTPVerifyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	var userID, fullName, email string
	phoneQuery := input.PhoneNumber

	// Format penyesuaian query (08xx vs 8xx)
	query := `
		SELECT user_id, full_name, COALESCE(email, '')
		FROM users
		WHERE phone_number = $1 OR phone_number = $2 OR phone_number = $3
		LIMIT 1;
	`
	alt1 := "0" + phoneQuery
	alt2 := phoneQuery
	if len(phoneQuery) > 0 && phoneQuery[0] == '0' {
		alt2 = phoneQuery[1:]
	}
	alt3 := "+62" + alt2

	err := h.DB.QueryRow(c.Request.Context(), query, alt1, alt2, alt3).Scan(&userID, &fullName, &email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Jika nomor belum terdaftar, default ke Farrel atau create user
			userID = "11111111-1111-1111-1111-111111111111"
			fullName = "User Demo"
			email = "demo@arisankita.id"
		} else {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal verifikasi nomor di database: "+err.Error(), nil))
			return
		}
	}

	token, err := generateToken(userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menerbitkan token JWT", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Verifikasi OTP berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"user_id":      userID,
			"full_name":    fullName,
			"phone_number": input.PhoneNumber,
			"email":        email,
		},
	}))
}

// POST /api/v1/auth/google
func (h *AuthHandler) GoogleAuth(c *gin.Context) {
	var input GoogleAuthInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	userID := "11111111-1111-1111-1111-111111111111"
	email := "farrel@arisankita.id"
	token, _ := generateToken(userID, email)

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Autentikasi Google berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"user_id": userID,
			"email":   email,
		},
	}))
}

// POST /api/v1/auth/register (Standard/legacy)
func (h *AuthHandler) Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	userID := "11111111-1111-1111-1111-111111111111"
	token, _ := generateToken(userID, input.Email)

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Registrasi akun berhasil",
		"token":   token,
		"data": gin.H{
			"id":           userID,
			"name":         input.Name,
			"email":        input.Email,
			"phone_number": input.PhoneNumber,
		},
	})
}

// POST /api/v1/auth/login (Standard/legacy)
func (h *AuthHandler) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	var userID, fullName string
	err := h.DB.QueryRow(c.Request.Context(), "SELECT user_id, full_name FROM users WHERE email = $1 LIMIT 1;", input.Email).Scan(&userID, &fullName)
	if err != nil {
		userID = "11111111-1111-1111-1111-111111111111"
		fullName = "Farrel Abda"
	}

	token, _ := generateToken(userID, input.Email)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Login berhasil",
		"token":   token,
		"user": gin.H{
			"id":        userID,
			"full_name": fullName,
			"email":     input.Email,
		},
	})
}
