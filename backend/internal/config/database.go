package config

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var DB *pgxpool.Pool

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
		log.Printf("[WARN] Gagal melakukan ping ke database Supabase: %v", err)
	} else {
		log.Println("[INFO] Berhasil terhubung ke Database Supabase via pgxpool.")
	}

	DB = pool
	return DB
}

func CloseDB() {
	if DB != nil {
		DB.Close()
		log.Println("[INFO] Pool koneksi database berhasil ditutup.")
	}
}
