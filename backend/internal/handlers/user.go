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
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `
		SELECT
			u.user_id, u.full_name, COALESCE(u.email, ''),
			COALESCE(u.phone_number, '') AS phone_number,
			'' AS avatar_url,
			u.created_at,
			COALESCE(COUNT(ca.award_id), 0) AS total_wins,
			COALESCE(SUM(ca.gross_amount), 0.00)::NUMERIC(18,2) AS total_win_amount
		FROM users u
		LEFT JOIN circle_memberships cm ON cm.user_id = u.user_id
		LEFT JOIN cycle_participants cp ON cp.circle_membership_id = cm.circle_membership_id
		LEFT JOIN cycle_awards ca ON ca.cycle_participant_id = cp.cycle_participant_id
		WHERE u.user_id = $1
		GROUP BY u.user_id, u.full_name, u.email, u.phone_number, u.created_at;
	`

	var profile dto.UserProfileResponse
	var createdAtTime time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, userID).Scan(
		&profile.ID, &profile.FullName, &profile.Email, &profile.PhoneNumber,
		&profile.AvatarURL, &createdAtTime, &profile.TotalWins, &profile.TotalWinAmount,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Profil pengguna tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil data profil"})
		return
	}

	profile.CreatedAt = createdAtTime.Format(time.RFC3339)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Profil berhasil didapatkan", "data": profile})
}

// GetWinHistory - GET /api/v1/users/me/win-history
func (h *UserHandler) GetWinHistory(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `
		SELECT
			ca.award_id::text AS winner_id,
			c.circle_id::text AS circle_id,
			c.circle_name AS circle_name,
			ac.cycle_number AS round_number,
			ca.gross_amount AS awarded_amount,
			ca.decided_at AS won_at
		FROM cycle_awards ca
		JOIN cycle_participants cp ON cp.cycle_participant_id = ca.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		JOIN circles c ON c.circle_id = cm.circle_id
		JOIN arisan_cycles ac ON ac.cycle_id = ca.cycle_id
		WHERE cm.user_id = $1
		ORDER BY ca.decided_at DESC;
	`

	rows, err := h.DB.Query(c.Request.Context(), query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil riwayat kemenangan"})
		return
	}
	defer rows.Close()

	winHistories := make([]dto.WinHistoryItem, 0)
	for rows.Next() {
		var item dto.WinHistoryItem
		var wonAtTime time.Time
		if err := rows.Scan(
			&item.WinnerID,
			&item.CircleID,
			&item.CircleName,
			&item.RoundNumber,
			&item.AwardedAmount,
			&wonAtTime,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memproses data riwayat"})
			return
		}
		item.WonAt = wonAtTime.Format(time.RFC3339)
		winHistories = append(winHistories, item)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Riwayat kemenangan berhasil didapatkan", "data": winHistories})
}

// UpdateProfile - PATCH /api/v1/users/me
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data pembaharuan profil tidak valid"})
		return
	}

	query := `
		UPDATE users
		SET
			full_name = COALESCE(NULLIF($1, ''), full_name),
			phone_number = COALESCE(NULLIF($2, ''), phone_number),
			updated_at = NOW()
		WHERE user_id = $3
		RETURNING user_id, full_name, COALESCE(email, ''), COALESCE(phone_number, ''), '' AS avatar_url, created_at;
	`

	var profile dto.UserProfileResponse
	var createdAtTime time.Time

	err := h.DB.QueryRow(c.Request.Context(), query, req.FullName, req.PhoneNumber, userID).Scan(
		&profile.ID, &profile.FullName, &profile.Email, &profile.PhoneNumber, &profile.AvatarURL, &createdAtTime,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui profil pengguna"})
		return
	}

	profile.CreatedAt = createdAtTime.Format(time.RFC3339)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Profil berhasil diperbarui", "data": profile})
}

// GetUserReputation - GET /api/v1/users/me/reputation
func (h *UserHandler) GetUserReputation(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Pengguna tidak terautentikasi"})
		return
	}

	query := `
		SELECT
			COALESCE(COUNT(CASE WHEN co.obligation_status = 'PAID' THEN 1 END), 0) AS total_paid,
			COALESCE(COUNT(CASE WHEN co.obligation_status = 'OVERDUE' THEN 1 END), 0) AS total_late
		FROM cycle_obligations co
		JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		WHERE cm.user_id = $1;
	`

	var totalPaid, totalLate int
	_ = h.DB.QueryRow(c.Request.Context(), query, userID).Scan(&totalPaid, &totalLate)

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
		"message": "Skor reputasi berhasil didapatkan",
		"data": dto.ReputationResponse{
			UserID:          userID,
			ReputationScore: reputationScore,
			Status:          status,
			TotalPaid:       totalPaid,
			TotalLate:       totalLate,
			ReliabilityRate: reliabilityRate,
		},
	})
}
