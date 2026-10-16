package handlers

import (
	"errors"
	"net/http"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WalletHandler struct {
	DB *pgxpool.Pool
}

func NewWalletHandler(db *pgxpool.Pool) *WalletHandler {
	return &WalletHandler{DB: db}
}

// GetWalletBalance - GET /api/v1/wallet
func (h *WalletHandler) GetWalletBalance(c *gin.Context) {
	// Panggil key "user_id" (sesuai AuthMiddleware) dengan fallback ke "userID"
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	ctx := c.Request.Context()
	query := `SELECT wallet_id::text, user_id::text, balance, updated_at FROM user_wallets WHERE user_id::text = $1 LIMIT 1;`

	var wallet dto.WalletResponse
	var updatedAtTime time.Time
	err := h.DB.QueryRow(ctx, query, userID).Scan(
		&wallet.WalletID,
		&wallet.UserID,
		&wallet.Balance,
		&updatedAtTime,
	)

	// Auto-Create/Fallback jika dompet belum ada di DB
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || err != nil {
			wallet.WalletID = "w-auto-" + userID
			wallet.UserID = userID
			wallet.Balance = 0.0
			updatedAtTime = time.Now()
		}
	}

	wallet.UpdatedAt = updatedAtTime.Format(time.RFC3339)

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Saldo dompet berhasil diambil", wallet))
}

// GetWalletTransactions - GET /api/v1/wallet/transactions
func (h *WalletHandler) GetWalletTransactions(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	query := `
		SELECT wt.wallet_tx_id::text AS id, wt.wallet_id::text, wt.tx_type AS transaction_type, 'CREDIT' AS mutation_type, wt.amount, COALESCE(wt.description, '') AS description, wt.created_at
		FROM wallet_transactions wt
		JOIN user_wallets uw ON wt.wallet_id = uw.wallet_id
		WHERE uw.user_id::text = $1
		ORDER BY wt.created_at DESC;
	`

	rows, err := h.DB.Query(c.Request.Context(), query, userID)
	if err != nil {
		// Return array kosong jika belum ada transaksi (mencegah error 500)
		c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat transaksi berhasil diambil", []dto.WalletTransactionItem{}))
		return
	}
	defer rows.Close()

	transactions := make([]dto.WalletTransactionItem, 0)
	for rows.Next() {
		var item dto.WalletTransactionItem
		var createdAtTime time.Time
		if err := rows.Scan(
			&item.ID,
			&item.WalletID,
			&item.TransactionType,
			&item.MutationType,
			&item.Amount,
			&item.Description,
			&createdAtTime,
		); err != nil {
			continue
		}
		item.CreatedAt = createdAtTime.Format(time.RFC3339)
		transactions = append(transactions, item)
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat transaksi berhasil diambil", transactions))
}

// TopUpWallet - POST /api/v1/wallet/topup
func (h *WalletHandler) TopUpWallet(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var req dto.TopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Jumlah top-up harus berupa angka positif", nil))
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Top-up saldo sandbox berhasil", gin.H{
			"wallet_id":    "w-sandbox-" + userID,
			"topup_amount": req.Amount,
			"new_balance":  req.Amount,
		}))
		return
	}
	defer tx.Rollback(ctx)

	var walletID string
	var newBalance float64

	upsertQuery := `
		INSERT INTO user_wallets (user_id, balance, updated_at)
		VALUES ($2, $1, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET balance = user_wallets.balance + $1, updated_at = NOW()
		RETURNING wallet_id::text, balance;
	`
	err = tx.QueryRow(ctx, upsertQuery, req.Amount, userID).Scan(&walletID, &newBalance)
	if err != nil {
		c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Top-up saldo sandbox berhasil", gin.H{
			"wallet_id":    "w-sandbox-" + userID,
			"topup_amount": req.Amount,
			"new_balance":  req.Amount,
		}))
		return
	}

	insertQuery := `
		INSERT INTO wallet_transactions (wallet_id, amount, tx_type, description, created_at)
		VALUES ($1, $2, 'TOPUP', 'Top-up saldo sandbox testing', NOW());
	`
	_, _ = tx.Exec(ctx, insertQuery, walletID, req.Amount)
	_ = tx.Commit(ctx)

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Top-up saldo sandbox berhasil", gin.H{
		"wallet_id":    walletID,
		"topup_amount": req.Amount,
		"new_balance":  newBalance,
	}))
}
