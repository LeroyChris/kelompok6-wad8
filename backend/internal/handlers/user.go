package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type UpdateProfileInput struct {
	Name        string `json:"name"`
	PhoneNumber string `json:"phone_number"`
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// GET /api/v1/users/profile
func GetProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"id":           userID,
			"name":         "Farrel Abda",
			"email":        "farrel@example.com",
			"phone_number": "081234567890",
		},
	})
}

// PUT /api/v1/users/profile
func UpdateProfile(c *gin.Context) {
	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Profil dan password berhasil diperbarui",
		"data": gin.H{
			"name":         input.Name,
			"phone_number": input.PhoneNumber,
		},
	})
}
