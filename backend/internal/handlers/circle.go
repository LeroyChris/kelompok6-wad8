package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"backend-arisankita/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CircleHandler struct{ DB *pgxpool.Pool }

func NewCircleHandler(db *pgxpool.Pool) *CircleHandler { return &CircleHandler{DB: db} }

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

func (h *CircleHandler) CreateCircle(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(401, dto.BuildResponse(401, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	var in CreateCircleInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, dto.BuildResponse(400, "error", "Input circle tidak valid", nil))
		return
	}
	in.CircleName, in.TrackType, in.PeriodType = strings.TrimSpace(in.CircleName), strings.ToUpper(strings.TrimSpace(in.TrackType)), strings.ToUpper(strings.TrimSpace(in.PeriodType))
	if in.PeriodType == "" {
		in.PeriodType = "MONTHLY"
	}
	if (in.TrackType != "SPSB" && in.TrackType != "RANDOM_DRAW") || (in.PeriodType != "MONTHLY" && in.PeriodType != "WEEKLY") {
		c.JSON(400, dto.BuildResponse(400, "error", "track_type atau period_type tidak valid", nil))
		return
	}
	if in.TrackType == "SPSB" && (in.BidFloorPercent == nil || in.BidCeilingPercent == nil || *in.BidFloorPercent < 1 || *in.BidCeilingPercent > 25 || *in.BidFloorPercent > *in.BidCeilingPercent) {
		c.JSON(400, dto.BuildResponse(400, "error", "Circle SPSB membutuhkan bid_floor_percent dan bid_ceiling_percent yang valid", nil))
		return
	}
	if in.TrackType == "RANDOM_DRAW" {
		in.BidFloorPercent, in.BidCeilingPercent = nil, nil
	}
	code, err := circleInviteCode()
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal membuat kode undangan", nil))
		return
	}
	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())
	var id, membershipID string
	err = tx.QueryRow(c.Request.Context(), `INSERT INTO circles (circle_name,created_by_user_id,circle_status,track_type,contribution_amount,member_limit,period_type,bid_floor_percent,bid_ceiling_percent) VALUES ($1,$2,'RECRUITING',$3,$4,$5,$6,$7,$8) RETURNING circle_id::text`, in.CircleName, userID, in.TrackType, in.ContributionAmount, in.MemberLimit, in.PeriodType, in.BidFloorPercent, in.BidCeilingPercent).Scan(&id)
	if err == nil {
		err = tx.QueryRow(c.Request.Context(), `INSERT INTO circle_memberships (circle_id,user_id,membership_role,membership_status,joined_at) VALUES ($1,$2,'OWNER','ACTIVE',CURRENT_TIMESTAMP) RETURNING circle_membership_id::text`, id, userID).Scan(&membershipID)
	}
	if err == nil {
		_, err = tx.Exec(c.Request.Context(), `INSERT INTO circle_invitations (circle_id,invited_by_user_id,invite_code,invite_code_hash,invitation_status,expires_at) VALUES ($1,$2,$3,$4,'ACTIVE',CURRENT_TIMESTAMP + INTERVAL '14 days')`, id, userID, code, inviteHash(code))
	}
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal membuat circle", nil))
		return
	}
	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal menyimpan circle", nil))
		return
	}
	c.JSON(201, dto.BuildResponse(201, "success", "Circle arisan berhasil dibuat", gin.H{"circle_id": id, "circle_name": in.CircleName, "track_type": in.TrackType, "contribution_amount": in.ContributionAmount, "member_limit": in.MemberLimit, "invite_code": code, "circle_membership_id": membershipID}))
}

func (h *CircleHandler) GetCircles(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(401, dto.BuildResponse(401, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	limit := circleLimit(c)
	cursorTime, cursorID, err := decodeWalletCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(400, dto.BuildResponse(400, "error", "cursor tidak valid", nil))
		return
	}
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT c.circle_id::text,c.circle_name,c.track_type,c.contribution_amount::float8,c.member_limit,c.circle_status,cm.membership_role,COUNT(active_cm.circle_membership_id),c.created_at
		FROM circle_memberships cm
		JOIN circles c ON c.circle_id=cm.circle_id
		LEFT JOIN circle_memberships active_cm ON active_cm.circle_id=c.circle_id AND active_cm.membership_status='ACTIVE'
		WHERE cm.user_id=$1 AND cm.membership_status='ACTIVE'
		  AND ($2::timestamptz IS NULL OR (c.created_at,c.circle_id) < ($2::timestamptz,$3::uuid))
		GROUP BY c.circle_id,cm.membership_role
		ORDER BY c.created_at DESC,c.circle_id DESC
		LIMIT $4`, userID, cursorTime, nullableString(cursorID), limit+1)
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal mengambil daftar circle", nil))
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0, limit)
	times := make([]time.Time, 0, limit+1)
	for rows.Next() {
		var id, name, track, status, role string
		var amount float64
		var memberLimit, count int
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &track, &amount, &memberLimit, &status, &role, &count, &createdAt); err != nil {
			c.JSON(500, dto.BuildResponse(500, "error", "Data circle tidak valid", nil))
			return
		}
		items = append(items, gin.H{"circle_id": id, "circle_name": name, "track_type": track, "contribution_amount": amount, "member_limit": memberLimit, "active_member_count": count, "circle_status": status, "membership_role": role})
		times = append(times, createdAt)
	}
	var nextCursor any
	if len(items) > limit {
		cursor := encodeWalletCursor(times[limit-1], items[limit-1]["circle_id"].(string))
		nextCursor = cursor
		items = items[:limit]
	}
	c.JSON(200, dto.BuildResponse(200, "success", "Daftar circle berhasil diambil", gin.H{"items": items, "meta": gin.H{"limit": limit, "next_cursor": nextCursor}}))
}

func (h *CircleHandler) GetCircleDetail(c *gin.Context) {
	var data gin.H
	var id, name, creator, status, track, period string
	var amount float64
	var limit, count int
	var floor, ceiling *float64
	err := h.DB.QueryRow(c.Request.Context(), `SELECT c.circle_id::text,c.circle_name,c.created_by_user_id::text,c.circle_status,c.track_type,c.contribution_amount::float8,c.member_limit,c.period_type,c.bid_floor_percent::float8,c.bid_ceiling_percent::float8,COUNT(cm.circle_membership_id) FILTER (WHERE cm.membership_status='ACTIVE') FROM circles c LEFT JOIN circle_memberships cm ON cm.circle_id=c.circle_id WHERE c.circle_id=$1 GROUP BY c.circle_id`, c.Param("id")).Scan(&id, &name, &creator, &status, &track, &amount, &limit, &period, &floor, &ceiling, &count)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, dto.BuildResponse(404, "error", "Circle tidak ditemukan", nil))
		return
	}
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal mengambil circle", nil))
		return
	}
	data = gin.H{"circle_id": id, "circle_name": name, "created_by_user_id": creator, "circle_status": status, "track_type": track, "contribution_amount": amount, "member_limit": limit, "active_member_count": count, "period_type": period, "bid_floor_percent": floor, "bid_ceiling_percent": ceiling}
	c.JSON(200, dto.BuildResponse(200, "success", "Detail circle berhasil diambil", data))
}

func (h *CircleHandler) JoinCircle(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		c.JSON(401, dto.BuildResponse(401, "error", "Pengguna tidak terautentikasi", nil))
		return
	}
	var in JoinCircleInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, dto.BuildResponse(400, "error", "invite_code wajib diisi", nil))
		return
	}
	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())
	var invitationID, circleID, circleName, status string
	var memberLimit, current int
	err = tx.QueryRow(c.Request.Context(), `SELECT ci.invitation_id::text,ci.circle_id::text,c.circle_name,c.circle_status,c.member_limit,(SELECT COUNT(*) FROM circle_memberships cm WHERE cm.circle_id=c.circle_id AND cm.membership_status='ACTIVE') FROM circle_invitations ci JOIN circles c ON c.circle_id=ci.circle_id WHERE ci.invite_code=$1 AND ci.invite_code_hash=$2 AND ci.invitation_status='ACTIVE' AND ci.expires_at>CURRENT_TIMESTAMP FOR UPDATE OF ci`, strings.TrimSpace(in.InviteCode), inviteHash(strings.TrimSpace(in.InviteCode))).Scan(&invitationID, &circleID, &circleName, &status, &memberLimit, &current)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, dto.BuildResponse(404, "error", "Kode undangan tidak valid atau telah kedaluwarsa", nil))
		return
	}
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal memvalidasi kode undangan", nil))
		return
	}
	if status != "RECRUITING" || current >= memberLimit {
		c.JSON(409, dto.BuildResponse(409, "error", "Circle tidak menerima anggota baru", nil))
		return
	}
	var membershipID string
	err = tx.QueryRow(c.Request.Context(), `INSERT INTO circle_memberships (circle_id,user_id,membership_role,membership_status,joined_at) VALUES ($1,$2,'MEMBER','ACTIVE',CURRENT_TIMESTAMP) RETURNING circle_membership_id::text`, circleID, userID).Scan(&membershipID)
	if err != nil {
		c.JSON(409, dto.BuildResponse(409, "error", "Anda sudah tergabung atau gagal bergabung ke circle", nil))
		return
	}
	_, err = tx.Exec(c.Request.Context(), `UPDATE circle_invitations SET invitation_status='USED',accepted_by_user_id=$1,accepted_at=CURRENT_TIMESTAMP WHERE invitation_id=$2`, userID, invitationID)
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal menyelesaikan undangan", nil))
		return
	}
	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal menyimpan keanggotaan", nil))
		return
	}
	c.JSON(201, dto.BuildResponse(201, "success", "Berhasil bergabung ke circle", gin.H{"circle_id": circleID, "circle_name": circleName, "circle_membership_id": membershipID, "membership_role": "MEMBER", "membership_status": "ACTIVE"}))
}

func (h *CircleHandler) CreateInvitation(c *gin.Context) {
	userID, _ := authenticatedUserID(c)
	var in InvitationInput
	_ = c.ShouldBindJSON(&in)
	if in.ExpiresInDays < 1 || in.ExpiresInDays > 30 {
		in.ExpiresInDays = 14
	}
	code, err := circleInviteCode()
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal membuat kode undangan", nil))
		return
	}
	var invitationID string
	var expiry time.Time
	err = h.DB.QueryRow(c.Request.Context(), `INSERT INTO circle_invitations (circle_id,invited_by_user_id,invite_code,invite_code_hash,invitation_status,expires_at) VALUES ($1,$2,$3,$4,'ACTIVE',CURRENT_TIMESTAMP + ($5 * INTERVAL '1 day')) RETURNING invitation_id::text,expires_at`, c.Param("id"), userID, code, inviteHash(code), in.ExpiresInDays).Scan(&invitationID, &expiry)
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal membuat undangan", nil))
		return
	}
	c.JSON(201, dto.BuildResponse(201, "success", "Kode undangan berhasil dibuat", gin.H{"invitation_id": invitationID, "circle_id": c.Param("id"), "invite_code": code, "expires_at": expiry.Format(time.RFC3339)}))
}

func (h *CircleHandler) GetCircleMembers(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `SELECT cm.circle_membership_id::text,u.user_id::text,u.full_name,cm.membership_role,cm.membership_status,cm.joined_at FROM circle_memberships cm JOIN users u ON u.user_id=cm.user_id WHERE cm.circle_id=$1 ORDER BY cm.joined_at ASC NULLS LAST,cm.circle_membership_id ASC LIMIT $2`, c.Param("id"), circleLimit(c))
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal mengambil anggota", nil))
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var mid, uid, name, role, status string
		var joined *time.Time
		if err := rows.Scan(&mid, &uid, &name, &role, &status, &joined); err != nil {
			c.JSON(500, dto.BuildResponse(500, "error", "Data anggota tidak valid", nil))
			return
		}
		items = append(items, gin.H{"circle_membership_id": mid, "user_id": uid, "full_name": name, "membership_role": role, "membership_status": status, "joined_at": joined})
	}
	c.JSON(200, dto.BuildResponse(200, "success", "Daftar anggota berhasil diambil", gin.H{"items": items, "meta": gin.H{"limit": circleLimit(c), "next_cursor": nil}}))
}

func (h *CircleHandler) LockCircle(c *gin.Context) {
	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal memulai transaksi", nil))
		return
	}
	defer tx.Rollback(c.Request.Context())
	var limit, count int
	var status string
	err = tx.QueryRow(c.Request.Context(), `SELECT member_limit,circle_status FROM circles WHERE circle_id=$1 FOR UPDATE`, c.Param("id")).Scan(&limit, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, dto.BuildResponse(404, "error", "Circle tidak ditemukan", nil))
		return
	}
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal mengunci circle", nil))
		return
	}
	_ = tx.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM circle_memberships WHERE circle_id=$1 AND membership_status='ACTIVE'`, c.Param("id")).Scan(&count)
	if status != "RECRUITING" || count != limit {
		c.JSON(409, dto.BuildResponse(409, "error", "Circle harus RECRUITING dan memenuhi kuota sebelum dikunci", nil))
		return
	}
	_, err = tx.Exec(c.Request.Context(), `UPDATE circles SET circle_status='LOCKED' WHERE circle_id=$1`, c.Param("id"))
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal mengunci circle", nil))
		return
	}
	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal menyimpan status circle", nil))
		return
	}
	c.JSON(200, dto.BuildResponse(200, "success", "Circle berhasil dikunci", gin.H{"circle_id": c.Param("id"), "circle_status": "LOCKED"}))
}

// UpdateMember updates a non-owner member's role or membership status.
func (h *CircleHandler) UpdateMember(c *gin.Context) {
	var in UpdateMemberInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, dto.BuildResponse(400, "error", "Data anggota tidak valid", nil))
		return
	}
	in.Role, in.Status = strings.ToUpper(strings.TrimSpace(in.Role)), strings.ToUpper(strings.TrimSpace(in.Status))
	if in.Role == "" && in.Status == "" {
		c.JSON(400, dto.BuildResponse(400, "error", "Isi role atau status anggota", nil))
		return
	}
	if in.Role != "" && in.Role != "ADMIN" && in.Role != "MEMBER" {
		c.JSON(400, dto.BuildResponse(400, "error", "Role anggota hanya ADMIN atau MEMBER", nil))
		return
	}
	if in.Status != "" && in.Status != "ACTIVE" && in.Status != "SUSPENDED" && in.Status != "REMOVED" {
		c.JSON(400, dto.BuildResponse(400, "error", "Status anggota tidak valid", nil))
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
		c.JSON(404, dto.BuildResponse(404, "error", "Anggota tidak ditemukan atau merupakan owner", nil))
		return
	}
	if err != nil {
		c.JSON(500, dto.BuildResponse(500, "error", "Gagal memperbarui anggota", nil))
		return
	}
	c.JSON(200, dto.BuildResponse(200, "success", "Anggota berhasil diperbarui", gin.H{"user_id": c.Param("userID"), "membership_role": role, "membership_status": status}))
}
