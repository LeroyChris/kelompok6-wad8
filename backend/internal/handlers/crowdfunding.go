package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// POST /api/v1/circles/:id/crowdfunding
func CreateCrowdfundingHandler(c *gin.Context) {
	circleID := c.Param("id")

	// Struct lokal untuk menerima input JSON
	var req struct {
		Title        string  `json:"title" binding:"required"`
		TargetAmount float64 `json:"target_amount" binding:"required,gt=0"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Validasi patungan gagal: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Patungan internal berhasil dibuka untuk Circle ini",
		"data": gin.H{
			"campaign_id":   "cmp-uuid-123",
			"circle_id":     circleID,
			"title":         req.Title,
			"target_amount": req.TargetAmount,
			"collected":     0,
		},
	})
}

// POST /api/v1/crowdfunding/:id/contribute
func ContributeCrowdfundingHandler(c *gin.Context) {
	campaignID := c.Param("id")

	// Struct lokal untuk menerima input JSON
	var req struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Nominal patungan tidak valid",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Kontribusi patungan internal berhasil terkirim",
		"data": gin.H{
			"campaign_id": campaignID,
			"amount":      req.Amount,
		},
	})
}
