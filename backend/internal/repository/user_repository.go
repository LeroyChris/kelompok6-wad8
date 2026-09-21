package repository

import (
	"context"
	"errors"

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

func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	// TODO (Anggota 1): Tulis query Raw SQL INSERT INTO users ...
	return errors.New("not implemented")
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	// TODO (Anggota 1): Tulis query Raw SQL SELECT FROM users WHERE email = $1
	return nil, errors.New("not implemented")
}

func (r *userRepository) FindByID(ctx context.Context, userID string) (*models.User, error) {
	// TODO (Anggota 1): Tulis query Raw SQL SELECT FROM users WHERE user_id = $1
	return nil, errors.New("not implemented")
}

func (r *userRepository) Update(ctx context.Context, user *models.User) error {
	// TODO (Anggota 1): Tulis query Raw SQL UPDATE users SET ...
	return errors.New("not implemented")
}
