package repository

import (
	"context"
	"errors"
	"fmt"

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

type DrawRepository interface {
	GetCycleParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]ParticipantDB, int64, error)
	GetEligibleParticipants(ctx context.Context, cycleID string) ([]ParticipantDB, error)
	SaveBid(ctx context.Context, cycleID, userID string, bidRate float64) error
	ExecuteDrawTransaction(ctx context.Context, cycleID string, winner ParticipantDB, awardMethod string, amount float64) (string, error)
}

type drawRepo struct {
	db *pgxpool.Pool
}

func NewDrawRepository(db *pgxpool.Pool) DrawRepository {
	return &drawRepo{db: db}
}

// 1. Get Participants dengan Pagination (Menggunakan JOIN circle_memberships & users)
func (r *drawRepo) GetCycleParticipantsPaginated(ctx context.Context, cycleID string, page, pageSize int) ([]ParticipantDB, int64, error) {
	offset := (page - 1) * pageSize

	// Count total
	var total int64
	countQuery := `SELECT COUNT(*) FROM cycle_participants WHERE cycle_id = $1`
	err := r.db.QueryRow(ctx, countQuery, cycleID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count participants: %w", err)
	}

	// Query paginated dengan DOUBLE JOIN (cycle_participants -> circle_memberships -> users)
	query := `
		SELECT 
			cp.cycle_participant_id, 
			COALESCE(cm.user_id, '00000000-0000-0000-0000-000000000000'), 
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

// 2. Ambil Partisipan ELIGIBLE yang Belum Menang
func (r *drawRepo) GetEligibleParticipants(ctx context.Context, cycleID string) ([]ParticipantDB, error) {
	query := `
		SELECT 
			cp.cycle_participant_id, 
			COALESCE(cm.user_id, '00000000-0000-0000-0000-000000000000'), 
			COALESCE(u.full_name, 'Anggota'), 
			cp.participation_status
		FROM cycle_participants cp
		LEFT JOIN circle_memberships cm ON cp.circle_membership_id = cm.circle_membership_id
		LEFT JOIN users u ON cm.user_id = u.user_id
		WHERE cp.cycle_id = $1 
		  AND cp.participation_status = 'ELIGIBLE'
		  AND cm.user_id NOT IN (
			  SELECT winner_user_id FROM cycle_awards WHERE cycle_id = $1
		  )
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

// 3. Upsert Bid Lelang SPSB (Track A)
func (r *drawRepo) SaveBid(ctx context.Context, cycleID, userID string, bidRate float64) error {
	query := `
		INSERT INTO bids (cycle_id, user_id, bid_rate_percent, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (cycle_id, user_id) 
		DO UPDATE SET bid_rate_percent = EXCLUDED.bid_rate_percent, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, cycleID, userID, bidRate)
	if err != nil {
		return fmt.Errorf("failed to save bid: %w", err)
	}
	return nil
}

// 4. TRANSACTION QUERY: Menyimpan Pemenang & Mengunci Status secara Atomis
func (r *drawRepo) ExecuteDrawTransaction(ctx context.Context, cycleID string, winner ParticipantDB, awardMethod string, amount float64) (string, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to begin db transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// A. Insert ke cycle_awards
	var awardID string
	insertAwardQuery := `
		INSERT INTO cycle_awards (cycle_id, winner_user_id, award_method, gross_amount, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		RETURNING cycle_award_id
	`
	err = tx.QueryRow(ctx, insertAwardQuery, cycleID, winner.UserID, awardMethod, amount).Scan(&awardID)
	if err != nil {
		return "", fmt.Errorf("failed to insert cycle award: %w", err)
	}

	// B. Update status partisipan menjadi WON di cycle_participants
	updateParticipantQuery := `
		UPDATE cycle_participants
		SET participation_status = 'WON', updated_at = NOW()
		WHERE cycle_participant_id = $1 AND cycle_id = $2
	`
	cmdTag, err := tx.Exec(ctx, updateParticipantQuery, winner.ParticipantID, cycleID)
	if err != nil {
		return "", fmt.Errorf("failed to update participant status: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		return "", errors.New("participant record not found or already updated")
	}

	// Commit Transaction
	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("failed to commit transaction: %w", err)
	}

	return awardID, nil
}
