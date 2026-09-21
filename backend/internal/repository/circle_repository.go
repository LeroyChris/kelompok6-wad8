package repository

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CircleRepository menangani query Raw SQL untuk tabel circles & circle_members
// Pegangan: Anggota 2 (Circle & Membership)
type CircleRepository interface {
	CreateCircle(ctx context.Context, circle *models.Circle) error
	FindByID(ctx context.Context, circleID string) (*models.Circle, error)
	FindByInviteCode(ctx context.Context, code string) (*models.Circle, error)
	AddMember(ctx context.Context, member *models.CircleMember) error
	GetMembers(ctx context.Context, circleID string) ([]models.CircleMember, error)
	UpdateStatus(ctx context.Context, circleID string, status string) error
}

type circleRepository struct {
	db *pgxpool.Pool
}

func NewCircleRepository(db *pgxpool.Pool) CircleRepository {
	return &circleRepository{db: db}
}

func (r *circleRepository) CreateCircle(ctx context.Context, circle *models.Circle) error {
	// TODO (Anggota 2): Tulis query Raw SQL INSERT INTO circles ...
	return errors.New("not implemented")
}

func (r *circleRepository) FindByID(ctx context.Context, circleID string) (*models.Circle, error) {
	// TODO (Anggota 2): Tulis query Raw SQL SELECT FROM circles WHERE circle_id = $1
	return nil, errors.New("not implemented")
}

func (r *circleRepository) FindByInviteCode(ctx context.Context, code string) (*models.Circle, error) {
	// TODO (Anggota 2): Tulis query Raw SQL SELECT FROM circles WHERE invite_code = $1
	return nil, errors.New("not implemented")
}

func (r *circleRepository) AddMember(ctx context.Context, member *models.CircleMember) error {
	// TODO (Anggota 2): Tulis query Raw SQL INSERT INTO circle_members ...
	return errors.New("not implemented")
}

func (r *circleRepository) GetMembers(ctx context.Context, circleID string) ([]models.CircleMember, error) {
	// TODO (Anggota 2): Tulis query Raw SQL SELECT FROM circle_members WHERE circle_id = $1
	return nil, errors.New("not implemented")
}

func (r *circleRepository) UpdateStatus(ctx context.Context, circleID string, status string) error {
	// TODO (Anggota 2): Tulis query Raw SQL UPDATE circles SET circle_status = $1 WHERE circle_id = $2
	return errors.New("not implemented")
}
