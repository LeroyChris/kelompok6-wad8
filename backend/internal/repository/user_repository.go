package repository

import (
	"context"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository menangani query Raw SQL untuk tabel users (Skema 001_core_schema.sql)
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

func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (user_id, full_name, phone_number, email, account_status, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING user_id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, user.FullName, user.PhoneNumber, user.Email).Scan(&user.UserID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT user_id, full_name, phone_number, email, account_status, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`
	var u models.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&u.UserID, &u.FullName, &u.PhoneNumber, &u.Email, &u.AccountStatus, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) FindByID(ctx context.Context, userID string) (*models.User, error) {
	query := `
		SELECT user_id, full_name, phone_number, email, account_status, created_at, updated_at
		FROM users
		WHERE user_id = $1
	`
	var u models.User
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&u.UserID, &u.FullName, &u.PhoneNumber, &u.Email, &u.AccountStatus, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) Update(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users
		SET full_name = $1, phone_number = $2, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $3
	`
	_, err := r.db.Exec(ctx, query, user.FullName, user.PhoneNumber, user.UserID)
	return err
}