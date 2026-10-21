package dto

// MetaPagination menyimpan informasi pagination standar
type MetaPagination struct {
	CurrentPage int   `json:"current_page"`
	PageSize    int   `json:"page_size"`
	TotalItems  int64 `json:"total_items"`
	TotalPages  int   `json:"total_pages"`
}

// BuildResponse membuat format response JSON standar
func BuildResponse(code int, status string, message string, data interface{}) map[string]interface{} {
	return map[string]interface{}{
		"code":    code,
		"status":  status,
		"message": message,
		"data":    data,
	}
}

// -----------------------------------------------------------------
// DTO Response Models (Modul User, Wallet & Bank Accounts)
// -----------------------------------------------------------------

type UserProfileResponse struct {
	ID             string  `json:"id"`
	FullName       string  `json:"full_name"`
	Email          string  `json:"email"`
	PhoneNumber    string  `json:"phone_number"`
	AvatarURL      string  `json:"avatar_url"`
	TotalWins      int     `json:"total_wins"`
	TotalWinAmount float64 `json:"total_win_amount"`
	CreatedAt      string  `json:"created_at"`
}

type WinHistoryItem struct {
	AwardID               string   `json:"award_id"`
	CircleID              string   `json:"circle_id"`
	CircleName            string   `json:"circle_name"`
	RoundNumber           int      `json:"round_number"`
	AwardMethod           string   `json:"award_method"`
	AwardedAmount         float64  `json:"awarded_amount"`
	WinningBidRatePercent *float64 `json:"winning_bid_rate_percent,omitempty"`
	PayableBidRatePercent *float64 `json:"payable_bid_rate_percent,omitempty"`
	WonAt                 string   `json:"won_at"`
}

type ReputationResponse struct {
	UserID          string  `json:"user_id"`
	ReputationScore int     `json:"reputation_score"`
	Status          string  `json:"status"`
	TotalPaid       int     `json:"total_paid_obligations"`
	TotalLate       int     `json:"total_late_obligations"`
	ReliabilityRate float64 `json:"reliability_rate_percentage"`
}

type WalletResponse struct {
	WalletID  string  `json:"wallet_id"`
	UserID    string  `json:"user_id"`
	Balance   float64 `json:"balance"`
	UpdatedAt string  `json:"updated_at"`
}

type WalletTransactionItem struct {
	ID              string  `json:"id"`
	WalletID        string  `json:"wallet_id"`
	TransactionType string  `json:"transaction_type"`
	MutationType    string  `json:"mutation_type"`
	Amount          float64 `json:"amount"`
	Description     string  `json:"description"`
	CreatedAt       string  `json:"created_at"`
}

type BankAccountItem struct {
	ID            string `json:"id"`
	UserID        string `json:"user_id"`
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountHolder string `json:"account_holder"`
	IsPrimary     bool   `json:"is_primary"`
	CreatedAt     string `json:"created_at"`
}

// -----------------------------------------------------------------
// DTO Response Models (Modul Circle, Draw & Bids)
// -----------------------------------------------------------------

type CircleMemberItem struct {
	UserID           string `json:"user_id"`
	FullName         string `json:"full_name"`
	Email            string `json:"email"`
	MembershipRole   string `json:"membership_role"`
	MembershipStatus string `json:"membership_status"`
	JoinedAt         string `json:"joined_at"`
}
