package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Authorization header is required",
			})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Invalid authorization header format (Bearer <token>)",
			})
			return
		}

		tokenString := parts[1]
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "JWT_SECRET belum dikonfigurasi",
			})
			return
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok || t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Invalid or expired token",
			})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if userID, exists := claims["user_id"].(string); exists && userID != "" {
				c.Set("userID", userID)
				c.Set("user_id", userID)
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"status":  "error",
					"message": "Token tidak memiliki identitas user",
				})
				return
			}
			if email, exists := claims["email"]; exists {
				c.Set("email", email)
			}
			if role, exists := claims["role"]; exists {
				c.Set("role", role)
			} else {
				c.Set("role", "MEMBER")
			}
		}

		c.Next()
	}
}

// RequireCircleRole authorizes the authenticated user against an active circle
// membership. Routes using this middleware must use :id as their circle ID.
func RequireCircleRole(db *pgxpool.Pool, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		circleID := c.Param("id")
		if userID == "" || circleID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Autentikasi atau circle tidak valid"})
			return
		}

		var role string
		err := db.QueryRow(c.Request.Context(), `
			SELECT membership_role
			FROM circle_memberships
			WHERE circle_id = $1 AND user_id = $2 AND membership_status = 'ACTIVE'`, circleID, userID).Scan(&role)
		if err != nil {
			status := http.StatusForbidden
			message := "Anda bukan anggota aktif circle ini"
			if err != pgx.ErrNoRows {
				status = http.StatusInternalServerError
				message = "Gagal memverifikasi akses circle"
			}
			c.AbortWithStatusJSON(status, gin.H{"status": "error", "message": message})
			return
		}

		for _, allowedRole := range allowedRoles {
			if strings.EqualFold(role, allowedRole) {
				c.Set("circle_role", role)
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": "error", "message": "Role circle tidak memiliki akses untuk aksi ini"})
	}
}

func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    http.StatusForbidden,
				"status":  "error",
				"message": "Akses ditolak: role pengguna tidak teridentifikasi",
			})
			return
		}

		userRole, ok := val.(string)
		if !ok {
			userRole = "MEMBER"
		}

		for _, allowed := range allowedRoles {
			if strings.EqualFold(userRole, allowed) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"code":    http.StatusForbidden,
			"status":  "error",
			"message": "Akses ditolak: Anda tidak memiliki wewenang (role tidak memenuhi syarat)",
		})
	}
}
