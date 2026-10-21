package handlers

import (
	"net/http"
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
	return id
}

func (h *DrawHandler) GetCycleParticipants(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "cursor tidak valid", nil))
		return
	}
	participants, err := h.drawService.GetParticipantsCursor(c.Request.Context(), cycleID, limit+1, cursorTime, cursorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil partisipan: "+err.Error(), nil))
		return
	}
	var nextCursor any
	if len(participants) > limit {
		last := participants[limit-1]
		nextCursor = encodeWalletCursor(last.CreatedAt, last.ParticipantID)
		participants = participants[:limit]
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil partisipan siklus "+cycleID, gin.H{"items": participants, "meta": gin.H{"limit": limit, "next_cursor": nextCursor}}))
}

func (h *DrawHandler) ExecuteCycleDraw(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))

	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	result, err := h.drawService.ExecuteCycleDraw(c.Request.Context(), cycleID, userID)
	if err != nil {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", err.Error(), nil))
		return
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Pemenang putaran arisan berhasil ditetapkan dan dana dicairkan", result))
}
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

func (h *DrawHandler) GetMyCycleBid(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	cycleID := normalizeCycleID(c.Param("id"))
	bid, err := h.drawService.GetUserBid(c.Request.Context(), cycleID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil bid", nil))
		return
	}
	if bid == nil {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Belum ada bid aktif", nil))
		return
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Bid aktif berhasil diambil", gin.H{"cycle_id": cycleID, "bid_rate_percent": bid.BidRatePercent, "bid_status": "ACTIVE"}))
}

func (h *DrawHandler) CloseBidding(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	if err := h.drawService.CloseBidding(c.Request.Context(), cycleID); err != nil {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", err.Error(), nil))
		return
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Bidding ditutup dan siklus siap dicairkan", gin.H{"cycle_id": cycleID, "cycle_status": "READY_FOR_DISBURSEMENT"}))
}

func (h *DrawHandler) CreateCircleCycle(c *gin.Context) {
	circleID := c.Param("id")

	var input CreateCycleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input siklus tidak valid: "+err.Error(), nil))
		return
	}

	dueAt := time.Now().AddDate(0, 1, 0)
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

func (h *DrawHandler) GetCircleCycles(c *gin.Context) {
	circleID := c.Param("id")
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "cursor tidak valid", nil))
		return
	}
	cycles, err := h.drawService.GetCyclesByCircle(c.Request.Context(), circleID, limit+1, cursorTime, cursorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil siklus", nil))
		return
	}
	var nextCursor any
	if len(cycles) > limit {
		last := cycles[limit-1]
		nextCursor = encodeWalletCursor(last.CreatedAt, last.CycleID)
		cycles = cycles[:limit]
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil siklus arisan", gin.H{"items": cycles, "meta": gin.H{"limit": limit, "next_cursor": nextCursor}}))
}

func (h *DrawHandler) GetCycleDetail(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	cycle, err := h.drawService.GetCycle(c.Request.Context(), cycleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil siklus", nil))
		return
	}
	if cycle == nil {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Siklus tidak ditemukan", nil))
		return
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil detail siklus", cycle))
}

func (h *DrawHandler) GetCycleObligations(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "cursor tidak valid", nil))
		return
	}
	obligations, err := h.drawService.GetCycleObligations(c.Request.Context(), cycleID, limit+1, cursorTime, cursorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil tagihan: "+err.Error(), nil))
		return
	}

	var nextCursor any
	if len(obligations) > limit {
		nextCursor = encodeWalletCursor(obligations[limit-1].CreatedAt, obligations[limit-1].ObligationID)
		obligations = obligations[:limit]
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil tagihan iuran siklus", gin.H{"items": obligations, "meta": gin.H{"limit": limit, "next_cursor": nextCursor}}))
}

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

func (h *DrawHandler) GetDrawProof(c *gin.Context) {
	cycleID := normalizeCycleID(c.Param("id"))
	proof, err := h.drawService.GetDrawProof(c.Request.Context(), cycleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil bukti draw", nil))
		return
	}
	if proof == nil {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Bukti draw belum tersedia untuk siklus ini", nil))
		return
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Bukti random draw berhasil diambil", proof))
}
