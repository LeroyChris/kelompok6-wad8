package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

type SubmitPaymentInput struct {
	GroupMemberID string  `json:"group_member_id"`
	PeriodNumber  int     `json:"period_number"`
	Amount        float64 `json:"amount" binding:"required"`
	ProofURL      string  `json:"proof_url"`
	PaymentMethod string  `json:"payment_method"` // GATEWAY, MANUAL_TRANSFER
}

type ReviewProofInput struct {
	ReviewStatus string `json:"review_status" binding:"required"` // APPROVED, REJECTED
	ReviewNote   string `json:"review_note"`
}

type VerifyPaymentInput struct {
	Status string `json:"status" binding:"required"` // verified, rejected
}

// POST /api/v1/obligations/:id/pay
func PayObligation(c *gin.Context) {
	obligationID := c.Param("id")
	var input SubmitPaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input tidak valid: "+err.Error(), nil))
		return
	}

	method := input.PaymentMethod
	if method == "" {
		method = "MANUAL_TRANSFER"
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Pesanan pembayaran berhasil dibuat", gin.H{
		"payment_order_id": "po-uuid-101",
		"obligation_id":    obligationID,
		"amount":           input.Amount,
		"payment_method":   method,
		"payment_status":   "CREATED",
	}))
}

// GET /api/v1/payments/:id
func GetPaymentDetail(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Rincian pembayaran", gin.H{
		"payment_order_id": id,
		"amount":           500000,
		"payment_method":   "MANUAL_TRANSFER",
		"payment_status":   "PENDING",
	}))
}

// POST /api/v1/payments/:id/proof
func UploadPaymentProof(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		ProofURL string `json:"proof_url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Bukti transfer berhasil diunggah", gin.H{
		"payment_proof_id": "pp-uuid-001",
		"payment_order_id": id,
		"proof_url":        input.ProofURL,
		"review_status":    "PENDING",
	}))
}

// POST /api/v1/payment-proofs/:id/review
func ReviewPaymentProof(c *gin.Context) {
	id := c.Param("id")
	var input ReviewProofInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Review bukti bayar disimpan", gin.H{
		"payment_proof_id": id,
		"review_status":    input.ReviewStatus,
		"review_note":      input.ReviewNote,
	}))
}

// POST /api/v1/webhooks/payment-gateway
func HandlePaymentGatewayWebhook(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Webhook diterima", gin.H{
		"status": "PROCESSED",
	}))
}

// POST /api/v1/payments (Legacy frontend alias)
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

// GET /api/v1/payments/group/:id (Legacy frontend alias)
func GetGroupPayments(c *gin.Context) {
	groupID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"group_id": groupID,
		"data": []gin.H{
			{"payment_id": "pay-uuid-501", "member_name": "Farrel Abda", "period_number": 1, "amount": 500000, "status": "verified"},
			{"payment_id": "pay-uuid-502", "member_name": "Roy", "period_number": 1, "amount": 500000, "status": "pending"},
		},
	})
}

// PATCH /api/v1/payments/:id/verify (Legacy frontend alias)
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
