package dto

// BaseResponse adalah struktur standar JSON output untuk seluruh API ArisanKita
type BaseResponse struct {
	Code    int         `json:"code"`
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// BuildResponse membuat struct BaseResponse standar dengan 4 argumen
func BuildResponse(code int, status string, message string, data interface{}) BaseResponse {
	return BaseResponse{
		Code:    code,
		Status:  status,
		Message: message,
		Data:    data,
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
	WinnerID      string  `json:"winner_id"`
	CircleID      string  `json:"circle_id"`
	CircleName    string  `json:"circle_name"`
	RoundNumber   int     `json:"round_number"`
	AwardedAmount float64 `json:"awarded_amount"`
	WonAt         string  `json:"won_at"`
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
