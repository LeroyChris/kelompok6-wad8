package handlers

import (
	"errors"
	"net/http"

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
	var createdAtTime interface{}

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

	if t, ok := createdAtTime.(interface{ String() string }); ok {
		profile.CreatedAt = t.String()
	}

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
		var wonAtTime interface{}
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
		if t, ok := wonAtTime.(interface{ String() string }); ok {
			item.WonAt = t.String()
		}
		winHistories = append(winHistories, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Riwayat kemenangan berhasil didapatkan",
		"data":    winHistories,
	})
}

// Handler bantuan untuk rute lain di main.go
func UpdateProfile(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Profil berhasil diperbarui"})
}

func GetUserReputation(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": gin.H{"reputation_score": 100}})
}
