-- ArisanKita - Extended module query contract
-- Parameter menggunakan placeholder pgx: $1, $2, ...
-- Jalankan mutasi finansial dalam transaction.

-- 1. Membuat campaign internal.
INSERT INTO crowdfunding_campaigns (
    circle_id,
    creator_user_id,
    related_award_id,
    campaign_type,
    title,
    description,
    target_amount,
    starts_at,
    ends_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING
    campaign_id,
    circle_id,
    campaign_type,
    target_amount,
    campaign_status,
    created_at;

-- 2. Daftar campaign dengan total kontribusi yang sudah dibayar.
SELECT
    cc.campaign_id,
    cc.circle_id,
    cc.campaign_type,
    cc.title,
    cc.description,
    cc.target_amount,
    COALESCE(SUM(c.amount) FILTER (
        WHERE c.contribution_status = 'PAID'
    ), 0.00)::NUMERIC(18, 2) AS collected_amount,
    cc.campaign_status,
    cc.starts_at,
    cc.ends_at
FROM crowdfunding_campaigns cc
LEFT JOIN campaign_contributions c
    ON c.campaign_id = cc.campaign_id
WHERE cc.circle_id = $1
GROUP BY
    cc.campaign_id,
    cc.circle_id,
    cc.campaign_type,
    cc.title,
    cc.description,
    cc.target_amount,
    cc.campaign_status,
    cc.starts_at,
    cc.ends_at
ORDER BY cc.created_at DESC;

-- 3. Membuat kontribusi campaign dan payment order.
BEGIN;

INSERT INTO campaign_contributions (
    campaign_id,
    contributor_user_id,
    amount
)
VALUES ($1, $2, $3)
RETURNING contribution_id;

INSERT INTO payment_orders (
    order_type,
    payment_method,
    provider,
    provider_order_ref,
    amount,
    payment_status,
    expires_at
)
VALUES (
    'CAMPAIGN_CONTRIBUTION',
    $4,
    $5,
    $6,
    $3,
    'CREATED',
    $7
)
RETURNING payment_order_id;

-- Gunakan contribution_id dan payment_order_id hasil dua query di atas.
INSERT INTO campaign_contribution_payment_orders (
    payment_order_id,
    contribution_id
)
VALUES ($8, $9);

COMMIT;

-- 4. Update kontribusi berdasarkan payment webhook.
UPDATE campaign_contributions c
SET contribution_status = $1, -- PAID / FAILED / REFUNDED
    paid_at = CASE WHEN $1 = 'PAID' THEN CURRENT_TIMESTAMP ELSE paid_at END
WHERE c.contribution_id = $2;

-- 5. Membuat perjanjian pinjaman dari campaign INTERNAL_LOAN.
INSERT INTO loan_agreements (
    campaign_id,
    borrower_user_id,
    principal_amount,
    service_fee_percent,
    approved_at,
    maturity_at,
    loan_status
)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, 'ACTIVE')
RETURNING loan_id, campaign_id, principal_amount, loan_status;

-- 6. Membuat jadwal cicilan bulanan.
INSERT INTO loan_repayment_schedules (
    loan_id,
    installment_number,
    due_at,
    amount_due
)
SELECT
    $1,
    installment_number,
    $2::TIMESTAMPTZ
        + (installment_number - 1) * INTERVAL '1 month',
    $3
FROM generate_series(1, $4::INTEGER) AS installment_number
RETURNING schedule_id, installment_number, due_at, amount_due;

-- 7. Membuat pembayaran cicilan dan payment order.
BEGIN;

INSERT INTO loan_repayments (
    schedule_id,
    amount_paid,
    repayment_status
)
VALUES ($1, $2, 'PENDING')
RETURNING repayment_id;

INSERT INTO payment_orders (
    order_type,
    payment_method,
    provider,
    provider_order_ref,
    amount,
    payment_status,
    expires_at
)
VALUES (
    'LOAN_REPAYMENT',
    $3,
    $4,
    $5,
    $2,
    'CREATED',
    $6
)
RETURNING payment_order_id;

INSERT INTO loan_repayment_payment_orders (
    payment_order_id,
    repayment_id
)
VALUES ($7, $8);

COMMIT;

-- 8. Ringkasan pinjaman dan total pembayaran.
SELECT
    la.loan_id,
    la.borrower_user_id,
    la.principal_amount,
    la.service_fee_percent,
    la.loan_status,
    COALESCE(SUM(lr.amount_paid) FILTER (
        WHERE lr.repayment_status = 'PAID'
    ), 0.00)::NUMERIC(18, 2) AS total_repaid,
    COALESCE(SUM(lrs.amount_due), 0.00)::NUMERIC(18, 2) AS total_scheduled
FROM loan_agreements la
JOIN loan_repayment_schedules lrs ON lrs.loan_id = la.loan_id
LEFT JOIN loan_repayments lr ON lr.schedule_id = lrs.schedule_id
WHERE la.loan_id = $1
GROUP BY
    la.loan_id,
    la.borrower_user_id,
    la.principal_amount,
    la.service_fee_percent,
    la.loan_status;

-- 9. Mengajukan KYC.
INSERT INTO kyc_verifications (
    user_id,
    verification_level,
    provider,
    document_storage_ref,
    name_match_status
)
VALUES ($1, $2, $3, $4, $5)
RETURNING verification_id, user_id, verification_level, verification_status;

-- 10. Mengaktifkan kebutuhan KYC ketika total pembayaran Circle melewati threshold.
WITH circle_total AS (
    SELECT
        c.circle_id,
        c.kyc_threshold_amount,
        COALESCE(SUM(po.amount) FILTER (
            WHERE po.payment_status = 'PAID'
        ), 0.00) AS total_paid
    FROM circles c
    LEFT JOIN arisan_cycles ac ON ac.circle_id = c.circle_id
    LEFT JOIN cycle_participants cp ON cp.cycle_id = ac.cycle_id
    LEFT JOIN cycle_obligations co
        ON co.cycle_participant_id = cp.cycle_participant_id
    LEFT JOIN obligation_payment_orders opo
        ON opo.obligation_id = co.obligation_id
    LEFT JOIN payment_orders po
        ON po.payment_order_id = opo.payment_order_id
    WHERE c.circle_id = $1
    GROUP BY c.circle_id, c.kyc_threshold_amount
)
INSERT INTO circle_kyc_reviews (
    circle_id,
    required_level,
    triggered_amount
)
SELECT
    circle_id,
    'ADVANCED',
    total_paid
FROM circle_total
WHERE total_paid >= kyc_threshold_amount
ON CONFLICT (circle_id, required_level)
DO UPDATE SET
    triggered_amount = EXCLUDED.triggered_amount,
    review_status = CASE
        WHEN circle_kyc_reviews.review_status = 'COMPLETED'
            THEN circle_kyc_reviews.review_status
        ELSE 'REQUIRED'
    END;

-- 11. Mencatat hasil verifikasi KYC.
UPDATE kyc_verifications
SET verification_status = $1,
    rejection_reason = $2,
    verified_at = CASE
        WHEN $1 = 'VERIFIED' THEN CURRENT_TIMESTAMP
        ELSE verified_at
    END,
    expires_at = $3
WHERE verification_id = $4;

-- 12. Menambah event reputasi.
INSERT INTO reputation_events (
    user_id,
    score_delta,
    event_type,
    reason,
    reference_type,
    reference_id
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING reputation_event_id, user_id, score_delta, created_at;

-- 13. Mengambil skor reputasi terkini.
SELECT user_id, full_name, reputation_score
FROM v_user_reputation
WHERE user_id = $1;

-- 14. Membuat risk block menggunakan hash/token, bukan data mentah.
INSERT INTO risk_block_entries (
    user_id,
    block_type,
    value_hash,
    reason,
    created_by_user_id,
    expires_at
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (block_type, value_hash)
DO UPDATE SET
    block_status = 'ACTIVE',
    reason = EXCLUDED.reason,
    expires_at = EXCLUDED.expires_at
RETURNING risk_block_id, block_type, block_status, created_at;

-- 15. Mengajukan keringanan kewajiban.
INSERT INTO obligation_relief_requests (
    obligation_id,
    requested_by_user_id,
    relief_type,
    requested_amount_due,
    requested_due_at,
    reason
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING relief_request_id, obligation_id, request_status, created_at;

-- 16. Approval keringanan oleh OWNER/ADMIN Circle.
UPDATE obligation_relief_requests r
SET request_status = $1, -- APPROVED / REJECTED
    reviewed_by_user_id = $2,
    review_note = $3,
    reviewed_at = CURRENT_TIMESTAMP
WHERE r.relief_request_id = $4
  AND EXISTS (
      SELECT 1
      FROM cycle_obligations co
      JOIN cycle_participants cp
          ON cp.cycle_participant_id = co.cycle_participant_id
      JOIN arisan_cycles ac ON ac.cycle_id = cp.cycle_id
      JOIN circle_memberships approver
          ON approver.circle_id = ac.circle_id
      WHERE co.obligation_id = r.obligation_id
        AND approver.user_id = $2
        AND approver.membership_status = 'ACTIVE'
        AND approver.membership_role IN ('OWNER', 'ADMIN')
  )
RETURNING relief_request_id, request_status, reviewed_at;

-- 17. Menjadwalkan notifikasi.
INSERT INTO notification_outbox (
    user_id,
    circle_id,
    channel,
    template_key,
    payload,
    scheduled_at
)
VALUES ($1, $2, $3, $4, $5::JSONB, $6)
RETURNING notification_id, notification_status, scheduled_at;

-- 18. Worker mengambil notifikasi secara aman untuk diproses.
SELECT
    notification_id,
    user_id,
    circle_id,
    channel,
    template_key,
    payload,
    attempt_count
FROM notification_outbox
WHERE notification_status = 'PENDING'
  AND scheduled_at <= CURRENT_TIMESTAMP
ORDER BY scheduled_at ASC
FOR UPDATE SKIP LOCKED
LIMIT $1;

-- Setelah worker mengambil baris:
UPDATE notification_outbox
SET notification_status = 'PROCESSING',
    attempt_count = attempt_count + 1
WHERE notification_id = $1
  AND notification_status = 'PENDING';

-- Setelah berhasil/gagal:
UPDATE notification_outbox
SET notification_status = $1, -- SENT / FAILED
    sent_at = CASE WHEN $1 = 'SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END,
    provider_message_ref = $2,
    last_error = $3
WHERE notification_id = $4;
