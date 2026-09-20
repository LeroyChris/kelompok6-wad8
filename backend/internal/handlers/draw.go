package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GET /api/v1/draws/group/:id
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
			{
				"draw_id":       "draw-uuid-902",
				"period_number": 2,
				"winner_name":   "Farrel Abda",
				"total_won":     5000000,
				"draw_date":     "2026-09-01T10:00:00Z",
			},
		},
	})
}
