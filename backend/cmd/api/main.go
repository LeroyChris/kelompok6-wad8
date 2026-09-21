package main

import (
	"log"
	"os"

	"backend-arisankita/internal/config"
	"backend-arisankita/internal/handlers"
	"backend-arisankita/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Inisialisasi Database Pool (Supabase PostgreSQL via pgxpool)
	// Jika DATABASE_URL belum di-set di .env, sistem tetap jalan dalam mode mock
	db := config.InitDB()
	if db != nil {
		defer config.CloseDB()
	}

	r := gin.Default()

	// CORS Setup untuk Frontend React Vite
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(corsConfig))

	v1 := r.Group("/api/v1")
	{
		// -------------------------------------------------------------
		// Track 1: Auth & User Profile (Anggota 1)
		// -------------------------------------------------------------
		auth := v1.Group("/auth")
		{
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
		}

		users := v1.Group("/users")
		users.Use(middleware.AuthMiddleware())
		{
			users.GET("/profile", handlers.GetProfile)
			users.PUT("/profile", handlers.UpdateProfile)
		}

		// -------------------------------------------------------------
		// Track 2: Kelompok Arisan / Circle Hub (Anggota 2)
		// -------------------------------------------------------------
		groups := v1.Group("/groups")
		{
			groups.POST("", handlers.CreateGroup)
			groups.GET("/:id", handlers.GetGroupDetail)
			groups.POST("/:id/join", handlers.JoinGroup)
		}

		// -------------------------------------------------------------
		// Track 3: Pembayaran & Core Engine Pengocokan (Anggota 3)
		// -------------------------------------------------------------
		payments := v1.Group("/payments")
		{
			payments.POST("", handlers.SubmitPayment)
			payments.GET("/group/:id", handlers.GetGroupPayments)
			payments.PATCH("/:id/verify", handlers.VerifyPayment)
		}

		draws := v1.Group("/draws")
		{
			draws.GET("/group/:id", handlers.GetGroupDraws)
		}

		// Endpoint Circle/Spin Legacy
		circles := v1.Group("/circles")
		{
			circles.GET("", handlers.GetCircles)
			circles.POST("/:id/bids", handlers.SubmitBid)
			circles.POST("/:id/spin", handlers.SpinWheel)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[INFO] Server ArisanKita backend berjalan di port :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("[FATAL] Gagal menjalankan server: %v", err)
	}
}
