package main

import (
	"backend-arisankita/internal/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	v1 := r.Group("/api/v1")
	{
		// Auth
		v1.POST("/auth/register", handlers.Register)
		v1.POST("/auth/login", handlers.Login)

		// Kelompok Arisan
		v1.POST("/groups", handlers.CreateGroup)
		v1.GET("/groups/:id", handlers.GetGroupDetail)
		v1.POST("/groups/:id/join", handlers.JoinGroup)

		// Pembayaran
		v1.POST("/payments", handlers.SubmitPayment)
		v1.GET("/payments/group/:id", handlers.GetGroupPayments)
		v1.PATCH("/payments/:id/verify", handlers.VerifyPayment)

		// Pengocokan
		v1.GET("/draws/group/:id", handlers.GetGroupDraws)

		// Endpoint Lama (Circle/Spin)
		v1.GET("/circles", handlers.GetCircles)
		v1.POST("/circles/:id/bids", handlers.SubmitBid)
		v1.POST("/circles/:id/spin", handlers.SpinWheel)
	}

	r.Run(":8080")
}
