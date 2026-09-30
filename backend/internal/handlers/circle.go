package handlers

import (
	"net/http"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
)

type CreateCircleInput struct {
	CircleName          string   `json:"circle_name" binding:"required"`
	TrackType           string   `json:"track_type" binding:"required"` // SPSB, RANDOM_DRAW
	ContributionAmount  float64  `json:"contribution_amount" binding:"required"`
	MemberLimit         int      `json:"member_limit" binding:"required"`
	PeriodType          string   `json:"period_type" binding:"required"` // WEEKLY, MONTHLY
	BidFloorPercent     *float64 `json:"bid_floor_percent,omitempty"`
	BidCeilingPercent   *float64 `json:"bid_ceiling_percent,omitempty"`
	StartsAt            *string  `json:"starts_at,omitempty"`
	// Frontend legacy aliases
	Name            string  `json:"name"`
	AmountPerPeriod float64 `json:"amount_per_period"`
	MaxMembers      int     `json:"max_members"`
}

// POST /api/v1/circles & POST /api/v1/groups
func CreateCircle(c *gin.Context) {
	var input CreateCircleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input tidak valid: "+err.Error(), nil))
		return
	}

	// Normalisasi alias
	name := input.CircleName
	if name == "" {
		name = input.Name
	}
	amount := input.ContributionAmount
	if amount == 0 {
		amount = input.AmountPerPeriod
	}
	members := input.MemberLimit
	if members == 0 {
		members = input.MaxMembers
	}
	trackType := input.TrackType
	if trackType == "" {
		trackType = "RANDOM_DRAW"
	}
	periodType := input.PeriodType
	if periodType == "" {
		periodType = "MONTHLY"
	}

	responseData := gin.H{
		"circle_id":            "c-uuid-101",
		"id":                   "c-uuid-101", // frontend legacy alias
		"circle_name":          name,
		"name":                 name,
		"track_type":           trackType,
		"contribution_amount":  amount,
		"amount_per_period":    amount,
		"member_limit":         members,
		"max_members":          members,
		"period_type":          periodType,
		"circle_status":        "RECRUITING",
		"status":               "active",
		"created_by_user_id":   "usr-uuid-001",
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Circle arisan berhasil dibuat", responseData))
}

// GET /api/v1/circles
func GetCircles(c *gin.Context) {
	dummyCircles := []gin.H{
		{
			"circle_id":           "c-uuid-101",
			"id":                  "c-uuid-101",
			"circle_name":         "Arisan Keluarga Cemara",
			"name":                "Arisan Keluarga Cemara",
			"track_type":          "RANDOM_DRAW",
			"contribution_amount": 500000,
			"member_limit":        10,
			"period_type":         "MONTHLY",
			"circle_status":       "RECRUITING",
		},
		{
			"circle_id":           "c-uuid-102",
			"id":                  "c-uuid-102",
			"circle_name":         "Arisan Kantor Finansial",
			"track_type":          "SPSB",
			"contribution_amount": 1000000,
			"member_limit":        12,
			"period_type":         "MONTHLY",
			"circle_status":       "RUNNING",
		},
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil daftar circle", dummyCircles))
}

// GET /api/v1/circles/:id & GET /api/v1/groups/:id
func GetCircleDetail(c *gin.Context) {
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

// POST /api/v1/circles/:id/lock
func LockCircle(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Circle berhasil dikunci", gin.H{
		"circle_id":     id,
		"circle_status": "LOCKED",
	}))
}

// POST /api/v1/circles/:id/invitations
func CreateInvitation(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Kode undangan berhasil dibuat", gin.H{
		"circle_id":   id,
		"invite_code": "ARK-JOIN-8821",
		"expires_at":  "2026-10-07T00:00:00Z",
	}))
}

type JoinCircleInput struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

// POST /api/v1/circles/join & POST /api/v1/invitations/join & POST /api/v1/groups/:id/join
func JoinCircle(c *gin.Context) {
	var input JoinCircleInput
	// Optional bind jika dipanggil dari path legacy tanpa body
	_ = c.ShouldBindJSON(&input)

	code := input.InviteCode
	if code == "" {
		code = "ARK-RT05-2026"
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil bergabung ke circle", gin.H{
		"circle_id":             "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"circle_name":           "Arisan Keluarga RT 05",
		"circle_membership_id": "mem-new-099",
		"membership_status":    "ACTIVE",
		"membership_role":      "MEMBER",
		"invite_code":          code,
	}))
}

// GET /api/v1/circles/:id/members
func GetCircleMembers(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil mengambil daftar anggota", []gin.H{
		{"circle_membership_id": "mem-01", "name": "Farrel Abda", "role": "OWNER", "status": "ACTIVE"},
		{"circle_membership_id": "mem-02", "name": "Roy", "role": "MEMBER", "status": "ACTIVE"},
	}))
}

// POST /api/v1/circles/:id/bids (Legacy route)
func SubmitBid(c *gin.Context) {
	SubmitCycleBid(c)
}

// POST /api/v1/circles/:id/spin (Legacy route)
func SpinWheel(c *gin.Context) {
	ExecuteCycleDraw(c)
}

