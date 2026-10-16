package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CircleHandler struct {
	DB *pgxpool.Pool
}

func NewCircleHandler(db *pgxpool.Pool) *CircleHandler {
	return &CircleHandler{DB: db}
}

type CreateCircleInput struct {
	CircleName         string   `json:"circle_name"`
	Name               string   `json:"name"`                          // Alias dari frontend
	TrackType          string   `json:"track_type" binding:"required"` // SPSB, RANDOM_DRAW
	ContributionAmount float64  `json:"contribution_amount"`
	MonthlyDues        float64  `json:"monthly_dues"` // Alias dari frontend
	MemberLimit        int      `json:"member_limit"`
	PeriodType         string   `json:"period_type"`
	BidFloorPercent    *float64 `json:"bid_floor_percent,omitempty"`
	BidCeilingPercent  *float64 `json:"bid_ceiling_percent,omitempty"`
}

type JoinCircleInput struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

// POST /api/v1/circles
func (h *CircleHandler) CreateCircle(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "11111111-1111-1111-1111-111111111111" // Fallback user demo
	}

	var input CreateCircleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input tidak valid: "+err.Error(), nil))
		return
	}

	name := input.CircleName
	if name == "" {
		name = input.Name
	}
	amount := input.ContributionAmount
	if amount == 0 {
		amount = input.MonthlyDues
	}
	members := input.MemberLimit
	if members == 0 {
		members = 10
	}
	periodType := input.PeriodType
	if periodType == "" {
		periodType = "MONTHLY"
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(ctx)

	// 1. Insert ke tabel circles
	var circleID string
	insertCircleSql := `
		INSERT INTO circles (circle_name, track_type, contribution_amount, member_limit, period_type, created_by_user_id, circle_status)
		VALUES ($1, $2, $3, $4, $5, $6, 'RECRUITING')
		RETURNING circle_id;
	`
	err = tx.QueryRow(ctx, insertCircleSql, name, input.TrackType, amount, members, periodType, userID).Scan(&circleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan circle ke DB: "+err.Error(), nil))
		return
	}

	// 2. Insert Pembuat sebagai 'OWNER' di circle_memberships
	var membershipID string
	insertMemberSql := `
		INSERT INTO circle_memberships (circle_id, user_id, membership_role, membership_status)
		VALUES ($1, $2, 'OWNER', 'ACTIVE')
		RETURNING circle_membership_id;
	`
	err = tx.QueryRow(ctx, insertMemberSql, circleID, userID).Scan(&membershipID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menambahkan keanggotaan owner: "+err.Error(), nil))
		return
	}

	// 3. Buat Kode Undangan Otomatis di circle_invitations
	rand.Seed(time.Now().UnixNano())
	inviteCode := fmt.Sprintf("ARK-%04d", rand.Intn(10000))
	insertInviteSql := `
		INSERT INTO circle_invitations (circle_id, invite_code, invitation_status)
		VALUES ($1, $2, 'ACTIVE');
	`
	_, err = tx.Exec(ctx, insertInviteSql, circleID, inviteCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat kode undangan: "+err.Error(), nil))
		return
	}

	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyelesaikan pembuatan circle", nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Circle arisan berhasil dibuat", gin.H{
		"circle_id":            circleID,
		"id":                   circleID,
		"circle_name":          name,
		"name":                 name,
		"track_type":           input.TrackType,
		"contribution_amount":  amount,
		"invite_code":          inviteCode,
		"circle_membership_id": membershipID,
	}))
}

// GET /api/v1/circles/:id & GET /api/v1/groups/:id
func (h *CircleHandler) GetCircleDetail(c *gin.Context) {
	id := c.Param("id")

	responseData := gin.H{
		"circle_id":           id,
		"id":                  id,
		"circle_name":         "Arisan RT 05",
		"name":                "Arisan RT 05",
		"track_type":          "RANDOM_DRAW",
		"contribution_amount": 500000,
		"amount_per_period":   500000,
		"member_limit":        10,
		"max_members":         10,
		"period_type":         "MONTHLY",
		"circle_status":       "RECRUITING",
		"status":              "active",
		"members": []gin.H{
			{"circle_membership_id": "mem-01", "member_id": "mem-01", "name": "Farrel Abda", "role": "OWNER", "is_admin": true, "status": "ACTIVE"},
			{"circle_membership_id": "mem-02", "member_id": "mem-02", "name": "Roy", "role": "MEMBER", "is_admin": false, "status": "ACTIVE"},
			{"circle_membership_id": "mem-03", "member_id": "mem-03", "name": "Faza", "role": "MEMBER", "is_admin": false, "status": "ACTIVE"},
		},
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil detail circle", responseData))
}

// POST /api/v1/circles/join & POST /api/v1/invitations/join & POST /api/v1/groups/:id/join
func (h *CircleHandler) JoinCircle(c *gin.Context) {
	var input JoinCircleInput
	_ = c.ShouldBindJSON(&input)

	code := input.InviteCode
	if code == "" {
		code = "ARK-RT05-2026"
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil bergabung ke circle", gin.H{
		"circle_id":            "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"circle_name":          "Arisan Keluarga RT 05",
		"circle_membership_id": "mem-new-099",
		"membership_status":    "ACTIVE",
		"membership_role":      "MEMBER",
		"invite_code":          code,
	}))
}

// GET /api/v1/circles
func (h *CircleHandler) GetCircles(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil daftar circle", []gin.H{
		{
			"circle_id":           "c-uuid-101",
			"circle_name":         "Arisan Alumni 2018",
			"track_type":          "SPSB",
			"contribution_amount": 1000000,
			"circle_status":       "RUNNING",
		},
		{
			"circle_id":           "c-uuid-102",
			"circle_name":         "Arisan Keluarga Besar",
			"track_type":          "RANDOM_DRAW",
			"contribution_amount": 500000,
			"circle_status":       "RECRUITING",
		},
	}))
}

// POST /api/v1/circles/:id/lock
func (h *CircleHandler) LockCircle(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Circle berhasil dikunci", gin.H{
		"circle_id":     id,
		"circle_status": "LOCKED",
	}))
}

// POST /api/v1/circles/:id/invitations
func (h *CircleHandler) CreateInvitation(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Kode undangan berhasil dibuat", gin.H{
		"circle_id":   id,
		"invite_code": "ARK-JOIN-8821",
		"expires_at":  "2026-12-31T23:59:59Z",
	}))
}

// GET /api/v1/circles/:id/members
func (h *CircleHandler) GetCircleMembers(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil daftar anggota", []gin.H{
		{"circle_membership_id": "mem-01", "name": "Farrel Abda", "role": "OWNER", "status": "ACTIVE"},
		{"circle_membership_id": "mem-02", "name": "Roy", "role": "MEMBER", "status": "ACTIVE"},
	}))
}

// Legacy Aliases di Level Circle
func (h *CircleHandler) SubmitBid(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Silakan gunakan endpoint resmi /api/v1/cycles/:id/bids",
	})
}

func (h *CircleHandler) SpinWheel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Silakan gunakan endpoint resmi /api/v1/cycles/:id/draw",
	})
}
