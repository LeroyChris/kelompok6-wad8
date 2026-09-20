package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

// DTO untuk Request Bidding (Track A)
type BidRequest struct {
	UserID    string `json:"user_id" binding:"required"`
	BidAmount int64  `json:"bid_amount" binding:"required"`
}

// GET /api/v1/circles
func GetCircles(c *gin.Context) {
	dummyCircles := []gin.H{
		{"id": "ARK-101", "name": "Arisan Keluarga", "track": "TRACK_B", "dues": 100000},
		{"id": "ARK-102", "name": "Arisan Kantor", "track": "TRACK_A", "dues": 250000},
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil daftar circle", dummyCircles))
}

// POST /api/v1/circles/:id/bids (Track A)
func SubmitBid(c *gin.Context) {
	circleID := c.Param("id")
	var req BidRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input tidak valid: "+err.Error(), nil))
		return
	}

	responseData := gin.H{
		"circle_id":  circleID,
		"user_id":    req.UserID,
		"bid_amount": req.BidAmount,
		"status":     "SUBMITTED",
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Penawaran lelang berhasil dikirim", responseData))
}

// POST /api/v1/circles/:id/spin (Track B)
func SpinWheel(c *gin.Context) {
	circleID := c.Param("id")

	responseData := gin.H{
		"circle_id":   circleID,
		"winner_id":   "USR-007",
		"winner_name": "Farrel Abda",
		"total_pot":   1500000,
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pengocokan berhasil", responseData))
}