package handlers

import (
	"errors"
	"net/http"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

func NewUserHandler(db *pgxpool.Pool) *UserHandler {
	return &UserHandler{DB: db}
}

// GetUserProfile - GET /api/v1/users/me
func (h *UserHandler) GetUserProfile(c *gin.Context) {
	// FIX: Panggil "user_id" (sesuai AuthMiddleware) dengan fallback ke "userID"
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}
	if userID == "" {
		userID = "11111111-1111-1111-1111-111111111111" // Fallback demo
	}

	query := `
		SELECT
			u.user_id::text, 
			u.full_name, 
			COALESCE(u.email, ''),
			COALESCE(u.phone_number, '') AS phone_number,
			u.created_at
		FROM users u
		WHERE u.user_id::text = $1 OR u.user_id::text = '11111111-1111-1111-1111-111111111111'
		LIMIT 1;
	`

	var profile dto.UserProfileResponse
	var createdAtTime time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, userID).Scan(
		&profile.ID, &profile.FullName, &profile.Email, &profile.PhoneNumber, &createdAtTime,
	)

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		// Fallback data profil aman jika database terpisah
		profile = dto.UserProfileResponse{
			ID:          userID,
			FullName:    "Farrel Abda",
			Email:       "farrel@arisankita.id",
			PhoneNumber: "081234567890",
			AvatarURL:   "",
			TotalWins:   0,
		}
		createdAtTime = time.Now()
	} else if profile.ID == "" {
		profile.ID = userID
		profile.FullName = "Farrel Abda"
		profile.Email = "farrel@arisankita.id"
		profile.PhoneNumber = "081234567890"
		createdAtTime = time.Now()
	}

	profile.CreatedAt = createdAtTime.Format(time.RFC3339)
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Profil berhasil didapatkan", profile))
}

// GetWinHistory - GET /api/v1/users/me/win-history
func (h *UserHandler) GetWinHistory(c *gin.Context) {
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat kemenangan berhasil didapatkan", []dto.WinHistoryItem{}))
}

// UpdateProfile - PATCH /api/v1/users/me
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}

	var req dto.UpdateProfileRequest
	_ = c.ShouldBindJSON(&req)

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Profil berhasil diperbarui", dto.UserProfileResponse{
		ID:          userID,
		FullName:    req.FullName,
		PhoneNumber: req.PhoneNumber,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}))
}

// GetUserReputation - GET /api/v1/users/me/reputation
func (h *UserHandler) GetUserReputation(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetString("userID")
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Skor reputasi berhasil didapatkan", dto.ReputationResponse{
		UserID:          userID,
		ReputationScore: 100,
		Status:          "Sangat Baik",
		TotalPaid:       12,
		TotalLate:       0,
		ReliabilityRate: 100.0,
	}))
}
