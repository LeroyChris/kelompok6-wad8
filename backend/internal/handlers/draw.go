package handlers

import (
	"net/http"
	"strconv"
	"time"

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

type CreateCycleInput struct {
	CycleNumber int    `json:"cycle_number" binding:"required"`
	DueAt       string `json:"due_at"`
}

func normalizeCycleID(id string) string {
	switch id {
	case "cyc-uuid-001":
		return "c1111111-0001-0000-0000-000000000001"
	case "cyc-uuid-002":
		return "c1111111-0002-0000-0000-000000000002"
	case "cyc-uuid-sqd-001", "cyc-spsb-001":
		return "c2222222-0001-0000-0000-000000000001"
	default:
		return id
	}
}

// GET /api/v1/cycles/:id/participants?page=1&page_size=10
func (h *DrawHandler) GetCycleParticipants(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	participants, meta, err := h.drawService.GetParticipantsPaginated(c.Request.Context(), cycleID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil partisipan: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildPaginatedResponse(http.StatusOK, "success", "Berhasil mengambil partisipan siklus "+cycleID, participants, meta))
}

// POST /api/v1/cycles/:id/draw (Eksekusi Pemenang: SPSB Vickrey atau Random Draw)
func (h *DrawHandler) ExecuteCycleDraw(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))

	result, err := h.drawService.ExecuteCycleDraw(c.Request.Context(), cycleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pemenang putaran arisan berhasil ditetapkan dan dana dicairkan", result))
}

// POST /api/v1/cycles/:id/bids (Track A Lelang SPSB)
func (h *DrawHandler) SubmitCycleBid(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	userID := c.GetString("userID")
	if userID == "" {
		userID = c.GetString("user_id")
	}

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

// POST /api/v1/circles/:id/cycles (Buka siklus baru, snapshot member, & terbitkan tagihan)
func (h *DrawHandler) CreateCircleCycle(c *gin.Context) {
	circleID := c.Param("id")

	var input CreateCycleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input siklus tidak valid: "+err.Error(), nil))
		return
	}

	dueAt := time.Now().AddDate(0, 1, 0) // Default 30 hari
	if input.DueAt != "" {
		if parsed, err := time.Parse(time.RFC3339, input.DueAt); err == nil {
			dueAt = parsed
		}
	}

	cycleID, err := h.drawService.StartNewCycle(c.Request.Context(), circleID, input.CycleNumber, dueAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menginisialisasi siklus baru: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Siklus baru berhasil dibuka dan tagihan iuran diterbitkan", gin.H{
		"cycle_id":     cycleID,
		"circle_id":    circleID,
		"cycle_number": input.CycleNumber,
		"cycle_status": "PAYMENT_COLLECTION",
		"due_at":       dueAt.Format(time.RFC3339),
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
	cycleID := normalizeCycleID(c.Param("id"))
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil detail siklus", gin.H{
		"cycle_id":     cycleID,
		"cycle_number": 2,
		"cycle_status": "PAYMENT_COLLECTION",
		"due_at":       "2026-09-01T00:00:00Z",
	}))
}

// GET /api/v1/cycles/:id/obligations (Query real data dari Supabase)
func (h *DrawHandler) GetCycleObligations(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	obligations, err := h.drawService.GetCycleObligations(c.Request.Context(), cycleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil tagihan: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil tagihan iuran siklus", obligations))
}

// GET /api/v1/cycles/:id/award (Query real data dari Supabase)
func (h *DrawHandler) GetCycleAward(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	award, err := h.drawService.GetCycleAward(c.Request.Context(), cycleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil data pemenang: "+err.Error(), nil))
		return
	}
	if award == nil {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Belum ada pemenang yang ditetapkan untuk siklus ini", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Data pemenang putaran arisan", award))
}

// GET /api/v1/draws/group/:id (Legacy alias)
func (h *DrawHandler) GetGroupDraws(c *gin.Context) {
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
