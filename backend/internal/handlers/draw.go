package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

type BidInput struct {
	BidRatePercent float64 `json:"bid_rate_percent" binding:"required"`
}

// GET /api/v1/circles/:id/cycles
func GetCircleCycles(c *gin.Context) {
	circleID := c.Param("id")
	cycles := []gin.H{
		{
			"cycle_id":     "cyc-uuid-001",
			"circle_id":    circleID,
			"cycle_number": 1,
			"cycle_status": "COMPLETED",
			"due_at":       "2026-08-01T00:00:00Z",
		},
		{
			"cycle_id":     "cyc-uuid-002",
			"circle_id":    circleID,
			"cycle_number": 2,
			"cycle_status": "PAYMENT_COLLECTION",
			"due_at":       "2026-09-01T00:00:00Z",
		},
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil siklus arisan", cycles))
}

// GET /api/v1/cycles/:id
func GetCycleDetail(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil detail siklus", gin.H{
		"cycle_id":     cycleID,
		"cycle_number": 2,
		"cycle_status": "PAYMENT_COLLECTION",
		"due_at":       "2026-09-01T00:00:00Z",
	}))
}

// GET /api/v1/cycles/:id/participants
func GetCycleParticipants(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil partisipan siklus", []gin.H{
		{"participant_id": "par-01", "name": "Farrel Abda", "status": "ELIGIBLE"},
		{"participant_id": "par-02", "name": "Roy", "status": "ELIGIBLE"},
		{"participant_id": "par-03", "name": "Faza", "status": "ELIGIBLE"},
	}))
}

// GET /api/v1/cycles/:id/obligations
func GetCycleObligations(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil tagihan iuran siklus", []gin.H{
		{"obligation_id": "ob-01", "participant_id": "par-01", "amount_due": 500000, "status": "PAID"},
		{"obligation_id": "ob-02", "participant_id": "par-02", "amount_due": 500000, "status": "UNPAID"},
	}))
}

// POST /api/v1/cycles/:id/bids
func SubmitCycleBid(c *gin.Context) {
	cycleID := c.Param("id")
	var input BidInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input bid tidak valid: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Tawaran lelang berhasil diajukan", gin.H{
		"cycle_id":         cycleID,
		"bid_rate_percent": input.BidRatePercent,
		"bid_status":       "ACTIVE",
	}))
}

// POST /api/v1/cycles/:id/draw
func ExecuteCycleDraw(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pengundian acak berhasil dieksekusi", gin.H{
		"award_id":             "awd-uuid-001",
		"cycle_id":             cycleID,
		"winner_name":          "Roy",
		"award_method":         "RANDOM_DRAW",
		"gross_amount":         5000000,
		"random_seed_commitment": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
	}))
}

// GET /api/v1/cycles/:id/award
func GetCycleAward(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pemenang siklus", gin.H{
		"award_id":      "awd-uuid-001",
		"cycle_id":      cycleID,
		"winner_name":   "Roy",
		"award_method":  "RANDOM_DRAW",
		"gross_amount":  5000000,
	}))
}

// GET /api/v1/draws/group/:id (Legacy alias)
func GetGroupDraws(c *gin.Context) {
	groupID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"group_id": groupID,
		"data": []gin.H{
			{
				"draw_id":       "draw-uuid-901",
				"period_number": 1,
				"winner_name":   "Roy",
				"total_won":     5000000,
				"draw_date":     "2026-08-01T10:00:00Z",
			},
		},
	})
}
