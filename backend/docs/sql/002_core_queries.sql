-- ArisanKita - Core MVP query contract
-- Parameter menggunakan placeholder pgx: $1, $2, ...
-- Semua operasi yang mengubah status finansial wajib dijalankan dalam transaction.

-- 1. Membuat Circle.
-- Untuk RANDOM_DRAW, bid_floor_percent dan bid_ceiling_percent harus NULL.
INSERT INTO circles (
    circle_name,
    created_by_user_id,
    circle_status,
    track_type,
    contribution_amount,
    member_limit,
    period_type,
    bid_floor_percent,
    bid_ceiling_percent,
    partial_disbursement_threshold_percent,
    starts_at
)
VALUES (
    $1,  -- circle_name
    $2,  -- created_by_user_id
    'RECRUITING',
    $3,  -- SPSB / RANDOM_DRAW
    $4,  -- contribution_amount
    $5,  -- member_limit
    $6,  -- WEEKLY / MONTHLY
    $7,  -- bid_floor_percent, nullable
    $8,  -- bid_ceiling_percent, nullable
    COALESCE($9, 90.00),
    $10  -- starts_at
)
RETURNING
    circle_id,
    circle_name,
    track_type,
    contribution_amount,
    member_limit,
    period_type,
    circle_status,
    starts_at,
    created_at;

-- 2. Menjadikan pembuat Circle sebagai OWNER aktif.
INSERT INTO circle_memberships (
    circle_id,
    user_id,
    membership_role,
    membership_status,
    joined_at
)
VALUES ($1, $2, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT (circle_id, user_id)
DO UPDATE SET
    membership_role = 'OWNER',
    membership_status = 'ACTIVE',
    joined_at = COALESCE(circle_memberships.joined_at, CURRENT_TIMESTAMP)
RETURNING circle_membership_id, circle_id, user_id, membership_role, membership_status;

-- 3. Mengambil Circle milik user.
SELECT
    c.circle_id,
    c.circle_name,
    c.track_type,
    c.contribution_amount,
    c.member_limit,
    c.period_type,
    c.circle_status,
    cm.membership_role,
    cm.membership_status
FROM circles c
JOIN circle_memberships cm ON cm.circle_id = c.circle_id
WHERE cm.user_id = $1
  AND cm.membership_status = 'ACTIVE'
ORDER BY c.created_at DESC;

-- 4. Membuat undangan.
-- $2 harus berupa hash invite code, bukan kode mentah.
INSERT INTO circle_invitations (
    circle_id,
    invited_by_user_id,
    invite_code_hash,
    expires_at
)
VALUES ($1, $2, $3, $4)
RETURNING invitation_id, circle_id, expires_at, invitation_status;

-- 5. Memproses join menggunakan invite code hash.
-- Jalankan SELECT dan INSERT membership dalam transaction.
SELECT
    invitation_id,
    circle_id
FROM circle_invitations
WHERE invite_code_hash = $1
  AND invitation_status = 'ACTIVE'
  AND expires_at > CURRENT_TIMESTAMP
FOR UPDATE;

INSERT INTO circle_memberships (
    circle_id,
    user_id,
    membership_role,
    membership_status
)
VALUES ($1, $2, 'MEMBER', 'PENDING')
ON CONFLICT (circle_id, user_id)
DO NOTHING
RETURNING circle_membership_id, circle_id, user_id, membership_status;

-- Setelah membership berhasil dibuat:
UPDATE circle_invitations
SET invitation_status = 'USED',
    accepted_by_user_id = $2,
    accepted_at = CURRENT_TIMESTAMP
WHERE invitation_id = $3
  AND invitation_status = 'ACTIVE';

-- 6. Approval anggota oleh OWNER/ADMIN.
UPDATE circle_memberships cm
SET membership_status = 'ACTIVE',
    joined_at = COALESCE(cm.joined_at, CURRENT_TIMESTAMP)
WHERE cm.circle_membership_id = $1
  AND cm.membership_status = 'PENDING'
  AND EXISTS (
      SELECT 1
      FROM circle_memberships approver
      WHERE approver.circle_id = cm.circle_id
        AND approver.user_id = $2
        AND approver.membership_status = 'ACTIVE'
        AND approver.membership_role IN ('OWNER', 'ADMIN')
  )
RETURNING cm.circle_membership_id, cm.circle_id, cm.user_id, cm.membership_status, cm.joined_at;

-- 7. Mengunci Circle dan membuat seluruh cycle.
-- Jalankan seluruh blok berikut dalam satu transaction:
BEGIN;

SELECT circle_id, circle_status, track_type, contribution_amount,
       member_limit, period_type, starts_at
FROM circles
WHERE circle_id = $1
FOR UPDATE;

SELECT COUNT(*) AS active_member_count
FROM circle_memberships
WHERE circle_id = $1
  AND membership_status = 'ACTIVE';

UPDATE circles
SET circle_status = 'LOCKED'
WHERE circle_id = $1
  AND circle_status = 'RECRUITING';

INSERT INTO arisan_cycles (
    circle_id,
    cycle_number,
    cycle_status,
    due_at
)
SELECT
    c.circle_id,
    sequence_number,
    'PENDING',
    c.starts_at
        + CASE
            WHEN c.period_type = 'WEEKLY'
                THEN (sequence_number - 1) * INTERVAL '1 week'
            ELSE (sequence_number - 1) * INTERVAL '1 month'
          END
        + INTERVAL '7 days'
FROM circles c
CROSS JOIN generate_series(1, $2::INTEGER) AS sequence_number
WHERE c.circle_id = $1
RETURNING cycle_id, circle_number, due_at;

-- Snapshot peserta dan kewajiban setiap cycle.
INSERT INTO cycle_participants (
    cycle_id,
    circle_membership_id
)
SELECT
    ac.cycle_id,
    cm.circle_membership_id
FROM arisan_cycles ac
JOIN circle_memberships cm
    ON cm.circle_id = ac.circle_id
   AND cm.membership_status = 'ACTIVE'
WHERE ac.circle_id = $1;

INSERT INTO cycle_obligations (
    cycle_participant_id,
    amount_due,
    due_at
)
SELECT
    cp.cycle_participant_id,
    c.contribution_amount,
    ac.due_at
FROM cycle_participants cp
JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
JOIN circles c ON c.circle_id = ac.circle_id
WHERE ac.circle_id = $1;

UPDATE circles
SET circle_status = 'RUNNING'
WHERE circle_id = $1
  AND circle_status = 'LOCKED';

COMMIT;

-- 8. Membuka bidding pada satu cycle.
UPDATE arisan_cycles
SET cycle_status = 'BIDDING_OPEN',
    bidding_open_at = CURRENT_TIMESTAMP,
    bidding_close_at = $2
WHERE cycle_id = $1
  AND cycle_status = 'PENDING'
RETURNING cycle_id, cycle_number, cycle_status, bidding_open_at, bidding_close_at;

-- 9. Mengirim bid rahasia.
-- Trigger database memvalidasi SPSB serta floor/ceiling.
INSERT INTO bids (
    cycle_participant_id,
    bid_rate_percent
)
VALUES ($1, $2)
ON CONFLICT (cycle_participant_id)
DO UPDATE SET
    bid_rate_percent = EXCLUDED.bid_rate_percent,
    bid_status = 'ACTIVE',
    submitted_at = CURRENT_TIMESTAMP
RETURNING bid_id, cycle_participant_id, bid_rate_percent, bid_status, submitted_at;

-- 10. Mengambil bid milik user sendiri.
SELECT
    b.bid_id,
    b.cycle_participant_id,
    b.bid_rate_percent,
    b.bid_status,
    b.submitted_at
FROM bids b
JOIN cycle_participants cp ON cp.cycle_participant_id = b.cycle_participant_id
JOIN circle_memberships cm ON cm.circle_membership_id = cp.circle_membership_id
WHERE cp.cycle_id = $1
  AND cm.user_id = $2;

-- 11. Menutup bidding dan membuat award SPSB.
-- Jika hanya ada satu bid valid, floor digunakan sebagai payable rate.
-- Tie-breaker: bid rate tertinggi, submitted_at paling awal, bid_id terkecil.
BEGIN;

SELECT cycle_id, cycle_status
FROM arisan_cycles
WHERE cycle_id = $1
FOR UPDATE;

WITH ranked_bids AS (
    SELECT
        b.cycle_participant_id,
        b.bid_rate_percent,
        b.bid_id,
        b.submitted_at,
        ROW_NUMBER() OVER (
            ORDER BY b.bid_rate_percent DESC, b.submitted_at ASC, b.bid_id ASC
        ) AS bid_rank
    FROM bids b
    JOIN cycle_participants cp
        ON cp.cycle_participant_id = b.cycle_participant_id
    WHERE cp.cycle_id = $1
      AND cp.participation_status = 'ELIGIBLE'
      AND b.bid_status = 'ACTIVE'
),
pot AS (
    SELECT COALESCE(SUM(co.amount_due), 0.00) AS gross_amount
    FROM cycle_obligations co
    JOIN cycle_participants cp
        ON cp.cycle_participant_id = co.cycle_participant_id
    WHERE cp.cycle_id = $1
),
circle_rule AS (
    SELECT c.bid_floor_percent
    FROM arisan_cycles ac
    JOIN circles c ON c.circle_id = ac.circle_id
    WHERE ac.cycle_id = $1
)
INSERT INTO cycle_awards (
    cycle_id,
    cycle_participant_id,
    award_method,
    gross_amount,
    winning_bid_rate_percent,
    payable_bid_rate_percent
)
SELECT
    $1,
    winner.cycle_participant_id,
    'SPSB',
    pot.gross_amount,
    winner.bid_rate_percent,
    COALESCE(second.bid_rate_percent, circle_rule.bid_floor_percent)
FROM ranked_bids winner
LEFT JOIN ranked_bids second
    ON second.bid_rank = 2
CROSS JOIN pot
CROSS JOIN circle_rule
WHERE winner.bid_rank = 1;

UPDATE arisan_cycles
SET cycle_status = 'BIDDING_CLOSED'
WHERE cycle_id = $1
  AND cycle_status = 'BIDDING_OPEN';

COMMIT;

-- 12. Payment matrix untuk frontend.
SELECT *
FROM v_payment_matrix
WHERE circle_id = $1
ORDER BY cycle_number ASC, full_name ASC;

-- 13. Membuat payment order untuk satu kewajiban.
-- Jalankan SELECT outstanding dan INSERT dalam satu transaction.
SELECT
    co.obligation_id
FROM cycle_obligations co
WHERE co.obligation_id = $1
FOR UPDATE;

SELECT
    co.obligation_id,
    co.amount_due
        - COALESCE(
            SUM(po.amount) FILTER (WHERE po.payment_status = 'PAID'),
            0.00
          )
        AS amount_remaining
FROM cycle_obligations co
LEFT JOIN obligation_payment_orders opo
    ON opo.obligation_id = co.obligation_id
LEFT JOIN payment_orders po
    ON po.payment_order_id = opo.payment_order_id
WHERE co.obligation_id = $1
GROUP BY co.obligation_id, co.amount_due;

INSERT INTO payment_orders (
    order_type,
    payment_method,
    provider,
    provider_order_ref,
    amount,
    payment_status,
    expires_at
)
VALUES ('CYCLE_CONTRIBUTION', $2, $3, $4, $5, 'CREATED', $6)
RETURNING payment_order_id, order_type, amount, payment_status, expires_at;

-- Hubungkan payment order yang baru dibuat dengan kewajiban.
INSERT INTO obligation_payment_orders (
    payment_order_id,
    obligation_id
)
VALUES ($7, $1);

-- 14. Menerima webhook secara idempotent.
INSERT INTO payment_events (
    payment_order_id,
    provider,
    provider_event_id,
    provider_order_ref,
    event_type,
    payload_hash
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (provider, provider_event_id)
DO NOTHING
RETURNING payment_event_id;

-- Jika INSERT di atas menghasilkan baris, proses status payment:
UPDATE payment_orders
SET payment_status = $1, -- PAID / FAILED / EXPIRED / REFUNDED
    paid_at = CASE WHEN $1 = 'PAID' THEN CURRENT_TIMESTAMP ELSE paid_at END
WHERE payment_order_id = $2;

-- 15. Query histori pemenang / papan giliran.
SELECT
    ac.cycle_number,
    ac.cycle_id,
    u.user_id,
    u.full_name,
    ca.award_method,
    ca.gross_amount,
    ca.winning_bid_rate_percent,
    ca.payable_bid_rate_percent,
    ca.decided_at
FROM cycle_awards ca
JOIN arisan_cycles ac ON ac.cycle_id = ca.cycle_id
JOIN cycle_participants cp
    ON cp.cycle_participant_id = ca.cycle_participant_id
JOIN circle_memberships cm
    ON cm.circle_membership_id = cp.circle_membership_id
JOIN users u ON u.user_id = cm.user_id
WHERE ac.circle_id = $1
ORDER BY ac.cycle_number ASC;

-- 16. Peserta yang belum pernah menang.
SELECT
    cm.circle_membership_id,
    u.user_id,
    u.full_name
FROM circle_memberships cm
JOIN users u ON u.user_id = cm.user_id
WHERE cm.circle_id = $1
  AND cm.membership_status = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1
      FROM cycle_awards ca
      JOIN cycle_participants cp
          ON cp.cycle_participant_id = ca.cycle_participant_id
      JOIN arisan_cycles ac
          ON ac.cycle_id = ca.cycle_id
      WHERE ac.circle_id = cm.circle_id
        AND cp.circle_membership_id = cm.circle_membership_id
  )
ORDER BY u.full_name ASC;
