package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ParticipantDB struct {
	ParticipantID string `json:"participant_id"`
	UserID        string `json:"user_id"`
	Name          string `json:"name"`
	Initials      string `json:"initials"`
	Status        string `json:"status"`
}

type CircleCycleInfo struct {
	CircleID           string     `json:"circle_id"`
	CircleName         string     `json:"circle_name"`
	TrackType          string     `json:"track_type"`
	ContributionAmount float64    `json:"contribution_amount"`
	MemberLimit        int        `json:"member_limit"`
	BidFloorPercent    *float64   `json:"bid_floor_percent"`
	BidCeilingPercent  *float64   `json:"bid_ceiling_percent"`
	CycleNumber        int        `json:"cycle_number"`
	CycleStatus        string     `json:"cycle_status"`
	BiddingOpenAt      *time.Time `json:"bidding_open_at"`
	BiddingCloseAt     *time.Time `json:"bidding_close_at"`
}

type BidEntry struct {
	ParticipantID  string  `json:"participant_id"`
	UserID         string  `json:"user_id"`
	FullName       string  `json:"full_name"`
	BidRatePercent float64 `json:"bid_rate_percent"`
}

type ObligationDB struct {
	ObligationID  string    `json:"obligation_id"`
	ParticipantID string    `json:"participant_id"`
	UserID        string    `json:"user_id"`
	FullName      string    `json:"full_name"`
	AmountDue     float64   `json:"amount_due"`
	DueAt         time.Time `json:"due_at"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type AwardDB struct {
	AwardID        string    `json:"award_id"`
	CycleID        string    `json:"cycle_id"`
	ParticipantID  string    `json:"participant_id"`
	WinnerUserID   string    `json:"winner_user_id"`
	WinnerName     string    `json:"winner_name"`
	AwardMethod    string    `json:"award_method"`
	GrossAmount    float64   `json:"gross_amount"`
	WinningBidRate *float64  `json:"winning_bid_rate_percent,omitempty"`
	PayableBidRate *float64  `json:"payable_bid_rate_percent,omitempty"`
	DecisionHash   string    `json:"decision_hash"`
	DecidedAt      time.Time `json:"decided_at"`
}

type DrawProofDB struct {
	AwardID                 string    `json:"award_id"`
	CycleID                 string    `json:"cycle_id"`
	RandomSeedCommitment    string    `json:"random_seed_commitment"`
	RandomSeedReveal        *string   `json:"random_seed_reveal,omitempty"`
	ParticipantSnapshotHash *string   `json:"participant_snapshot_hash,omitempty"`
	AlgorithmVersion        string    `json:"algorithm_version"`
	RandomSource            string    `json:"random_source"`
	ParticipantCount        int       `json:"participant_count"`
	DrawnAt                 time.Time `json:"drawn_at"`
}

type CycleDB struct {
	CycleID        string     `json:"cycle_id"`
	CircleID       string     `json:"circle_id"`
	CycleNumber    int        `json:"cycle_number"`
	CycleStatus    string     `json:"cycle_status"`
	DueAt          time.Time  `json:"due_at"`
	BiddingOpenAt  *time.Time `json:"bidding_open_at,omitempty"`
	BiddingCloseAt *time.Time `json:"bidding_close_at,omitempty"`
}

type DrawRepository interface {
	GetCycleParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]ParticipantDB, int64, error)
	GetEligibleParticipants(ctx context.Context, cycleID string) ([]ParticipantDB, error)
	GetCircleInfoByCycle(ctx context.Context, cycleID string) (*CircleCycleInfo, error)
	GetActiveBidsByCycle(ctx context.Context, cycleID string) ([]BidEntry, error)
	GetUserBid(ctx context.Context, cycleID, userID string) (*BidEntry, error)
	SaveBid(ctx context.Context, cycleID, userID string, bidRate float64) error
	ExecuteSPSBDrawTransaction(ctx context.Context, cycleID string, winner BidEntry, winningRate, payableRate, grossAmount, netAmount float64, decisionHash string) (string, error)
	ExecuteRandomDrawTransaction(ctx context.Context, cycleID string, winner ParticipantDB, grossAmount float64, decisionHash, seedCommitment, seedReveal, snapshotHash string, participantCount int) (string, error)
	GetCycleObligations(ctx context.Context, cycleID string, limit int, cursorTime *time.Time, cursorID string) ([]ObligationDB, error)
	GetCycleAward(ctx context.Context, cycleID string) (*AwardDB, error)
	OpenCycleWithParticipantsAndObligations(ctx context.Context, circleID string, cycleNumber int, dueAt time.Time) (string, error)
	GetPaidPot(ctx context.Context, cycleID string) (float64, error)
	CloseBidding(ctx context.Context, cycleID string) error
	GetCyclesByCircle(ctx context.Context, circleID string, limit, cursor int) ([]CycleDB, error)
	GetCycle(ctx context.Context, cycleID string) (*CycleDB, error)
	GetDrawProof(ctx context.Context, cycleID string) (*DrawProofDB, error)
}

type drawRepo struct {
	db *pgxpool.Pool
}

func NewDrawRepository(db *pgxpool.Pool) DrawRepository {
	return &drawRepo{db: db}
}

func (r *drawRepo) GetCycleParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]ParticipantDB, int64, error) {
	offset := (page - 1) * pageSize

	var total int64
	countQuery := `SELECT COUNT(*) FROM cycle_participants WHERE cycle_id = $1`
	err := r.db.QueryRow(ctx, countQuery, cycleID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count participants: %w", err)
	}

	query := `
		SELECT
			cp.cycle_participant_id,
			COALESCE(cm.user_id::text, '00000000-0000-0000-0000-000000000000'),
			COALESCE(u.full_name, 'Anggota'),
			cp.participation_status
		FROM cycle_participants cp
		LEFT JOIN circle_memberships cm ON cp.circle_membership_id = cm.circle_membership_id
		LEFT JOIN users u ON cm.user_id = u.user_id
		WHERE cp.cycle_id = $1
		ORDER BY cp.created_at ASC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(ctx, query, cycleID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch paginated participants: %w", err)
	}
	defer rows.Close()

	var list []ParticipantDB
	for rows.Next() {
		var p ParticipantDB
		var fullName string
		if err := rows.Scan(&p.ParticipantID, &p.UserID, &fullName, &p.Status); err != nil {
			return nil, 0, err
		}
		p.Name = fullName
		if len(fullName) >= 2 {
			p.Initials = string(fullName[0]) + string(fullName[1])
		} else {
			p.Initials = fullName
		}
		list = append(list, p)
	}

	return list, total, nil
}

func (r *drawRepo) GetEligibleParticipants(ctx context.Context, cycleID string) ([]ParticipantDB, error) {
	query := `
		SELECT
			cp.cycle_participant_id,
			COALESCE(cm.user_id::text, '00000000-0000-0000-0000-000000000000'),
			COALESCE(u.full_name, 'Anggota'),
			cp.participation_status
		FROM cycle_participants cp
		JOIN circle_memberships cm ON cp.circle_membership_id = cm.circle_membership_id
		JOIN users u ON cm.user_id = u.user_id
		JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
		WHERE cp.cycle_id = $1
		  AND cp.participation_status = 'ELIGIBLE'
		  AND cm.user_id NOT IN (
			  SELECT cm2.user_id
			  FROM cycle_awards ca
			  JOIN cycle_participants cp2 ON cp2.cycle_participant_id = ca.cycle_participant_id
			  JOIN circle_memberships cm2 ON cm2.circle_membership_id = cp2.circle_membership_id
			  JOIN arisan_cycles ac2 ON ac2.cycle_id = ca.cycle_id
			  WHERE ac2.circle_id = ac.circle_id
		  );
	`
	rows, err := r.db.Query(ctx, query, cycleID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch eligible participants: %w", err)
	}
	defer rows.Close()

	var list []ParticipantDB
	for rows.Next() {
		var p ParticipantDB
		var fullName string
		if err := rows.Scan(&p.ParticipantID, &p.UserID, &fullName, &p.Status); err != nil {
			return nil, err
		}
		p.Name = fullName
		if len(fullName) >= 2 {
			p.Initials = string(fullName[0]) + string(fullName[1])
		} else {
			p.Initials = fullName
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *drawRepo) GetCircleInfoByCycle(ctx context.Context, cycleID string) (*CircleCycleInfo, error) {
	query := `
		SELECT
			c.circle_id::text,
			c.circle_name,
			c.track_type,
			c.contribution_amount,
			c.member_limit,
			c.bid_floor_percent,
			c.bid_ceiling_percent,
			ac.cycle_number,
			ac.cycle_status,
			ac.bidding_open_at,
			ac.bidding_close_at
		FROM arisan_cycles ac
		JOIN circles c ON c.circle_id = ac.circle_id
		WHERE ac.cycle_id = $1;
	`
	var info CircleCycleInfo
	err := r.db.QueryRow(ctx, query, cycleID).Scan(
		&info.CircleID,
		&info.CircleName,
		&info.TrackType,
		&info.ContributionAmount,
		&info.MemberLimit,
		&info.BidFloorPercent,
		&info.BidCeilingPercent,
		&info.CycleNumber,
		&info.CycleStatus,
		&info.BiddingOpenAt,
		&info.BiddingCloseAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("siklus arisan tidak ditemukan")
		}
		return nil, fmt.Errorf("failed to get circle info: %w", err)
	}
	return &info, nil
}

func (r *drawRepo) SaveBid(ctx context.Context, cycleID, userID string, bidRate float64) error {
	findParticipantQuery := `
		SELECT cp.cycle_participant_id
		FROM cycle_participants cp
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		WHERE cp.cycle_id = $1 AND cm.user_id = $2 AND cp.participation_status = 'ELIGIBLE';
	`
	var participantID string
	err := r.db.QueryRow(ctx, findParticipantQuery, cycleID, userID).Scan(&participantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("pengguna bukan merupakan partisipan aktif atau belum berhak mengajukan bid pada siklus ini")
		}
		return fmt.Errorf("failed to lookup participant: %w", err)
	}

	query := `
		INSERT INTO bids (cycle_participant_id, bid_rate_percent, bid_status, submitted_at)
		VALUES ($1, $2, 'ACTIVE', NOW())
		ON CONFLICT (cycle_participant_id)
		DO UPDATE SET bid_rate_percent = EXCLUDED.bid_rate_percent, submitted_at = NOW();
	`
	_, err = r.db.Exec(ctx, query, participantID, bidRate)
	if err != nil {
		return fmt.Errorf("failed to save bid: %w", err)
	}
	return nil
}

func (r *drawRepo) GetActiveBidsByCycle(ctx context.Context, cycleID string) ([]BidEntry, error) {
	query := `
		SELECT
			cp.cycle_participant_id::text,
			cm.user_id::text,
			u.full_name,
			b.bid_rate_percent
		FROM bids b
		JOIN cycle_participants cp ON cp.cycle_participant_id = b.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		JOIN users u ON u.user_id = cm.user_id
		WHERE cp.cycle_id = $1 AND b.bid_status = 'ACTIVE'
		ORDER BY b.bid_rate_percent DESC, b.submitted_at ASC, b.bid_id ASC
		LIMIT 2;
	`
	rows, err := r.db.Query(ctx, query, cycleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active bids: %w", err)
	}
	defer rows.Close()

	var bids []BidEntry
	for rows.Next() {
		var b BidEntry
		if err := rows.Scan(&b.ParticipantID, &b.UserID, &b.FullName, &b.BidRatePercent); err != nil {
			return nil, err
		}
		bids = append(bids, b)
	}
	return bids, nil
}

func (r *drawRepo) GetUserBid(ctx context.Context, cycleID, userID string) (*BidEntry, error) {
	var bid BidEntry
	err := r.db.QueryRow(ctx, `SELECT cp.cycle_participant_id::text,cm.user_id::text,u.full_name,b.bid_rate_percent::float8 FROM bids b JOIN cycle_participants cp ON cp.cycle_participant_id=b.cycle_participant_id JOIN circle_memberships cm ON cm.circle_membership_id=cp.circle_membership_id JOIN users u ON u.user_id=cm.user_id WHERE cp.cycle_id=$1 AND cm.user_id=$2 AND b.bid_status='ACTIVE'`, cycleID, userID).Scan(&bid.ParticipantID, &bid.UserID, &bid.FullName, &bid.BidRatePercent)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &bid, nil
}

func (r *drawRepo) ExecuteSPSBDrawTransaction(
	ctx context.Context,
	cycleID string,
	winner BidEntry,
	winningRate, payableRate, grossAmount, netAmount float64,
	decisionHash string,
) (string, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var awardID string
	insertAwardQuery := `
		INSERT INTO cycle_awards (
			cycle_id, cycle_participant_id, award_method, gross_amount,
			penalty_amount, net_award_amount, winning_bid_rate_percent, payable_bid_rate_percent, decision_hash, decided_at
		)
		VALUES ($1, $2, 'SPSB', $3, $4, $5, $6, $7, $8, NOW())
		RETURNING award_id::text;
	`
	err = tx.QueryRow(ctx, insertAwardQuery, cycleID, winner.ParticipantID, grossAmount, grossAmount-netAmount, netAmount, winningRate, payableRate, decisionHash).Scan(&awardID)
	if err != nil {
		return "", fmt.Errorf("failed to insert cycle award: %w", err)
	}

	insertDisbursementQuery := `
		INSERT INTO disbursements (
			award_id, provider, requested_amount, platform_fee_amount, net_amount, disbursement_status, requested_at, completed_at
		)
		VALUES ($1, 'IN_APP_WALLET', $2, 0.00, $3, 'PAID', NOW(), NOW());
	`
	if _, err := tx.Exec(ctx, insertDisbursementQuery, awardID, grossAmount, netAmount); err != nil {
		return "", fmt.Errorf("failed to record disbursement: %w", err)
	}

	updateWalletQuery := `
		UPDATE user_wallets
		SET balance = balance + $1, updated_at = NOW()
		WHERE user_id = $2;
	`
	if _, err := tx.Exec(ctx, updateWalletQuery, netAmount, winner.UserID); err != nil {
		return "", fmt.Errorf("failed to credit winner wallet: %w", err)
	}

	insertTxQuery := `
		INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description, created_at)
		SELECT wallet_id, $1, 'DISBURSEMENT', $2, 'Pemenang Arisan Lelang SPSB (Vickrey)', NOW()
		FROM user_wallets WHERE user_id = $3;
	`
	if _, err := tx.Exec(ctx, insertTxQuery, netAmount, awardID, winner.UserID); err != nil {
		return "", fmt.Errorf("failed to record ledger transaction: %w", err)
	}

	updateCycleQuery := `
		UPDATE arisan_cycles
		SET cycle_status = 'COMPLETED'
		WHERE cycle_id = $1;
	`
	if _, err := tx.Exec(ctx, updateCycleQuery, cycleID); err != nil {
		return "", fmt.Errorf("failed to complete cycle: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("failed to commit SPSB transaction: %w", err)
	}

	return awardID, nil
}

func (r *drawRepo) ExecuteRandomDrawTransaction(
	ctx context.Context,
	cycleID string,
	winner ParticipantDB,
	grossAmount float64,
	decisionHash, seedCommitment, seedReveal, snapshotHash string, participantCount int,
) (string, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var awardID string
	insertAwardQuery := `
		INSERT INTO cycle_awards (
			cycle_id, cycle_participant_id, award_method, gross_amount,
			penalty_amount, net_award_amount, decision_hash, decided_at
		)
		VALUES ($1, $2, 'RANDOM_DRAW', $3, 0, $3, $4, NOW())
		RETURNING award_id::text;
	`
	err = tx.QueryRow(ctx, insertAwardQuery, cycleID, winner.ParticipantID, grossAmount, decisionHash).Scan(&awardID)
	if err != nil {
		return "", fmt.Errorf("failed to insert cycle award: %w", err)
	}

	insertDrawResultQuery := `
		INSERT INTO draw_results (
			award_id, random_seed_commitment, random_seed_reveal, participant_snapshot_hash, algorithm_version, random_source, participant_count, drawn_at
		)
		VALUES ($1, $2, $3, $4, 'SHA256_MOD_V1', 'CRYPTO_SECURE_RANDOM', $5, NOW());
	`
	if _, err := tx.Exec(ctx, insertDrawResultQuery, awardID, seedCommitment, seedReveal, snapshotHash, participantCount); err != nil {
		return "", fmt.Errorf("failed to record draw result audit: %w", err)
	}

	insertDisbursementQuery := `
		INSERT INTO disbursements (
			award_id, provider, requested_amount, platform_fee_amount, net_amount, disbursement_status, requested_at, completed_at
		)
		VALUES ($1, 'IN_APP_WALLET', $2, 0.00, $2, 'PAID', NOW(), NOW());
	`
	if _, err := tx.Exec(ctx, insertDisbursementQuery, awardID, grossAmount); err != nil {
		return "", fmt.Errorf("failed to record disbursement: %w", err)
	}

	updateWalletQuery := `
		UPDATE user_wallets
		SET balance = balance + $1, updated_at = NOW()
		WHERE user_id = $2;
	`
	if _, err := tx.Exec(ctx, updateWalletQuery, grossAmount, winner.UserID); err != nil {
		return "", fmt.Errorf("failed to credit winner wallet: %w", err)
	}

	insertTxQuery := `
		INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description, created_at)
		SELECT wallet_id, $1, 'DISBURSEMENT', $2, 'Pemenang Kocokan Arisan Acak (Random Draw)', NOW()
		FROM user_wallets WHERE user_id = $3;
	`
	if _, err := tx.Exec(ctx, insertTxQuery, grossAmount, awardID, winner.UserID); err != nil {
		return "", fmt.Errorf("failed to record ledger transaction: %w", err)
	}

	updateCycleQuery := `
		UPDATE arisan_cycles
		SET cycle_status = 'COMPLETED'
		WHERE cycle_id = $1;
	`
	if _, err := tx.Exec(ctx, updateCycleQuery, cycleID); err != nil {
		return "", fmt.Errorf("failed to complete cycle: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("failed to commit Random Draw transaction: %w", err)
	}

	return awardID, nil
}

func (r *drawRepo) GetPaidPot(ctx context.Context, cycleID string) (float64, error) {
	var amount float64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(co.amount_due), 0)::float8
		FROM cycle_obligations co
		JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
		WHERE cp.cycle_id = $1 AND co.obligation_status = 'PAID'`, cycleID).Scan(&amount)
	return amount, err
}

func (r *drawRepo) CloseBidding(ctx context.Context, cycleID string) error {
	command, err := r.db.Exec(ctx, `
		UPDATE arisan_cycles
		SET cycle_status = 'READY_FOR_DISBURSEMENT'
		WHERE cycle_id = $1
		  AND cycle_status = 'BIDDING_OPEN'`, cycleID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return errors.New("bidding belum dapat ditutup atau siklus tidak ditemukan")
	}
	return nil
}

func (r *drawRepo) GetCyclesByCircle(ctx context.Context, circleID string, limit, cursor int) ([]CycleDB, error) {
	rows, err := r.db.Query(ctx, `SELECT cycle_id::text,circle_id::text,cycle_number,cycle_status,due_at,bidding_open_at,bidding_close_at FROM arisan_cycles WHERE circle_id=$1 AND ($2=0 OR cycle_number < $2) ORDER BY cycle_number DESC LIMIT $3`, circleID, cursor, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]CycleDB, 0)
	for rows.Next() {
		var item CycleDB
		if err := rows.Scan(&item.CycleID, &item.CircleID, &item.CycleNumber, &item.CycleStatus, &item.DueAt, &item.BiddingOpenAt, &item.BiddingCloseAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *drawRepo) GetCycle(ctx context.Context, cycleID string) (*CycleDB, error) {
	var item CycleDB
	err := r.db.QueryRow(ctx, `SELECT cycle_id::text,circle_id::text,cycle_number,cycle_status,due_at,bidding_open_at,bidding_close_at FROM arisan_cycles WHERE cycle_id=$1`, cycleID).Scan(&item.CycleID, &item.CircleID, &item.CycleNumber, &item.CycleStatus, &item.DueAt, &item.BiddingOpenAt, &item.BiddingCloseAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *drawRepo) GetDrawProof(ctx context.Context, cycleID string) (*DrawProofDB, error) {
	var proof DrawProofDB
	err := r.db.QueryRow(ctx, `
		SELECT ca.award_id::text,ca.cycle_id::text,dr.random_seed_commitment,dr.random_seed_reveal,
			dr.participant_snapshot_hash,dr.algorithm_version,dr.random_source,dr.participant_count,dr.drawn_at
		FROM cycle_awards ca JOIN draw_results dr ON dr.award_id=ca.award_id
		WHERE ca.cycle_id=$1 AND ca.award_method='RANDOM_DRAW'`, cycleID).Scan(
		&proof.AwardID, &proof.CycleID, &proof.RandomSeedCommitment, &proof.RandomSeedReveal,
		&proof.ParticipantSnapshotHash, &proof.AlgorithmVersion, &proof.RandomSource, &proof.ParticipantCount, &proof.DrawnAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &proof, nil
}

func (r *drawRepo) GetCycleObligations(ctx context.Context, cycleID string, limit int, cursorTime *time.Time, cursorID string) ([]ObligationDB, error) {
	query := `
		SELECT
			co.obligation_id::text,
			co.cycle_participant_id::text,
			COALESCE(cm.user_id::text, '00000000-0000-0000-0000-000000000000'),
			COALESCE(u.full_name, 'Anggota'),
			co.amount_due,
			co.due_at,
			co.obligation_status,
			co.created_at
		FROM cycle_obligations co
		JOIN cycle_participants cp ON cp.cycle_participant_id = co.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		JOIN users u ON u.user_id = cm.user_id
		WHERE cp.cycle_id = $1
		  AND ($2::timestamptz IS NULL OR (co.created_at,co.obligation_id) > ($2::timestamptz,$3::uuid))
		ORDER BY co.created_at ASC, co.obligation_id ASC
		LIMIT $4;
	`
	var nullableCursor any
	if cursorID != "" {
		nullableCursor = cursorID
	}
	rows, err := r.db.Query(ctx, query, cycleID, cursorTime, nullableCursor, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get obligations: %w", err)
	}
	defer rows.Close()

	var list []ObligationDB
	for rows.Next() {
		var o ObligationDB
		if err := rows.Scan(&o.ObligationID, &o.ParticipantID, &o.UserID, &o.FullName, &o.AmountDue, &o.DueAt, &o.Status, &o.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, nil
}

func (r *drawRepo) GetCycleAward(ctx context.Context, cycleID string) (*AwardDB, error) {
	query := `
		SELECT
			ca.award_id::text,
			ca.cycle_id::text,
			ca.cycle_participant_id::text,
			cm.user_id::text,
			u.full_name,
			ca.award_method,
			ca.gross_amount,
			ca.winning_bid_rate_percent,
			ca.payable_bid_rate_percent,
			ca.decision_hash,
			ca.decided_at
		FROM cycle_awards ca
		JOIN cycle_participants cp ON cp.cycle_participant_id = ca.cycle_participant_id
		JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
		JOIN users u ON u.user_id = cm.user_id
		WHERE ca.cycle_id = $1;
	`
	var a AwardDB
	err := r.db.QueryRow(ctx, query, cycleID).Scan(
		&a.AwardID,
		&a.CycleID,
		&a.ParticipantID,
		&a.WinnerUserID,
		&a.WinnerName,
		&a.AwardMethod,
		&a.GrossAmount,
		&a.WinningBidRate,
		&a.PayableBidRate,
		&a.DecisionHash,
		&a.DecidedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get award: %w", err)
	}
	return &a, nil
}

func (r *drawRepo) OpenCycleWithParticipantsAndObligations(ctx context.Context, circleID string, cycleNumber int, dueAt time.Time) (string, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	var circleStatus string
	var expectedCycleNumber int
	err = tx.QueryRow(ctx, `
		SELECT c.circle_status,
			(SELECT COALESCE(MAX(ac.cycle_number), 0) + 1 FROM arisan_cycles ac WHERE ac.circle_id=c.circle_id)
		FROM circles c
		WHERE c.circle_id=$1
		FOR UPDATE`, circleID).Scan(&circleStatus, &expectedCycleNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New("circle tidak ditemukan")
	}
	if err != nil {
		return "", fmt.Errorf("failed to lock circle: %w", err)
	}
	if circleStatus != "LOCKED" && circleStatus != "RUNNING" {
		return "", errors.New("circle harus LOCKED atau RUNNING sebelum cycle dibuat")
	}
	if cycleNumber != expectedCycleNumber {
		return "", fmt.Errorf("cycle_number harus %d", expectedCycleNumber)
	}

	var cycleID string
	insertCycleQuery := `
		INSERT INTO arisan_cycles (circle_id, cycle_number, cycle_status, due_at)
		VALUES ($1, $2, 'PAYMENT_COLLECTION', $3)
		RETURNING cycle_id::text;
	`
	err = tx.QueryRow(ctx, insertCycleQuery, circleID, cycleNumber, dueAt).Scan(&cycleID)
	if err != nil {
		return "", fmt.Errorf("failed to create cycle: %w", err)
	}

	insertParticipantsQuery := `
		INSERT INTO cycle_participants (cycle_id, circle_membership_id, participation_status)
		SELECT $1, cm.circle_membership_id,
			CASE WHEN EXISTS (
				SELECT 1 FROM cycle_awards ca
				JOIN cycle_participants previous_cp ON previous_cp.cycle_participant_id = ca.cycle_participant_id
				JOIN circle_memberships previous_cm ON previous_cm.circle_membership_id = previous_cp.circle_membership_id
				JOIN arisan_cycles previous_cycle ON previous_cycle.cycle_id = ca.cycle_id
				WHERE previous_cycle.circle_id = $2 AND previous_cm.user_id = cm.user_id
			) THEN 'EXCLUDED' ELSE 'ELIGIBLE' END
		FROM circle_memberships cm
		WHERE cm.circle_id = $2 AND cm.membership_status = 'ACTIVE'
		ON CONFLICT (cycle_id, circle_membership_id) DO NOTHING;
	`
	if _, err := tx.Exec(ctx, insertParticipantsQuery, cycleID, circleID); err != nil {
		return "", fmt.Errorf("failed to populate cycle participants: %w", err)
	}

	insertObligationsQuery := `
		INSERT INTO cycle_obligations (cycle_participant_id, amount_due, due_at, obligation_status)
		SELECT cp.cycle_participant_id, c.contribution_amount, $2, 'UNPAID'
		FROM cycle_participants cp
		JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
		JOIN circles c ON c.circle_id = ac.circle_id
		WHERE cp.cycle_id = $1
		ON CONFLICT (cycle_participant_id) DO NOTHING;
	`
	if _, err := tx.Exec(ctx, insertObligationsQuery, cycleID, dueAt); err != nil {
		return "", fmt.Errorf("failed to generate cycle obligations: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE circles SET circle_status='RUNNING' WHERE circle_id=$1 AND circle_status='LOCKED'`, circleID); err != nil {
		return "", fmt.Errorf("failed to start circle: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("failed to commit cycle initialization: %w", err)
	}

	return cycleID, nil
}
