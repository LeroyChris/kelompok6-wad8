package models

import "time"

// PaymentOrder merepresentasikan order pembayaran di tabel payment_orders
type PaymentOrder struct {
	PaymentOrderID   string     `json:"payment_order_id"`
	OrderType        string     `json:"order_type"`     // CYCLE_CONTRIBUTION, CAMPAIGN_CONTRIBUTION, LOAN_REPAYMENT
	PaymentMethod    string     `json:"payment_method"` // GATEWAY, MANUAL_TRANSFER, E_WALLET
	Provider         *string    `json:"provider,omitempty"`
	ProviderOrderRef *string    `json:"provider_order_ref,omitempty"`
	Amount           float64    `json:"amount"`
	PaymentStatus    string     `json:"payment_status"` // CREATED, PENDING, PENDING_REVIEW, PAID, FAILED, EXPIRED, REFUNDED, REJECTED
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	PaidAt           *time.Time `json:"paid_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ObligationPaymentOrder merepresentasikan relasi order bayar dengan kewajiban iuran
type ObligationPaymentOrder struct {
	PaymentOrderID string `json:"payment_order_id"`
	ObligationID   string `json:"obligation_id"`
}

// PaymentProof merepresentasikan bukti transfer manual di tabel payment_proofs
type PaymentProof struct {
	PaymentProofID   string     `json:"payment_proof_id"`
	PaymentOrderID   string     `json:"payment_order_id"`
	ProofURL         string     `json:"proof_url"`
	ReviewStatus     string     `json:"review_status"` // PENDING, APPROVED, REJECTED
	ReviewedByUserID *string    `json:"reviewed_by_user_id,omitempty"`
	ReviewNote       *string    `json:"review_note,omitempty"`
	SubmittedAt      time.Time  `json:"submitted_at"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
}

// PaymentEvent merepresentasikan webhook callback log di tabel payment_events
type PaymentEvent struct {
	PaymentEventID   string     `json:"payment_event_id"`
	PaymentOrderID   *string    `json:"payment_order_id,omitempty"`
	Provider         string     `json:"provider"`
	ProviderEventID  string     `json:"provider_event_id"`
	ProviderOrderRef *string    `json:"provider_order_ref,omitempty"`
	EventType        string     `json:"event_type"`
	PayloadHash      string     `json:"payload_hash"`
	ProcessingStatus string     `json:"processing_status"` // RECEIVED, PROCESSED, IGNORED, FAILED
	ReceivedAt       time.Time  `json:"received_at"`
	ProcessedAt      *time.Time `json:"processed_at,omitempty"`
}

// Disbursement merepresentasikan pencairan dana arisan ke pemenang di tabel disbursements
type Disbursement struct {
	DisbursementID          string     `json:"disbursement_id"`
	AwardID                 string     `json:"award_id"`
	BankAccountID           string     `json:"bank_account_id"`
	Provider                *string    `json:"provider,omitempty"`
	ProviderDisbursementRef *string    `json:"provider_disbursement_ref,omitempty"`
	RequestedAmount         float64    `json:"requested_amount"`
	PlatformFeeAmount       float64    `json:"platform_fee_amount"`
	NetAmount               float64    `json:"net_amount"`
	DisbursementStatus      string     `json:"disbursement_status"` // REQUESTED, PROCESSING, PAID, FAILED, REVERSED
	RequestedAt             time.Time  `json:"requested_at"`
	CompletedAt             *time.Time `json:"completed_at,omitempty"`
}
