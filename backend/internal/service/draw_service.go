package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"backend-arisankita/internal/dto"
	"backend-arisankita/internal/repository"
)

type DrawService interface {
	GetParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]repository.ParticipantDB, dto.MetaPagination, error)
	ExecuteCycleDraw(ctx context.Context, cycleID string) (map[string]interface{}, error)
	SubmitBid(ctx context.Context, cycleID, userID string, bidRate float64) error
	GetCycleObligations(ctx context.Context, cycleID string, limit int, cursorTime *time.Time, cursorID string) ([]repository.ObligationDB, error)
	GetCycleAward(ctx context.Context, cycleID string) (*repository.AwardDB, error)
	StartNewCycle(ctx context.Context, circleID string, cycleNumber int, dueAt time.Time) (string, error)
	CloseBidding(ctx context.Context, cycleID string) error
	GetCyclesByCircle(ctx context.Context, circleID string, limit, cursor int) ([]repository.CycleDB, error)
	GetCycle(ctx context.Context, cycleID string) (*repository.CycleDB, error)
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

// Eksekusi Pemenang Siklus (Smart Routing: SPSB Auction atau Random Draw)
func (s *drawService) ExecuteCycleDraw(ctx context.Context, cycleID string) (map[string]interface{}, error) {
	// 1. Ambil data Circle & Siklus
	info, err := s.repo.GetCircleInfoByCycle(ctx, cycleID)
	if err != nil {
		return nil, err
	}

	if info.CycleStatus != "READY_FOR_DISBURSEMENT" {
		return nil, errors.New("siklus harus berstatus READY_FOR_DISBURSEMENT sebelum pemenang dapat ditetapkan")
	}

	grossAmount, err := s.repo.GetPaidPot(ctx, cycleID)
	if err != nil {
		return nil, fmt.Errorf("gagal menghitung pot iuran: %w", err)
	}
	if grossAmount <= 0 {
		return nil, errors.New("belum ada iuran lunas untuk dicairkan")
	}

	// 2. Cabang Logika Berdasarkan Track Type
	if info.TrackType == "SPSB" {
		return s.executeSPSBVickreyDraw(ctx, cycleID, info, grossAmount)
	}

	return s.executeProvablyFairRandomDraw(ctx, cycleID, info, grossAmount)
}

// Logika Lelang SPSB (Second Price Sealed Bid / Vickrey Auction)
func (s *drawService) executeSPSBVickreyDraw(
	ctx context.Context,
	cycleID string,
	info *repository.CircleCycleInfo,
	grossAmount float64,
) (map[string]interface{}, error) {
	bids, err := s.repo.GetActiveBidsByCycle(ctx, cycleID)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca penawaran lelang: %w", err)
	}
	if len(bids) == 0 {
		return nil, errors.New("belum ada penawaran lelang aktif yang diajukan pada putaran ini")
	}

	// Pemenang adalah penawar tertinggi (bids[0])
	winner := bids[0]
	winningRate := winner.BidRatePercent

	// Aturan Vickrey: Bayar tarif tawaran tertinggi KEDUA
	payableRate := winningRate
	if len(bids) >= 2 {
		payableRate = bids[1].BidRatePercent
	} else if info.BidFloorPercent != nil && *info.BidFloorPercent > 0 {
		payableRate = *info.BidFloorPercent
	}

	discountAmount := grossAmount * (payableRate / 100.0)
	netAmount := grossAmount - discountAmount

	// Buat Hash Audit Keputusan
	hashRaw := fmt.Sprintf("SPSB:%s:%s:win=%.2f:pay=%.2f:%d", cycleID, winner.UserID, winningRate, payableRate, time.Now().UnixNano())
	hashBytes := sha256.Sum256([]byte(hashRaw))
	decisionHash := hex.EncodeToString(hashBytes[:])

	// Eksekusi Transaksi Atomis (Simpan Award, Catat Pencairan, Kredit Dompet)
	awardID, err := s.repo.ExecuteSPSBDrawTransaction(
		ctx, cycleID, winner, winningRate, payableRate, grossAmount, netAmount, decisionHash,
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"award_id":                 awardID,
		"cycle_id":                 cycleID,
		"circle_name":              info.CircleName,
		"award_method":             "SPSB",
		"winner_user_id":           winner.UserID,
		"winner_name":              winner.FullName,
		"winning_bid_rate_percent": winningRate,
		"payable_bid_rate_percent": payableRate,
		"gross_amount":             grossAmount,
		"discount_amount":          discountAmount,
		"net_disbursed_amount":     netAmount,
		"decision_hash":            decisionHash,
	}, nil
}

// Logika Pengundian Acak Kriptografis (Provably Fair Random Draw)
func (s *drawService) executeProvablyFairRandomDraw(
	ctx context.Context,
	cycleID string,
	info *repository.CircleCycleInfo,
	grossAmount float64,
) (map[string]interface{}, error) {
	candidates, err := s.repo.GetEligibleParticipants(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, errors.New("tidak ada partisipan yang berhak mengikuti pengundian pada siklus ini (seluruh anggota mungkin telah menang)")
	}

	// Generate Cryptographically Secure Random Seed
	seedBytes := make([]byte, 32)
	if _, err := rand.Read(seedBytes); err != nil {
		return nil, fmt.Errorf("gagal menghasilkan seed kriptografi: %w", err)
	}
	commitmentBytes := sha256.Sum256(seedBytes)
	seedCommitment := hex.EncodeToString(commitmentBytes[:])
	// Deterministic selection lets members verify the revealed seed afterwards.
	selection := sha256.Sum256(append(seedBytes, []byte(cycleID)...))
	winner := candidates[int(selection[0])%len(candidates)]
	participantIDs := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		participantIDs = append(participantIDs, candidate.ParticipantID)
	}
	snapshot := sha256.Sum256([]byte(strings.Join(participantIDs, ",")))

	// Buat Hash Keputusan
	hashRaw := fmt.Sprintf("RANDOM:%s:%s:%s:%d", cycleID, winner.UserID, seedCommitment, time.Now().UnixNano())
	hashBytes := sha256.Sum256([]byte(hashRaw))
	decisionHash := hex.EncodeToString(hashBytes[:])

	// Eksekusi Transaksi Atomis (Simpan Award, Audit Trail, Pencairan ke Dompet Pemenang)
	awardID, err := s.repo.ExecuteRandomDrawTransaction(
		ctx, cycleID, winner, grossAmount, decisionHash, seedCommitment, hex.EncodeToString(seedBytes), hex.EncodeToString(snapshot[:]), len(candidates),
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"award_id":               awardID,
		"cycle_id":               cycleID,
		"circle_name":            info.CircleName,
		"award_method":           "RANDOM_DRAW",
		"winner_user_id":         winner.UserID,
		"winner_name":            winner.Name,
		"gross_amount":           grossAmount,
		"net_disbursed_amount":   grossAmount,
		"random_seed_commitment": seedCommitment,
		"random_source":          "CRYPTO_SECURE_RANDOM",
		"eligible_count":         len(candidates),
		"decision_hash":          decisionHash,
	}, nil
}

func (s *drawService) SubmitBid(ctx context.Context, cycleID, userID string, bidRate float64) error {
	if bidRate < 0 || bidRate > 100 {
		return errors.New("persentase tawaran lelang harus berada di antara 0% hingga 100%")
	}

	info, err := s.repo.GetCircleInfoByCycle(ctx, cycleID)
	if err != nil {
		return err
	}

	if info.TrackType != "SPSB" {
		return errors.New("kelompok arisan ini menggunakan sistem kocokan acak (Random Draw), bukan sistem lelang (SPSB)")
	}
	if info.CycleStatus != "BIDDING_OPEN" {
		return errors.New("bidding tidak sedang dibuka untuk siklus ini")
	}

	if info.BidFloorPercent != nil && bidRate < *info.BidFloorPercent {
		return fmt.Errorf("tawaran minimal adalah %.2f%% sesuai batas bawah (bid floor) kelompok", *info.BidFloorPercent)
	}
	if info.BidCeilingPercent != nil && bidRate > *info.BidCeilingPercent {
		return fmt.Errorf("tawaran maksimal adalah %.2f%% sesuai batas atas (bid ceiling) kelompok", *info.BidCeilingPercent)
	}

	return s.repo.SaveBid(ctx, cycleID, userID, bidRate)
}

func (s *drawService) GetCycleObligations(ctx context.Context, cycleID string, limit int, cursorTime *time.Time, cursorID string) ([]repository.ObligationDB, error) {
	return s.repo.GetCycleObligations(ctx, cycleID, limit, cursorTime, cursorID)
}

func (s *drawService) GetCycleAward(ctx context.Context, cycleID string) (*repository.AwardDB, error) {
	return s.repo.GetCycleAward(ctx, cycleID)
}

func (s *drawService) StartNewCycle(ctx context.Context, circleID string, cycleNumber int, dueAt time.Time) (string, error) {
	return s.repo.OpenCycleWithParticipantsAndObligations(ctx, circleID, cycleNumber, dueAt)
}

func (s *drawService) CloseBidding(ctx context.Context, cycleID string) error {
	return s.repo.CloseBidding(ctx, cycleID)
}

func (s *drawService) GetCyclesByCircle(ctx context.Context, circleID string, limit, cursor int) ([]repository.CycleDB, error) {
	return s.repo.GetCyclesByCircle(ctx, circleID, limit, cursor)
}
func (s *drawService) GetCycle(ctx context.Context, cycleID string) (*repository.CycleDB, error) {
	return s.repo.GetCycle(ctx, cycleID)
}
