package main

import (
	"log"
	"os"
	"strings"

	"backend-arisankita/internal/config"
	"backend-arisankita/internal/handlers"
	"backend-arisankita/internal/middleware"
	"backend-arisankita/internal/repository"
	"backend-arisankita/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Inisialisasi Database Pool (Supabase PostgreSQL via pgxpool)
	db := config.InitDB()
	if db != nil {
		defer config.CloseDB()
	}

	r := gin.Default()

	// CORS origins are configured per environment. Local Vite origins remain
	// the development default when CORS_ALLOWED_ORIGINS is not set.
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = allowedCORSOrigins()
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Idempotency-Key"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowCredentials = true
	r.Use(cors.New(corsConfig))

	// Inisialisasi Layer Repositories & Services
	drawRepo := repository.NewDrawRepository(db)
	drawService := service.NewDrawService(drawRepo)

	// Inisialisasi Layer Handlers
	authHandler := handlers.NewAuthHandler(db)
	userHandler := handlers.NewUserHandler(db)
	walletHandler := handlers.NewWalletHandler(db)
	bankHandler := handlers.NewBankAccountHandler(db)
	circleHandler := handlers.NewCircleHandler(db)
	drawHandler := handlers.NewDrawHandler(drawService)
	paymentHandler := handlers.NewPaymentHandler(db)

	healthHandler := func(c *gin.Context) {
		dbStatus := "disconnected"
		if db != nil {
			if err := db.Ping(c.Request.Context()); err == nil {
				dbStatus = "connected"
			}
		}
		c.JSON(200, gin.H{
			"status":   "ok",
			"database": dbStatus,
		})
	}
	r.GET("/health", healthHandler)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", healthHandler)

		// Autentikasi & Identitas (Email OTP Self-Registration / Login)
		auth := v1.Group("/auth")
		{
			auth.POST("/otp/request", authHandler.RequestEmailOTP)
			auth.POST("/otp/verify", authHandler.VerifyEmailOTP)
			auth.POST("/login", authHandler.Login)
		}

		users := v1.Group("/users")
		users.Use(middleware.AuthMiddleware())
		users.Use(middleware.RBACWithClaimsMiddleware(middleware.RoleUser))
		{
			users.GET("/me", userHandler.GetUserProfile)
			users.PATCH("/me", userHandler.UpdateProfile)
			users.GET("/me/win-history", userHandler.GetWinHistory)
			users.GET("/me/reputation", userHandler.GetUserReputation)
		}

		// In-App Wallet
		wallet := v1.Group("/wallet")
		wallet.Use(middleware.AuthMiddleware())
		{
			wallet.GET("", walletHandler.GetWalletBalance)
			wallet.GET("/transactions", walletHandler.GetWalletTransactions)
			wallet.POST("/topup", walletHandler.TopUpWallet)
			wallet.POST("/topups", walletHandler.TopUpWallet)
		}

		// Rekening Bank
		bankAccounts := v1.Group("/bank-accounts")
		bankAccounts.Use(middleware.AuthMiddleware())
		{
			bankAccounts.POST("", bankHandler.CreateBankAccount)
			bankAccounts.GET("", bankHandler.GetBankAccounts)
			bankAccounts.DELETE("/:id", bankHandler.DeleteBankAccount)
		}

		// Manajemen Circle
		circles := v1.Group("/circles")
		circles.Use(middleware.AuthMiddleware())
		{
			circles.POST("", circleHandler.CreateCircle)
			circles.POST("/join", circleHandler.JoinCircle)
			circles.GET("", circleHandler.GetCircles)
			circles.GET("/:id", middleware.RequireCircleRole(db, "OWNER", "ADMIN", "MEMBER"), circleHandler.GetCircleDetail)
			circles.PATCH("/:id", middleware.RequireCircleRole(db, "OWNER"), circleHandler.UpdateCircle)
			circles.POST("/:id/leave", circleHandler.LeaveCircle) // FIX RUTE KELUAR CIRCLE
			circles.POST("/:id/lock", middleware.RequireCircleRole(db, "OWNER"), circleHandler.LockCircle)
			circles.POST("/:id/invitations", middleware.RequireCircleRole(db, "OWNER", "ADMIN"), circleHandler.CreateInvitation)
			circles.GET("/:id/invitations", middleware.RequireCircleRole(db, "OWNER", "ADMIN"), circleHandler.GetInvitations)
			circles.GET("/:id/members", middleware.RequireCircleRole(db, "OWNER", "ADMIN", "MEMBER"), circleHandler.GetCircleMembers)
			circles.PATCH("/:id/members/:userID", middleware.RequireCircleRole(db, "OWNER"), circleHandler.UpdateMember)
			circles.GET("/:id/payment-matrix", middleware.RequireCircleRole(db, "OWNER", "ADMIN", "MEMBER"), paymentHandler.GetPaymentMatrix)
			circles.GET("/:id/payment-proofs", middleware.RequireCircleRole(db, "OWNER", "ADMIN"), paymentHandler.GetCirclePaymentProofs)

			// Relasi Siklus
			circles.GET("/:id/cycles", middleware.RequireCircleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetCircleCycles)
			circles.POST("/:id/cycles", middleware.RequireCircleRole(db, "OWNER"), drawHandler.CreateCircleCycle)
		}

		invitations := v1.Group("/invitations")
		invitations.Use(middleware.AuthMiddleware())
		{
			invitations.POST("/join", circleHandler.JoinCircle)
		}

		// Siklus & Mesin Lelang/Kocok
		cycles := v1.Group("/cycles")
		cycles.Use(middleware.AuthMiddleware())
		{
			cycles.GET("/:id", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetCycleDetail)
			cycles.GET("/:id/participants", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetCycleParticipants)
			cycles.GET("/:id/obligations", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetCycleObligations)
			cycles.POST("/:id/bids", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.SubmitCycleBid)
			cycles.GET("/:id/bids/me", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetMyCycleBid)
			cycles.POST("/:id/bidding/close", middleware.RequireCycleRole(db, "OWNER", "ADMIN"), drawHandler.CloseBidding)
			cycles.POST("/:id/award/resolve", middleware.RequireCycleRole(db, "OWNER", "ADMIN"), drawHandler.ExecuteCycleDraw)
			cycles.GET("/:id/award", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetCycleAward)
			cycles.GET("/:id/draw-proof", middleware.RequireCycleRole(db, "OWNER", "ADMIN", "MEMBER"), drawHandler.GetDrawProof)
		}

		// Pembayaran & Tagihan
		obligations := v1.Group("/obligations")
		obligations.Use(middleware.AuthMiddleware())
		{
			obligations.POST("/:id/pay", paymentHandler.PayObligation)
			obligations.POST("/:id/payments/wallet", paymentHandler.PayObligation)
			obligations.POST("/:id/payments/manual", paymentHandler.PayObligation)
		}

		payments := v1.Group("/payments")
		payments.Use(middleware.AuthMiddleware())
		{
			payments.GET("/:id", paymentHandler.GetPaymentDetail)
			payments.POST("/:id/proof", paymentHandler.UploadPaymentProof)
		}

		v1.POST("/payment-proofs/:id/review", middleware.AuthMiddleware(), paymentHandler.ReviewPaymentProof)
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

func allowedCORSOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if raw == "" {
		return []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		if origin := strings.TrimSpace(part); origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}