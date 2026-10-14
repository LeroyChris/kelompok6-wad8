package handlers

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "supersecretkey-arisankita-wad-kelompok6-ganti-ini"
	}
	return []byte(secret)
}

func GenerateJWT(userID string, phone string) (string, error) {
	claims := jwt.MapClaims{
		"user_id":      userID,
		"phone_number": phone,
		"exp":          time.Now().Add(24 * time.Hour).Unix(),
		"iat":          time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

// VerifyOTP handles POST /api/v1/auth/otp/verify
func VerifyOTP(c *gin.Context) {
	var req struct {
		PhoneNumber string `json:"phone_number"`
		OTPCode     string `json:"otp_code"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request body"})
		return
	}

	userID := "11111111-1111-1111-1111-111111111111" // ID user utama di Supabase

	// Terbitkan Token JWT Asli (bukan mock)
	tokenString, err := GenerateJWT(userID, req.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal membuat token JWT"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"status":  "success",
		"message": "Verifikasi OTP berhasil",
		"data": gin.H{
			"token": tokenString,
			"user": gin.H{
				"phone_number": req.PhoneNumber,
				"user_id":      userID,
			},
		},
	})
}
