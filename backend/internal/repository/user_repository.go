package repository

import (
	"context"

	"backend-arisankita/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	FindByID(ctx context.Context, userID string) (*models.User, error)
	Update(ctx context.Context, user *models.User) error
	CreateUser(ctx context.Context, email string, fullName string) (*models.User, error) // TAMBAHAN PENTING

	GetUserWalletByID(ctx context.Context, userID string) (*models.UserWallet, error)
	GetWalletTransactionsByUserID(ctx context.Context, userID string) ([]models.WalletTransaction, error)
	TopUpBalanceSandbox(ctx context.Context, userID string, amount float64) error
	CreateAuthIdentity(ctx context.Context, userID, provider, providerSubject string) error
}

type userRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) UserRepository {
	return &userRepository{db: db}
}

// Implementation CreateUser
func (r *userRepository) CreateUser(ctx context.Context, email string, fullName string) (*models.User, error) {
	var user models.User
	query := `
		INSERT INTO users (full_name, email, account_status)
		VALUES ($1, $2, 'ACTIVE')
		RETURNING user_id, full_name, email, account_status, created_at;
	`
	err := r.db.QueryRow(ctx, query, fullName, email).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.AccountStatus,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (full_name, phone_number, email, account_status)
		VALUES ($1, $2, $3, 'ACTIVE')
		RETURNING user_id, full_name, phone_number, email, account_status, created_at;
	`
	return r.db.QueryRow(ctx, query, user.FullName, user.PhoneNumber, user.Email).Scan(
		&user.UserID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.AccountStatus,
		&user.CreatedAt,
	)
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT user_id, full_name, phone_number, email, account_status, created_at
		FROM users
		WHERE LOWER(email) = LOWER($1);
	`
	var user models.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.UserID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.AccountStatus,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByID(ctx context.Context, userID string) (*models.User, error) {
	query := `
		SELECT
			u.user_id,
			u.full_name,
			u.phone_number,
			u.email,
			u.account_status,
			COALESCE(w.balance, 0.00) AS wallet_balance,
			COUNT(ca.award_id) AS total_won_count,
			COALESCE(SUM(ca.gross_amount), 0.00)::NUMERIC(18,2) AS total_amount_won
		FROM users u
		LEFT JOIN user_wallets w ON w.user_id = u.user_id
		LEFT JOIN circle_memberships cm ON cm.user_id = u.user_id
		LEFT JOIN cycle_participants cp ON cp.circle_membership_id = cm.circle_membership_id
		LEFT JOIN cycle_awards ca ON ca.cycle_participant_id = cp.cycle_participant_id
		WHERE u.user_id = $1
		GROUP BY u.user_id, u.full_name, u.phone_number, u.email, u.account_status, w.balance;
	`
	var user models.User
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&user.UserID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.AccountStatus,
		&user.WalletBalance,
		&user.TotalWonCount,
		&user.TotalAmountWon,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Update(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users
		SET full_name = $1, phone_number = $2, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $3
		RETURNING updated_at;
	`
	return r.db.QueryRow(ctx, query, user.FullName, user.PhoneNumber, user.UserID).Scan(&user.UpdatedAt)
}

func (r *userRepository) GetUserWalletByID(ctx context.Context, userID string) (*models.UserWallet, error) {
	query := `
		SELECT wallet_id, user_id, balance, created_at, updated_at
		FROM user_wallets
		WHERE user_id = $1;
	`
	var wallet models.UserWallet
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&wallet.WalletID,
		&wallet.UserID,
		&wallet.Balance,
		&wallet.CreatedAt,
		&wallet.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &wallet, nil
}

func (r *userRepository) GetWalletTransactionsByUserID(ctx context.Context, userID string) ([]models.WalletTransaction, error) {
	query := `
		SELECT 
			wt.wallet_tx_id,
			wt.wallet_id,
			wt.amount, 
			wt.tx_type, 
			wt.reference_id, 
			wt.description, 
			wt.created_at
		FROM wallet_transactions wt
		JOIN user_wallets uw ON uw.wallet_id = wt.wallet_id
		WHERE uw.user_id = $1
		ORDER BY wt.created_at DESC;
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.WalletTransaction
	for rows.Next() {
		var tx models.WalletTransaction
		err := rows.Scan(
			&tx.WalletTxID,
			&tx.WalletID,
			&tx.Amount,
			&tx.TxType,
			&tx.ReferenceID,
			&tx.Description,
			&tx.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, tx)
	}
	return transactions, nil
}

func (r *userRepository) TopUpBalanceSandbox(ctx context.Context, userID string, amount float64) error {
	query := `
		UPDATE user_wallets 
		SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP 
		WHERE user_id = $2;
	`
	_, err := r.db.Exec(ctx, query, amount, userID)
	return err
}

func (r *userRepository) CreateAuthIdentity(ctx context.Context, userID, provider, providerSubject string) error {
	query := `
		INSERT INTO user_auth_identities (user_id, provider, provider_subject)
		VALUES ($1, $2, $3)
		ON CONFLICT (provider, provider_subject) DO NOTHING;
	`
	_, err := r.db.Exec(ctx, query, userID, provider, providerSubject)
	return err
}
