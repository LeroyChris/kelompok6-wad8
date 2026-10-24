package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter defines the interface for rate limiting
type RateLimiter interface {
	Allow(c *gin.Context) bool
	Remaining(c *gin.Context) int
	Reset() time.Time
}

// SimpleInMemoryRateLimiter is a basic rate limiter implementation
type SimpleInMemoryRateLimiter struct {
	limit         int
	interval      time.Duration
	intervalStart time.Time
	requests      map[string]int
}

// NewSimpleInMemoryRateLimiter creates a new rate limiter
func NewSimpleInMemoryRateLimiter(limit int, interval time.Duration) *SimpleInMemoryRateLimiter {
	rl := &SimpleInMemoryRateLimiter{
		limit:        limit,
		interval:     interval,
		intervalStart: time.Now(),
		requests:     make(map[string]int),
	}
	return rl
}

// Allow checks if a request is allowed based on the rate limit
func (rl *SimpleInMemoryRateLimiter) Allow(c *gin.Context) bool {
	clientIP := getClientIP(c)

	// Reset counter if interval has passed
	if time.Since(rl.intervalStart) >= rl.interval {
		rl.requests = make(map[string]int)
		rl.intervalStart = time.Now()
	}

	rl.requests[clientIP]++

	if rl.requests[clientIP] > rl.limit {
		rl.requests[clientIP]--
		return false
	}

	return true
}

// Remaining returns the number of remaining requests
func (rl *SimpleInMemoryRateLimiter) Remaining(c *gin.Context) int {
	clientIP := getClientIP(c)
	return rl.limit - rl.requests[clientIP]
}

// Reset returns the time when the rate limit will reset
func (rl *SimpleInMemoryRateLimiter) Reset() time.Time {
	return rl.intervalStart.Add(rl.interval)
}

// getClientIP extracts the client IP from the request
func getClientIP(c *gin.Context) string {
	ip := strings.TrimSpace(c.GetHeader("X-Forwarded-For"))
	if ip == "" {
		ip = strings.TrimSpace(c.GetHeader("X-Real-IP"))
	}
	if ip == "" {
		ip = c.ClientIP()
	}
	return ip
}

// RateLimitMiddleware creates a Gin middleware for rate limiting
func RateLimitMiddleware(limit int, interval time.Duration) gin.HandlerFunc {
	rl := NewSimpleInMemoryRateLimiter(limit, interval)

	return func(c *gin.Context) {
		if !rl.Allow(c) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"status":  "error",
				"message": "Too many requests, please try again later",
			})
			return
		}
		c.Writer.Header().Set("X-RateLimit-Remaining", strconv.Itoa(rl.Remaining(c)))
		c.Writer.Header().Set("X-RateLimit-Reset", rl.Reset().Format(time.RFC3339))
		c.Next()
	}
}