-- ============================================================================
-- ArisanKita Query Contract Reference v2
-- Parameter kompatibel pgx ($1, $2, $3, ...)
-- Dikelompokkan per Track Tanggung Jawab Tim
-- ============================================================================

-- ============================================================================
-- TRACK 1: USER, AUTH & IN-APP WALLET (Porsi Anggota Awam)
-- ============================================================================

-- 1.1 Registrasi User Baru
-- $1: full_name, $2: phone_number, $3: email
INSERT INTO users (full_name, phone_number, email, account_status)
VALUES ($1, $2, $3, 'ACTIVE')
RETURNING user_id, full_name, phone_number, email, account_status, created_at;

-- 1.2 Catat Provider Auth Identity
-- $1: user_id, $2: provider ('PHONE_OTP', 'GOOGLE'), $3: provider_subject
INSERT INTO user_auth_identities (user_id, provider, provider_subject)
VALUES ($1, $2, $3)
ON CONFLICT (provider, provider_subject) DO NOTHING;

-- 1.3 Ambil Profil User Lengkap & Ringkasan Kemenangan (GET /api/v1/users/me)
-- $1: user_id
SELECT
    u.user_id,
    u.full_name,
    u.phone_number,
    u.email,
    u.account_status,
    w.balance AS wallet_balance,
    COUNT(ca.award_id) AS total_won_count,
    COALESCE(SUM(ca.gross_amount), 0.00)::NUMERIC(18,2) AS total_amount_won
FROM users u
LEFT JOIN user_wallets w ON w.user_id = u.user_id
LEFT JOIN circle_memberships cm ON cm.user_id = u.user_id
LEFT JOIN cycle_participants cp ON cp.circle_membership_id = cm.circle_membership_id
LEFT JOIN cycle_awards ca ON ca.cycle_participant_id = cp.cycle_participant_id
WHERE u.user_id = $1
GROUP BY u.user_id, u.full_name, u.phone_number, u.email, u.account_status, w.balance;

-- 1.4 Ambil Detail Riwayat Menang Arisan (GET /api/v1/users/me/win-history)
-- $1: user_id
SELECT
    ca.award_id,
    c.circle_id,
    c.circle_name,
    ac.cycle_number,
    ca.award_method,
    ca.gross_amount,
    ca.winning_bid_rate_percent,
    ca.payable_bid_rate_percent,
    ca.decided_at AS won_at
FROM cycle_awards ca
JOIN cycle_participants cp ON cp.cycle_participant_id = ca.cycle_participant_id
JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
JOIN circles c ON c.circle_id = cm.circle_id
JOIN arisan_cycles ac ON ac.cycle_id = ca.cycle_id
WHERE cm.user_id = $1
ORDER BY ca.decided_at DESC;

-- 1.5 Cek Saldo Dompet In-App (GET /api/v1/wallet)
-- $1: user_id
SELECT wallet_id, user_id, balance, updated_at
FROM user_wallets
WHERE user_id = $1;

-- 1.6 Ambil Riwayat Mutasi Dompet (GET /api/v1/wallet/transactions)
-- $1: user_id
SELECT
    wt.wallet_tx_id,
    wt.amount,
    wt.tx_type,
    wt.reference_id,
    wt.description,
    wt.created_at
FROM wallet_transactions wt
JOIN user_wallets uw ON uw.wallet_id = wt.wallet_id
WHERE uw.user_id = $1
ORDER BY wt.created_at DESC;

-- 1.7 Sandbox Top-Up Dompet (POST /api/v1/wallet/topup)
-- Jalankan dalam transaksi:
-- $1: user_id, $2: amount_to_add
UPDATE user_wallets
SET balance = balance + $2, updated_at = CURRENT_TIMESTAMP
WHERE user_id = $1
RETURNING wallet_id, balance;

-- Tambah baris transaksi mutasi top-up:
-- $1: wallet_id, $2: amount, $3: description
INSERT INTO wallet_transactions (wallet_id, amount, tx_type, description)
VALUES ($1, $2, 'TOPUP', $3);


-- ============================================================================
-- TRACK 2: CIRCLE HUB, MEMBERSHIP & UNDANGAN (Porsi Anggota 2)
-- ============================================================================

-- 2.1 Buat Circle Baru (POST /api/v1/circles)
-- $1: circle_name, $2: created_by_user_id, $3: track_type, $4: contribution_amount,
-- $5: member_limit, $6: period_type, $7: bid_floor_percent, $8: bid_ceiling_percent
INSERT INTO circles (
    circle_name, created_by_user_id, circle_status, track_type,
    contribution_amount, member_limit, period_type,
    bid_floor_percent, bid_ceiling_percent, starts_at
)
VALUES ($1, $2, 'RECRUITING', $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
RETURNING circle_id, circle_name, track_type, contribution_amount, member_limit, circle_status;

-- 2.2 Otomatis Set Pembuat Circle sebagai OWNER
-- $1: circle_id, $2: user_id
INSERT INTO circle_memberships (circle_id, user_id, membership_role, membership_status, joined_at)
VALUES ($1, $2, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT (circle_id, user_id) DO NOTHING;

-- 2.3 Buat Kode Undangan Baru (POST /api/v1/circles/:id/invitations)
-- $1: circle_id, $2: invited_by_user_id, $3: invite_code
INSERT INTO circle_invitations (circle_id, invited_by_user_id, invite_code, invite_code_hash, invitation_status, expires_at)
VALUES ($1, $2, $3, encode(digest($3, 'sha256'), 'hex'), 'ACTIVE', CURRENT_TIMESTAMP + INTERVAL '14 days')
RETURNING invitation_id, circle_id, invite_code, expires_at;

-- 2.4 Cari Circle Berdasarkan Kode Undangan (POST /api/v1/circles/join)
-- $1: invite_code
SELECT ci.invitation_id, ci.circle_id, c.circle_name, c.member_limit, c.circle_status,
       (SELECT COUNT(*) FROM circle_memberships cm WHERE cm.circle_id = c.circle_id AND cm.membership_status = 'ACTIVE') AS current_members
FROM circle_invitations ci
JOIN circles c ON c.circle_id = ci.circle_id
WHERE ci.invite_code = $1 AND ci.invitation_status = 'ACTIVE' AND ci.expires_at > CURRENT_TIMESTAMP;

-- 2.5 Masukkan User Menjadi MEMBER saat Join Berhasil
-- $1: circle_id, $2: user_id
INSERT INTO circle_memberships (circle_id, user_id, membership_role, membership_status, joined_at)
VALUES ($1, $2, 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
RETURNING circle_membership_id, circle_id, user_id, membership_role, membership_status;

-- 2.6 List Anggota Circle (GET /api/v1/circles/:id/members)
-- $1: circle_id
SELECT
    cm.circle_membership_id,
    u.user_id,
    u.full_name,
    u.phone_number,
    cm.membership_role,
    cm.membership_status,
    cm.joined_at
FROM circle_memberships cm
JOIN users u ON u.user_id = cm.user_id
WHERE cm.circle_id = $1 AND cm.membership_status = 'ACTIVE'
ORDER BY cm.joined_at ASC;


-- ============================================================================
-- TRACK 3: ARISAN ENGINE, SIKLUS & PEMBAYARAN (Porsi Lead / Lu)
-- ============================================================================

-- 3.1 Buka Siklus Baru (POST /api/v1/circles/:id/cycles)
-- $1: circle_id, $2: cycle_number, $3: due_at
INSERT INTO arisan_cycles (circle_id, cycle_number, cycle_status, due_at)
VALUES ($1, $2, 'PAYMENT_COLLECTION', $3)
RETURNING cycle_id, circle_id, cycle_number, cycle_status, due_at;

-- 3.2 Auto-Populate Anggota Circle menjadi Snapshot Peserta Siklus
-- $1: cycle_id, $2: circle_id
INSERT INTO cycle_participants (cycle_id, circle_membership_id, participation_status)
SELECT $1, cm.circle_membership_id, 'ELIGIBLE'
FROM circle_memberships cm
WHERE cm.circle_id = $2 AND cm.membership_status = 'ACTIVE'
ON CONFLICT (cycle_id, circle_membership_id) DO NOTHING;

-- 3.3 Auto-Generate Tagihan Iuran untuk Semua Peserta Siklus
-- $1: cycle_id, $2: amount_due (circles.contribution_amount), $3: due_at
INSERT INTO cycle_obligations (cycle_participant_id, amount_due, due_at, obligation_status)
SELECT cp.cycle_participant_id, $2, $3, 'UNPAID'
FROM cycle_participants cp
WHERE cp.cycle_id = $1
ON CONFLICT (cycle_participant_id) DO NOTHING;

-- 3.4 Bayar Tagihan Iuran via In-App Wallet (POST /api/v1/obligations/:id/pay with WALLET)
-- Dilakukan dalam 1 transaksi DB:
-- A. Potong saldo dompet user
UPDATE user_wallets
SET balance = balance - $2, updated_at = CURRENT_TIMESTAMP
WHERE user_id = $1 AND balance >= $2;

-- B. Ubah status obligation jadi PAID
UPDATE cycle_obligations
SET obligation_status = 'PAID'
WHERE obligation_id = $3;

-- C. Buat payment_order status PAID
INSERT INTO payment_orders (order_type, payment_method, amount, payment_status, paid_at)
VALUES ('CYCLE_CONTRIBUTION', 'WALLET', $2, 'PAID', CURRENT_TIMESTAMP)
RETURNING payment_order_id;

-- D. Catat mutasi wallet keluar
INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description)
VALUES ($4, $2, 'DUES_PAYMENT', $3, 'Pembayaran Iuran Arisan');

-- 3.5 Submit Penawaran Lelang SPSB (POST /api/v1/cycles/:id/bids)
-- $1: cycle_participant_id, $2: bid_rate_percent
INSERT INTO bids (cycle_participant_id, bid_rate_percent, bid_status)
VALUES ($1, $2, 'ACTIVE')
ON CONFLICT (cycle_participant_id)
DO UPDATE SET bid_rate_percent = $2, submitted_at = CURRENT_TIMESTAMP;

-- 3.6 Hitung Pemenang Lelang SPSB (Vickrey Auction)
-- $1: cycle_id
SELECT
    cp.cycle_participant_id,
    cm.user_id,
    u.full_name,
    b.bid_rate_percent
FROM bids b
JOIN cycle_participants cp ON cp.cycle_participant_id = b.cycle_participant_id
JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
JOIN users u ON u.user_id = cm.user_id
WHERE cp.cycle_id = $1 AND b.bid_status = 'ACTIVE'
ORDER BY b.bid_rate_percent DESC
LIMIT 2;
-- Baris ke-1 = Pemenang (winning_bid)
-- Baris ke-2 = Harga bayar diskon (payable_bid). Jika hanya 1 penawar, payable = bid floor circle.

-- 3.7 Tetapkan Pemenang Siklus (POST /api/v1/cycles/:id/draw)
-- $1: cycle_id, $2: winner_participant_id, $3: award_method, $4: gross_amount,
-- $5: winning_bid_rate_percent, $6: payable_bid_rate_percent, $7: decision_hash
INSERT INTO cycle_awards (
    cycle_id, cycle_participant_id, award_method, gross_amount,
    winning_bid_rate_percent, payable_bid_rate_percent, decision_hash
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING award_id, cycle_id, cycle_participant_id, gross_amount;

-- 3.8 Auto-Kredit Saldo Pemenang (Disbursement ke Wallet)
-- $1: winner_user_id, $2: net_award_amount, $3: award_id
UPDATE user_wallets
SET balance = balance + $2, updated_at = CURRENT_TIMESTAMP
WHERE user_id = $1;

INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description)
SELECT wallet_id, $2, 'DISBURSEMENT', $3, 'Pencairan Hadiah Pemenang Arisan'
FROM user_wallets WHERE user_id = $1;
