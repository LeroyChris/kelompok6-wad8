package models

import "time"

// User merepresentasikan entitas tabel users (BAB 5.3)
// Pegangan: Anggota 1 (Auth & User Profile)
type User struct {
	UserID          string    `json:"user_id"`
	PhoneNumber     string    `json:"phone_number"`
	Email           string    `json:"email"`
	PasswordHash    string    `json:"-"` // Jangan ekspos password ke JSON
	FullName        string    `json:"full_name"`
	AccountStatus   string    `json:"account_status"`   // ACTIVE, SUSPENDED
	ReputationScore int       `json:"reputation_score"` // Default 100
	CreatedAt       time.Time `json:"created_at"`
}
