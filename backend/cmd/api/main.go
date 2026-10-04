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

	// Inisialisasi Handler Instances
	userHandler := handlers.NewUserHandler(db)
	walletHandler := handlers.NewWalletHandler(db)
	bankHandler := handlers.NewBankAccountHandler(db)

	v1 := r.Group("/api/v1")
	{
		// -------------------------------------------------------------
		// Modul 2.1: Autentikasi & Identitas Pengguna (Track 1)
		// -------------------------------------------------------------
		auth := v1.Group("/auth")
		{
			auth.POST("/otp/request", handlers.RequestOTP)
			auth.POST("/otp/verify", handlers.VerifyOTP)
			auth.POST("/google", handlers.GoogleAuth)
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
		}

		users := v1.Group("/users")
		users.Use(middleware.AuthMiddleware())
		{
			users.GET("/me", userHandler.GetUserProfile)
			users.PATCH("/me", handlers.UpdateProfile) // Tetap memanggil fungsi handler umum/helper
			users.GET("/me/win-history", userHandler.GetWinHistory)
			users.GET("/me/reputation", handlers.GetUserReputation)

			// Legacy alias untuk kompatibilitas frontend
			users.GET("/profile", userHandler.GetUserProfile)
			users.PUT("/profile", handlers.UpdateProfile)
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
		{
			circles.POST("", handlers.CreateCircle)
			circles.POST("/join", handlers.JoinCircle)
			circles.GET("", handlers.GetCircles)
			circles.GET("/:id", handlers.GetCircleDetail)
			circles.POST("/:id/lock", handlers.LockCircle)
			circles.POST("/:id/invitations", handlers.CreateInvitation)
			circles.GET("/:id/members", handlers.GetCircleMembers)

			// Relasi Siklus per Circle
			circles.GET("/:id/cycles", handlers.GetCircleCycles)

			// Legacy spin & bids di circle level
			circles.POST("/:id/bids", handlers.SubmitBid)
			circles.POST("/:id/spin", handlers.SpinWheel)
		}

		invitations := v1.Group("/invitations")
		{
			invitations.POST("/join", handlers.JoinCircle)
		}

		// Legacy alias /groups untuk frontend
		groups := v1.Group("/groups")
		{
			groups.POST("", handlers.CreateGroup)
			groups.GET("/:id", handlers.GetGroupDetail)
			groups.POST("/:id/join", handlers.JoinGroup)
		}

		// -------------------------------------------------------------
		// Modul 2.4 & 2.5: Siklus Arisan, Partisipan & Mesin Lelang/Kocok (Track 3)
		// -------------------------------------------------------------
		cycles := v1.Group("/cycles")
		{
			cycles.GET("/:id", handlers.GetCycleDetail)
			cycles.GET("/:id/participants", handlers.GetCycleParticipants)
			cycles.GET("/:id/obligations", handlers.GetCycleObligations)
			cycles.POST("/:id/bids", handlers.SubmitCycleBid)
			cycles.POST("/:id/draw", handlers.ExecuteCycleDraw)
			cycles.GET("/:id/award", handlers.GetCycleAward)
		}

		// Legacy alias /draws
		draws := v1.Group("/draws")
		{
			draws.GET("/group/:id", handlers.GetGroupDraws)
		}

		// -------------------------------------------------------------
		// Modul 2.6: Pembayaran Tagihan & Bukti Transaksi (Track 3)
		// -------------------------------------------------------------
		obligations := v1.Group("/obligations")
		{
			obligations.POST("/:id/pay", handlers.PayObligation)
		}

		payments := v1.Group("/payments")
		{
			payments.GET("/:id", handlers.GetPaymentDetail)
			payments.POST("/:id/proof", handlers.UploadPaymentProof)

			// Legacy aliases
			payments.POST("", handlers.SubmitPayment)
			payments.GET("/group/:id", handlers.GetGroupPayments)
			payments.PATCH("/:id/verify", handlers.VerifyPayment)
		}

		v1.POST("/payment-proofs/:id/review", handlers.ReviewPaymentProof)
		v1.POST("/webhooks/payment-gateway", handlers.HandlePaymentGatewayWebhook)
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
