package repository

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ArisanRepository menangani query Raw SQL untuk tabel arisan_cycles, bids, transactions
// Pegangan: Anggota 3 (Core Engine Arisan & Transaksi)
type ArisanRepository interface {
	CreateCycle(ctx context.Context, cycle *models.ArisanCycle) error
	GetCyclesByCircleID(ctx context.Context, circleID string) ([]models.ArisanCycle, error)
	SubmitBid(ctx context.Context, bid *models.Bid) error
	GetBidsByCycleID(ctx context.Context, cycleID string) ([]models.Bid, error)
	SetWinner(ctx context.Context, cycleID string, winnerUserID string, winningBid float64, actualPayable float64) error
	CreateTransaction(ctx context.Context, tx *models.Transaction) error
	GetTransactionsByCircleID(ctx context.Context, circleID string) ([]models.Transaction, error)
}

type arisanRepository struct {
	db *pgxpool.Pool
}

func NewArisanRepository(db *pgxpool.Pool) ArisanRepository {
	return &arisanRepository{db: db}
}

func (r *arisanRepository) CreateCycle(ctx context.Context, cycle *models.ArisanCycle) error {
	// TODO (Anggota 3): Tulis query Raw SQL INSERT INTO arisan_cycles ...
	return errors.New("not implemented")
}

func (r *arisanRepository) GetCyclesByCircleID(ctx context.Context, circleID string) ([]models.ArisanCycle, error) {
	// TODO (Anggota 3): Tulis query Raw SQL SELECT FROM arisan_cycles WHERE circle_id = $1
	return nil, errors.New("not implemented")
}

func (r *arisanRepository) SubmitBid(ctx context.Context, bid *models.Bid) error {
	// TODO (Anggota 3): Tulis query Raw SQL INSERT INTO bids ...
	return errors.New("not implemented")
}

func (r *arisanRepository) GetBidsByCycleID(ctx context.Context, cycleID string) ([]models.Bid, error) {
	// TODO (Anggota 3): Tulis query Raw SQL SELECT FROM bids WHERE cycle_id = $1
	return nil, errors.New("not implemented")
}

func (r *arisanRepository) SetWinner(ctx context.Context, cycleID string, winnerUserID string, winningBid float64, actualPayable float64) error {
	// TODO (Anggota 3): Tulis query Raw SQL UPDATE arisan_cycles SET winner_user_id = $1, ...
	return errors.New("not implemented")
}

func (r *arisanRepository) CreateTransaction(ctx context.Context, tx *models.Transaction) error {
	// TODO (Anggota 3): Tulis query Raw SQL INSERT INTO transactions ...
	return errors.New("not implemented")
}

func (r *arisanRepository) GetTransactionsByCircleID(ctx context.Context, circleID string) ([]models.Transaction, error) {
	// TODO (Anggota 3): Tulis query Raw SQL SELECT FROM transactions WHERE circle_id = $1
	return nil, errors.New("not implemented")
}
