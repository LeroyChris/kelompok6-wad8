package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

type WalletHandler struct {
	DB *sql.DB
}

func NewWalletHandler(db *sql.DB) *WalletHandler {
	return &WalletHandler{DB: db}
}

type WalletResponse struct {
	WalletID  string  `json:"wallet_id"`
	UserID    string  `json:"user_id"`
	Balance   float64 `json:"balance"`
	UpdatedAt string  `json:"updated_at"`
}

type WalletTransactionItem struct {
	ID              string  `json:"id"`
	WalletID        string  `json:"wallet_id"`
	TransactionType string  `json:"transaction_type"`
	MutationType    string  `json:"mutation_type"`
	Amount          float64 `json:"amount"`
	Description     string  `json:"description"`
	CreatedAt       string  `json:"created_at"`
}

type TopUpRequest struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

// GET /api/v1/wallet
func (h *WalletHandler) GetWalletBalance(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `SELECT id AS wallet_id, user_id, balance, updated_at FROM user_wallets WHERE user_id = $1;`

	var wallet WalletResponse
	err := h.DB.QueryRowContext(c.Request.Context(), query, userID).Scan(&wallet.WalletID, &wallet.UserID, &wallet.Balance, &wallet.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Dompet tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil data saldo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Saldo berhasil didapatkan", "data": wallet})
}

// GET /api/v1/wallet/transactions
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

	rows, err := h.DB.QueryContext(c.Request.Context(), query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil transaksi"})
		return
	}
	defer rows.Close()

	transactions := make([]WalletTransactionItem, 0)
	for rows.Next() {
		var item WalletTransactionItem
		if err := rows.Scan(&item.ID, &item.WalletID, &item.TransactionType, &item.MutationType, &item.Amount, &item.Description, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memproses transaksi"})
			return
		}
		transactions = append(transactions, item)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": transactions})
}

// POST /api/v1/wallet/topup
func (h *WalletHandler) TopUpWallet(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	var req TopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Jumlah top-up harus berupa angka positif"})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback()

	var walletID string
	var newBalance float64
	updateQuery := `UPDATE user_wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING id, balance;`
	err = tx.QueryRowContext(ctx, updateQuery, req.Amount, userID).Scan(&walletID, &newBalance)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui saldo"})
		return
	}

	insertQuery := `
		INSERT INTO wallet_transactions (wallet_id, transaction_type, mutation_type, amount, description, created_at)
		VALUES ($1, 'TOPUP', 'CREDIT', $2, 'Top-up saldo sandbox testing', NOW());
	`
	_, err = tx.ExecContext(ctx, insertQuery, walletID, req.Amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mencatat mutasi"})
		return
	}

	if err := tx.Commit(); err != nil {
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
