package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"backend-arisankita/internal/repository"
)

type drawRepoStub struct {
	info  *repository.CircleCycleInfo
	saved bool
}

func (s *drawRepoStub) GetCycleParticipantsPaginated(context.Context, string, int, int) ([]repository.ParticipantDB, int64, error) {
	return nil, 0, nil
}
func (s *drawRepoStub) GetEligibleParticipants(context.Context, string) ([]repository.ParticipantDB, error) {
	return nil, nil
}
func (s *drawRepoStub) GetCircleInfoByCycle(context.Context, string) (*repository.CircleCycleInfo, error) {
	return s.info, nil
}
func (s *drawRepoStub) GetActiveBidsByCycle(context.Context, string) ([]repository.BidEntry, error) {
	return nil, nil
}
func (s *drawRepoStub) SaveBid(context.Context, string, string, float64) error {
	s.saved = true
	return nil
}
func (s *drawRepoStub) ExecuteSPSBDrawTransaction(context.Context, string, repository.BidEntry, float64, float64, float64, float64, string) (string, error) {
	return "", errors.New("not used")
}
func (s *drawRepoStub) ExecuteRandomDrawTransaction(context.Context, string, repository.ParticipantDB, float64, string, string, string, string, int) (string, error) {
	return "", errors.New("not used")
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
func (s *drawRepoStub) GetPaidPot(context.Context, string) (float64, error) { return 0, nil }
func (s *drawRepoStub) CloseBidding(context.Context, string) error          { return nil }
func (s *drawRepoStub) GetCyclesByCircle(context.Context, string, int, int) ([]repository.CycleDB, error) {
	return nil, nil
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
