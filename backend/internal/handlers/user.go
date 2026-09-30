package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

type UpdateProfileInput struct {
	Name        string `json:"name"`
	PhoneNumber string `json:"phone_number"`
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// GET /api/v1/users/me & GET /api/v1/users/profile
func GetProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Profil berhasil diambil", gin.H{
		"user_id":          userID,
		"full_name":        "Farrel Abda",
		"email":            "farrel@arisankita.id",
		"phone_number":     "081234567890",
		"account_status":   "ACTIVE",
		"wallet_balance":   5000000,
		"total_won_count":  1,
		"total_amount_won": 2000000,
	}))
}

// PATCH /api/v1/users/me & PUT /api/v1/users/profile
func UpdateProfile(c *gin.Context) {
	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Profil berhasil diperbarui", gin.H{
		"full_name":    input.Name,
		"phone_number": input.PhoneNumber,
	}))
}

// GET /api/v1/users/me/win-history
func GetWinHistory(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat kemenangan arisan", []gin.H{
		{
			"award_id":                 "awd11111-0001-0000-0000-000000000001",
			"circle_id":                "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
			"circle_name":              "Arisan Keluarga RT 05",
			"cycle_number":             1,
			"award_method":             "RANDOM_DRAW",
			"gross_amount":             2000000,
			"winning_bid_rate_percent": nil,
			"payable_bid_rate_percent": nil,
			"won_at":                   "2026-09-15T10:00:00Z",
		},
	}))
}

// GET /api/v1/users/me/reputation
func GetUserReputation(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Poin reputasi", gin.H{
		"reputation_score": 100,
		"badge":            "STARTER",
		"history":          []gin.H{},
	}))
}
