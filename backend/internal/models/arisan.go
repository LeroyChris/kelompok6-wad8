package models

import "time"

// ArisanCycle merepresentasikan entitas tabel arisan_cycles
type ArisanCycle struct {
	CycleID        string     `json:"cycle_id"`
	CircleID       string     `json:"circle_id"`
	CycleNumber    int        `json:"cycle_number"`
	CycleStatus    string     `json:"cycle_status"` // PENDING, BIDDING_OPEN, BIDDING_CLOSED, PAYMENT_COLLECTION, READY_FOR_DISBURSEMENT, PARTIALLY_DISBURSED, DISBURSED, COMPLETED, CANCELLED
	BiddingOpenAt  *time.Time `json:"bidding_open_at,omitempty"`
	BiddingCloseAt *time.Time `json:"bidding_close_at,omitempty"`
	DueAt          time.Time  `json:"due_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

// CycleParticipant merepresentasikan snapshot peserta di tabel cycle_participants
type CycleParticipant struct {
	CycleParticipantID string    `json:"cycle_participant_id"`
	CycleID            string    `json:"cycle_id"`
	CircleMembershipID string    `json:"circle_membership_id"`
	ParticipationStatus string   `json:"participation_status"` // ELIGIBLE, EXCLUDED, REPLACED
	CreatedAt          time.Time `json:"created_at"`
}

// CycleParticipantSubstitution merepresentasikan tabel cycle_participant_substitutions
type CycleParticipantSubstitution struct {
	SubstitutionID                string    `json:"substitution_id"`
	CycleID                       string    `json:"cycle_id"`
	OriginalCycleParticipantID    string    `json:"original_cycle_participant_id"`
	ReplacementCycleParticipantID string    `json:"replacement_cycle_participant_id"`
	ApprovedByUserID              string    `json:"approved_by_user_id"`
	Reason                        string    `json:"reason"`
	CreatedAt                     time.Time `json:"created_at"`
}

// CycleObligation merepresentasikan tagihan iuran di tabel cycle_obligations
type CycleObligation struct {
	ObligationID       string    `json:"obligation_id"`
	CycleParticipantID string    `json:"cycle_participant_id"`
	AmountDue          float64   `json:"amount_due"`
	DueAt              time.Time `json:"due_at"`
	ObligationStatus   string    `json:"obligation_status"` // UNPAID, PARTIAL, PAID, OVERDUE, WAIVED, CANCELLED
	CreatedAt          time.Time `json:"created_at"`
}

// Bid merepresentasikan penawaran lelang rahasia di tabel bids
type Bid struct {
	BidID              string    `json:"bid_id"`
	CycleParticipantID string    `json:"cycle_participant_id"`
	BidRatePercent     float64   `json:"bid_rate_percent"`
	BidStatus          string    `json:"bid_status"` // ACTIVE, WITHDRAWN, INVALID
	SubmittedAt        time.Time `json:"submitted_at"`
}

// CycleAward merepresentasikan penetapan pemenang siklus di tabel cycle_awards
type CycleAward struct {
	AwardID               string    `json:"award_id"`
	CycleID               string    `json:"cycle_id"`
	CycleParticipantID    string    `json:"cycle_participant_id"`
	AwardMethod           string    `json:"award_method"` // SPSB, RANDOM_DRAW
	GrossAmount           float64   `json:"gross_amount"`
	WinningBidRatePercent *float64  `json:"winning_bid_rate_percent,omitempty"`
	PayableBidRatePercent *float64  `json:"payable_bid_rate_percent,omitempty"`
	DecisionHash          *string   `json:"decision_hash,omitempty"`
	DecidedAt             time.Time `json:"decided_at"`
}

// DrawResult merepresentasikan seed acak pengundian di tabel draw_results
type DrawResult struct {
	DrawResultID         string    `json:"draw_result_id"`
	AwardID              string    `json:"award_id"`
	RandomSeedCommitment string    `json:"random_seed_commitment"`
	RandomSource         string    `json:"random_source"`
	ParticipantCount     int       `json:"participant_count"`
	DrawnAt              time.Time `json:"drawn_at"`
}
