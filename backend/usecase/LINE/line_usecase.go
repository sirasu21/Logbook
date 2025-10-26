package usecase

import (
	"context"
	"time"

	repositoryLine "github.com/sirasu21/Logbook/backend/repository/LINE"
)

type LineUsecase interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, val any, ttl time.Duration) error
	Del(ctx context.Context, key string) error
}

type lineUsecase struct{
	rp repositoryLine.LineRepository
}

func NewLineUsecase(rp repositoryLine.LineRepository) LineUsecase{
	return &lineUsecase{rp: rp}
}

func (u *lineUsecase)Get(ctx context.Context, key string) (string, error){
	value, err := u.rp.Get(ctx, key)
	if err != nil{
		return "", err
	}
	return value, nil
}

func (u *lineUsecase)Set(ctx context.Context, key string , val any, ttl time.Duration)  error{
	err := u.rp.SetEX(ctx, key, val, ttl)
	if err != nil{
		return err
	}
	return nil
}

func (u *lineUsecase)Del(ctx context.Context, key string) error{
	err := u.rp.Del(ctx, key)
	if err != nil{
		return err
	}
	return nil
}





