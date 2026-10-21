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

		// Autentikasi & Identitas
		auth := v1.Group("/auth")
		{
			auth.POST("/otp/request", authHandler.RequestOTP)
			auth.POST("/otp/verify", authHandler.VerifyOTP)
			auth.POST("/request-otp", authHandler.RequestOTP)
			auth.POST("/verify-otp", authHandler.VerifyOTP)
		}

		users := v1.Group("/users")
		users.Use(middleware.AuthMiddleware())
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
			circles.POST("/:id/lock", middleware.RequireCircleRole(db, "OWNER"), circleHandler.LockCircle)
			circles.POST("/:id/invitations", middleware.RequireCircleRole(db, "OWNER", "ADMIN"), circleHandler.CreateInvitation)
			circles.GET("/:id/members", middleware.RequireCircleRole(db, "OWNER", "ADMIN", "MEMBER"), circleHandler.GetCircleMembers)
			circles.PATCH("/:id/members/:userID", middleware.RequireCircleRole(db, "OWNER"), circleHandler.UpdateMember)
			circles.GET("/:id/payment-matrix", paymentHandler.GetPaymentMatrix)
			// Relasi Siklus
			circles.GET("/:id/cycles", drawHandler.GetCircleCycles)
			circles.POST("/:id/cycles", drawHandler.CreateCircleCycle)
		}

		invitations := v1.Group("/invitations")
		invitations.Use(middleware.AuthMiddleware())
		{
			invitations.POST("/join", circleHandler.JoinCircle)
		}

		groups := v1.Group("/groups")
		groups.Use(middleware.AuthMiddleware())
		{
			groups.POST("", circleHandler.CreateGroup)
			groups.GET("/:id", middleware.RequireCircleRole(db, "OWNER", "ADMIN", "MEMBER"), circleHandler.GetGroupDetail)
			groups.POST("/:id/join", circleHandler.JoinGroup)
		}

		// Siklus & Mesin Lelang/Kocok
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

		draws := v1.Group("/draws")
		draws.Use(middleware.AuthMiddleware())
		{
			draws.GET("/group/:id", drawHandler.GetGroupDraws)
		}

		// Pembayaran & Tagihan
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
