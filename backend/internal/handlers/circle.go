package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CircleHandler struct {
	DB *pgxpool.Pool
}

func NewCircleHandler(db *pgxpool.Pool) *CircleHandler {
	return &CircleHandler{DB: db}
}

type CreateCircleInput struct {
	CircleName         string   `json:"circle_name" binding:"required"`
	TrackType          string   `json:"track_type" binding:"required"`
	ContributionAmount float64  `json:"contribution_amount" binding:"required,gt=0"`
	MemberLimit        int      `json:"member_limit" binding:"required,gte=2"`
	PeriodType         string   `json:"period_type"`
	BidFloorPercent    *float64 `json:"bid_floor_percent"`
	BidCeilingPercent  *float64 `json:"bid_ceiling_percent"`
}

type JoinCircleInput struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

type InvitationInput struct {
	ExpiresInDays int `json:"expires_in_days"`
}

type UpdateMemberInput struct {
	Role   string `json:"role"`
	Status string `json:"status"`
}
type UpdateCircleInput struct {
	CircleName string `json:"circle_name" binding:"required"`
}

func circleInviteCode() (string, error) {
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "ARK-" + strings.ToUpper(hex.EncodeToString(bytes)), nil
}

func inviteHash(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

func circleLimit(c *gin.Context) int {
	n, e := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if e != nil || n < 1 {
		return 20
	}
	if n > 100 {
		return 100
	}
	return n
}

// CreateCircle membuat circle privat, menetapkan owner, dan membuat undangan
// awal. Cycle baru hanya dibuat setelah owner mengunci circle yang penuh.
func (h *CircleHandler) CreateCircle(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var in CreateCircleInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Input circle tidak valid", nil))
		return
	}

	in.CircleName = strings.TrimSpace(in.CircleName)
	in.TrackType = strings.ToUpper(strings.TrimSpace(in.TrackType))
	in.PeriodType = strings.ToUpper(strings.TrimSpace(in.PeriodType))

	if in.PeriodType == "" {
		in.PeriodType = "MONTHLY"
	}
	if in.TrackType != "SPSB" && in.TrackType != "RANDOM_DRAW" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "track_type harus SPSB atau RANDOM_DRAW", nil))
		return
	}

	if in.TrackType == "SPSB" {
		if in.BidFloorPercent == nil {
			f := 1.0
			in.BidFloorPercent = &f
		}
		if in.BidCeilingPercent == nil {
			cVal := 25.0
			in.BidCeilingPercent = &cVal
		}
	} else {
		in.BidFloorPercent = nil
		in.BidCeilingPercent = nil
	}

	code, err := circleInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat kode undangan", nil))
		return
	}

	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi database", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())

	// 1. Buat Record di Tabel Circles
	var circleID, membershipID string
	err = tx.QueryRow(c.Request.Context(), `
		INSERT INTO circles (circle_name, created_by_user_id, circle_status, track_type, contribution_amount, member_limit, period_type, bid_floor_percent, bid_ceiling_percent)
		VALUES ($1, $2, 'RECRUITING', $3, $4, $5, $6, $7, $8)
		RETURNING circle_id::text`, in.CircleName, userID, in.TrackType, in.ContributionAmount, in.MemberLimit, in.PeriodType, in.BidFloorPercent, in.BidCeilingPercent).Scan(&circleID)

	// 2. Tambahkan Pembuat sebagai OWNER
	if err == nil {
		err = tx.QueryRow(c.Request.Context(), `
			INSERT INTO circle_memberships (circle_id, user_id, membership_role, membership_status, joined_at)
			VALUES ($1, $2, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP)
			RETURNING circle_membership_id::text`, circleID, userID).Scan(&membershipID)
	}

	// 3. Buat Kode Undangan
	if err == nil {
		_, err = tx.Exec(c.Request.Context(), `
			INSERT INTO circle_invitations (circle_id, invited_by_user_id, invite_code, invite_code_hash, invitation_status, expires_at)
			VALUES ($1, $2, $3, $4, 'ACTIVE', CURRENT_TIMESTAMP + INTERVAL '14 days')`, circleID, userID, code, inviteHash(code))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal inisialisasi Circle", nil))
		return
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan Circle baru", nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Circle arisan berhasil dibuat", gin.H{
		"circle_id":            circleID,
		"circle_name":          in.CircleName,
		"track_type":           in.TrackType,
		"contribution_amount":  in.ContributionAmount,
		"member_limit":         in.MemberLimit,
		"invite_code":          code,
		"circle_membership_id": membershipID,
	}))
}

// UpdateCircle permits an owner to rename a recruiting circle. Financial and
// membership parameters are immutable once created to preserve cycle rules.
func (h *CircleHandler) UpdateCircle(c *gin.Context) {
	var in UpdateCircleInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Nama circle wajib diisi", nil))
		return
	}
	name := strings.TrimSpace(in.CircleName)
	if name == "" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Nama circle wajib diisi", nil))
		return
	}
	var status string
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE circles SET circle_name=$1
		WHERE circle_id=$2 AND circle_status IN ('DRAFT','RECRUITING')
		RETURNING circle_status`, name, c.Param("id")).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Circle tidak ditemukan atau tidak dapat diubah setelah dikunci", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui circle", nil))
		return
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Circle berhasil diperbarui", gin.H{"circle_id": c.Param("id"), "circle_name": name, "circle_status": status}))
}

// GetCircles mengambil daftar Circle yang diikuti pengguna
func (h *CircleHandler) GetCircles(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "cursor tidak valid", nil))
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT c.circle_id::text, c.circle_name, c.track_type, c.contribution_amount::float8, c.member_limit, c.circle_status, cm.membership_role, COUNT(active_cm.circle_membership_id), c.created_at
		FROM circle_memberships cm
		JOIN circles c ON c.circle_id = cm.circle_id
		LEFT JOIN circle_memberships active_cm ON active_cm.circle_id = c.circle_id AND active_cm.membership_status = 'ACTIVE'
		WHERE cm.user_id = $1 AND cm.membership_status = 'ACTIVE'
		  AND ($2::timestamptz IS NULL OR (c.created_at, c.circle_id) < ($2::timestamptz, $3::uuid))
		GROUP BY c.circle_id, cm.membership_role
		ORDER BY c.created_at DESC, c.circle_id DESC
		LIMIT $4`, userID, cursorTime, nullableString(cursorID), limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil daftar circle", nil))
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0, limit)
	var nextCursor any
	var lastCreatedAt time.Time
	var lastID string
	for rows.Next() {
		var id, name, track, status, role string
		var amount float64
		var memberLimit, count int
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &track, &amount, &memberLimit, &status, &role, &count, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Data circle tidak valid", nil))
			return
		}
		if len(items) == limit {
			nextCursor = encodeWalletCursor(lastCreatedAt, lastID)
			break
		}
		items = append(items, gin.H{
			"circle_id":           id,
			"circle_name":         name,
			"track_type":          track,
			"contribution_amount": amount,
			"member_limit":        memberLimit,
			"active_member_count": count,
			"circle_status":       status,
			"membership_role":     role,
		})
		lastCreatedAt, lastID = createdAt, id
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Daftar circle berhasil diambil", gin.H{
		"items": items,
		"meta":  gin.H{"limit": limit, "next_cursor": nextCursor},
	}))
}

// GetCircleDetail mengambil informasi detail Circle beserta Invite Code aktifnya
func (h *CircleHandler) GetCircleDetail(c *gin.Context) {
	circleID := c.Param("id")

	var id, name, creator, status, track, period string
	var amount float64
	var limit, count int
	var floor, ceiling *float64

	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT 
			c.circle_id::text, c.circle_name, c.created_by_user_id::text, c.circle_status, 
			c.track_type, c.contribution_amount::float8, c.member_limit, c.period_type, 
			c.bid_floor_percent::float8, c.bid_ceiling_percent::float8, 
			COUNT(cm.circle_membership_id) FILTER (WHERE cm.membership_status = 'ACTIVE') 
		FROM circles c 
		LEFT JOIN circle_memberships cm ON cm.circle_id = c.circle_id 
		WHERE c.circle_id = $1 
		GROUP BY c.circle_id`, circleID).Scan(&id, &name, &creator, &status, &track, &amount, &limit, &period, &floor, &ceiling, &count)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Circle tidak ditemukan", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil detail circle", nil))
		return
	}

	var inviteCode string
	_ = h.DB.QueryRow(c.Request.Context(), `
		SELECT invite_code 
		FROM circle_invitations 
		WHERE circle_id = $1 AND invitation_status = 'ACTIVE' AND expires_at > CURRENT_TIMESTAMP 
		ORDER BY created_at DESC LIMIT 1`, circleID).Scan(&inviteCode)

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Detail circle berhasil diambil", gin.H{
		"circle_id":           id,
		"circle_name":         name,
		"created_by_user_id":  creator,
		"circle_status":       status,
		"track_type":          track,
		"contribution_amount": amount,
		"member_limit":        limit,
		"active_member_count": count,
		"period_type":         period,
		"bid_floor_percent":   floor,
		"bid_ceiling_percent": ceiling,
		"invite_code":         inviteCode,
	}))
}

// JoinCircle memproses pendaftaran anggota menggunakan Kode Undangan
func (h *CircleHandler) JoinCircle(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	var in JoinCircleInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "invite_code wajib diisi", nil))
		return
	}

	code := strings.TrimSpace(in.InviteCode)

	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())

	var invitationID, circleID, circleName, status string
	var memberLimit, current int
	err = tx.QueryRow(c.Request.Context(), `
		SELECT 
			ci.invitation_id::text, ci.circle_id::text, c.circle_name, c.circle_status, c.member_limit, 
			(SELECT COUNT(*) FROM circle_memberships cm WHERE cm.circle_id = c.circle_id AND cm.membership_status = 'ACTIVE') 
		FROM circle_invitations ci 
		JOIN circles c ON c.circle_id = ci.circle_id 
		WHERE ci.invite_code = $1 AND ci.invite_code_hash = $2 AND ci.invitation_status = 'ACTIVE' AND ci.expires_at > CURRENT_TIMESTAMP 
		FOR UPDATE OF ci`, code, inviteHash(code)).Scan(&invitationID, &circleID, &circleName, &status, &memberLimit, &current)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Kode undangan tidak valid atau telah kedaluwarsa", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memvalidasi kode undangan", nil))
		return
	}

	if status != "RECRUITING" || current >= memberLimit {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Circle tidak menerima anggota baru / kuota penuh", nil))
		return
	}

	var membershipID string
	err = tx.QueryRow(c.Request.Context(), `
		INSERT INTO circle_memberships (circle_id, user_id, membership_role, membership_status, joined_at)
		VALUES ($1, $2, 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
		RETURNING circle_membership_id::text`, circleID, userID).Scan(&membershipID)
	if err != nil {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Anda sudah tergabung atau gagal bergabung ke circle ini", nil))
		return
	}

	_, err = tx.Exec(c.Request.Context(), `
		UPDATE circle_invitations 
		SET invitation_status = 'USED', accepted_by_user_id = $1, accepted_at = CURRENT_TIMESTAMP 
		WHERE invitation_id = $2`, userID, invitationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui status undangan", nil))
		return
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan keanggotaan baru", nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Berhasil bergabung ke circle", gin.H{
		"circle_id":            circleID,
		"circle_name":          circleName,
		"circle_membership_id": membershipID,
		"membership_role":      "MEMBER",
		"membership_status":    "ACTIVE",
	}))
}

// LeaveCircle memproses anggota yang ingin keluar dari Circle arisan
func (h *CircleHandler) LeaveCircle(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}

	circleID := c.Param("id")

	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi database", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())

	var role string
	err = tx.QueryRow(c.Request.Context(), `
		SELECT membership_role 
		FROM circle_memberships 
		WHERE circle_id = $1 AND user_id = $2 AND membership_status = 'ACTIVE'
		FOR UPDATE`, circleID, userID).Scan(&role)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Anda tidak terdaftar sebagai anggota aktif di circle ini", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memeriksa status keanggotaan", nil))
		return
	}

	if role == "OWNER" {
		c.JSON(http.StatusForbidden, dto.BuildResponse(http.StatusForbidden, "error", "Pemilik (Owner) tidak dapat keluar dari Circle. Harap alihkan kepemilikan terlebih dahulu", nil))
		return
	}

	_, err = tx.Exec(c.Request.Context(), `
		UPDATE circle_memberships 
		SET membership_status = 'LEFT', left_at = CURRENT_TIMESTAMP 
		WHERE circle_id = $1 AND user_id = $2`, circleID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui status keanggotaan", nil))
		return
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan perubahan", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Berhasil keluar dari circle arisan", gin.H{
		"circle_id": circleID,
		"user_id":   userID,
		"status":    "LEFT",
	}))
}

// GetCircleMembers mengambil daftar anggota terdaftar di Circle
func (h *CircleHandler) GetCircleMembers(c *gin.Context) {
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "cursor tidak valid", nil))
		return
	}
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT 
			cm.circle_membership_id::text,
			u.user_id::text,
			u.full_name,
			COALESCE(u.email, '') AS email,
			cm.membership_role,
			cm.membership_status,
			cm.joined_at, cm.created_at
		FROM circle_memberships cm 
		JOIN users u ON u.user_id = cm.user_id 
		WHERE cm.circle_id = $1
		  AND ($2::timestamptz IS NULL OR (cm.created_at, cm.circle_membership_id) < ($2::timestamptz, $3::uuid))
		ORDER BY cm.created_at DESC, cm.circle_membership_id DESC
		LIMIT $4`, c.Param("id"), cursorTime, nullableString(cursorID), limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil daftar anggota", nil))
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0, limit)
	var nextCursor any
	var lastCreatedAt time.Time
	var lastID string
	for rows.Next() {
		var mid, uid, name, email, role, status string
		var joined *time.Time
		var createdAt time.Time
		if err := rows.Scan(&mid, &uid, &name, &email, &role, &status, &joined, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Data anggota tidak valid", nil))
			return
		}
		if len(items) == limit {
			nextCursor = encodeWalletCursor(lastCreatedAt, lastID)
			break
		}
		items = append(items, gin.H{
			"circle_membership_id": mid,
			"user_id":              uid,
			"full_name":            name,
			"email":                email,
			"membership_role":      role,
			"membership_status":    status,
			"joined_at":            joined,
		})
		lastCreatedAt, lastID = createdAt, mid
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Daftar anggota berhasil diambil", gin.H{
		"items": items,
		"meta":  gin.H{"limit": limit, "next_cursor": nextCursor},
	}))
}

// LockCircle mengunci status Circle
func (h *CircleHandler) LockCircle(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.BuildResponse(http.StatusUnauthorized, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())
	if _, err := tx.Exec(c.Request.Context(), `SELECT set_config('app.actor_user_id', $1, true)`, userID); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menetapkan pelaku audit", nil))
		return
	}

	var limit, count int
	var status string
	err = tx.QueryRow(c.Request.Context(), `SELECT member_limit, circle_status FROM circles WHERE circle_id = $1 FOR UPDATE`, c.Param("id")).Scan(&limit, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Circle tidak ditemukan", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengunci circle", nil))
		return
	}

	_ = tx.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM circle_memberships WHERE circle_id = $1 AND membership_status = 'ACTIVE'`, c.Param("id")).Scan(&count)
	if status != "RECRUITING" || count != limit {
		c.JSON(http.StatusConflict, dto.BuildResponse(http.StatusConflict, "error", "Circle harus RECRUITING dan memenuhi kuota sebelum dikunci", nil))
		return
	}

	_, err = tx.Exec(c.Request.Context(), `UPDATE circles SET circle_status = 'LOCKED' WHERE circle_id = $1`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengunci circle", nil))
		return
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal menyimpan status circle", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Circle berhasil dikunci", gin.H{"circle_id": c.Param("id"), "circle_status": "LOCKED"}))
}

// CreateInvitation membuat kode undangan baru
func (h *CircleHandler) CreateInvitation(c *gin.Context) {
	userID, _ := authenticatedUserID(c)
	var in InvitationInput
	_ = c.ShouldBindJSON(&in)
	if in.ExpiresInDays < 1 || in.ExpiresInDays > 30 {
		in.ExpiresInDays = 14
	}

	code, err := circleInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat kode undangan", nil))
		return
	}

	var invitationID string
	var expiry time.Time
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO circle_invitations (circle_id, invited_by_user_id, invite_code, invite_code_hash, invitation_status, expires_at)
		VALUES ($1, $2, $3, $4, 'ACTIVE', CURRENT_TIMESTAMP + ($5 * INTERVAL '1 day'))
		RETURNING invitation_id::text, expires_at`, c.Param("id"), userID, code, inviteHash(code), in.ExpiresInDays).Scan(&invitationID, &expiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal membuat undangan", nil))
		return
	}

	c.JSON(http.StatusCreated, dto.BuildResponse(http.StatusCreated, "success", "Kode undangan berhasil dibuat", gin.H{
		"invitation_id": invitationID,
		"circle_id":     c.Param("id"),
		"invite_code":   code,
		"expires_at":    expiry.Format(time.RFC3339),
	}))
}

// GetInvitations lists invitations for an owner or admin. The route's RBAC
// middleware verifies the caller before this handler is entered.
func (h *CircleHandler) GetInvitations(c *gin.Context) {
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "cursor tidak valid", nil))
		return
	}
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT invitation_id::text, invite_code, invitation_status, expires_at,
			accepted_by_user_id::text, accepted_at, created_at
		FROM circle_invitations
		WHERE circle_id=$1
		  AND ($2::timestamptz IS NULL OR (created_at, invitation_id) < ($2::timestamptz, $3::uuid))
		ORDER BY created_at DESC, invitation_id DESC
		LIMIT $4`, c.Param("id"), cursorTime, nullableString(cursorID), limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal mengambil undangan", nil))
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0, limit)
	var nextCursor any
	var lastCreatedAt time.Time
	var lastID string
	for rows.Next() {
		var id, code, status string
		var expiresAt, createdAt time.Time
		var acceptedBy *string
		var acceptedAt *time.Time
		if err := rows.Scan(&id, &code, &status, &expiresAt, &acceptedBy, &acceptedAt, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Data undangan tidak valid", nil))
			return
		}
		if len(items) == limit {
			nextCursor = encodeWalletCursor(lastCreatedAt, lastID)
			break
		}
		items = append(items, gin.H{"invitation_id": id, "invite_code": code, "invitation_status": status, "expires_at": expiresAt, "accepted_by_user_id": acceptedBy, "accepted_at": acceptedAt, "created_at": createdAt})
		lastCreatedAt, lastID = createdAt, id
	}
	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Daftar undangan berhasil diambil", gin.H{"items": items, "meta": gin.H{"limit": limit, "next_cursor": nextCursor}}))
}

// UpdateMember memperbarui role atau status anggota
func (h *CircleHandler) UpdateMember(c *gin.Context) {
	var in UpdateMemberInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Data anggota tidak valid", nil))
		return
	}

	in.Role = strings.ToUpper(strings.TrimSpace(in.Role))
	in.Status = strings.ToUpper(strings.TrimSpace(in.Status))

	if in.Role == "" && in.Status == "" {
		c.JSON(http.StatusBadRequest, dto.BuildResponse(http.StatusBadRequest, "error", "Isi role atau status anggota", nil))
		return
	}

	var role, status string
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE circle_memberships
		SET membership_role = COALESCE(NULLIF($1, ''), membership_role),
			membership_status = COALESCE(NULLIF($2, ''), membership_status),
			joined_at = CASE WHEN $2 = 'ACTIVE' THEN COALESCE(joined_at, CURRENT_TIMESTAMP) ELSE joined_at END,
			left_at = CASE WHEN $2 = 'REMOVED' THEN CURRENT_TIMESTAMP ELSE left_at END
		WHERE circle_id = $3 AND user_id = $4 AND membership_role <> 'OWNER'
		RETURNING membership_role, membership_status`, in.Role, in.Status, c.Param("id"), c.Param("userID")).Scan(&role, &status)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, dto.BuildResponse(http.StatusNotFound, "error", "Anggota tidak ditemukan atau merupakan owner", nil))
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.BuildResponse(http.StatusInternalServerError, "error", "Gagal memperbarui anggota", nil))
		return
	}

	c.JSON(http.StatusOK, dto.BuildResponse(http.StatusOK, "success", "Anggota berhasil diperbarui", gin.H{"user_id": c.Param("userID"), "membership_role": role, "membership_status": status}))
}
