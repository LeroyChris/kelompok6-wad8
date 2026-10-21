package service

import (
	"context"
	"testing"
	"time"

	"backend-arisankita/internal/repository"
)

type drawRepoStub struct {
	info           *repository.CircleCycleInfo
	saved          bool
	bids           []repository.BidEntry
	paidPot        float64
	executed       bool
	winner         repository.BidEntry
	winningRate    float64
	payableRate    float64
	grossAmount    float64
	netAmount      float64
	candidates     []repository.ParticipantDB
	randomWinner   repository.ParticipantDB
	randomGross    float64
	randomExecuted bool
}

func (s *drawRepoStub) GetCycleParticipantsPaginated(context.Context, string, int, int) ([]repository.ParticipantDB, int64, error) {
	return nil, 0, nil
}
func (s *drawRepoStub) GetCycleParticipantsCursor(context.Context, string, int, *time.Time, string) ([]repository.ParticipantDB, error) {
	return nil, nil
}
func (s *drawRepoStub) GetEligibleParticipants(context.Context, string) ([]repository.ParticipantDB, error) {
	return s.candidates, nil
}
func (s *drawRepoStub) GetCircleInfoByCycle(context.Context, string) (*repository.CircleCycleInfo, error) {
	return s.info, nil
}
func (s *drawRepoStub) GetActiveBidsByCycle(context.Context, string) ([]repository.BidEntry, error) {
	return s.bids, nil
}
func (s *drawRepoStub) GetUserBid(context.Context, string, string) (*repository.BidEntry, error) {
	return nil, nil
}
func (s *drawRepoStub) SaveBid(context.Context, string, string, float64) error {
	s.saved = true
	return nil
}
func (s *drawRepoStub) ExecuteSPSBDrawTransaction(_ context.Context, _, _ string, winner repository.BidEntry, winningRate, payableRate, grossAmount, netAmount float64, _ string) (string, error) {
	s.executed, s.winner, s.winningRate, s.payableRate, s.grossAmount, s.netAmount = true, winner, winningRate, payableRate, grossAmount, netAmount
	return "award", nil
}
func (s *drawRepoStub) ExecuteRandomDrawTransaction(_ context.Context, _, _ string, winner repository.ParticipantDB, gross float64, _ string, _ string, _ string, _ string, _ int) (string, error) {
	s.randomExecuted, s.randomWinner, s.randomGross = true, winner, gross
	return "award", nil
}
func (s *drawRepoStub) GetCycleObligations(context.Context, string, int, *time.Time, string) ([]repository.ObligationDB, error) {
	return nil, nil
}
func (s *drawRepoStub) GetCycleAward(context.Context, string) (*repository.AwardDB, error) {
	return nil, nil
}
func (s *drawRepoStub) OpenCycleWithParticipantsAndObligations(context.Context, string, int, time.Time) (string, error) {
	return "", nil
}
func (s *drawRepoStub) GetPaidPot(context.Context, string) (float64, error) { return s.paidPot, nil }
func (s *drawRepoStub) CloseBidding(context.Context, string) error          { return nil }
func (s *drawRepoStub) GetCyclesByCircle(context.Context, string, int, int) ([]repository.CycleDB, error) {
	return nil, nil
}

func TestExecuteSPSBUsesSecondPriceAndPaidPot(t *testing.T) {
	floor := 1.0
	repo := &drawRepoStub{
		info:    &repository.CircleCycleInfo{TrackType: "SPSB", CycleStatus: "READY_FOR_DISBURSEMENT", BidFloorPercent: &floor},
		paidPot: 3_000_000,
		bids: []repository.BidEntry{
			{ParticipantID: "farrel", UserID: "user-a", FullName: "Tiara", BidRatePercent: 7.5},
			{ParticipantID: "faza", UserID: "user-b", FullName: "Leroy", BidRatePercent: 5.0},
		},
	}
	result, err := NewDrawService(repo).ExecuteCycleDraw(context.Background(), "cycle", "actor")
	if err != nil {
		t.Fatal(err)
	}
	if !repo.executed || repo.winner.ParticipantID != "farrel" {
		t.Fatalf("winner was not highest bid: %#v", repo.winner)
	}
	if repo.winningRate != 7.5 || repo.payableRate != 5.0 {
		t.Fatalf("rates got win=%v payable=%v", repo.winningRate, repo.payableRate)
	}
	if repo.grossAmount != 3_000_000 || repo.netAmount != 2_850_000 {
		t.Fatalf("amount got gross=%v net=%v", repo.grossAmount, repo.netAmount)
	}
	if result["net_disbursed_amount"] != float64(2_850_000) {
		t.Fatalf("unexpected response: %#v", result)
	}
}

func TestExecuteRandomDrawUsesEligibleCandidatesAndPaidPot(t *testing.T) {
	repo := &drawRepoStub{
		info:    &repository.CircleCycleInfo{TrackType: "RANDOM_DRAW", CycleStatus: "READY_FOR_DISBURSEMENT"},
		paidPot: 2_000_000,
		candidates: []repository.ParticipantDB{
			{ParticipantID: "tiara", UserID: "user-a", Name: "Tiara"},
			{ParticipantID: "leroy", UserID: "user-b", Name: "Leroy"},
		},
	}
	result, err := NewDrawService(repo).ExecuteCycleDraw(context.Background(), "cycle", "actor")
	if err != nil {
		t.Fatal(err)
	}
	if !repo.randomExecuted || repo.randomGross != 2_000_000 {
		t.Fatalf("random draw transaction not executed correctly: %#v", repo)
	}
	if repo.randomWinner.ParticipantID != "tiara" && repo.randomWinner.ParticipantID != "leroy" {
		t.Fatalf("winner not in eligible candidates: %#v", repo.randomWinner)
	}
	if result["award_method"] != "RANDOM_DRAW" || result["net_disbursed_amount"] != float64(2_000_000) {
		t.Fatalf("unexpected result: %#v", result)
	}
}
func (s *drawRepoStub) GetCycle(context.Context, string) (*repository.CycleDB, error) {
	return nil, nil
}
func (s *drawRepoStub) GetDrawProof(context.Context, string) (*repository.DrawProofDB, error) {
	return nil, nil
}

var _ repository.DrawRepository = (*drawRepoStub)(nil)

func TestSubmitBidRules(t *testing.T) {
	floor, ceiling := 1.0, 20.0
	tests := []struct {
		name      string
		info      repository.CircleCycleInfo
		bid       float64
		wantError bool
	}{
		{"reject random draw", repository.CircleCycleInfo{TrackType: "RANDOM_DRAW", CycleStatus: "BIDDING_OPEN"}, 5, true},
		{"reject closed bidding", repository.CircleCycleInfo{TrackType: "SPSB", CycleStatus: "PAYMENT_COLLECTION", BidFloorPercent: &floor, BidCeilingPercent: &ceiling}, 5, true},
		{"reject below floor", repository.CircleCycleInfo{TrackType: "SPSB", CycleStatus: "BIDDING_OPEN", BidFloorPercent: &floor, BidCeilingPercent: &ceiling}, 0.5, true},
		{"reject above ceiling", repository.CircleCycleInfo{TrackType: "SPSB", CycleStatus: "BIDDING_OPEN", BidFloorPercent: &floor, BidCeilingPercent: &ceiling}, 25, true},
		{"accept valid bid", repository.CircleCycleInfo{TrackType: "SPSB", CycleStatus: "BIDDING_OPEN", BidFloorPercent: &floor, BidCeilingPercent: &ceiling}, 7.5, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.info.CycleStatus == "BIDDING_OPEN" && test.info.TrackType == "SPSB" {
				opened, closes := time.Now().Add(-time.Minute), time.Now().Add(time.Minute)
				test.info.BiddingOpenAt, test.info.BiddingCloseAt = &opened, &closes
			}
			repo := &drawRepoStub{info: &test.info}
			err := NewDrawService(repo).SubmitBid(context.Background(), "cycle", "user", test.bid)
			if (err != nil) != test.wantError {
				t.Fatalf("error=%v, wantError=%v", err, test.wantError)
			}
			if repo.saved == test.wantError {
				t.Fatalf("saved=%v, want saved=%v", repo.saved, !test.wantError)
			}
		})
	}
}
