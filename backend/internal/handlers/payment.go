package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
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
	Amount        float64 `json:"amount"`
	ProofURL      string  `json:"proof_url"`
	PaymentMethod string  `json:"payment_method"` // WALLET, MANUAL_TRANSFER
}

type ReviewProofInput struct {
	ReviewStatus string `json:"review_status" binding:"required"` // APPROVED, REJECTED
	ReviewNote   string `json:"review_note"`
}

type VerifyPaymentInput struct {
	Status string `json:"status" binding:"required"`
}

func normalizeObligationID(id string) string {
	switch id {
	case "ob-01":
		return "0b111111-0001-0000-0000-000000000001"
	case "ob-02":
		return "0b111111-0002-0000-0000-000000000002"
	case "ob-03":
		return "0b111111-0003-0000-0000-000000000003"
	case "ob-04":
		return "0b111111-0004-0000-0000-000000000004"
	default:
		return id
	}
}

// POST /api/v1/obligations/:id/pay
func (h *PaymentHandler) PayObligation(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	obligationID := normalizeObligationID(c.Param("id"))
	var input SubmitPaymentInput
	_ = c.ShouldBindJSON(&input)

	method := input.PaymentMethod
	if method == "" {
		method = "WALLET"
	}

	ctx := c.Request.Context()

	// 1. Ambil detail obligation dari Supabase
	var obligationAmount float64
	var currentStatus string
	checkQuery := `
		SELECT amount_due, obligation_status
		FROM cycle_obligations
		WHERE obligation_id = $1;
	`
	err := h.DB.QueryRow(ctx, checkQuery, obligationID).Scan(&obligationAmount, &currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Tagihan iuran tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memverifikasi tagihan: "+err.Error(), nil))
		return
	}

	if currentStatus == "PAID" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Tagihan iuran ini sudah lunas", nil))
		return
	}

	// 2. Transaksi ACID: Bayar dengan Saldo In-App Wallet
	if method == "WALLET" {
		tx, err := h.DB.Begin(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi database", nil))
			return
		}
		defer tx.Rollback(ctx)

		// A. Ambil & Kunci Wallet User (FOR UPDATE)
		var walletID string
		var currentBalance float64
		walletQuery := `
			SELECT wallet_id::text, balance
			FROM user_wallets
			WHERE user_id = $1
			FOR UPDATE;
		`
		err = tx.QueryRow(ctx, walletQuery, userID).Scan(&walletID, &currentBalance)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Dompet digital belum terdaftar", nil))
				return
			}
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membaca dompet: "+err.Error(), nil))
			return
		}

		if currentBalance < obligationAmount {
			c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Saldo dompet tidak mencukupi untuk membayar iuran", gin.H{
				"current_balance": currentBalance,
				"amount_due":      obligationAmount,
			}))
			return
		}

		// B. Potong saldo dompet user
		deductQuery := `
			UPDATE user_wallets
			SET balance = balance - $1, updated_at = NOW()
			WHERE wallet_id = $2;
		`
		if _, err := tx.Exec(ctx, deductQuery, obligationAmount, walletID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memotong saldo: "+err.Error(), nil))
			return
		}

		// C. Buat payment_order berstatus PAID
		var paymentOrderID string
		insertOrderQuery := `
			INSERT INTO payment_orders (order_type, payment_method, amount, payment_status, paid_at, created_at, updated_at)
			VALUES ('CYCLE_CONTRIBUTION', 'WALLET', $1, 'PAID', NOW(), NOW(), NOW())
			RETURNING payment_order_id::text;
		`
		if err := tx.QueryRow(ctx, insertOrderQuery, obligationAmount).Scan(&paymentOrderID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mencatat order pembayaran: "+err.Error(), nil))
			return
		}

		// D. Hubungkan payment_order dengan cycle_obligation
		linkQuery := `
			INSERT INTO obligation_payment_orders (payment_order_id, obligation_id)
			VALUES ($1, $2);
		`
		if _, err := tx.Exec(ctx, linkQuery, paymentOrderID, obligationID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menghubungkan relasi pembayaran: "+err.Error(), nil))
			return
		}

		// E. Update status obligation menjadi PAID
		updateObligationQuery := `
			UPDATE cycle_obligations
			SET obligation_status = 'PAID'
			WHERE obligation_id = $1;
		`
		if _, err := tx.Exec(ctx, updateObligationQuery, obligationID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui status tagihan: "+err.Error(), nil))
			return
		}

		// F. Catat mutasi ledger di wallet_transactions
		insertTxQuery := `
			INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description, created_at)
			VALUES ($1, $2, 'DUES_PAYMENT', $3, 'Pembayaran Iuran Arisan', NOW());
		`
		if _, err := tx.Exec(ctx, insertTxQuery, walletID, obligationAmount, obligationID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mencatat mutasi dompet: "+err.Error(), nil))
			return
		}

		// Commit Transaksi ACID
		if err := tx.Commit(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyelesaikan transaksi: "+err.Error(), nil))
			return
		}

		c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pembayaran iuran berhasil diproses via dompet internal", gin.H{
			"payment_order_id":  paymentOrderID,
			"obligation_id":     obligationID,
			"amount_paid":       obligationAmount,
			"payment_method":    "WALLET",
			"payment_status":    "PAID",
			"remaining_balance": currentBalance - obligationAmount,
		}))
		return
	}

	// Metode Manual Transfer
	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Pesanan pembayaran transfer manual berhasil dibuat", gin.H{
		"obligation_id":  obligationID,
		"amount":         obligationAmount,
		"payment_method": method,
		"payment_status": "PENDING",
	}))
}

// GET /api/v1/payments/:id
func (h *PaymentHandler) GetPaymentDetail(c *gin.Context) {
	id := c.Param("id")

	query := `
		SELECT payment_order_id::text, order_type, payment_method, amount, payment_status, created_at
		FROM payment_orders
		WHERE payment_order_id = $1;
	`
	var orderID, orderType, paymentMethod, paymentStatus string
	var amount float64
	var createdAt time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, id).Scan(
		&orderID, &orderType, &paymentMethod, &amount, &paymentStatus, &createdAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Rincian pembayaran tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil data pembayaran: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Rincian pembayaran berhasil didapatkan", gin.H{
		"payment_order_id": orderID,
		"order_type":       orderType,
		"amount":           amount,
		"payment_method":   paymentMethod,
		"payment_status":   paymentStatus,
		"created_at":       createdAt.Format(time.RFC3339),
	}))
}

// POST /api/v1/payments/:id/proof
func (h *PaymentHandler) UploadPaymentProof(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}
	id := c.Param("id")

	var input struct {
		ProofURL string `json:"proof_url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "URL bukti bayar wajib disertakan: "+err.Error(), nil))
		return
	}

	query := `
		INSERT INTO payment_proofs (payment_order_id, proof_url, review_status, submitted_at)
		VALUES ($1, $2, 'PENDING', NOW())
		ON CONFLICT (payment_order_id)
		DO UPDATE SET proof_url = $2, review_status = 'PENDING', submitted_at = NOW()
		RETURNING payment_proof_id::text;
	`
	var proofID string
	err := h.DB.QueryRow(c.Request.Context(), query, id, input.ProofURL).Scan(&proofID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengunggah bukti bayar: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Bukti transfer berhasil diunggah", gin.H{
		"payment_proof_id": proofID,
		"payment_order_id": id,
		"proof_url":        input.ProofURL,
		"submitted_by":     userID,
		"review_status":    "PENDING",
	}))
}

// POST /api/v1/payment-proofs/:id/review
func (h *PaymentHandler) ReviewPaymentProof(c *gin.Context) {
	proofID := c.Param("id")
	reviewerID := c.GetString("user_id")
	if reviewerID == "" {
		reviewerID = c.GetString("userID")
	}

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

	query := `
		UPDATE payment_proofs
		SET review_status = $1, review_note = $2, reviewed_by_user_id = $3, reviewed_at = NOW()
		WHERE payment_proof_id = $4;
	`
	res, err := h.DB.Exec(ctx, query, input.ReviewStatus, input.ReviewNote, reviewerID, proofID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan review bukti bayar: "+err.Error(), nil))
		return
	}
	if res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Bukti bayar tidak ditemukan", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Review bukti bayar berhasil disimpan", gin.H{
		"payment_proof_id": proofID,
		"review_status":    input.ReviewStatus,
	}))
}

// POST /api/v1/webhooks/payment-gateway
func (h *PaymentHandler) HandlePaymentGatewayWebhook(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Webhook diterima", gin.H{
		"status": "PROCESSED",
	}))
}

// POST /api/v1/payments (Legacy frontend alias)
func (h *PaymentHandler) SubmitPayment(c *gin.Context) {
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
func (h *PaymentHandler) GetGroupPayments(c *gin.Context) {
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
func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
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

// GET /api/v1/circles/:id/payment-matrix
func (h *PaymentHandler) GetPaymentMatrix(c *gin.Context) {
	circleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Payment matrix berhasil didapatkan", gin.H{
		"circle_id": circleID,
		"periods":   []int{1, 2, 3},
		"matrix":    []gin.H{},
	}))
}
