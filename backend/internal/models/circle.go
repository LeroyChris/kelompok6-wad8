package models

import "time"

// Circle merepresentasikan entitas tabel circles (BAB 5.3)
// Pegangan: Anggota 2 (Circle & Membership)
type Circle struct {
	CircleID         string    `json:"circle_id"`
	LeaderID         string    `json:"leader_id"`
	CircleName       string    `json:"circle_name"`
	InviteCode       string    `json:"invite_code"`
	TrackType        string    `json:"track_type"` // TRACK_A (Lelang SPSB) / TRACK_B (Spin Wheel)
	MonthlyDuesAmount float64  `json:"monthly_dues_amount"`
	MaxMembers       int       `json:"max_members"`
	CircleStatus     string    `json:"circle_status"` // RECRUITING, LOCKED, COMPLETED
	CreatedAt        time.Time `json:"created_at"`
}

// CircleMember merepresentasikan entitas tabel circle_members (BAB 5.3)
type CircleMember struct {
	MemberID      string    `json:"member_id"`
	CircleID      string    `json:"circle_id"`
	UserID        string    `json:"user_id"`
	Role          string    `json:"role"`           // LEADER / MEMBER
	HasWonArisan  bool      `json:"has_won_arisan"` // Default false
	JoinedAt      time.Time `json:"joined_at"`
}
