package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type SubmitPaymentInput struct {
	GroupMemberID string  `json:"group_member_id" binding:"required"`
	PeriodNumber  int     `json:"period_number" binding:"required"`
	Amount        float64 `json:"amount" binding:"required"`
	ProofURL      string  `json:"proof_url" binding:"required"`
}

type VerifyPaymentInput struct {
	Status string `json:"status" binding:"required"` // 'verified' atau 'rejected'
}

// POST /api/v1/payments
func SubmitPayment(c *gin.Context) {
	var input SubmitPaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Bukti pembayaran berhasil dikirim",
		"data": gin.H{
			"payment_id":      "pay-uuid-501",
			"group_member_id": input.GroupMemberID,
			"period_number":   input.PeriodNumber,
			"amount":          input.Amount,
			"proof_url":       input.ProofURL,
			"status":          "pending",
		},
	})
}

// GET /api/v1/payments/group/:id
func GetGroupPayments(c *gin.Context) {
	groupID := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"group_id": groupID,
		"data": []gin.H{
			{"payment_id": "pay-uuid-501", "member_name": "Farrel Abda", "period_number": 1, "amount": 500000, "status": "verified"},
			{"payment_id": "pay-uuid-502", "member_name": "Roy", "period_number": 1, "amount": 500000, "status": "pending"},
			{"payment_id": "pay-uuid-503", "member_name": "Faza", "period_number": 1, "amount": 500000, "status": "pending"},
		},
	})
}

// PATCH /api/v1/payments/:id/verify
func VerifyPayment(c *gin.Context) {
	paymentID := c.Param("id")
	var input VerifyPaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Status pembayaran berhasil diperbarui",
		"data": gin.H{
			"payment_id": paymentID,
			"status":     input.Status,
		},
	})
}
