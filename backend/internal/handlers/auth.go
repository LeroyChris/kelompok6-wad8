package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

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

// POST /api/v1/auth/otp/request
func RequestOTP(c *gin.Context) {
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

// POST /api/v1/auth/otp/verify
func VerifyOTP(c *gin.Context) {
	var input OTPVerifyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Verifikasi OTP berhasil", gin.H{
		"token": "mock-jwt-token-phone-auth",
		"user": gin.H{
			"user_id":      "usr-uuid-001",
			"phone_number": input.PhoneNumber,
		},
	}))
}

// POST /api/v1/auth/google
func GoogleAuth(c *gin.Context) {
	var input GoogleAuthInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Autentikasi Google berhasil", gin.H{
		"token": "mock-jwt-token-google-auth",
		"user": gin.H{
			"user_id": "usr-uuid-001",
			"email":   "user@gmail.com",
		},
	}))
}

// POST /api/v1/auth/register (Standard/legacy)
func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Registrasi akun berhasil",
		"data": gin.H{
			"id":           "usr-uuid-001",
			"name":         input.Name,
			"email":        input.Email,
			"phone_number": input.PhoneNumber,
		},
	})
}

// POST /api/v1/auth/login (Standard/legacy)
func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Login berhasil",
		"token":   "mock-jwt-token-arisankita-1234567890",
		"user": gin.H{
			"id":    "usr-uuid-001",
			"email": input.Email,
		},
	})
}
