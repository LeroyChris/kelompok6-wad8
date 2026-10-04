package repository

import (
	"context"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository menangani query Raw SQL untuk tabel users
// Pegangan: Anggota 1 (Auth & User Profile)
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	FindByID(ctx context.Context, userID string) (*models.User, error)
	Update(ctx context.Context, user *models.User) error
}

type userRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) UserRepository {
	return &userRepository{db: db}
}

// 1.1 Registrasi User Baru
func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (full_name, phone_number, email, account_status)
		VALUES ($1, $2, $3, 'ACTIVE')
		RETURNING user_id, full_name, phone_number, email, account_status, created_at;
	`
	return r.db.QueryRow(ctx, query, user.FullName, user.PhoneNumber, user.Email).Scan(
		&user.UserID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.AccountStatus,
		&user.CreatedAt,
	)
}

// Cari User berdasarkan Email (Login / Validasi)
func (r *userRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT user_id, full_name, phone_number, email, account_status, created_at
		FROM users
		WHERE LOWER(email) = LOWER($1);
	`
	var user models.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.UserID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.AccountStatus,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// 1.3 Ambil Profil User Lengkap & Ringkasan Kemenangan (GET /api/v1/users/me)
func (r *userRepository) FindByID(ctx context.Context, userID string) (*models.User, error) {
	query := `
		SELECT
			u.user_id,
			u.full_name,
			u.phone_number,
			u.email,
			u.account_status,
			COALESCE(w.balance, 0.00) AS wallet_balance,
			COUNT(ca.award_id) AS total_won_count,
			COALESCE(SUM(ca.gross_amount), 0.00)::NUMERIC(18,2) AS total_amount_won
		FROM users u
		LEFT JOIN user_wallets w ON w.user_id = u.user_id
		LEFT JOIN circle_memberships cm ON cm.user_id = u.user_id
		LEFT JOIN cycle_participants cp ON cp.circle_membership_id = cm.circle_membership_id
		LEFT JOIN cycle_awards ca ON ca.cycle_participant_id = cp.cycle_participant_id
		WHERE u.user_id = $1
		GROUP BY u.user_id, u.full_name, u.phone_number, u.email, u.account_status, w.balance;
	`
	var user models.User
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&user.UserID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.AccountStatus,
		&user.WalletBalance,
		&user.TotalWonCount,
		&user.TotalAmountWon,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Update Profil User
func (r *userRepository) Update(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users
		SET full_name = $1, phone_number = $2, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $3
		RETURNING updated_at;
	`
	return r.db.QueryRow(ctx, query, user.FullName, user.PhoneNumber, user.UserID).Scan(&user.UpdatedAt)
}