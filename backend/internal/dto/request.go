package dto

// DTO untuk Register User
type RegisterRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	FullName    string `json:"full_name" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=6"`
}

// DTO untuk Login User
type LoginRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	Password    string `json:"password" binding:"required"`
}

// DTO untuk Pembuatan Circle Baru
type CreateCircleRequest struct {
	CircleName  string  `json:"circle_name" binding:"required"`
	TrackType   string  `json:"track_type" binding:"required"` // 'TRACK_A_COMMERCIAL' / 'TRACK_B_SOCIAL'
	MonthlyDues float64 `json:"monthly_dues" binding:"required,gt=0"`
	MaxMembers  int     `json:"max_members" binding:"required,gt=1"`
}

// DTO untuk Penawaran Lelang SPSB (Track A)
type SubmitBidRequest struct {
	BidAmount float64 `json:"bid_amount" binding:"required,gt=0"`
}

// DTO untuk Kampanye Patungan Internal
type CreateCrowdfundingRequest struct {
	Title        string  `json:"title" binding:"required"`
	TargetAmount float64 `json:"target_amount" binding:"required,gt=0"`
}

// DTO untuk Kontribusi Patungan Internal
type ContributeCrowdfundingRequest struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}
