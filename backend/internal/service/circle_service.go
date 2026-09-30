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
	CreateCircle(ctx context.Context, ownerUserID, name string, trackType string, duesAmount float64, memberLimit int, periodType string) (*models.Circle, error)
	JoinCircle(ctx context.Context, userID, inviteCode string) error
	GetCircleDetail(ctx context.Context, circleID string) (*models.Circle, []models.CircleMembership, error)
	LockCircle(ctx context.Context, circleID, ownerUserID string) error
}

type circleService struct {
	circleRepo repository.CircleRepository
}

func NewCircleService(circleRepo repository.CircleRepository) CircleService {
	return &circleService{circleRepo: circleRepo}
}

func (s *circleService) CreateCircle(ctx context.Context, ownerUserID, name string, trackType string, duesAmount float64, memberLimit int, periodType string) (*models.Circle, error) {
	// TODO (Anggota 2): Generate invite code unik, simpan circle, tambahkan creator sebagai OWNER
	return nil, errors.New("not implemented")
}

func (s *circleService) JoinCircle(ctx context.Context, userID, inviteCode string) error {
	// TODO (Anggota 2): Cari circle by invite code hash, cek kuota member_limit, tambahkan member
	return errors.New("not implemented")
}

func (s *circleService) GetCircleDetail(ctx context.Context, circleID string) (*models.Circle, []models.CircleMembership, error) {
	// TODO (Anggota 2): Ambil detail circle dan list member
	return nil, nil, errors.New("not implemented")
}

func (s *circleService) LockCircle(ctx context.Context, circleID, ownerUserID string) error {
	// TODO (Anggota 2): Pastikan user adalah OWNER, ubah status RECRUITING -> LOCKED
	return errors.New("not implemented")
}
