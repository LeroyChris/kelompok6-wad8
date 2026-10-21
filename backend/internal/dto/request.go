package dto

// DTO untuk Update Profil User
type UpdateProfileRequest struct {
	FullName string `json:"full_name"`
}

// DTO untuk Rekening Bank User
type CreateBankAccountRequest struct {
	BankName      string `json:"bank_name" binding:"required"`
	AccountNumber string `json:"account_number" binding:"required"`
	AccountHolder string `json:"account_holder" binding:"required"`
	IsPrimary     bool   `json:"is_primary"`
}
