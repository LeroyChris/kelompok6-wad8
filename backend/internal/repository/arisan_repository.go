package repository

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ArisanRepository menangani query Raw SQL untuk siklus, lelang, kocokan, dan pembayaran
// Pegangan: Anggota 3 (Core Engine Arisan & Transaksi)
type ArisanRepository interface {
	CreateCycle(ctx context.Context, cycle *models.ArisanCycle) error
	GetCyclesByCircleID(ctx context.Context, circleID string) ([]models.ArisanCycle, error)
	SubmitBid(ctx context.Context, bid *models.Bid) error
	GetBidsByCycleID(ctx context.Context, cycleID string) ([]models.Bid, error)
	SetAward(ctx context.Context, award *models.CycleAward) error
	CreatePaymentOrder(ctx context.Context, order *models.PaymentOrder) error
	GetPaymentOrderByID(ctx context.Context, paymentOrderID string) (*models.PaymentOrder, error)
}

type arisanRepository struct {
	db *pgxpool.Pool
}

func NewArisanRepository(db *pgxpool.Pool) ArisanRepository {
	return &arisanRepository{db: db}
}

func (r *arisanRepository) CreateCycle(ctx context.Context, cycle *models.ArisanCycle) error {
	// Query ada di docs/sql/002_core_queries.sql No. 6
	return errors.New("not implemented")
}

func (r *arisanRepository) GetCyclesByCircleID(ctx context.Context, circleID string) ([]models.ArisanCycle, error) {
	return nil, errors.New("not implemented")
}

func (r *arisanRepository) SubmitBid(ctx context.Context, bid *models.Bid) error {
	// Query ada di docs/sql/002_core_queries.sql No. 9
	return errors.New("not implemented")
}

func (r *arisanRepository) GetBidsByCycleID(ctx context.Context, cycleID string) ([]models.Bid, error) {
	// Query ada di docs/sql/002_core_queries.sql No. 10
	return nil, errors.New("not implemented")
}

func (r *arisanRepository) SetAward(ctx context.Context, award *models.CycleAward) error {
	// Query ada di docs/sql/002_core_queries.sql No. 11
	return errors.New("not implemented")
}

func (r *arisanRepository) CreatePaymentOrder(ctx context.Context, order *models.PaymentOrder) error {
	// Query ada di docs/sql/002_core_queries.sql No. 13
	return errors.New("not implemented")
}

func (r *arisanRepository) GetPaymentOrderByID(ctx context.Context, paymentOrderID string) (*models.PaymentOrder, error) {
	return nil, errors.New("not implemented")
}
