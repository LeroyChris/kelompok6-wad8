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

	// Inisialisasi Layer Handlers dengan Database Instance (db)
	authHandler := handlers.NewAuthHandler(db)
	userHandler := handlers.NewUserHandler(db)
	walletHandler := handlers.NewWalletHandler(db)
	bankHandler := handlers.NewBankAccountHandler(db)
	circleHandler := handlers.NewCircleHandler(db)
	drawHandler := handlers.NewDrawHandler(db)       // ✅ FIX: Memakai db (*pgxpool.Pool) langsung
	paymentHandler := handlers.NewPaymentHandler(db) // ✅ FIX: Memakai db (*pgxpool.Pool) langsung

	v1 := r.Group("/api/v1")
	{
		// -------------------------------------------------------------
		// Modul 2.1: Autentikasi & Identitas Pengguna (Track 1)
		// -------------------------------------------------------------
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
			users.GET("/me/reputation", userHandler.GetUserReputation)
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
			circles.POST("", circleHandler.CreateCircle)
			circles.POST("/join", circleHandler.JoinCircle)
			circles.GET("", circleHandler.GetCircles)
			circles.GET("/:id", circleHandler.GetCircleDetail)
			circles.POST("/:id/lock", circleHandler.LockCircle)
			circles.POST("/:id/invitations", circleHandler.CreateInvitation)
			circles.GET("/:id/members", circleHandler.GetCircleMembers)

			// Relasi Siklus per Circle
			circles.GET("/:id/cycles", drawHandler.GetCircleCycles)
		}

		invitations := v1.Group("/invitations")
		invitations.Use(middleware.AuthMiddleware())
		{
			invitations.POST("/join", circleHandler.JoinCircle)
		}

		// Legacy alias /groups untuk frontend
		groups := v1.Group("/groups")
		groups.Use(middleware.AuthMiddleware())
		{
			groups.POST("", circleHandler.CreateGroup)
			groups.GET("/:id", circleHandler.GetGroupDetail)
			groups.POST("/:id/join", circleHandler.JoinGroup)
		}

		// -------------------------------------------------------------
		// Modul 2.4 & 2.5: Siklus Arisan & Mesin Lelang/Kocok (Track 3)
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
			obligations.POST("/:id/pay", paymentHandler.PayObligation) // ✅ FIX: Menggunakan paymentHandler
		}

		payments := v1.Group("/payments")
		payments.Use(middleware.AuthMiddleware())
		{
			payments.GET("/:id", paymentHandler.GetPaymentDetail)          // ✅ FIX: Menggunakan paymentHandler
			payments.POST("/:id/proof", paymentHandler.UploadPaymentProof) // ✅ FIX: Menggunakan paymentHandler
			payments.POST("", paymentHandler.SubmitPayment)
			payments.GET("/group/:id", paymentHandler.GetGroupPayments)
			payments.PATCH("/:id/verify", paymentHandler.VerifyPayment)
		}

		v1.POST("/payment-proofs/:id/review", middleware.AuthMiddleware(), paymentHandler.ReviewPaymentProof)
		v1.POST("/webhooks/payment-gateway", paymentHandler.HandlePaymentGatewayWebhook) // ✅ FIX: Menggunakan paymentHandler
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
