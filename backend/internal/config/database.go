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

// InitDB initializes PostgreSQL connection pool using pgxpool (Raw SQL, No ORM)
func InitDB() *pgxpool.Pool {
	// Load .env file if exists
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[WARN] DATABASE_URL is not set. Running without active database connection (mock mode only).")
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Printf("[WARN] Failed to parse DATABASE_URL: %v", err)
		return nil
	}

	// Pool settings
	poolConfig.MaxConns = 10
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = 1 * time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Printf("[WARN] Unable to connect to Supabase PostgreSQL: %v", err)
		return nil
	}

	if err := pool.Ping(ctx); err != nil {
		log.Printf("[WARN] Database ping failed: %v", err)
		return nil
	}

	log.Println("[INFO] Successfully connected to Supabase PostgreSQL (pgxpool)!")
	DB = pool
	return pool
}

// CloseDB closes database connection pool
func CloseDB() {
	if DB != nil {
		DB.Close()
		log.Println("[INFO] Database connection closed.")
	}
}
