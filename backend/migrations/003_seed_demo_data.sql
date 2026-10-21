-- ============================================================================
-- ArisanKita Demo Seeding Data (Deterministic UUIDs for Easy Testing & Demo)
-- ============================================================================

BEGIN;

-- Bersihkan data lama jika ada (idempotent re-seed)
TRUNCATE TABLE
    wallet_transactions,
    user_wallets,
    obligation_payment_orders,
    payment_proofs,
    payment_events,
    payment_orders,
    disbursements,
    draw_results,
    cycle_awards,
    bids,
    cycle_obligations,
    cycle_participant_substitutions,
    cycle_participants,
    arisan_cycles,
    circle_invitations,
    circle_memberships,
    circles,
    user_bank_accounts,
    user_auth_identities,
    users
CASCADE;

-- ----------------------------------------------------------------------------
-- 1. USERS & IDENTITIES
-- ----------------------------------------------------------------------------
INSERT INTO users (user_id, full_name, phone_number, email, account_status)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Tiara Maharani', '081234567890', 'tiara@arisankita.id', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 'Abda Pratama', '081298765432', 'abda@arisankita.id', 'ACTIVE'),
    ('33333333-3333-3333-3333-333333333333', 'Leroy Wijaya', '081311223344', 'leroy@arisankita.id', 'ACTIVE'),
    ('44444444-4444-4444-4444-444444444444', 'Nadia Putri', '081599887766', 'nadia@arisankita.id', 'ACTIVE');

-- Trigger otomatis membuatkan user_wallets berisi Rp 5.000.000 untuk tiap user di atas.

-- Login identities (email sandbox OTP)
INSERT INTO user_auth_identities (user_id, provider, provider_subject)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'EMAIL_OTP', 'tiara@arisankita.id'),
    ('22222222-2222-2222-2222-222222222222', 'EMAIL_OTP', 'abda@arisankita.id'),
    ('33333333-3333-3333-333333333333', 'EMAIL_OTP', 'leroy@arisankita.id'),
    ('44444444-4444-4444-4444-444444444444', 'EMAIL_OTP', 'nadia@arisankita.id');

-- Rekening Bank User
INSERT INTO user_bank_accounts (
    bank_account_id, user_id, provider, account_type, account_number_token,
    account_number_masked, account_name_from_provider, validation_status
)
VALUES
    ('b1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'BCA', 'BANK', 'tok_bca_tiara', '******8812', 'Tiara Maharani', 'MATCHED'),
    ('b2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'MANDIRI', 'BANK', 'tok_mandiri_abda', '******5432', 'Abda Pratama', 'MATCHED'),
    ('b3333333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'GOPAY', 'E_WALLET', 'tok_gopay_leroy', '******3344', 'Leroy Wijaya', 'MATCHED');

-- ----------------------------------------------------------------------------
-- 2. CIRCLES & MEMBERSHIPS
-- ----------------------------------------------------------------------------
-- Circle 1: Track Random Draw (Keluarga)
INSERT INTO circles (
    circle_id, circle_name, created_by_user_id, circle_status, track_type,
    contribution_amount, member_limit, period_type, partial_disbursement_threshold_percent, starts_at
)
VALUES (
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arisan Keluarga RT 05', '11111111-1111-1111-1111-111111111111',
    'RUNNING', 'RANDOM_DRAW', 500000.00, 4, 'MONTHLY', 100.00, CURRENT_TIMESTAMP - INTERVAL '30 days'
);

-- Circle 2: Track Lelang SPSB (Startup/Kantor)
INSERT INTO circles (
    circle_id, circle_name, created_by_user_id, circle_status, track_type,
    contribution_amount, member_limit, period_type, bid_floor_percent, bid_ceiling_percent,
    partial_disbursement_threshold_percent, starts_at
)
VALUES (
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arisan Fintech Squad', '22222222-2222-2222-2222-222222222222',
    'RUNNING', 'SPSB', 1000000.00, 3, 'MONTHLY', 1.00, 20.00, 100.00, CURRENT_TIMESTAMP
);

-- Memberships Circle 1 (Tiara = OWNER, Abda/Leroy/Nadia = MEMBER)
INSERT INTO circle_memberships (
    circle_membership_id, circle_id, user_id, membership_role, membership_status, joined_at
)
VALUES
    ('d1111111-0001-0000-0000-000000000001', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '35 days'),
    ('d1111111-0002-0000-0000-000000000002', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '34 days'),
    ('d1111111-0003-0000-0000-000000000003', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '33 days'),
    ('d1111111-0004-0000-0000-000000000004', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '32 days');

-- Memberships Circle 2 (Abda = OWNER, Tiara/Leroy = MEMBER)
INSERT INTO circle_memberships (
    circle_membership_id, circle_id, user_id, membership_role, membership_status, joined_at
)
VALUES
    ('d2222222-0001-0000-0000-000000000001', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('d2222222-0002-0000-0000-000000000002', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '9 days'),
    ('d2222222-0003-0000-0000-000000000003', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '8 days');

-- Kode Undangan Aktif
INSERT INTO circle_invitations (
    circle_id, invited_by_user_id, invite_code, invite_code_hash, invitation_status, expires_at
)
VALUES
    ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'ARK-RT05-2026', encode(digest('ARK-RT05-2026', 'sha256'), 'hex'), 'ACTIVE', CURRENT_TIMESTAMP + INTERVAL '30 days'),
    ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'ARK-SQD-2026', encode(digest('ARK-SQD-2026', 'sha256'), 'hex'), 'ACTIVE', CURRENT_TIMESTAMP + INTERVAL '30 days');

-- ----------------------------------------------------------------------------
-- 3. SIKLUS & RIWAYAT MENANG (Circle 1 - Random Draw)
-- ----------------------------------------------------------------------------
-- Putaran 1: SELESAI (Pemenang: Abda Pratama)
INSERT INTO arisan_cycles (cycle_id, circle_id, cycle_number, cycle_status, due_at)
VALUES (
    'c1111111-0001-0000-0000-000000000001', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    1, 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '15 days'
);

-- Peserta Putaran 1
INSERT INTO cycle_participants (
    cycle_participant_id, cycle_id, circle_membership_id, participation_status
)
VALUES
    ('e1111111-0001-0000-0000-000000000001', 'c1111111-0001-0000-0000-000000000001', 'd1111111-0001-0000-0000-000000000001', 'ELIGIBLE'),
    ('e1111111-0002-0000-0000-000000000002', 'c1111111-0001-0000-0000-000000000001', 'd1111111-0002-0000-0000-000000000002', 'ELIGIBLE'), -- Abda
    ('e1111111-0003-0000-0000-000000000003', 'c1111111-0001-0000-0000-000000000001', 'd1111111-0003-0000-0000-000000000003', 'ELIGIBLE'),
    ('e1111111-0004-0000-0000-000000000004', 'c1111111-0001-0000-0000-000000000001', 'd1111111-0004-0000-0000-000000000004', 'ELIGIBLE');

-- Iuran putaran 1 sudah lunas oleh seluruh peserta sehingga pot Rp2.000.000
-- dan pencairan hadiah di bawah memiliki jejak pembayaran yang lengkap.
INSERT INTO cycle_obligations (
    obligation_id, cycle_participant_id, amount_due, due_at, obligation_status
)
VALUES
    ('0b111111-1001-0000-0000-000000000001', 'e1111111-0001-0000-0000-000000000001', 500000.00, CURRENT_TIMESTAMP - INTERVAL '16 days', 'PAID'),
    ('0b111111-1002-0000-0000-000000000002', 'e1111111-0002-0000-0000-000000000002', 500000.00, CURRENT_TIMESTAMP - INTERVAL '16 days', 'PAID'),
    ('0b111111-1003-0000-0000-000000000003', 'e1111111-0003-0000-0000-000000000003', 500000.00, CURRENT_TIMESTAMP - INTERVAL '16 days', 'PAID'),
    ('0b111111-1004-0000-0000-000000000004', 'e1111111-0004-0000-0000-000000000004', 500000.00, CURRENT_TIMESTAMP - INTERVAL '16 days', 'PAID');

INSERT INTO payment_orders (
    payment_order_id, order_type, payment_method, amount, payment_status, paid_at, idempotency_key
)
VALUES
    ('f0111111-1001-0000-0000-000000000001', 'CYCLE_CONTRIBUTION', 'WALLET', 500000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '16 days', 'seed-cycle-1-tiara'),
    ('f0111111-1002-0000-0000-000000000002', 'CYCLE_CONTRIBUTION', 'WALLET', 500000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '16 days', 'seed-cycle-1-abda'),
    ('f0111111-1003-0000-0000-000000000003', 'CYCLE_CONTRIBUTION', 'WALLET', 500000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '16 days', 'seed-cycle-1-leroy'),
    ('f0111111-1004-0000-0000-000000000004', 'CYCLE_CONTRIBUTION', 'WALLET', 500000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '16 days', 'seed-cycle-1-nadia');

INSERT INTO obligation_payment_orders (payment_order_id, obligation_id)
VALUES
    ('f0111111-1001-0000-0000-000000000001', '0b111111-1001-0000-0000-000000000001'),
    ('f0111111-1002-0000-0000-000000000002', '0b111111-1002-0000-0000-000000000002'),
    ('f0111111-1003-0000-0000-000000000003', '0b111111-1003-0000-0000-000000000003'),
    ('f0111111-1004-0000-0000-000000000004', '0b111111-1004-0000-0000-000000000004');

UPDATE user_wallets
SET balance = balance - 500000.00
WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
);

INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description)
SELECT uw.wallet_id, 500000.00, 'DUES_PAYMENT', po.payment_order_id, 'Pembayaran iuran Arisan Keluarga RT 05 Putaran 1'
FROM user_wallets uw
JOIN users u ON u.user_id = uw.user_id
JOIN payment_orders po ON po.idempotency_key = CASE u.email
    WHEN 'tiara@arisankita.id' THEN 'seed-cycle-1-tiara'
    WHEN 'abda@arisankita.id' THEN 'seed-cycle-1-abda'
    WHEN 'leroy@arisankita.id' THEN 'seed-cycle-1-leroy'
    WHEN 'nadia@arisankita.id' THEN 'seed-cycle-1-nadia'
END
WHERE uw.user_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
);

-- Award Pemenang Putaran 1: Abda Menang Rp 2.000.000
INSERT INTO cycle_awards (
    award_id, cycle_id, cycle_participant_id, award_method, gross_amount, penalty_amount, net_award_amount, decision_hash, decided_at
)
VALUES (
    'a0d11111-0001-0000-0000-000000000001', 'c1111111-0001-0000-0000-000000000001',
    'e1111111-0002-0000-0000-000000000002', 'RANDOM_DRAW', 2000000.00, 0.00, 2000000.00,
    encode(digest('random-seed-award-cycle-1', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '15 days'
);

INSERT INTO draw_results (
    award_id, random_seed_commitment, random_seed_reveal,
    participant_snapshot_hash, algorithm_version, random_source, participant_count, drawn_at
)
VALUES (
    'a0d11111-0001-0000-0000-000000000001',
    encode(digest('provably-fair-seed-cycle-1', 'sha256'), 'hex'),
    'provably-fair-seed-cycle-1',
    encode(digest('e1111111-0001-0000-0000-000000000001,e1111111-0002-0000-0000-000000000002,e1111111-0003-0000-0000-000000000003,e1111111-0004-0000-0000-000000000004', 'sha256'), 'hex'),
    'SHA256_MOD_V1',
    'CRYPTO_SECURE_RANDOM', 4, CURRENT_TIMESTAMP - INTERVAL '15 days'
);

-- Pencairan dana kemenangan ke dompet Abda
INSERT INTO disbursements (
    award_id, provider, requested_amount, platform_fee_amount, net_amount, disbursement_status
)
VALUES (
    'a0d11111-0001-0000-0000-000000000001', 'IN_APP_WALLET', 2000000.00, 0.00, 2000000.00, 'PAID'
);

-- Kredit saldo dompet Abda Pratama (+2.000.000)
UPDATE user_wallets
SET balance = balance + 2000000.00
WHERE user_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description)
SELECT wallet_id, 2000000.00, 'DISBURSEMENT',
       'a0d11111-0001-0000-0000-000000000001',
       'Pemenang Arisan Keluarga RT 05 Putaran 1'
FROM user_wallets
WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- ----------------------------------------------------------------------------
-- Putaran 2: AKTIF (Pengumpulan Iuran)
-- ----------------------------------------------------------------------------
INSERT INTO arisan_cycles (cycle_id, circle_id, cycle_number, cycle_status, due_at)
VALUES (
    'c1111111-0002-0000-0000-000000000002', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    2, 'PAYMENT_COLLECTION', CURRENT_TIMESTAMP + INTERVAL '10 days'
);

-- Peserta Putaran 2
INSERT INTO cycle_participants (
    cycle_participant_id, cycle_id, circle_membership_id, participation_status
)
VALUES
    ('e1111111-0002-0001-0000-000000000001', 'c1111111-0002-0000-0000-000000000002', 'd1111111-0001-0000-0000-000000000001', 'ELIGIBLE'), -- Tiara
    ('e1111111-0002-0002-0000-000000000002', 'c1111111-0002-0000-0000-000000000002', 'd1111111-0002-0000-0000-000000000002', 'EXCLUDED'), -- Abda (sudah menang)
    ('e1111111-0002-0003-0000-000000000003', 'c1111111-0002-0000-0000-000000000002', 'd1111111-0003-0000-0000-000000000003', 'ELIGIBLE'), -- Leroy
    ('e1111111-0002-0004-0000-000000000004', 'c1111111-0002-0000-0000-000000000002', 'd1111111-0004-0000-0000-000000000004', 'ELIGIBLE'); -- Nadia

-- Tagihan Iuran Putaran 2 (Masing-masing Rp 500.000)
-- Abda sudah bayar via wallet; Tiara, Leroy, dan Nadia belum bayar (siap dicoba saat demo)
INSERT INTO cycle_obligations (
    obligation_id, cycle_participant_id, amount_due, due_at, obligation_status
)
VALUES
    ('0b111111-0001-0000-0000-000000000001', 'e1111111-0002-0001-0000-000000000001', 500000.00, CURRENT_TIMESTAMP + INTERVAL '10 days', 'UNPAID'),
    ('0b111111-0002-0000-0000-000000000002', 'e1111111-0002-0002-0000-000000000002', 500000.00, CURRENT_TIMESTAMP + INTERVAL '10 days', 'PAID'),
    ('0b111111-0003-0000-0000-000000000003', 'e1111111-0002-0003-0000-000000000003', 500000.00, CURRENT_TIMESTAMP + INTERVAL '10 days', 'UNPAID'),
    ('0b111111-0004-0000-0000-000000000004', 'e1111111-0002-0004-0000-000000000004', 500000.00, CURRENT_TIMESTAMP + INTERVAL '10 days', 'UNPAID');

-- Catat order pembayaran untuk Abda yang sudah PAID
INSERT INTO payment_orders (
    payment_order_id, order_type, payment_method, amount, payment_status, paid_at, idempotency_key
)
VALUES (
    'f0111111-2002-0000-0000-000000000002',
    'CYCLE_CONTRIBUTION', 'WALLET', 500000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '1 day', 'seed-cycle-2-abda'
);

INSERT INTO obligation_payment_orders (payment_order_id, obligation_id)
VALUES (
    'f0111111-2002-0000-0000-000000000002',
    '0b111111-0002-0000-0000-000000000002'
);

UPDATE user_wallets
SET balance = balance - 500000.00
WHERE user_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description)
SELECT wallet_id, 500000.00, 'DUES_PAYMENT',
       'f0111111-2002-0000-0000-000000000002',
       'Pembayaran iuran Arisan Keluarga RT 05 Putaran 2'
FROM user_wallets
WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- ----------------------------------------------------------------------------
-- 4. SIKLUS LELANG SPSB (Circle 2 - Fintech Squad)
-- ----------------------------------------------------------------------------
-- Putaran 1: BIDDING_OPEN
INSERT INTO arisan_cycles (
    cycle_id, circle_id, cycle_number, cycle_status, bidding_open_at, bidding_close_at, due_at
)
VALUES (
    'c2222222-0001-0000-0000-000000000001', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    1, 'BIDDING_OPEN',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '2 days',
    CURRENT_TIMESTAMP + INTERVAL '5 days'
);

INSERT INTO cycle_participants (
    cycle_participant_id, cycle_id, circle_membership_id, participation_status
)
VALUES
    ('e2222222-0001-0000-0000-000000000001', 'c2222222-0001-0000-0000-000000000001', 'd2222222-0001-0000-0000-000000000001', 'ELIGIBLE'), -- Abda
    ('e2222222-0002-0000-0000-000000000002', 'c2222222-0001-0000-0000-000000000001', 'd2222222-0002-0000-0000-000000000002', 'ELIGIBLE'), -- Tiara
    ('e2222222-0003-0000-0000-000000000003', 'c2222222-0001-0000-0000-000000000001', 'd2222222-0003-0000-0000-000000000003', 'ELIGIBLE'); -- Leroy

-- Seluruh iuran SPSB sudah dikumpulkan sebelum window bid dibuka. Dengan ini,
-- setelah bidding ditutup, cycle dapat langsung masuk READY_FOR_DISBURSEMENT.
INSERT INTO cycle_obligations (
    obligation_id, cycle_participant_id, amount_due, due_at, obligation_status
)
VALUES
    ('0b222222-0001-0000-0000-000000000001', 'e2222222-0001-0000-0000-000000000001', 1000000.00, CURRENT_TIMESTAMP + INTERVAL '5 days', 'PAID'),
    ('0b222222-0002-0000-0000-000000000002', 'e2222222-0002-0000-0000-000000000002', 1000000.00, CURRENT_TIMESTAMP + INTERVAL '5 days', 'PAID'),
    ('0b222222-0003-0000-0000-000000000003', 'e2222222-0003-0000-0000-000000000003', 1000000.00, CURRENT_TIMESTAMP + INTERVAL '5 days', 'PAID');

INSERT INTO payment_orders (
    payment_order_id, order_type, payment_method, amount, payment_status, paid_at, idempotency_key
)
VALUES
    ('f0222222-0001-0000-0000-000000000001', 'CYCLE_CONTRIBUTION', 'WALLET', 1000000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '1 day', 'seed-spsb-abda'),
    ('f0222222-0002-0000-0000-000000000002', 'CYCLE_CONTRIBUTION', 'WALLET', 1000000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '1 day', 'seed-spsb-tiara'),
    ('f0222222-0003-0000-0000-000000000003', 'CYCLE_CONTRIBUTION', 'WALLET', 1000000.00, 'PAID', CURRENT_TIMESTAMP - INTERVAL '1 day', 'seed-spsb-leroy');

INSERT INTO obligation_payment_orders (payment_order_id, obligation_id)
VALUES
    ('f0222222-0001-0000-0000-000000000001', '0b222222-0001-0000-0000-000000000001'),
    ('f0222222-0002-0000-0000-000000000002', '0b222222-0002-0000-0000-000000000002'),
    ('f0222222-0003-0000-0000-000000000003', '0b222222-0003-0000-0000-000000000003');

UPDATE user_wallets
SET balance = balance - 1000000.00
WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);

INSERT INTO wallet_transactions (wallet_id, amount, tx_type, reference_id, description)
SELECT uw.wallet_id, 1000000.00, 'DUES_PAYMENT', po.payment_order_id, 'Pembayaran iuran Arisan Fintech Squad Putaran 1'
FROM user_wallets uw
JOIN users u ON u.user_id = uw.user_id
JOIN payment_orders po ON po.idempotency_key = CASE u.email
    WHEN 'abda@arisankita.id' THEN 'seed-spsb-abda'
    WHEN 'tiara@arisankita.id' THEN 'seed-spsb-tiara'
    WHEN 'leroy@arisankita.id' THEN 'seed-spsb-leroy'
END
WHERE uw.user_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);

-- Penawaran Lelang Terkirim (Siap dihitung pemenang lelangnya)
-- Tiara tawar 7.5%, Leroy tawar 5.0%
INSERT INTO bids (bid_id, cycle_participant_id, bid_rate_percent, bid_status)
VALUES
    ('b1d11111-0001-0000-0000-000000000001', 'e2222222-0002-0000-0000-000000000002', 7.50, 'ACTIVE'),
    ('b1d11111-0002-0000-0000-000000000002', 'e2222222-0003-0000-0000-000000000003', 5.00, 'ACTIVE');

COMMIT;
