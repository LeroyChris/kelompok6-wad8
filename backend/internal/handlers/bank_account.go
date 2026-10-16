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
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}

	accounts := []dto.BankAccountItem{
		{
			ID:            "ba-01",
			UserID:        userID,
			BankName:      "BCA",
			AccountNumber: "1234567890",
			AccountHolder: "Farrel Abda",
			IsPrimary:     true,
			CreatedAt:     time.Now().Format(time.RFC3339),
		},
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Daftar rekening bank berhasil diambil", accounts))
}

// AddBankAccount / CreateBankAccount - POST /api/v1/bank-accounts
func (h *BankAccountHandler) AddBankAccount(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}

	var req dto.CreateBankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data rekening tidak valid", nil))
		return
	}

	acc := dto.BankAccountItem{
		ID:            "ba-" + time.Now().Format("02150405"),
		UserID:        userID,
		BankName:      req.BankName,
		AccountNumber: req.AccountNumber,
		AccountHolder: req.AccountHolder,
		IsPrimary:     req.IsPrimary,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Rekening bank berhasil ditambahkan", acc))
}

// DeleteBankAccount - DELETE /api/v1/bank-accounts/:id
func (h *BankAccountHandler) DeleteBankAccount(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Rekening bank berhasil dihapus", nil))
}

func (h *BankAccountHandler) CreateBankAccount(c *gin.Context) {
	h.AddBankAccount(c)
}
