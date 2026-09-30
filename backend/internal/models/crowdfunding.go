package models

import "time"

// CrowdfundingCampaign merepresentasikan kampanye patungan internal di tabel crowdfunding_campaigns
type CrowdfundingCampaign struct {
	CampaignID     string     `json:"campaign_id"`
	CircleID       string     `json:"circle_id"`
	CreatorUserID  string     `json:"creator_user_id"`
	RelatedAwardID *string    `json:"related_award_id,omitempty"`
	CampaignType   string     `json:"campaign_type"` // INTERNAL_LOAN, DONATION, SPONSORSHIP
	Title          string     `json:"title"`
	Description    *string    `json:"description,omitempty"`
	TargetAmount   float64    `json:"target_amount"`
	CampaignStatus string     `json:"campaign_status"` // DRAFT, OPEN, TARGET_REACHED, CLOSED, CANCELLED, COMPLETED
	StartsAt       *time.Time `json:"starts_at,omitempty"`
	EndsAt         *time.Time `json:"ends_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CampaignContribution merepresentasikan partisipasi patungan di tabel campaign_contributions
type CampaignContribution struct {
	ContributionID     string     `json:"contribution_id"`
	CampaignID         string     `json:"campaign_id"`
	ContributorUserID  string     `json:"contributor_user_id"`
	Amount             float64    `json:"amount"`
	ContributionStatus string     `json:"contribution_status"` // PENDING, PAID, FAILED, REFUNDED, CANCELLED
	CreatedAt          time.Time  `json:"created_at"`
	PaidAt             *time.Time `json:"paid_at,omitempty"`
}

// LoanAgreement merepresentasikan akad pinjaman internal di tabel loan_agreements
type LoanAgreement struct {
	LoanID            string     `json:"loan_id"`
	CampaignID        string     `json:"campaign_id"`
	BorrowerUserID    string     `json:"borrower_user_id"`
	PrincipalAmount   float64    `json:"principal_amount"`
	ServiceFeePercent float64    `json:"service_fee_percent"`
	LoanStatus        string     `json:"loan_status"` // PENDING, ACTIVE, PAID, OVERDUE, DEFAULTED, CANCELLED
	ApprovedAt        *time.Time `json:"approved_at,omitempty"`
	MaturityAt        *time.Time `json:"maturity_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

// LoanRepaymentSchedule merepresentasikan jadwal angsuran pinjaman di tabel loan_repayment_schedules
type LoanRepaymentSchedule struct {
	ScheduleID         string    `json:"schedule_id"`
	LoanID             string    `json:"loan_id"`
	InstallmentNumber  int       `json:"installment_number"`
	DueAt              time.Time `json:"due_at"`
	AmountDue          float64   `json:"amount_due"`
	ScheduleStatus     string    `json:"schedule_status"` // UNPAID, PARTIAL, PAID, OVERDUE, WAIVED, CANCELLED
}

// LoanRepayment merepresentasikan pembayaran angsuran pinjaman di tabel loan_repayments
type LoanRepayment struct {
	RepaymentID     string     `json:"repayment_id"`
	ScheduleID      string     `json:"schedule_id"`
	AmountPaid      float64    `json:"amount_paid"`
	RepaymentStatus string     `json:"repayment_status"` // PENDING, PAID, FAILED, REFUNDED
	PaidAt          *time.Time `json:"paid_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}
