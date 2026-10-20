package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
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

func maskAccountNumber(accountNumber string) string {
	if len(accountNumber) <= 4 {
		return strings.Repeat("*", len(accountNumber))
	}
	return strings.Repeat("*", len(accountNumber)-4) + accountNumber[len(accountNumber)-4:]
}

func tokeniseAccountNumber(accountNumber string) string {
	digest := sha256.Sum256([]byte(accountNumber))
	return hex.EncodeToString(digest[:])
}

func (h *BankAccountHandler) GetBankAccounts(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT
			bank_account_id::text,
			user_id::text,
			provider,
			account_number_masked,
			COALESCE(account_name_from_provider, ''),
			created_at
		FROM user_bank_accounts
		WHERE user_id = $1
		ORDER BY created_at ASC, bank_account_id ASC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil rekening bank", nil))
		return
	}
	defer rows.Close()

	accounts := make([]dto.BankAccountItem, 0)
	for rows.Next() {
		var item dto.BankAccountItem
		var createdAt time.Time
		if err := rows.Scan(&item.ID, &item.UserID, &item.BankName, &item.AccountNumber, &item.AccountHolder, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Data rekening bank tidak valid", nil))
			return
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		accounts = append(accounts, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membaca rekening bank", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Daftar rekening bank berhasil diambil", accounts))
}

func (h *BankAccountHandler) AddBankAccount(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var req dto.CreateBankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data rekening tidak valid", nil))
		return
	}
	provider := strings.ToUpper(strings.TrimSpace(req.BankName))
	accountNumber := strings.ReplaceAll(strings.TrimSpace(req.AccountNumber), " ", "")
	accountHolder := strings.TrimSpace(req.AccountHolder)
	if provider == "" || accountNumber == "" || accountHolder == "" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data rekening tidak lengkap", nil))
		return
	}

	var account dto.BankAccountItem
	var createdAt time.Time
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO user_bank_accounts (
			user_id, provider, account_type, account_number_token,
			account_number_masked, account_name_from_provider, validation_status, authorization_type
		)
		VALUES ($1, $2, 'BANK', $3, $4, $5, 'MATCHED', 'SELF')
		RETURNING bank_account_id::text, user_id::text, provider, account_number_masked,
			COALESCE(account_name_from_provider, ''), created_at`,
		userID, provider, tokeniseAccountNumber(accountNumber), maskAccountNumber(accountNumber), accountHolder,
	).Scan(&account.ID, &account.UserID, &account.BankName, &account.AccountNumber, &account.AccountHolder, &createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menambahkan rekening bank", nil))
		return
	}
	account.CreatedAt = createdAt.Format(time.RFC3339)
	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Rekening bank berhasil ditambahkan", account))
}

func (h *BankAccountHandler) DeleteBankAccount(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	commandTag, err := h.DB.Exec(c.Request.Context(), `
		DELETE FROM user_bank_accounts
		WHERE bank_account_id = $1 AND user_id = $2`, c.Param("id"), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menghapus rekening bank", nil))
		return
	}
	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Rekening bank tidak ditemukan", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Rekening bank berhasil dihapus", nil))
}

func (h *BankAccountHandler) CreateBankAccount(c *gin.Context) {
	h.AddBankAccount(c)
}
