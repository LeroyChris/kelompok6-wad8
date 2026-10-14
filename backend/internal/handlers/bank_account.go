package handlers

import (
	"net/http"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BankAccountHandler struct {
	DB *pgxpool.Pool
}

func NewBankAccountHandler(db *pgxpool.Pool) *BankAccountHandler {
	return &BankAccountHandler{DB: db}
}

// GetBankAccounts - GET /api/v1/bank-accounts
func (h *BankAccountHandler) GetBankAccounts(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `
		SELECT bank_account_id::text, user_id::text, provider AS bank_name, account_number_token AS account_number, account_name_from_provider AS account_holder, true AS is_primary, created_at
		FROM user_bank_accounts
		WHERE user_id = $1
		ORDER BY created_at DESC;
	`

	rows, err := h.DB.Query(c.Request.Context(), query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil data rekening bank"})
		return
	}
	defer rows.Close()

	accounts := make([]dto.BankAccountItem, 0)
	for rows.Next() {
		var acc dto.BankAccountItem
		var createdAtTime time.Time
		if err := rows.Scan(
			&acc.ID,
			&acc.UserID,
			&acc.BankName,
			&acc.AccountNumber,
			&acc.AccountHolder,
			&acc.IsPrimary,
			&createdAtTime,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memproses data rekening"})
			return
		}
		acc.CreatedAt = createdAtTime.Format(time.RFC3339)
		accounts = append(accounts, acc)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": accounts})
}

// AddBankAccount / CreateBankAccount - POST /api/v1/bank-accounts
func (h *BankAccountHandler) AddBankAccount(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	var req dto.CreateBankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Data rekening tidak valid"})
		return
	}

	query := `
		INSERT INTO user_bank_accounts (
			user_id, provider, account_type, account_number_token,
			account_number_masked, account_name_from_provider, validation_status, created_at
		)
		VALUES ($1, $2, 'BANK', $3, $3, $4, 'MATCHED', NOW())
		RETURNING bank_account_id::text, created_at;
	`

	var acc dto.BankAccountItem
	acc.UserID = userID
	acc.BankName = req.BankName
	acc.AccountNumber = req.AccountNumber
	acc.AccountHolder = req.AccountHolder
	acc.IsPrimary = req.IsPrimary

	var createdAtTime time.Time
	err := h.DB.QueryRow(c.Request.Context(), query, userID, req.BankName, req.AccountNumber, req.AccountHolder, req.IsPrimary).Scan(
		&acc.ID,
		&createdAtTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menambahkan rekening bank"})
		return
	}

	acc.CreatedAt = createdAtTime.Format(time.RFC3339)

	c.JSON(http.StatusCreated, gin.H{"status": "success", "message": "Rekening bank berhasil ditambahkan", "data": acc})
}

// DeleteBankAccount - DELETE /api/v1/bank-accounts/:id
func (h *BankAccountHandler) DeleteBankAccount(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	accountID := c.Param("id")

	query := `DELETE FROM user_bank_accounts WHERE bank_account_id = $1 AND user_id = $2;`
	res, err := h.DB.Exec(c.Request.Context(), query, accountID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus rekening bank"})
		return
	}

	if res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Rekening bank tidak ditemukan atau bukan milik Anda"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Rekening bank berhasil dihapus"})
}

func (h *BankAccountHandler) CreateBankAccount(c *gin.Context) {
	h.AddBankAccount(c)
}
