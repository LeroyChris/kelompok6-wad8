package models

import "time"

// Circle merepresentasikan entitas tabel circles (001_core_schema.sql & 003_extended_schema.sql)
type Circle struct {
	CircleID                             string     `json:"circle_id"`
	CircleName                           string     `json:"circle_name"`
	CreatedByUserID                      string     `json:"created_by_user_id"`
	CircleStatus                         string     `json:"circle_status"` // DRAFT, RECRUITING, LOCKED, RUNNING, COMPLETED, CANCELLED, SUSPENDED, ARCHIVED
	TrackType                            string     `json:"track_type"`   // SPSB, RANDOM_DRAW
	ContributionAmount                   float64    `json:"contribution_amount"`
	MemberLimit                          int        `json:"member_limit"`
	PeriodType                           string     `json:"period_type"` // WEEKLY, MONTHLY
	BidFloorPercent                      *float64   `json:"bid_floor_percent,omitempty"`
	BidCeilingPercent                    *float64   `json:"bid_ceiling_percent,omitempty"`
	PartialDisbursementThresholdPercent float64    `json:"partial_disbursement_threshold_percent"`
	KycThresholdAmount                   float64    `json:"kyc_threshold_amount"`
	StartsAt                             *time.Time `json:"starts_at,omitempty"`
	CreatedAt                            time.Time  `json:"created_at"`
	UpdatedAt                            time.Time  `json:"updated_at"`
}

// CircleMembership merepresentasikan entitas tabel circle_memberships
type CircleMembership struct {
	CircleMembershipID string     `json:"circle_membership_id"`
	CircleID           string     `json:"circle_id"`
	UserID             string     `json:"user_id"`
	MembershipRole     string     `json:"membership_role"`   // OWNER, ADMIN, MEMBER
	MembershipStatus   string     `json:"membership_status"` // PENDING, ACTIVE, REJECTED, SUSPENDED, LEFT, REMOVED
	JoinedAt           *time.Time `json:"joined_at,omitempty"`
	LeftAt             *time.Time `json:"left_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

// CircleInvitation merepresentasikan entitas tabel circle_invitations
type CircleInvitation struct {
	InvitationID       string     `json:"invitation_id"`
	CircleID           string     `json:"circle_id"`
	InvitedByUserID    string     `json:"invited_by_user_id"`
	InviteCodeHash     string     `json:"invite_code_hash"`
	InvitationStatus   string     `json:"invitation_status"` // ACTIVE, USED, EXPIRED, REVOKED
	ExpiresAt          time.Time  `json:"expires_at"`
	AcceptedByUserID   *string    `json:"accepted_by_user_id,omitempty"`
	AcceptedAt         *time.Time `json:"accepted_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}
