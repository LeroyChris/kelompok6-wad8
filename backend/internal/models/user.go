package models

import "time"

type User struct {
	UserID         string    `json:"id"`
	FullName       string    `json:"full_name"`
	PhoneNumber    string    `json:"phone_number"`
	Email          string    `json:"email"`
	AccountStatus  string    `json:"account_status"`
	AvatarURL      string    `json:"avatar_url"`
	WalletBalance  float64   `json:"wallet_balance,omitempty"`
	TotalWonCount  int       `json:"total_won_count,omitempty"`
	TotalAmountWon float64   `json:"total_amount_won,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}