package middleware

import "time"

import "github.com/gin-gonic/gin"

// requestIDKey is the key for storing request ID in the context
type requestIDKey struct{}

// RequestIDMiddleware generates a unique request ID and adds it to the response headers
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := "req-" + time.Now().Format("20060102150405")

		// c.Get returns (value, exists) - capture both
		_, exists := c.Get(requestIDKey{})
		_ = exists

		c.Set(requestIDKey{}, requestID)
		c.Writer.Header().Set("X-Request-ID", requestID)
		c.Next()
	}
}

// GetRequestID returns the request ID from the context
func GetRequestID(c *gin.Context) string {
	v, exists := c.Get(requestIDKey{})
	if !exists {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}