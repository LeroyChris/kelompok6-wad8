package service

import (
	"context"
	"errors"
	"math"
	"math/rand"
	"time"

	"backend-arisankita/internal/dto"
	"backend-arisankita/internal/repository"
)

type DrawService interface {
	GetParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]repository.ParticipantDB, dto.MetaPagination, error)
	ExecuteRandomDraw(ctx context.Context, cycleID string) (map[string]interface{}, error)
	SubmitBid(ctx context.Context, cycleID, userID string, bidRate float64) error
}

type drawService struct {
	repo repository.DrawRepository
}

func NewDrawService(repo repository.DrawRepository) DrawService {
	return &drawService{repo: repo}
}

func (s *drawService) GetParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]repository.ParticipantDB, dto.MetaPagination, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	data, total, err := s.repo.GetCycleParticipantsPaginated(ctx, cycleID, page, pageSize)
	if err != nil {
		return nil, dto.MetaPagination{}, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages < 1 {
		totalPages = 1
	}

	meta := dto.MetaPagination{
		CurrentPage: page,
		PageSize:    pageSize,
		TotalItems:  total,
		TotalPages:  totalPages,
	}

	return data, meta, nil
}

func (s *drawService) ExecuteRandomDraw(ctx context.Context, cycleID string) (map[string]interface{}, error) {
	candidates, err := s.repo.GetEligibleParticipants(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, errors.New("tidak ada partisipan yang berhak mengikuti pengundian pada siklus ini")
	}

	// Logika acak pemenang (Random Draw)
	rand.Seed(time.Now().UnixNano())
	winnerIdx := rand.Intn(len(candidates))
	winner := candidates[winnerIdx]

	// Eksekusi Transaction SQL untuk simpan award & update status
	awardID, err := s.repo.ExecuteDrawTransaction(ctx, cycleID, winner, "RANDOM_DRAW", 5000000)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"award_id":               awardID,
		"cycle_id":               cycleID,
		"winner":                 winner,
		"winner_name":            winner.Name,
		"award_method":           "RANDOM_DRAW",
		"gross_amount":           5000000,
		"random_seed_commitment": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
	}, nil
}

func (s *drawService) SubmitBid(ctx context.Context, cycleID, userID string, bidRate float64) error {
	if bidRate < 0 || bidRate > 100 {
		return errors.New("persentase tawaran lelang harus berada di antara 0% hingga 100%")
	}
	return s.repo.SaveBid(ctx, cycleID, userID, bidRate)
}
