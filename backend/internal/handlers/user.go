package handlers

import (
	"errors"
	"net/http"
	"strings"
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

func authenticatedUserID(c *gin.Context) (string, bool) {
	userID := c.GetString("user_id")
	return userID, userID != ""
}

// GetUserProfile returns the authenticated user's own profile and win summary.
func (h *UserHandler) GetUserProfile(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	query := `
		SELECT
			u.user_id::text,
			u.full_name,
			COALESCE(u.email, ''),
			COUNT(ca.award_id),
			COALESCE(SUM(ca.net_award_amount), 0)::float8,
			u.created_at
		FROM users u
		LEFT JOIN circle_memberships cm ON cm.user_id = u.user_id
		LEFT JOIN cycle_participants cp ON cp.circle_membership_id = cm.circle_membership_id
		LEFT JOIN cycle_awards ca ON ca.cycle_participant_id = cp.cycle_participant_id
		WHERE u.user_id = $1
		GROUP BY u.user_id, u.full_name, u.email, u.created_at`

	var profile dto.UserProfileResponse
	var createdAt time.Time
	err := h.DB.QueryRow(c.Request.Context(), query, userID).Scan(
		&profile.ID,
		&profile.FullName,
		&profile.Email,
		&profile.TotalWins,
		&profile.TotalWinAmount,
		&createdAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil profil", nil))
		return
	}

	profile.CreatedAt = createdAt.Format(time.RFC3339)
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Profil berhasil didapatkan", profile))
}

// GetWinHistory returns awards owned by the authenticated user.
func (h *UserHandler) GetWinHistory(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT
			ca.award_id::text,
			c.circle_id::text,
			c.circle_name,
			ac.cycle_number,
			ca.award_method,
			ca.net_award_amount::float8,
			ca.winning_bid_rate_percent::float8,
			ca.payable_bid_rate_percent::float8,
			ca.decided_at
		FROM cycle_awards ca
		JOIN cycle_participants cp ON cp.cycle_participant_id = ca.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		JOIN arisan_cycles ac ON ac.cycle_id = ca.cycle_id
		JOIN circles c ON c.circle_id = ac.circle_id
		WHERE cm.user_id = $1
		ORDER BY ca.decided_at DESC, ca.award_id DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil riwayat kemenangan", nil))
		return
	}
	defer rows.Close()

	history := make([]dto.WinHistoryItem, 0)
	for rows.Next() {
		var item dto.WinHistoryItem
		var wonAt time.Time
		if err := rows.Scan(
			&item.AwardID,
			&item.CircleID,
			&item.CircleName,
			&item.RoundNumber,
			&item.AwardMethod,
			&item.AwardedAmount,
			&item.WinningBidRatePercent,
			&item.PayableBidRatePercent,
			&wonAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Data riwayat kemenangan tidak valid", nil))
			return
		}
		item.WonAt = wonAt.Format(time.RFC3339)
		history = append(history, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membaca riwayat kemenangan", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Riwayat kemenangan berhasil didapatkan", history))
}

// UpdateProfile updates mutable profile fields.
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data profil tidak valid", nil))
		return
	}
	if strings.TrimSpace(req.FullName) == "" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "full_name wajib diisi", nil))
		return
	}

	query := `
		UPDATE users
		SET full_name = $1
		WHERE user_id = $2
		RETURNING user_id::text, full_name, COALESCE(email, ''), created_at`

	var profile dto.UserProfileResponse
	var createdAt time.Time
	err := h.DB.QueryRow(c.Request.Context(), query, strings.TrimSpace(req.FullName), userID).Scan(
		&profile.ID, &profile.FullName, &profile.Email, &createdAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Email sudah digunakan atau profil gagal diperbarui", nil))
		return
	}
	profile.CreatedAt = createdAt.Format(time.RFC3339)
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Profil berhasil diperbarui", profile))
}

func (h *UserHandler) GetUserReputation(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var response dto.ReputationResponse
	err := h.DB.QueryRow(c.Request.Context(), `
		WITH my_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE co.obligation_status = 'PAID') AS total_paid,
				COUNT(*) FILTER (WHERE co.obligation_status = 'OVERDUE') AS total_late
			FROM circle_memberships cm
			JOIN cycle_participants cp ON cp.circle_membership_id = cm.circle_membership_id
			JOIN cycle_obligations co ON co.cycle_participant_id = cp.cycle_participant_id
			WHERE cm.user_id = $1
		)
		SELECT
			$1::text,
			100 + (total_paid - total_late) AS reputation_score,
			total_paid,
			total_late,
			COALESCE(
				ROUND(
					100.0 * total_paid / NULLIF(total_paid + total_late, 0),
					2
				),
				100.0
			)::float8 AS reliability_rate
		FROM my_stats`, userID).Scan(
		&response.UserID,
		&response.ReputationScore,
		&response.TotalPaid,
		&response.TotalLate,
		&response.ReliabilityRate,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "User tidak ditemukan", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil reputasi", nil))
		return
	}

	switch {
	case response.ReliabilityRate >= 95:
		response.Status = "Sangat Baik"
	case response.ReliabilityRate >= 75:
		response.Status = "Baik"
	default:
		response.Status = "Perlu Perhatian"
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Skor reputasi berhasil didapatkan", response))
}
