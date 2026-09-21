package models

import "time"

// ArisanCycle merepresentasikan entitas tabel arisan_cycles (BAB 5.3)
// Pegangan: Anggota 3 (Core Engine Arisan & Transaksi)
type ArisanCycle struct {
	CycleID             string    `json:"cycle_id"`
	CircleID            string    `json:"circle_id"`
	CycleNumber         int       `json:"cycle_number"`
	DueDate             time.Time `json:"due_date"`
	WinnerUserID        *string   `json:"winner_user_id,omitempty"`
	WinningBidAmount    *float64  `json:"winning_bid_amount,omitempty"`
	ActualPayableAmount *float64  `json:"actual_payable_amount,omitempty"`
	CycleStatus         string    `json:"cycle_status"` // PENDING, BIDDING_OPEN, BIDDING_CLOSED, PAYMENT_COLLECTION, DISBURSED, COMPLETED
}

// Bid merepresentasikan entitas tabel bids (Lelang SPSB)
type Bid struct {
	BidID       string    `json:"bid_id"`
	CycleID     string    `json:"cycle_id"`
	UserID      string    `json:"user_id"`
	BidAmount   float64   `json:"bid_amount"`
	SubmittedAt time.Time `json:"submitted_at"`
}

// CrowdfundingCampaign merepresentasikan entitas tabel crowdfunding_campaigns
type CrowdfundingCampaign struct {
	CampaignID      string    `json:"campaign_id"`
	CircleID        string    `json:"circle_id"`
	CreatorID       string    `json:"creator_id"`
	Title           string    `json:"title"`
	TargetAmount    float64   `json:"target_amount"`
	CollectedAmount float64   `json:"collected_amount"`
	Status          string    `json:"status"` // OPEN, FUNDED, CLOSED
	CreatedAt       time.Time `json:"created_at"`
}

// Transaction merepresentasikan entitas tabel transactions
type Transaction struct {
	TransactionID     string    `json:"transaction_id"`
	UserID            string    `json:"user_id"`
	CircleID          string    `json:"circle_id"`
	TransactionType   string    `json:"transaction_type"` // DUES_PAYMENT, DISBURSEMENT, CROWDFUNDING_CONTRIBUTION
	Amount            float64   `json:"amount"`
	PaymentGatewayRef string    `json:"payment_gateway_ref"`
	Status            string    `json:"status"` // PENDING, SUCCESS, FAILED
	AuditHash         string    `json:"audit_hash"`
	CreatedAt         time.Time `json:"created_at"`
}
