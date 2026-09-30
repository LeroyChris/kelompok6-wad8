package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type AddBankAccountInput struct {
	Provider           string `json:"provider" binding:"required"`
	AccountType        string `json:"account_type" binding:"required"` // BANK, E_WALLET
	AccountNumber      string `json:"account_number" binding:"required"`
	AuthorizationType  string `json:"authorization_type"`             // SELF, FAMILY_AUTHORIZED
}

// POST /api/v1/bank-accounts
func AddBankAccount(c *gin.Context) {
	var input AddBankAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	userID, _ := c.Get("userID")

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Rekening berhasil didaftarkan",
		"data": gin.H{
			"bank_account_id":       "ba-uuid-001",
			"user_id":               userID,
			"provider":              input.Provider,
			"account_type":          input.AccountType,
			"account_number_masked": "****" + input.AccountNumber[max(0, len(input.AccountNumber)-4):],
			"validation_status":     "PENDING",
			"authorization_type":    input.AuthorizationType,
		},
	})
}

// GET /api/v1/bank-accounts
func GetBankAccounts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": []gin.H{
			{
				"bank_account_id":       "ba-uuid-001",
				"provider":              "BCA",
				"account_type":          "BANK",
				"account_number_masked": "******1234",
				"validation_status":     "MATCHED",
				"authorization_type":    "SELF",
			},
		},
	})
}

// DELETE /api/v1/bank-accounts/:id
func DeleteBankAccount(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Rekening berhasil dihapus",
		"data": gin.H{
			"bank_account_id": id,
		},
	})
}
