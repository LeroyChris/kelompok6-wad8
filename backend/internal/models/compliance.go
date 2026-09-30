package models

import "time"

// KYCVerification merepresentasikan verifikasi identitas di tabel kyc_verifications
type KYCVerification struct {
	VerificationID     string     `json:"verification_id"`
	UserID             string     `json:"user_id"`
	VerificationLevel  string     `json:"verification_level"`  // BASIC, ADVANCED
	VerificationStatus string     `json:"verification_status"` // PENDING, IN_REVIEW, VERIFIED, REJECTED, EXPIRED
	Provider           *string    `json:"provider,omitempty"`
	ProviderReference  *string    `json:"provider_reference,omitempty"`
	DocumentStorageRef *string    `json:"document_storage_ref,omitempty"`
	NameMatchStatus    *string    `json:"name_match_status,omitempty"` // PENDING, MATCHED, MISMATCHED
	RejectionReason    *string    `json:"rejection_reason,omitempty"`
	SubmittedAt        time.Time  `json:"submitted_at"`
	VerifiedAt         *time.Time `json:"verified_at,omitempty"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
}

// CircleKYCReview merepresentasikan status kepatuhan KYC circle di tabel circle_kyc_reviews
type CircleKYCReview struct {
	CircleKYCReviewID string     `json:"circle_kyc_review_id"`
	CircleID          string     `json:"circle_id"`
	RequiredLevel     string     `json:"required_level"` // BASIC, ADVANCED
	TriggeredAmount   float64    `json:"triggered_amount"`
	ReviewStatus      string     `json:"review_status"` // REQUIRED, IN_PROGRESS, COMPLETED, WAIVED
	TriggeredAt       time.Time  `json:"triggered_at"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
}

// RiskBlockEntry merepresentasikan blacklist nomor/rekening di tabel risk_block_entries
type RiskBlockEntry struct {
	RiskBlockID     string     `json:"risk_block_id"`
	UserID          *string    `json:"user_id,omitempty"`
	BlockType       string     `json:"block_type"` // USER, PHONE, BANK_ACCOUNT
	ValueHash       string     `json:"value_hash"`
	Reason          string     `json:"reason"`
	BlockStatus     string     `json:"block_status"` // ACTIVE, REVOKED, EXPIRED
	CreatedByUserID *string    `json:"created_by_user_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
}

// ReputationEvent merepresentasikan ledger skor reputasi di tabel reputation_events
type ReputationEvent struct {
	ReputationEventID string    `json:"reputation_event_id"`
	UserID            string    `json:"user_id"`
	ScoreDelta        int       `json:"score_delta"`
	EventType         string    `json:"event_type"`
	Reason            string    `json:"reason"`
	ReferenceType     *string   `json:"reference_type,omitempty"`
	ReferenceID       *string   `json:"reference_id,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

// ObligationReliefRequest merepresentasikan permohonan keringanan tagihan di tabel obligation_relief_requests
type ObligationReliefRequest struct {
	ReliefRequestID   string     `json:"relief_request_id"`
	ObligationID      string     `json:"obligation_id"`
	RequestedByUserID string     `json:"requested_by_user_id"`
	ReliefType        string     `json:"relief_type"` // REDUCE_AMOUNT, EXTEND_DUE_DATE, WAIVE
	RequestedAmountDue *float64  `json:"requested_amount_due,omitempty"`
	RequestedDueAt    *time.Time `json:"requested_due_at,omitempty"`
	Reason            string     `json:"reason"`
	RequestStatus     string     `json:"request_status"` // PENDING, APPROVED, REJECTED, CANCELLED
	ReviewedByUserID  *string    `json:"reviewed_by_user_id,omitempty"`
	ReviewNote        *string    `json:"review_note,omitempty"`
	ReviewedAt        *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

// NotificationOutbox merepresentasikan antrean notifikasi di tabel notification_outbox
type NotificationOutbox struct {
	NotificationID     string     `json:"notification_id"`
	UserID             string     `json:"user_id"`
	CircleID           *string    `json:"circle_id,omitempty"`
	Channel            string     `json:"channel"`      // WHATSAPP, EMAIL, IN_APP
	TemplateKey        string     `json:"template_key"`
	Payload            string     `json:"payload"`      // JSON string
	NotificationStatus string     `json:"notification_status"` // PENDING, PROCESSING, SENT, FAILED, CANCELLED
	AttemptCount       int        `json:"attempt_count"`
	ScheduledAt        time.Time  `json:"scheduled_at"`
	SentAt             *time.Time `json:"sent_at,omitempty"`
	ProviderMessageRef *string    `json:"provider_message_ref,omitempty"`
	LastError          *string    `json:"last_error,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

// AuditEvent merepresentasikan rantai hash audit di tabel audit_events
type AuditEvent struct {
	AuditEventID      string    `json:"audit_event_id"`
	ActorUserID       *string   `json:"actor_user_id,omitempty"`
	EventType         string    `json:"event_type"`
	EntityType        string    `json:"entity_type"`
	EntityID          string    `json:"entity_id"`
	PayloadHash       string    `json:"payload_hash"`
	PreviousEventHash *string   `json:"previous_event_hash,omitempty"`
	EventHash         string    `json:"event_hash"`
	CreatedAt         time.Time `json:"created_at"`
}
