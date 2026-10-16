package handlers

import (
	"net/http"
	"strconv"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DrawHandler struct {
	DB *pgxpool.Pool
}

func NewDrawHandler(db *pgxpool.Pool) *DrawHandler {
	return &DrawHandler{DB: db}
}

type BidInput struct {
	BidRatePercent float64 `json:"bid_rate_percent" binding:"required"`
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
		},
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil siklus arisan", cycles))
}

// GET /api/v1/cycles/:id
func (h *DrawHandler) GetCycleDetail(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil detail siklus", gin.H{
		"cycle_id":     cycleID,
		"cycle_number": 1,
		"cycle_status": "PAYMENT_COLLECTION",
	}))
}

// GET /api/v1/cycles/:id/participants
func (h *DrawHandler) GetCycleParticipants(c *gin.Context) {
	cycleID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	c.JSON(http.StatusOK, dto.BuildPaginatedResponse(
		http.StatusOK,
		"success",
		"Berhasil mengambil partisipan siklus "+cycleID,
		[]gin.H{},
		dto.MetaPagination{
			CurrentPage: page,
			PageSize:    pageSize,
			TotalItems:  0,
			TotalPages:  1,
		},
	))
}

// GET /api/v1/cycles/:id/obligations
func (h *DrawHandler) GetCycleObligations(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil tagihan iuran siklus", []gin.H{}))
}

// POST /api/v1/cycles/:id/bids (Track SPSB Lelang)
func (h *DrawHandler) SubmitCycleBid(c *gin.Context) {
	cycleID := c.Param("id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "11111111-1111-1111-1111-111111111111" // Fallback user demo
	}

	var input BidInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input bid tidak valid: "+err.Error(), nil))
		return
	}

	ctx := c.Request.Context()

	// 1. Dapatkan cycle_participant_id via JOIN 3 Tingkat
	var cycleParticipantID string
	getParticipantSql := `
		SELECT cp.cycle_participant_id
		FROM cycle_participants cp
		JOIN circle_memberships cm ON cp.circle_membership_id = cm.circle_membership_id
		WHERE cm.user_id = $1 
		  AND cp.cycle_id = $2 
		  AND cp.participation_status = 'ELIGIBLE'
		LIMIT 1;
	`
	err := h.DB.QueryRow(ctx, getParticipantSql, userID, cycleID).Scan(&cycleParticipantID)
	if err != nil {
		c.JSON(http.StatusForbidden, dto.BuildResponse(http.StatusForbidden, "error", "Anda tidak terdaftar sebagai peserta aktif di siklus ini", nil))
		return
	}

	// 2. Insert penawaran ke tabel bids menggunakan cycle_participant_id
	insertBidSql := `
		INSERT INTO bids (cycle_participant_id, bid_rate_percent, bid_status)
		VALUES ($1, $2, 'ACTIVE')
		RETURNING bid_id;
	`
	var bidID string
	err = h.DB.QueryRow(ctx, insertBidSql, cycleParticipantID, input.BidRatePercent).Scan(&bidID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan penawaran lelang: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Tawaran lelang berhasil diajukan", gin.H{
		"bid_id":               bidID,
		"cycle_id":             cycleID,
		"cycle_participant_id": cycleParticipantID,
		"bid_rate_percent":     input.BidRatePercent,
		"bid_status":           "ACTIVE",
	}))
}

// POST /api/v1/cycles/:id/draw (Track B Spin Wheel)
func (h *DrawHandler) ExecuteCycleDraw(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pengundian acak berhasil dieksekusi", gin.H{
		"cycle_id": cycleID,
		"winner":   "Roy",
	}))
}

// GET /api/v1/cycles/:id/award
func (h *DrawHandler) GetCycleAward(c *gin.Context) {
	cycleID := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pemenang siklus", gin.H{
		"award_id":    "awd-" + cycleID,
		"cycle_id":    cycleID,
		"winner_name": "Roy",
	}))
}

// GET /api/v1/draws/group/:id
func (h *DrawHandler) GetGroupDraws(c *gin.Context) {
	groupID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"group_id": groupID,
		"data":     []gin.H{},
	})
}
