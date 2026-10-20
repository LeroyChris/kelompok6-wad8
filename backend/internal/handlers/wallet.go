package handlers

import (
	"encoding/base64"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultWalletPageSize = 20
	maximumWalletPageSize = 100
)

type WalletHandler struct {
	DB *pgxpool.Pool
}

func NewWalletHandler(db *pgxpool.Pool) *WalletHandler {
	return &WalletHandler{DB: db}
}

func (h *WalletHandler) GetWalletBalance(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var wallet dto.WalletResponse
	var updatedAt time.Time
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT wallet_id::text, user_id::text, balance::float8, updated_at
		FROM user_wallets
		WHERE user_id = $1`, userID).Scan(
		&wallet.WalletID,
		&wallet.UserID,
		&wallet.Balance,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Wallet user tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil saldo wallet", nil))
		return
	}

	wallet.UpdatedAt = updatedAt.Format(time.RFC3339)
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Saldo dompet berhasil diambil", wallet))
}

func walletPageSize(raw string) int {
	if raw == "" {
		return defaultWalletPageSize
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 {
		return defaultWalletPageSize
	}
	if limit > maximumWalletPageSize {
		return maximumWalletPageSize
	}
	return limit
}

func decodeWalletCursor(cursor string) (*time.Time, string, error) {
	if cursor == "" {
		return nil, "", nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return nil, "", errors.New("cursor tidak valid")
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 2 || parts[1] == "" {
		return nil, "", errors.New("cursor tidak valid")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return nil, "", errors.New("cursor tidak valid")
	}
	return &createdAt, parts[1], nil
}

func encodeWalletCursor(createdAt time.Time, transactionID string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(createdAt.UTC().Format(time.RFC3339Nano) + "|" + transactionID))
}

// GetWalletTransactions returns ledger entries ordered newest-first using cursor pagination.
func (h *WalletHandler) GetWalletTransactions(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	limit := walletPageSize(c.Query("limit"))
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT
			wt.wallet_tx_id::text,
			wt.wallet_id::text,
			wt.tx_type,
			CASE
				WHEN wt.tx_type IN ('INITIAL_BALANCE', 'TOPUP', 'DISBURSEMENT') THEN 'CREDIT'
				ELSE 'DEBIT'
			END,
			wt.amount::float8,
			COALESCE(wt.description, ''),
			wt.created_at
		FROM wallet_transactions wt
		JOIN user_wallets uw ON uw.wallet_id = wt.wallet_id
		WHERE uw.user_id = $1
		  AND (
				$2::timestamptz IS NULL
				OR (wt.created_at, wt.wallet_tx_id) < ($2::timestamptz, $3::uuid)
			)
		ORDER BY wt.created_at DESC, wt.wallet_tx_id DESC
		LIMIT $4`, userID, cursorTime, nullableString(cursorID), limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil riwayat transaksi", nil))
		return
	}
	defer rows.Close()

	transactions := make([]dto.WalletTransactionItem, 0, limit)
	for rows.Next() {
		var item dto.WalletTransactionItem
		var createdAt time.Time
		if err := rows.Scan(
			&item.ID,
			&item.WalletID,
			&item.TransactionType,
			&item.MutationType,
			&item.Amount,
			&item.Description,
			&createdAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Data transaksi wallet tidak valid", nil))
			return
		}
		item.CreatedAt = createdAt.Format(time.RFC3339Nano)
		transactions = append(transactions, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membaca riwayat transaksi", nil))
		return
	}

	var nextCursor *string
	if len(transactions) > limit {
		last := transactions[limit-1]
		encoded := encodeWalletCursor(mustParseTransactionTime(last.CreatedAt), last.ID)
		nextCursor = &encoded
		transactions = transactions[:limit]
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat transaksi berhasil diambil", gin.H{
		"items": transactions,
		"meta": gin.H{
			"limit":       limit,
			"next_cursor": nextCursor,
		},
	}))
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func mustParseTransactionTime(value string) time.Time {
	parsed, _ := time.Parse(time.RFC3339, value)
	return parsed
}

// TopUpWallet is a sandbox-only operation and is recorded in the wallet ledger.
func (h *WalletHandler) TopUpWallet(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	if strings.EqualFold(os.Getenv("APP_ENV"), "production") {
		c.JSON(http.StatusForbidden, dto.BuildResponse(http.StatusForbidden, "error", "Top-up sandbox tidak tersedia di production", nil))
		return
	}

	var req dto.TopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Jumlah top-up harus berupa angka positif", nil))
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi top-up", nil))
		return
	}
	defer tx.Rollback(ctx)

	var walletID string
	var newBalance float64
	err = tx.QueryRow(ctx, `
		UPDATE user_wallets
		SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $2
		RETURNING wallet_id::text, balance::float8`, req.Amount, userID).Scan(&walletID, &newBalance)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Wallet user tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menambah saldo wallet", nil))
		return
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO wallet_transactions (wallet_id, amount, tx_type, description)
		VALUES ($1, $2, 'TOPUP', 'Top-up saldo sandbox')`, walletID, req.Amount); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mencatat transaksi top-up", nil))
		return
	}
	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan transaksi top-up", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Top-up saldo sandbox berhasil", gin.H{
		"wallet_id":    walletID,
		"topup_amount": req.Amount,
		"new_balance":  newBalance,
	}))
}
