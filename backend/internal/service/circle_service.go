package service

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"
	"backend-arisankita/internal/repository"
)

// CircleService menangani business logic Circle / Kelompok Arisan
// Pegangan: Anggota 2 (Circle & Membership)
type CircleService interface {
	CreateCircle(ctx context.Context, leaderID, name, description, trackType string, duesAmount float64, maxMembers int) (*models.Circle, error)
	JoinCircle(ctx context.Context, userID, inviteCode string) error
	GetCircleDetail(ctx context.Context, circleID string) (*models.Circle, []models.CircleMember, error)
	LockCircle(ctx context.Context, circleID, leaderID string) error
}

type circleService struct {
	circleRepo repository.CircleRepository
}

func NewCircleService(circleRepo repository.CircleRepository) CircleService {
	return &circleService{circleRepo: circleRepo}
}

func (s *circleService) CreateCircle(ctx context.Context, leaderID, name, description, trackType string, duesAmount float64, maxMembers int) (*models.Circle, error) {
	// TODO (Anggota 2): Generate invite code unik, simpan circle, tambahkan leader sebagai member
	return nil, errors.New("not implemented")
}

func (s *circleService) JoinCircle(ctx context.Context, userID, inviteCode string) error {
	// TODO (Anggota 2): Cari circle by invite code, cek kuota max_members, tambahkan member
	return errors.New("not implemented")
}

func (s *circleService) GetCircleDetail(ctx context.Context, circleID string) (*models.Circle, []models.CircleMember, error) {
	// TODO (Anggota 2): Ambil detail circle dan list member
	return nil, nil, errors.New("not implemented")
}

func (s *circleService) LockCircle(ctx context.Context, circleID, leaderID string) error {
	// TODO (Anggota 2): Pastikan user adalah leader, ubah status RECRUITING -> LOCKED
	return errors.New("not implemented")
}
