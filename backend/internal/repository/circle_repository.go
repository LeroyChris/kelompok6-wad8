package repository

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CircleRepository menangani query Raw SQL untuk tabel circles, circle_memberships, circle_invitations
// Pegangan: Anggota 2 (Circle Hub & Membership)
type CircleRepository interface {
	CreateCircle(ctx context.Context, circle *models.Circle) error
	FindByID(ctx context.Context, circleID string) (*models.Circle, error)
	AddMembership(ctx context.Context, membership *models.CircleMembership) error
	GetMemberships(ctx context.Context, circleID string) ([]models.CircleMembership, error)
	UpdateStatus(ctx context.Context, circleID string, status string) error
	CreateInvitation(ctx context.Context, invite *models.CircleInvitation) error
	FindInvitationByHash(ctx context.Context, codeHash string) (*models.CircleInvitation, error)
}

type circleRepository struct {
	db *pgxpool.Pool
}

func NewCircleRepository(db *pgxpool.Pool) CircleRepository {
	return &circleRepository{db: db}
}

func (r *circleRepository) CreateCircle(ctx context.Context, circle *models.Circle) error {
	// Query ada di docs/sql/002_core_queries.sql No. 1
	return errors.New("not implemented")
}

func (r *circleRepository) FindByID(ctx context.Context, circleID string) (*models.Circle, error) {
	// Query ada di docs/sql/002_core_queries.sql No. 3
	return nil, errors.New("not implemented")
}

func (r *circleRepository) AddMembership(ctx context.Context, membership *models.CircleMembership) error {
	// Query ada di docs/sql/002_core_queries.sql No. 2
	return errors.New("not implemented")
}

func (r *circleRepository) GetMemberships(ctx context.Context, circleID string) ([]models.CircleMembership, error) {
	return nil, errors.New("not implemented")
}

func (r *circleRepository) UpdateStatus(ctx context.Context, circleID string, status string) error {
	return errors.New("not implemented")
}

func (r *circleRepository) CreateInvitation(ctx context.Context, invite *models.CircleInvitation) error {
	// Query ada di docs/sql/002_core_queries.sql No. 4
	return errors.New("not implemented")
}

func (r *circleRepository) FindInvitationByHash(ctx context.Context, codeHash string) (*models.CircleInvitation, error) {
	// Query ada di docs/sql/002_core_queries.sql No. 5
	return nil, errors.New("not implemented")
}
