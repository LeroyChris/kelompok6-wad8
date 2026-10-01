package models

import "time"

// User merepresentasikan entitas tabel users (001_core_schema.sql)
type User struct {
	UserID        string    `json:"user_id"`
	FullName      string    `json:"full_name"`
	PhoneNumber   *string   `json:"phone_number,omitempty"`
	Email         *string   `json:"email,omitempty"`
	AccountStatus string    `json:"account_status"` // ACTIVE, SUSPENDED, DEACTIVATED
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Field tambahan untuk menampung ringkasan profil & kemenangan
	WalletBalance  float64 `json:"wallet_balance"`
	TotalWonCount  int     `json:"total_won_count"`
	TotalAmountWon float64 `json:"total_amount_won"`
}

// UserAuthIdentity merepresentasikan entitas tabel user_auth_identities
type UserAuthIdentity struct {
	IdentityID      string    `json:"identity_id"`
	UserID          string    `json:"user_id"`
	Provider        string    `json:"provider"` // PHONE_OTP, GOOGLE, PASSWORD
	ProviderSubject string    `json:"provider_subject"`
	CreatedAt       time.Time `json:"created_at"`
}

// UserBankAccount merepresentasikan entitas tabel user_bank_accounts
type UserBankAccount struct {
	BankAccountID           string     `json:"bank_account_id"`
	UserID                  string     `json:"user_id"`
	Provider                string     `json:"provider"`
	AccountType             string     `json:"account_type"` // BANK, E_WALLET
	AccountNumberToken      string     `json:"account_number_token"`
	AccountNumberMasked     string     `json:"account_number_masked"`
	AccountNameFromProvider *string    `json:"account_name_from_provider,omitempty"`
	ValidationStatus        string     `json:"validation_status"`  // PENDING, MATCHED, MISMATCHED, FAILED
	AuthorizationType       string     `json:"authorization_type"` // SELF, FAMILY_AUTHORIZED
	CreatedAt               time.Time  `json:"created_at"`
	VerifiedAt              *time.Time `json:"verified_at,omitempty"`
}

// WinHistoryItem merepresentasikan riwayat kemenangan arisan user
type WinHistoryItem struct {
	AwardID               string     `json:"award_id"`
	CircleID              string     `json:"circle_id"`
	CircleName            string     `json:"circle_name"`
	CycleNumber           int        `json:"cycle_number"`
	AwardMethod           string     `json:"award_method"` // SPSB, RANDOM_DRAW
	GrossAmount           float64    `json:"gross_amount"`
	WinningBidRatePercent *float64   `json:"winning_bid_rate_percent,omitempty"`
	PayableBidRatePercent *float64   `json:"payable_bid_rate_percent,omitempty"`
	WonAt                 time.Time  `json:"won_at"`
}
