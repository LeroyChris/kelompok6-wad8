package service

import (
	"context"
	"errors"

	"backend-arisankita/internal/models"
	"backend-arisankita/internal/repository"
)

// AuthService menangani business logic registrasi, login & password hash
// Pegangan: Anggota 1 (Auth & User Profile)
type AuthService interface {
	Register(ctx context.Context, fullName, email, password, phoneNumber string) (*models.User, error)
	Login(ctx context.Context, email, password string) (token string, user *models.User, err error)
}

type authService struct {
	userRepo repository.UserRepository
}

func NewAuthService(userRepo repository.UserRepository) AuthService {
	return &authService{userRepo: userRepo}
}

func (s *authService) Register(ctx context.Context, fullName, email, password, phoneNumber string) (*models.User, error) {
	// TODO (Anggota 1): Hash password pakai bcrypt, simpan ke userRepo
	return nil, errors.New("not implemented")
}

func (s *authService) Login(ctx context.Context, email, password string) (string, *models.User, error) {
	// TODO (Anggota 1): Cari user by email, compare hash bcrypt, generate JWT token
	return "", nil, errors.New("not implemented")
}
