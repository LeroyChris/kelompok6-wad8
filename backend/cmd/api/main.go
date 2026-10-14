package main

import (
	"log"
	"os"

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

	// CORS Setup untuk Frontend React Vite
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(corsConfig))

	// Inisialisasi Layer Repository -> Service -> Handler Instances
	authHandler := handlers.NewAuthHandler(db)
	userHandler := handlers.NewUserHandler(db)
	walletHandler := handlers.NewWalletHandler(db)
	bankHandler := handlers.NewBankAccountHandler(db)
	paymentHandler := handlers.NewPaymentHandler(db)

	// Inisialisasi Module Draw & Cycle (Real Database Supabase)
	drawRepo := repository.NewDrawRepository(db)
	drawService := service.NewDrawService(drawRepo)
	drawHandler := handlers.NewDrawHandler(drawService)

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
		// -------------------------------------------------------------
		// Modul 2.1: Autentikasi & Identitas Pengguna (Track 1)
		// -------------------------------------------------------------
		auth := v1.Group("/auth")
		{
			auth.POST("/otp/request", authHandler.RequestOTP)
			auth.POST("/otp/verify", authHandler.VerifyOTP)
			auth.POST("/request-otp", authHandler.RequestOTP)
			auth.POST("/verify-otp", authHandler.VerifyOTP)
			auth.POST("/google", authHandler.GoogleAuth)
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		users := v1.Group("/users")
		users.Use(middleware.AuthMiddleware())
		{
			users.GET("/me", userHandler.GetUserProfile)
			users.PATCH("/me", userHandler.UpdateProfile)
			users.GET("/me/win-history", userHandler.GetWinHistory)
			users.GET("/me/reputation", userHandler.GetUserReputation)

			// Legacy alias
			users.GET("/profile", userHandler.GetUserProfile)
			users.PUT("/profile", userHandler.UpdateProfile)
		}

		// -------------------------------------------------------------
		// Modul In-App Wallet (Track 1)
		// -------------------------------------------------------------
		wallet := v1.Group("/wallet")
		wallet.Use(middleware.AuthMiddleware())
		{
			wallet.GET("", walletHandler.GetWalletBalance)
			wallet.GET("/transactions", walletHandler.GetWalletTransactions)
			wallet.POST("/topup", walletHandler.TopUpWallet)
		}

		// -------------------------------------------------------------
		// Modul 2.2: Rekening Bank & Validasi (Track 1)
		// -------------------------------------------------------------
		bankAccounts := v1.Group("/bank-accounts")
		bankAccounts.Use(middleware.AuthMiddleware())
		{
			bankAccounts.POST("", bankHandler.CreateBankAccount)
			bankAccounts.GET("", bankHandler.GetBankAccounts)
			bankAccounts.DELETE("/:id", bankHandler.DeleteBankAccount)
		}

		// -------------------------------------------------------------
		// Modul 2.3: Manajemen Circle & Keanggotaan (Track 2)
		// -------------------------------------------------------------
		circles := v1.Group("/circles")
		circles.Use(middleware.AuthMiddleware())
		{
			circles.POST("", handlers.CreateCircle)
			circles.POST("/join", handlers.JoinCircle)
			circles.GET("", handlers.GetCircles)
			circles.GET("/:id", handlers.GetCircleDetail)
			circles.POST("/:id/lock", handlers.LockCircle)
			circles.POST("/:id/invitations", handlers.CreateInvitation)
			circles.GET("/:id/members", handlers.GetCircleMembers)

			// Relasi Siklus per Circle
			circles.GET("/:id/cycles", drawHandler.GetCircleCycles)
			circles.POST("/:id/cycles", drawHandler.CreateCircleCycle)

			// Legacy spin & bids di circle level
			circles.POST("/:id/bids", handlers.SubmitBid)
			circles.POST("/:id/spin", handlers.SpinWheel)
		}

		invitations := v1.Group("/invitations")
		invitations.Use(middleware.AuthMiddleware())
		{
			invitations.POST("/join", handlers.JoinCircle)
		}

		// Legacy alias /groups untuk frontend
		groups := v1.Group("/groups")
		groups.Use(middleware.AuthMiddleware())
		{
			groups.POST("", handlers.CreateGroup)
			groups.GET("/:id", handlers.GetGroupDetail)
			groups.POST("/:id/join", handlers.JoinGroup)
		}

		// -------------------------------------------------------------
		// Modul 2.4 & 2.5: Siklus Arisan, Partisipan & Mesin Lelang/Kocok (Track 3)
		// -------------------------------------------------------------
		cycles := v1.Group("/cycles")
		cycles.Use(middleware.AuthMiddleware())
		{
			cycles.GET("/:id", drawHandler.GetCycleDetail)
			cycles.GET("/:id/participants", drawHandler.GetCycleParticipants)
			cycles.GET("/:id/obligations", drawHandler.GetCycleObligations)
			cycles.POST("/:id/bids", drawHandler.SubmitCycleBid)
			cycles.POST("/:id/draw", drawHandler.ExecuteCycleDraw)
			cycles.GET("/:id/award", drawHandler.GetCycleAward)
		}

		// Legacy alias /draws
		draws := v1.Group("/draws")
		draws.Use(middleware.AuthMiddleware())
		{
			draws.GET("/group/:id", drawHandler.GetGroupDraws)
		}

		// -------------------------------------------------------------
		// Modul 2.6: Pembayaran Tagihan & Bukti Transaksi (Track 3)
		// -------------------------------------------------------------
		obligations := v1.Group("/obligations")
		obligations.Use(middleware.AuthMiddleware())
		{
			obligations.POST("/:id/pay", paymentHandler.PayObligation)
		}

		payments := v1.Group("/payments")
		payments.Use(middleware.AuthMiddleware())
		{
			payments.GET("/:id", paymentHandler.GetPaymentDetail)
			payments.POST("/:id/proof", paymentHandler.UploadPaymentProof)

			// Legacy aliases
			payments.POST("", paymentHandler.SubmitPayment)
			payments.GET("/group/:id", paymentHandler.GetGroupPayments)
			payments.PATCH("/:id/verify", paymentHandler.VerifyPayment)
		}

		v1.POST("/payment-proofs/:id/review", middleware.AuthMiddleware(), paymentHandler.ReviewPaymentProof)
		v1.POST("/webhooks/payment-gateway", paymentHandler.HandlePaymentGatewayWebhook)
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
