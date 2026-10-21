package repository

import (
	"context"
	"errors"

	"backend-arisankita/internal/dto"
	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CircleRepository interface {
	CreateCircle(ctx context.Context, circle *models.Circle) error
	FindByID(ctx context.Context, circleID string) (*models.Circle, error)
	AddMembership(ctx context.Context, membership *models.CircleMembership) error
	GetMemberships(ctx context.Context, circleID string) ([]dto.CircleMemberItem, error)
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

// GetMemberships mengambil data seluruh anggota Circle dari Supabase (Raw SQL JOIN)
func (r *circleRepository) GetMemberships(ctx context.Context, circleID string) ([]dto.CircleMemberItem, error) {
	query := `
		SELECT 
			u.user_id::text,
			u.full_name,
			COALESCE(u.email, '') AS email,
			cm.membership_role,
			cm.membership_status,
			cm.joined_at
		FROM circle_memberships cm
		JOIN users u ON u.user_id = cm.user_id
		WHERE cm.circle_id = $1 AND cm.membership_status = 'ACTIVE'
		ORDER BY cm.joined_at ASC;
	`

	rows, err := r.db.Query(ctx, query, circleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []dto.CircleMemberItem
	for rows.Next() {
		var item dto.CircleMemberItem
		var joinedAt interface{} // Handling timestamp
		err := rows.Scan(
			&item.UserID,
			&item.FullName,
			&item.Email,
			&item.MembershipRole,
			&item.MembershipStatus,
			&joinedAt,
		)
		if err != nil {
			return nil, err
		}
		members = append(members, item)
	}

	return members, nil
}

func (r *circleRepository) CreateCircle(ctx context.Context, circle *models.Circle) error {
	return errors.New("not implemented")
}

func (r *circleRepository) FindByID(ctx context.Context, circleID string) (*models.Circle, error) {
	return nil, errors.New("not implemented")
}

func (r *circleRepository) AddMembership(ctx context.Context, membership *models.CircleMembership) error {
	return errors.New("not implemented")
}

func (r *circleRepository) UpdateStatus(ctx context.Context, circleID string, status string) error {
	return errors.New("not implemented")
}

func (r *circleRepository) CreateInvitation(ctx context.Context, invite *models.CircleInvitation) error {
	return errors.New("not implemented")
}

func (r *circleRepository) FindInvitationByHash(ctx context.Context, codeHash string) (*models.CircleInvitation, error) {
	return nil, errors.New("not implemented")
}
