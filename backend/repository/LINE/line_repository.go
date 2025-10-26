package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/go-redis/redis"
)

type LineRepository interface {
	Get(ctx context.Context, key string) (string, error)
	SetEX(ctx context.Context, key string, val any, ttl time.Duration) error
	Del(ctx context.Context, key string) error
}

type lineRepository struct {
	rd *redis.Client
}

func NewLineRepository(rd *redis.Client) LineRepository {
	return &lineRepository{rd: rd}
}

func (r *lineRepository) Get(ctx context.Context, key string) (string, error) {
	value := r.rd.Get(key)
	if value.Err() != nil{
		return "", value.Err()
	}
  return value.Val(), nil
}
func (r *lineRepository) SetEX(ctx context.Context, key string, val any, ttl time.Duration) error {
  b, _ := json.Marshal(val)
  if err := r.rd.Set(key, b, ttl).Err(); err != nil{
	return err
  }
  return nil
}
func (r *lineRepository) Del(ctx context.Context, key string) error {
  if err := r.rd.Del(key).Err(); err != nil{
	return err
  }
  return nil
}