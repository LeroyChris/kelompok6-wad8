package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Role hierarchy for RBAC
// Higher role can access endpoints lower roles cannot
const (
	RoleAdmin    = "ADMIN"
	RoleOwner    = "OWNER"
	RoleUser     = "USER"
	RoleMember   = "MEMBER"
	RoleGuest    = "GUEST"
)

// Role level hierarchy (numeric for comparison)
var roleLevelMap = map[string]int{
	RoleAdmin:    4,
	RoleOwner:    3,
	RoleUser:     2,
	RoleMember:   1,
	RoleGuest:    0,
}

// HasRole checks if a user with the given roles has the required minimum role level
func HasRole(userRoles []string, requiredRole string) bool {
	if len(userRoles) == 0 {
		return false
	}

	userMaxLevel := 0
	for _, role := range userRoles {
		if level, exists := roleLevelMap[role]; exists && level > userMaxLevel {
			userMaxLevel = level
		}
	}

	requiredLevel, exists := roleLevelMap[requiredRole]
	if !exists {
		// Unknown role, deny access
		return false
	}

	return userMaxLevel >= requiredLevel
}

// RBACMiddleware creates a Gin middleware that checks user roles for permission
func RBACMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user roles from context (set by AuthMiddleware)
		userRoles := c.Request.Header["X-User-Roles"]
		if len(userRoles) == 0 {
			// Try to get from context set by auth middleware
			userRoles = []string{c.GetString("role")}
		}

		// Also check for multiple roles (e.g., user might have both USER and MEMBER)
		var roles []string
		if len(userRoles) > 0 && userRoles[0] != "" {
			roles = strings.Split(userRoles[0], ",")
		}
		if len(roles) == 0 {
			roles = userRoles
		}

		if !HasRole(roles, requiredRole) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You do not have permission to access this resource",
			})
			return
		}

		c.Next()
	}
}

// RBACWithClaimsMiddleware checks roles from JWT claims
func RBACWithClaimsMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get roles from context (set by AuthMiddleware)
		userRole := c.GetString("role")

		// Also check for jti if needed for more granular control
		_ = c.GetString("jti")

		if userRole == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Role not found in token",
			})
			return
		}

		// Split comma-separated roles if present
		var roles []string
		if strings.Contains(userRole, ",") {
			roles = strings.Split(userRole, ",")
		} else {
			roles = []string{userRole}
		}

		if !HasRole(roles, requiredRole) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You do not have permission to access this resource",
			})
			return
		}

		c.Next()
	}
}

// GetUserRole returns the primary role from context
func GetUserRole(c *gin.Context) string {
	return c.GetString("role")
}

// GetUserRoles returns all roles from context as a slice
func GetUserRoles(c *gin.Context) []string {
	userRole := c.GetString("role")
	if userRole == "" {
		return nil
	}
	if strings.Contains(userRole, ",") {
		return strings.Split(userRole, ",")
	}
	return []string{userRole}
}

// AllowRole assigns a role to the user context (typically called by auth middleware)
func AssignRole(c *gin.Context, role string) {
	c.Set("role", role)
}