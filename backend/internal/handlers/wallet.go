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
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `SELECT id AS wallet_id, user_id, balance, updated_at FROM user_wallets WHERE user_id = $1;`

	var wallet dto.WalletResponse
	var updatedAtTime time.Time
	err := h.DB.QueryRow(c.Request.Context(), query, userID).Scan(
		&wallet.WalletID,
		&wallet.UserID,
		&wallet.Balance,
		&updatedAtTime,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Dompet tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil data saldo"})
		return
	}

	wallet.UpdatedAt = updatedAtTime.Format(time.RFC3339)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Saldo berhasil didapatkan", "data": wallet})
}

// GetWalletTransactions - GET /api/v1/wallet/transactions
func (h *WalletHandler) GetWalletTransactions(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `
		SELECT wt.id, wt.wallet_id, wt.transaction_type, wt.mutation_type, wt.amount, COALESCE(wt.description, '') AS description, wt.created_at
		FROM wallet_transactions wt
		JOIN user_wallets uw ON wt.wallet_id = uw.id
		WHERE uw.user_id = $1
		ORDER BY wt.created_at DESC;
	`

	rows, err := h.DB.Query(c.Request.Context(), query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil transaksi"})
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
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memproses transaksi"})
			return
		}
		item.CreatedAt = createdAtTime.Format(time.RFC3339)
		transactions = append(transactions, item)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": transactions})
}

// TopUpWallet - POST /api/v1/wallet/topup
func (h *WalletHandler) TopUpWallet(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	var req dto.TopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Jumlah top-up harus berupa angka positif"})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	var walletID string
	var newBalance float64

	// Query UPSERT: Membuat row dompet baru jika belum ada, atau menambah balance jika sudah ada
	upsertQuery := `
		INSERT INTO user_wallets (user_id, balance, updated_at)
		VALUES ($2, $1, NOW())
		ON CONFLICT (user_id) 
		DO UPDATE SET balance = user_wallets.balance + $1, updated_at = NOW()
		RETURNING id, balance;
	`
	err = tx.QueryRow(ctx, upsertQuery, req.Amount, userID).Scan(&walletID, &newBalance)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui saldo dompet"})
		return
	}

	insertQuery := `
		INSERT INTO wallet_transactions (wallet_id, transaction_type, mutation_type, amount, description, created_at)
		VALUES ($1, 'TOPUP', 'CREDIT', $2, 'Top-up saldo sandbox testing', NOW());
	`
	_, err = tx.Exec(ctx, insertQuery, walletID, req.Amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mencatat mutasi transaksi"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyelesaikan top-up"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Top-up saldo sandbox berhasil",
		"data": gin.H{
			"wallet_id":    walletID,
			"topup_amount": req.Amount,
			"new_balance":  newBalance,
		},
	})
}
