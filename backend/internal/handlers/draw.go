package handlers

import (
	"net/http"
	"strconv"

	"backend-arisankita/internal/dto"
	"backend-arisankita/internal/service"

	"github.com/gin-gonic/gin"
)

type DrawHandler struct {
	drawService service.DrawService
}

func NewDrawHandler(drawService service.DrawService) *DrawHandler {
	return &DrawHandler{drawService: drawService}
}

type BidInput struct {
	BidRatePercent float64 `json:"bid_rate_percent" binding:"required"`
}

// GET /api/v1/cycles/:id/participants?page=1&page_size=10
func (h *DrawHandler) GetCycleParticipants(c *gin.Context) {
	cycleID := c.Param("id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	participants, meta, err := h.drawService.GetParticipantsPaginated(c.Request.Context(), cycleID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil partisipan: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildPaginatedResponse(http.StatusOK, "success", "Berhasil mengambil partisipan siklus "+cycleID, participants, meta))
}

// POST /api/v1/cycles/:id/draw (Track B Spin Wheel)
func (h *DrawHandler) ExecuteCycleDraw(c *gin.Context) {
	cycleID := c.Param("id")

	result, err := h.drawService.ExecuteRandomDraw(c.Request.Context(), cycleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pengundian acak berhasil dieksekusi", result))
}

// POST /api/v1/cycles/:id/bids (Track A Lelang SPSB)
func (h *DrawHandler) SubmitCycleBid(c *gin.Context) {
	cycleID := c.Param("id")
	userID := c.GetString("user_id") // Diambil dari JWT Auth Middleware

	var input BidInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input bid tidak valid: "+err.Error(), nil))
		return
	}

	if err := h.drawService.SubmitBid(c.Request.Context(), cycleID, userID, input.BidRatePercent); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Tawaran lelang berhasil diajukan ke database", gin.H{
		"cycle_id":         cycleID,
		"bid_rate_percent": input.BidRatePercent,
		"bid_status":       "ACTIVE",
	}))
}

// GET /api/v1/circles/:id/cycles
func (h *DrawHandler) GetCircleCycles(c *gin.Context) {
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
func (h *DrawHandler) GetCycleDetail(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil detail siklus", gin.H{
		"cycle_id":     cycleID,
		"cycle_number": 2,
		"cycle_status": "PAYMENT_COLLECTION",
		"due_at":       "2026-09-01T00:00:00Z",
	}))
}

// GET /api/v1/cycles/:id/obligations
func (h *DrawHandler) GetCycleObligations(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil tagihan iuran siklus", []gin.H{
		{"obligation_id": "ob-01", "participant_id": "par-01", "amount_due": 500000, "status": "PAID"},
		{"obligation_id": "ob-02", "participant_id": "par-02", "amount_due": 500000, "status": "UNPAID"},
	}))
}

// GET /api/v1/cycles/:id/award
func (h *DrawHandler) GetCycleAward(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pemenang siklus", gin.H{
		"award_id":     "awd-" + cycleID,
		"cycle_id":     cycleID,
		"winner_name":  "Roy",
		"award_method": "RANDOM_DRAW",
		"gross_amount": 5000000,
	}))
}
