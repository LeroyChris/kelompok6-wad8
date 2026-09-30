package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

type TopUpInput struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

// GET /api/v1/wallet
func GetWallet(c *gin.Context) {
	userID, _ := c.Get("userID")

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Informasi dompet berhasil diambil", gin.H{
		"wallet_id":  "w-uuid-001",
		"user_id":    userID,
		"balance":    5000000,
		"updated_at": "2026-09-30T12:00:00Z",
	}))
}

// GET /api/v1/wallet/transactions
func GetWalletTransactions(c *gin.Context) {
	transactions := []gin.H{
		{
			"wallet_tx_id": "wtx-001",
			"amount":       5000000,
			"tx_type":      "INITIAL_BALANCE",
			"description":  "Saldo Awal Akun Demo",
			"created_at":   "2026-09-30T12:00:00Z",
		},
		{
			"wallet_tx_id": "wtx-002",
			"amount":       2000000,
			"tx_type":      "DISBURSEMENT",
			"description":  "Pemenang Arisan Keluarga RT 05 Putaran 1",
			"created_at":   "2026-09-15T10:00:00Z",
		},
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat mutasi dompet berhasil diambil", transactions))
}

// POST /api/v1/wallet/topup
func TopUpWallet(c *gin.Context) {
	var input TopUpInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Nominal top up tidak valid: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Top-up saldo sandbox berhasil", gin.H{
		"wallet_id":   "w-uuid-001",
		"topup_amount": input.Amount,
		"new_balance": 5000000 + input.Amount,
	}))
}
