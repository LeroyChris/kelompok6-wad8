package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testDevelopmentSecret = "arisankita_secret_key_development_mode_2026"

func TestAuthMiddlewareAcceptsDevelopmentToken(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "")
	gin.SetMode(gin.TestMode)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": "11111111-1111-1111-1111-111111111111",
		"email":   "tiara@arisankita.id",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte(testDevelopmentSecret))
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/private", AuthMiddleware(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	request := httptest.NewRequest(http.MethodGet, "/private", nil)
	request.Header.Set("Authorization", "Bearer "+signed)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
}

func TestAuthMiddlewareRejectsUnexpectedSigningMethod(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "")
	gin.SetMode(gin.TestMode)
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{"user_id": "user", "exp": time.Now().Add(time.Hour).Unix()})
	signed, err := token.SignedString([]byte(testDevelopmentSecret))
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/private", AuthMiddleware(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	request := httptest.NewRequest(http.MethodGet, "/private", nil)
	request.Header.Set("Authorization", "Bearer "+signed)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}
