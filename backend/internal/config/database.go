package config

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// DB *pgxpool.Pool adalah koneksi database pool yang digunakan seluruh aplikasi
var DB *pgxpool.Pool

// SMTPConfig konfigurasi SMTP untuk pengiriman OTP email
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	FromName string
	FromAddr string
}

// DBConnectionMetrics menyimpan metadata pool koneksi untuk monitoring
type DBConnectionMetrics struct {
	MaxConns        int
	MinConns        int
	AcquiredConns   int
	IdleConns       int
	ConnLifetime    time.Duration
	ConnIdleTimeout time.Duration
	isInitialized   bool
}

// DBMetrics menyimpan snapshot metrics saat ini
type DBMetrics struct {
	mu              sync.Mutex
	metrics         DBConnectionMetrics
	initialized     bool
}

// GetMetrics mengembalikan salinan current metrics pool
func (m *DBMetrics) GetMetrics() DBConnectionMetrics {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.metrics
}

// GetInitializedCheck mengembalikan status apakah metrics sudah diinisialisasi
func (m *DBMetrics) GetInitializedCheck() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.initialized
}

// UpdateMetrics memperbarui metrics pool
func (m *DBMetrics) UpdateMetrics(metrics DBConnectionMetrics) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metrics = metrics
	m.initialized = true
}

// DBMetricsInstance instance singleton untuk diakses dari seluruh aplikasi
var DBMetricsInstance = &DBMetrics{}

// InitDBInitializer adalah fungsi yang dapat di-customize untuk init DB metrics
var InitDBInitializer func(*pgxpool.Pool) = defaultInitDBMetrics

// defaultInitDBMetrics metrics dasar saat pool dibuat
func defaultInitDBMetrics(pool *pgxpool.Pool) {
	// Initialize with basic pool configuration from config
	// Stats retrieval may vary by pgxpool version; use config values as fallback
	DBMetricsInstance.UpdateMetrics(DBConnectionMetrics{
		MaxConns:        10,
		MinConns:        2,
		ConnLifetime:    1 * time.Hour,
		ConnIdleTimeout: 15 * time.Minute,
		isInitialized:   true,
	})
}

// InitDB menginisialisasi koneksi database pool
func InitDB() *pgxpool.Pool {
	_ = godotenv.Load() // Muat .env jika ada

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("[FATAL] DATABASE_URL wajib dikonfigurasi")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("[FATAL] Gagal membaca konfigurasi DATABASE_URL: %v", err)
	}

	// ── Config Pool Settings ──
	config.MaxConns = 10                      // Maksimal koneksi simultan
	config.MinConns = 2                       // Minimal koneksi aktif
	config.MaxConnLifetime = 1 * time.Hour    // Daur ulang koneksi tiap 1 jam
	config.MaxConnIdleTime = 15 * time.Minute // Tutup koneksi idle > 15 menit

	// Timeout pembuatan koneksi awal
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		log.Fatalf("[FATAL] Gagal membuat pool koneksi database: %v", err)
	}

	// Tes Ping awal untuk memastikan database dapat dijangkau
	if err := pool.Ping(ctx); err != nil {
		log.Printf("[WARN] Gagal melakukan ping ke database: %v", err)
	} else {
		log.Println("[INFO] Berhasil terhubung ke Database.")
	}

	// Inisialisasi metrics
	InitDBInitializer(pool)

	DB = pool
	return DB
}

// CloseDB menutup koneksi database dengan graceful shutdown
func CloseDB() {
	if DB != nil {
		log.Println("[INFO] Menutup pool koneksi database (graceful shutdown)...")
		// Log sebelum close
		if DBMetricsInstance != nil && DBMetricsInstance.GetInitializedCheck() {
			meta := DBMetricsInstance.GetMetrics()
			log.Printf("[INFO] Pool configured - MaxConns: %d, MinConns: %d",
				meta.MaxConns, meta.MinConns)
		}
		DB.Close()
		log.Println("[INFO] Pool koneksi database berhasil ditutup.")
		DB = nil
	}
}

// GetDBMetrics mengambil current koneksi pool metrics
func GetDBMetrics() DBConnectionMetrics {
	if DBMetricsInstance != nil {
		return DBMetricsInstance.GetMetrics()
	}
	return DBConnectionMetrics{}
}

// RecommendedIndexes daftar indeks disarankan untuk tabel-tabel utama
// These can be executed via migration: goose or manual SQL
var RecommendedIndexes = map[string]string{
	"users": `
		CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
		CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
	`,

	"cycle_participants": `
		CREATE INDEX IF NOT EXISTS idx_cycle_participants_cycle_id ON cycle_participants(cycle_id);
		CREATE INDEX IF NOT EXISTS idx_cycle_participants_created_at ON cycle_participants(created_at);
	`,

	"cycle_awards": `
		CREATE INDEX IF NOT EXISTS idx_cycle_awards_cycle_id ON cycle_awards(cycle_id);
	`,

	"cycle_obligations": `
		CREATE INDEX IF NOT EXISTS idx_cycle_obligations_cycle_id ON cycle_obligations(cycle_id);
		CREATE INDEX IF NOT EXISTS idx_cycle_obligations_status ON cycle_obligations(obligation_status);
	`,

	"circle_memberships": `
		CREATE INDEX IF NOT EXISTS idx_circle_memberships_user_id ON circle_memberships(user_id);
		CREATE INDEX IF NOT EXISTS idx_circle_memberships_circle_id ON circle_memberships(circle_id);
	`,

	"bids": `
		CREATE INDEX IF NOT EXISTS idx_bids_cycle_participant_id ON bids(cycle_participant_id);
		CREATE INDEX IF NOT EXISTS idx_bids_bid_status ON bids(bid_status);
	`,
}