package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type CreateGroupInput struct {
	Name            string  `json:"name" binding:"required"`
	Description     string  `json:"description"`
	AmountPerPeriod float64 `json:"amount_per_period" binding:"required"`
	PeriodType      string  `json:"period_type" binding:"required"` // 'weekly' / 'monthly'
	MaxMembers      int     `json:"max_members" binding:"required"`
	StartDate       string  `json:"start_date" binding:"required"`
}

// POST /api/v1/groups
func CreateGroup(c *gin.Context) {
	var input CreateGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Kelompok arisan berhasil dibuat",
		"data": gin.H{
			"id":                "grp-uuid-101",
			"name":              input.Name,
			"description":       input.Description,
			"amount_per_period": input.AmountPerPeriod,
			"period_type":       input.PeriodType,
			"max_members":       input.MaxMembers,
			"start_date":        input.StartDate,
			"status":            "active",
			"created_by":        "usr-uuid-001",
		},
	})
}

// GET /api/v1/groups/:id
func GetGroupDetail(c *gin.Context) {
	groupID := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"id":                groupID,
			"name":              "Arisan Keluarga RT 05",
			"description":       "Kocokan tiap bulan tanggal 1",
			"amount_per_period": 500000,
			"period_type":       "monthly",
			"max_members":       10,
			"status":            "active",
			"members": []gin.H{
				{"member_id": "mem-01", "name": "Farrel Abda", "is_admin": true, "has_won": false},
				{"member_id": "mem-02", "name": "Roy", "is_admin": false, "has_won": true},
				{"member_id": "mem-03", "name": "Faza", "is_admin": false, "has_won": false},
			},
		},
	})
}

// POST /api/v1/groups/:id/join
func JoinGroup(c *gin.Context) {
	groupID := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Berhasil bergabung dengan kelompok arisan",
		"data": gin.H{
			"group_id":  groupID,
			"member_id": "mem-04",
			"joined_at": "2026-09-20T19:20:00Z",
		},
	})
}
