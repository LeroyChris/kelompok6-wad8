package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
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

// advanceCycleAfterCollection moves a fully paid cycle to its next legal state.
func advanceCycleAfterCollection(ctx context.Context, tx pgx.Tx, obligationID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE arisan_cycles ac
		SET cycle_status = CASE WHEN c.track_type = 'SPSB' THEN 'BIDDING_OPEN' ELSE 'READY_FOR_DISBURSEMENT' END
		FROM circles c
		WHERE ac.circle_id = c.circle_id
		  AND ac.cycle_status = 'PAYMENT_COLLECTION'
		  AND ac.cycle_id = (
			SELECT cp.cycle_id FROM cycle_obligations co
			JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
			WHERE co.obligation_id = $1
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM cycle_obligations co
			JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
			WHERE cp.cycle_id = ac.cycle_id AND co.obligation_status <> 'PAID'
		  )`, obligationID)
	return err
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

	method := strings.ToUpper(input.PaymentMethod)
	if method == "" {
		method = "WALLET"
	}

	ctx := c.Request.Context()
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))

	// 1. Ambil detail obligation dari Supabase
	var obligationAmount float64
	var currentStatus string
	checkQuery := `
		SELECT co.amount_due, co.obligation_status
		FROM cycle_obligations co
		JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		WHERE co.obligation_id = $1 AND cm.user_id = $2;
	`
	err := h.DB.QueryRow(ctx, checkQuery, obligationID, userID).Scan(&obligationAmount, &currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Tagihan iuran tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memverifikasi tagihan: "+err.Error(), nil))
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

		// Lock and re-check the obligation inside the transaction. This prevents
		// concurrent requests from charging the same obligation twice.
		err = tx.QueryRow(ctx, `
			SELECT co.amount_due, co.obligation_status
			FROM cycle_obligations co
			JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
			JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
			WHERE co.obligation_id = $1 AND cm.user_id = $2
			FOR UPDATE OF co`, obligationID, userID).Scan(&obligationAmount, &currentStatus)
		if err != nil {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Tagihan iuran tidak ditemukan", nil))
			return
		}
		if currentStatus == "PAID" {
			if idempotencyKey != "" {
				var existingOrderID, existingStatus string
				err = tx.QueryRow(ctx, `SELECT po.payment_order_id::text, po.payment_status FROM payment_orders po JOIN obligation_payment_orders opo ON opo.payment_order_id=po.payment_order_id WHERE opo.obligation_id=$1 AND po.idempotency_key=$2`, obligationID, idempotencyKey).Scan(&existingOrderID, &existingStatus)
				if err == nil {
					_ = tx.Commit(ctx)
					c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Permintaan pembayaran telah diproses sebelumnya", gin.H{"payment_order_id": existingOrderID, "obligation_id": obligationID, "payment_status": existingStatus, "idempotent_replay": true}))
					return
				}
			}
			c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Tagihan iuran ini sudah lunas", nil))
			return
		}

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

		// B. Reserve the payment order before any balance mutation. The unique
		// idempotency key rejects a simultaneous retry before it can debit again.
		var paymentOrderID string
		insertOrderQuery := `
			INSERT INTO payment_orders (order_type, payment_method, amount, payment_status, idempotency_key)
			VALUES ('CYCLE_CONTRIBUTION', 'WALLET', $1, 'CREATED', NULLIF($2, ''))
			RETURNING payment_order_id::text;`
		if err := tx.QueryRow(ctx, insertOrderQuery, obligationAmount, idempotencyKey).Scan(&paymentOrderID); err != nil {
			c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Idempotency-Key sudah digunakan oleh pembayaran lain", nil))
			return
		}
		if _, err := tx.Exec(ctx, `INSERT INTO obligation_payment_orders (payment_order_id, obligation_id) VALUES ($1, $2)`, paymentOrderID, obligationID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menghubungkan relasi pembayaran", nil))
			return
		}

		// C. Potong saldo dompet user
		deductQuery := `
			UPDATE user_wallets
			SET balance = balance - $1, updated_at = NOW()
			WHERE wallet_id = $2;
		`
		if _, err := tx.Exec(ctx, deductQuery, obligationAmount, walletID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memotong saldo: "+err.Error(), nil))
			return
		}

		// D. Update status obligation and payment order menjadi PAID
		updateObligationQuery := `
			UPDATE cycle_obligations
			SET obligation_status = 'PAID'
			WHERE obligation_id = $1;
		`
		if _, err := tx.Exec(ctx, updateObligationQuery, obligationID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui status tagihan: "+err.Error(), nil))
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE payment_orders SET payment_status='PAID', paid_at=NOW() WHERE payment_order_id=$1`, paymentOrderID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui order pembayaran", nil))
			return
		}
		if err := advanceCycleAfterCollection(ctx, tx, obligationID); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui status siklus", nil))
			return
		}

		// E. Catat mutasi ledger di wallet_transactions
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

	if method != "MANUAL_TRANSFER" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "payment_method harus WALLET atau MANUAL_TRANSFER", nil))
		return
	}
	if currentStatus == "PAID" {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Tagihan iuran ini sudah lunas", nil))
		return
	}
	var paymentOrderID string
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(ctx)
	err = tx.QueryRow(ctx, `INSERT INTO payment_orders (order_type,payment_method,amount,payment_status,expires_at) VALUES ('CYCLE_CONTRIBUTION','MANUAL_TRANSFER',$1,'PENDING_REVIEW',CURRENT_TIMESTAMP + INTERVAL '24 hours') RETURNING payment_order_id::text`, obligationAmount).Scan(&paymentOrderID)
	if err == nil {
		_, err = tx.Exec(ctx, `INSERT INTO obligation_payment_orders (payment_order_id,obligation_id) VALUES ($1,$2)`, paymentOrderID, obligationID)
	}
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal membuat pesanan transfer manual", nil))
		return
	}
	if err = tx.Commit(ctx); err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal menyimpan pesanan transfer manual", nil))
		return
	}
	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Pesanan pembayaran transfer manual berhasil dibuat", gin.H{"payment_order_id": paymentOrderID, "obligation_id": obligationID, "amount": obligationAmount, "payment_method": method, "payment_status": "PENDING_REVIEW"}))
}

// GET /api/v1/payments/:id
func (h *PaymentHandler) GetPaymentDetail(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	query := `
		SELECT po.payment_order_id::text, po.order_type, po.payment_method, po.amount, po.payment_status, po.created_at
		FROM payment_orders po
		JOIN obligation_payment_orders opo ON opo.payment_order_id = po.payment_order_id
		JOIN cycle_obligations co ON co.obligation_id = opo.obligation_id
		JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
		JOIN circle_memberships payer_cm ON payer_cm.circle_membership_id = cp.circle_membership_id
		JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
		LEFT JOIN circle_memberships reviewer_cm
			ON reviewer_cm.circle_id = ac.circle_id
			AND reviewer_cm.user_id = $2
			AND reviewer_cm.membership_status = 'ACTIVE'
		WHERE po.payment_order_id = $1
		  AND (payer_cm.user_id = $2 OR reviewer_cm.membership_role IN ('OWNER', 'ADMIN'));
	`
	var orderID, orderType, paymentMethod, paymentStatus string
	var amount float64
	var createdAt time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, id, userID).Scan(
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
	var ownerID string
	err := h.DB.QueryRow(c.Request.Context(), `SELECT cm.user_id::text FROM payment_orders po JOIN obligation_payment_orders opo ON opo.payment_order_id=po.payment_order_id JOIN cycle_obligations co ON co.obligation_id=opo.obligation_id JOIN cycle_participants cp ON cp.cycle_participant_id=co.cycle_participant_id JOIN circle_memberships cm ON cm.circle_membership_id=cp.circle_membership_id WHERE po.payment_order_id=$1 AND po.payment_method='MANUAL_TRANSFER' AND po.payment_status='PENDING_REVIEW'`, id).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) || ownerID != userID {
		c.JSON(http.StatusForbidden, dto.BuildResponse(http.StatusForbidden, "error", "Anda tidak dapat mengunggah bukti untuk pembayaran ini", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memverifikasi pembayaran", nil))
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
	err = h.DB.QueryRow(c.Request.Context(), query, id, input.ProofURL).Scan(&proofID)
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
	input.ReviewStatus = strings.ToUpper(strings.TrimSpace(input.ReviewStatus))
	if input.ReviewStatus != "APPROVED" && input.ReviewStatus != "REJECTED" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "review_status harus APPROVED atau REJECTED", nil))
		return
	}
	var payerID, reviewerRole string
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT payer_cm.user_id::text, reviewer_cm.membership_role
		FROM payment_proofs pp
		JOIN payment_orders po ON po.payment_order_id=pp.payment_order_id
		JOIN obligation_payment_orders opo ON opo.payment_order_id=po.payment_order_id
		JOIN cycle_obligations co ON co.obligation_id=opo.obligation_id
		JOIN cycle_participants cp ON cp.cycle_participant_id=co.cycle_participant_id
		JOIN circle_memberships payer_cm ON payer_cm.circle_membership_id=cp.circle_membership_id
		JOIN arisan_cycles ac ON ac.cycle_id=cp.cycle_id
		JOIN circle_memberships reviewer_cm ON reviewer_cm.circle_id=ac.circle_id AND reviewer_cm.user_id=$2 AND reviewer_cm.membership_status='ACTIVE'
		WHERE pp.payment_proof_id=$1`, proofID, reviewerID).Scan(&payerID, &reviewerRole)
	if err != nil || payerID == reviewerID || (reviewerRole != "OWNER" && reviewerRole != "ADMIN") {
		c.JSON(http.StatusForbidden, dto.BuildResponse(http.StatusForbidden, "error", "Hanya owner/admin lain yang dapat meninjau bukti transfer", nil))
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
		var obligationID, userID, paymentOrderID, circleID string
		var amount float64
		getPaymentInfoSql := `
			SELECT co.obligation_id, cm.user_id, co.amount_due, po.payment_order_id, ac.circle_id
			FROM payment_proofs pp
			JOIN payment_orders po ON pp.payment_order_id = po.payment_order_id
			JOIN obligation_payment_orders opo ON po.payment_order_id = opo.payment_order_id
			JOIN cycle_obligations co ON opo.obligation_id = co.obligation_id
			JOIN cycle_participants cp ON co.cycle_participant_id = cp.cycle_participant_id
			JOIN circle_memberships cm ON cp.circle_membership_id = cm.circle_membership_id
			JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
			WHERE pp.payment_proof_id = $1;
		`
		err = tx.QueryRow(ctx, getPaymentInfoSql, proofID).Scan(&obligationID, &userID, &amount, &paymentOrderID, &circleID)
		if err == nil {
			var reviewerRole string
			err = tx.QueryRow(ctx, `SELECT membership_role FROM circle_memberships WHERE circle_id=$1 AND user_id=$2 AND membership_status='ACTIVE'`, circleID, reviewerID).Scan(&reviewerRole)
			if err != nil || (reviewerRole != "OWNER" && reviewerRole != "ADMIN") || reviewerID == userID {
				c.JSON(http.StatusForbidden, dto.BuildResponse(http.StatusForbidden, "error", "Hanya owner/admin lain yang dapat meninjau bukti transfer", nil))
				return
			}
			// 2. Set Status Obligation -> PAID
			_, err = tx.Exec(ctx, `UPDATE cycle_obligations SET obligation_status = 'PAID' WHERE obligation_id = $1 AND obligation_status <> 'PAID'`, obligationID)
			if err == nil {
				_, err = tx.Exec(ctx, `UPDATE payment_orders SET payment_status='PAID',paid_at=NOW() WHERE payment_order_id=$1`, paymentOrderID)
			}
			if err == nil {
				err = advanceCycleAfterCollection(ctx, tx, obligationID)
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyetujui pembayaran", nil))
				return
			}
		} else {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Bukti pembayaran tidak ditemukan", nil))
			return
		}

		if err := tx.Commit(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memproses persetujuan pembayaran", nil))
			return
		}
	}
	if input.ReviewStatus == "REJECTED" {
		_, err := h.DB.Exec(ctx, `UPDATE payment_orders po SET payment_status='REJECTED' FROM payment_proofs pp WHERE pp.payment_order_id=po.payment_order_id AND pp.payment_proof_id=$1`, proofID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menolak pembayaran", nil))
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
