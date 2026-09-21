package service

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"
	"backend-arisankita/internal/repository"
)

// ArisanService menangani algoritma lelang SPSB, kocokan Spin Wheel, dan siklus
// Pegangan: Anggota 3 (Core Engine Arisan & Transaksi)
type ArisanService interface {
	SubmitBid(ctx context.Context, cycleID, userID string, bidAmount float64) error
	CalculateSPSBWinner(ctx context.Context, cycleID string) (winnerUserID string, winningBid float64, payableAmount float64, err error)
	SpinRandomWinner(ctx context.Context, cycleID string) (winnerUserID string, err error)
	RecordPayment(ctx context.Context, circleID, userID string, amount float64, gatewayRef string) (*models.Transaction, error)
}

type arisanService struct {
	arisanRepo repository.ArisanRepository
}

func NewArisanService(arisanRepo repository.ArisanRepository) ArisanService {
	return &arisanService{arisanRepo: arisanRepo}
}

func (s *arisanService) SubmitBid(ctx context.Context, cycleID, userID string, bidAmount float64) error {
	// TODO (Anggota 3): Validasi range bid (floor 1% & ceiling 25%), simpan bid rahasia
	return errors.New("not implemented")
}

func (s *arisanService) CalculateSPSBWinner(ctx context.Context, cycleID string) (string, float64, float64, error) {
	// TODO (Anggota 3): Implementasi Lelang SPSB (Second-Price Sealed-Bid):
	// 1. Ambil semua bid di cycle ini
	// 2. Cari bid tertinggi ke-1 (pemenang)
	// 3. Pemenang hanya membayar nilai penawaran tertinggi ke-2
	return "", 0, 0, errors.New("not implemented")
}

func (s *arisanService) SpinRandomWinner(ctx context.Context, cycleID string) (string, error) {
	// TODO (Anggota 3): Ambil member yang belum pernah menang (has_won_arisan = false), kocok secara acak
	return "", errors.New("not implemented")
}

func (s *arisanService) RecordPayment(ctx context.Context, circleID, userID string, amount float64, gatewayRef string) (*models.Transaction, error) {
	// TODO (Anggota 3): Catat transaksi pembayaran & generate SHA-256 audit_hash
	return nil, errors.New("not implemented")
}
