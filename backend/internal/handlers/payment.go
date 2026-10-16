package handlers

import (
	"fmt"
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PaymentHandler struct {
	DB *pgxpool.Pool
}

func NewPaymentHandler(db *pgxpool.Pool) *PaymentHandler {
	return &PaymentHandler{DB: db}
}

type SubmitPaymentInput struct {
	GroupMemberID string  `json:"group_member_id"`
	PeriodNumber  int     `json:"period_number"`
	Amount        float64 `json:"amount" binding:"required"`
	ProofURL      string  `json:"proof_url"`
	PaymentMethod string  `json:"payment_method"`
}

type ReviewProofInput struct {
	ReviewStatus string `json:"review_status" binding:"required"` // APPROVED, REJECTED
	ReviewNote   string `json:"review_note"`
}

type VerifyPaymentInput struct {
	Status string `json:"status" binding:"required"`
}

// POST /api/v1/obligations/:id/pay
func (h *PaymentHandler) PayObligation(c *gin.Context) {
	obligationID := c.Param("id")
	var input SubmitPaymentInput
	_ = c.ShouldBindJSON(&input)

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Pesanan pembayaran berhasil dibuat", gin.H{
		"payment_order_id": "po-uuid-101",
		"obligation_id":    obligationID,
		"amount":           input.Amount,
		"payment_status":   "CREATED",
	}))
}

// GET /api/v1/payments/:id
func (h *PaymentHandler) GetPaymentDetail(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Rincian pembayaran", gin.H{
		"payment_order_id": id,
		"amount":           500000,
		"payment_status":   "PENDING",
	}))
}

// POST /api/v1/payments/:id/proof
func (h *PaymentHandler) UploadPaymentProof(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Bukti transfer berhasil diunggah", gin.H{
		"payment_proof_id": "pp-uuid-001",
		"payment_order_id": id,
	}))
}

// POST /api/v1/payment-proofs/:id/review
func (h *PaymentHandler) ReviewPaymentProof(c *gin.Context) {
	proofID := c.Param("id")
	var input ReviewProofInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	ctx := c.Request.Context()

	if input.ReviewStatus == "APPROVED" {
		tx, err := h.DB.Begin(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi", nil))
			return
		}
		defer tx.Rollback(ctx)

		// 1. Ambil data obligation dan user_id dari bukti transfer
		var obligationID, userID string
		var amount float64
		getPaymentInfoSql := `
			SELECT co.obligation_id, cm.user_id, co.amount_due
			FROM payment_proofs pp
			JOIN payment_orders po ON pp.payment_order_id = po.payment_order_id
			JOIN obligation_payment_orders opo ON po.payment_order_id = opo.payment_order_id
			JOIN cycle_obligations co ON opo.obligation_id = co.obligation_id
			JOIN cycle_participants cp ON co.cycle_participant_id = cp.cycle_participant_id
			JOIN circle_memberships cm ON cp.circle_membership_id = cm.circle_membership_id
			WHERE pp.payment_proof_id = $1;
		`
		err = tx.QueryRow(ctx, getPaymentInfoSql, proofID).Scan(&obligationID, &userID, &amount)
		if err == nil {
			// 2. Set Status Obligation -> PAID
			_, _ = tx.Exec(ctx, `UPDATE cycle_obligations SET obligation_status = 'PAID' WHERE obligation_id = $1;`, obligationID)

			// 3. Potong/Update Saldo di user_wallets
			var walletID string
			_ = tx.QueryRow(ctx, `UPDATE user_wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 RETURNING wallet_id::text;`, amount, userID).Scan(&walletID)

			// 4. Catat Transaksi Mutasi
			if walletID != "" {
				desc := fmt.Sprintf("Pembayaran iuran arisan #%s", obligationID)
				_, _ = tx.Exec(ctx, `INSERT INTO wallet_transactions (wallet_id, amount, tx_type, description) VALUES ($1, $2, 'OBLIGATION_PAYMENT', $3);`, walletID, amount, desc)
			}
		}

		if err := tx.Commit(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memproses persetujuan pembayaran", nil))
			return
		}
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Review bukti bayar berhasil disimpan", gin.H{
		"payment_proof_id": proofID,
		"review_status":    input.ReviewStatus,
	}))
}

// POST /api/v1/webhooks/payment-gateway
func (h *PaymentHandler) HandlePaymentGatewayWebhook(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Webhook diterima", gin.H{"status": "PROCESSED"}))
}

// Legacy Handlers
func (h *PaymentHandler) SubmitPayment(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"status": "success", "message": "Bukti pembayaran berhasil dikirim"})
}

func (h *PaymentHandler) GetGroupPayments(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": []gin.H{}})
}

func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Status diperbarui"})
}
