package models

import "time"

// CycleParticipants memetakan baris pada tabel cycle_participants
type CycleParticipant struct {
	ID        string    `json:"id" db:"id"`
	CycleID   string    `json:"cycle_id" db:"cycle_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Status    string    `json:"status" db:"status"` // ELIGIBLE, WON, INELIGIBLE
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Bid memetakan baris pada tabel bids (Track A Lelang SPSB)
type Bid struct {
	ID             string    `json:"id" db:"id"`
	CycleID        string    `json:"cycle_id" db:"cycle_id"`
	UserID         string    `json:"user_id" db:"user_id"`
	BidRatePercent float64   `json:"bid_rate_percent" db:"bid_rate_percent"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// CycleAward memetakan baris pada tabel cycle_awards
type CycleAward struct {
	ID           string    `json:"id" db:"id"`
	CycleID      string    `json:"cycle_id" db:"cycle_id"`
	WinnerUserID string    `json:"winner_user_id" db:"winner_user_id"`
	AwardMethod  string    `json:"award_method" db:"award_method"` // RANDOM_DRAW atau SPSB_AUCTION
	GrossAmount  float64   `json:"gross_amount" db:"gross_amount"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
