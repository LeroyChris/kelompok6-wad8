package models

import "time"

// UserWallet merepresentasikan saldo dompet pengguna di tabel user_wallets
type UserWallet struct {
	WalletID  string    `json:"wallet_id"`
	UserID    string    `json:"user_id"`
	Balance   float64   `json:"balance"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// WalletTransaction merepresentasikan mutasi transaksi dompet di tabel wallet_transactions
type WalletTransaction struct {
	WalletTxID  string    `json:"wallet_tx_id"`
	WalletID    string    `json:"wallet_id"`
	Amount      float64   `json:"amount"`
	TxType      string    `json:"tx_type"` // INITIAL_BALANCE, TOPUP, DUES_PAYMENT, DISBURSEMENT, WITHDRAWAL
	ReferenceID *string   `json:"reference_id,omitempty"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
