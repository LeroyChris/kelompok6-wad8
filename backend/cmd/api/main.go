package main

import (
	"time"

	"backend-arisankita/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	router := gin.Default()

	// CORS untuk React (Port 5173)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Grouping REST API v1
	v1 := router.Group("/api/v1")
	{
		circles := v1.Group("/circles")
		{
			circles.GET("", handlers.GetCircles)            // GET  /api/v1/circles
			circles.POST("/:id/bids", handlers.SubmitBid)   // POST /api/v1/circles/ARK-101/bids
			circles.POST("/:id/spin", handlers.SpinWheel)   // POST /api/v1/circles/ARK-101/spin
		}
	}

	router.Run(":8080")
}