package handlers

import (
	"errors"
	"net/http"
	"time"

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

type UserProfileResponse struct {
	ID             string  `json:"id"`
	FullName       string  `json:"full_name"`
	Email          string  `json:"email"`
	PhoneNumber    string  `json:"phone_number"`
	AvatarURL      string  `json:"avatar_url"`
	TotalWins      int     `json:"total_wins"`
	TotalWinAmount float64 `json:"total_win_amount"`
	CreatedAt      string  `json:"created_at"`
}

type WinHistoryItem struct {
	WinnerID      string  `json:"winner_id"`
	CircleID      string  `json:"circle_id"`
	CircleName    string  `json:"circle_name"`
	RoundNumber   int     `json:"round_number"`
	AwardedAmount float64 `json:"awarded_amount"`
	WonAt         string  `json:"won_at"`
}

type UpdateProfileRequest struct {
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	AvatarURL   string `json:"avatar_url"`
}

type ReputationResponse struct {
	UserID          string  `json:"user_id"`
	ReputationScore int     `json:"reputation_score"`
	Status          string  `json:"status"`
	TotalPaid       int     `json:"total_paid_obligations"`
	TotalLate       int     `json:"total_late_obligations"`
	ReliabilityRate float64 `json:"reliability_rate_percentage"`
}

// GetUserProfile - GET /api/v1/users/me
func (h *UserHandler) GetUserProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Pengguna tidak terautentikasi",
		})
		return
	}

	query := `
		SELECT 
			u.id, 
			u.full_name, 
			u.email, 
			COALESCE(u.phone_number, '') AS phone_number, 
			COALESCE(u.avatar_url, '') AS avatar_url, 
			u.created_at,
			COALESCE(COUNT(w.id), 0) AS total_wins,
			COALESCE(SUM(w.awarded_amount), 0) AS total_win_amount
		FROM users u
		LEFT JOIN winner_histories w ON u.id = w.user_id
		WHERE u.id = $1
		GROUP BY u.id;
	`

	var profile UserProfileResponse
	var createdAtTime time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, userID).Scan(
		&profile.ID,
		&profile.FullName,
		&profile.Email,
		&profile.PhoneNumber,
		&profile.AvatarURL,
		&createdAtTime,
		&profile.TotalWins,
		&profile.TotalWinAmount,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Data profil pengguna tidak ditemukan",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data profil",
		})
		return
	}

	profile.CreatedAt = createdAtTime.Format(time.RFC3339)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Profil pengguna berhasil didapatkan",
		"data":    profile,
	})
}

// GetWinHistory - GET /api/v1/users/me/win-history
func (h *UserHandler) GetWinHistory(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Pengguna tidak terautentikasi",
		})
		return
	}

	query := `
		SELECT 
			w.id AS winner_id,
			c.id AS circle_id,
			c.name AS circle_name,
			w.round_number,
			w.awarded_amount,
			w.won_at
		FROM winner_histories w
		JOIN arisan_circles c ON w.circle_id = c.id
		WHERE w.user_id = $1
		ORDER BY w.won_at DESC;
	`

	rows, err := h.DB.Query(c.Request.Context(), query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil riwayat kemenangan",
		})
		return
	}
	defer rows.Close()

	winHistories := make([]WinHistoryItem, 0)
	for rows.Next() {
		var item WinHistoryItem
		var wonAtTime time.Time
		if err := rows.Scan(
			&item.WinnerID,
			&item.CircleID,
			&item.CircleName,
			&item.RoundNumber,
			&item.AwardedAmount,
			&wonAtTime,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Gagal memproses data riwayat kemenangan",
			})
			return
		}
		item.WonAt = wonAtTime.Format(time.RFC3339)
		winHistories = append(winHistories, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Riwayat kemenangan berhasil didapatkan",
		"data":    winHistories,
	})
}

// UpdateProfile - PATCH /api/v1/users/me
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Pengguna tidak terautentikasi",
		})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Format data pembaharuan profil tidak valid",
		})
		return
	}

	query := `
		UPDATE users
		SET 
			full_name = COALESCE(NULLIF($1, ''), full_name),
			phone_number = COALESCE(NULLIF($2, ''), phone_number),
			avatar_url = COALESCE(NULLIF($3, ''), avatar_url),
			updated_at = NOW()
		WHERE id = $4
		RETURNING id, full_name, email, COALESCE(phone_number, ''), COALESCE(avatar_url, ''), created_at;
	`

	var profile UserProfileResponse
	var createdAtTime time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, req.FullName, req.PhoneNumber, req.AvatarURL, userID).Scan(
		&profile.ID,
		&profile.FullName,
		&profile.Email,
		&profile.PhoneNumber,
		&profile.AvatarURL,
		&createdAtTime,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal memperbarui profil pengguna",
		})
		return
	}

	profile.CreatedAt = createdAtTime.Format(time.RFC3339)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Profil pengguna berhasil diperbarui",
		"data":    profile,
	})
}

// GetUserReputation - GET /api/v1/users/me/reputation
func (h *UserHandler) GetUserReputation(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Pengguna tidak terautentikasi",
		})
		return
	}

	query := `
		SELECT 
			COALESCE(COUNT(CASE WHEN status = 'PAID' THEN 1 END), 0) AS total_paid,
			COALESCE(COUNT(CASE WHEN status = 'LATE' OR status = 'OVERDUE' THEN 1 END), 0) AS total_late
		FROM cycle_obligations
		WHERE user_id = $1;
	`

	var totalPaid, totalLate int
	err := h.DB.QueryRow(c.Request.Context(), query, userID).Scan(&totalPaid, &totalLate)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal menghitung skor reputasi",
		})
		return
	}

	totalObligations := totalPaid + totalLate
	reputationScore := 100
	reliabilityRate := 100.0

	if totalObligations > 0 {
		reliabilityRate = (float64(totalPaid) / float64(totalObligations)) * 100.0
		reputationScore = 100 - (totalLate * 10)
		if reputationScore < 0 {
			reputationScore = 0
		}
	}

	status := "Sangat Baik"
	if reputationScore < 60 {
		status = "Berrisiko"
	} else if reputationScore < 85 {
		status = "Cukup"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Skor reputasi pengguna berhasil didapatkan",
		"data": ReputationResponse{
			UserID:          userID,
			ReputationScore: reputationScore,
			Status:          status,
			TotalPaid:       totalPaid,
			TotalLate:       totalLate,
			ReliabilityRate: reliabilityRate,
		},
	})
}
