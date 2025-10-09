package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/repository"
)

type BodyMetricUsecase interface {
	List(ctx context.Context, userID string, in BodyMetricListInput) (BodyMetricListOutput, error)
	Create(ctx context.Context, userID string, in CreateBodyMetricInput) (*models.BodyMetric, error)
	Update(ctx context.Context, userID, id string, in UpdateBodyMetricInput) (*models.BodyMetric, error)
	Delete(ctx context.Context, userID, id string) error
}

type BodyMetricListInput struct {
	From   *time.Time `json:"from,omitempty"`
	To     *time.Time `json:"to,omitempty"`
	Limit  int        `json:"limit,omitempty"`
	Offset int        `json:"offset,omitempty"`
}

type BodyMetricListOutput struct {
	Items  []models.BodyMetric `json:"items"`
	Total  int64               `json:"total"`
	Limit  int                 `json:"limit"`
	Offset int                 `json:"offset"`
}

type CreateBodyMetricInput struct {
	MeasuredAt time.Time `json:"measuredAt"`
	WeightKg   float32   `json:"weightKg"`
	BodyFatPct *float32  `json:"bodyFatPct,omitempty"`
	Note       *string   `json:"note,omitempty"`
}

type UpdateBodyMetricInput struct {
	MeasuredAt *time.Time `json:"measuredAt,omitempty"`
	WeightKg   *float32   `json:"weightKg,omitempty"`
	BodyFatPct *float32   `json:"bodyFatPct,omitempty"`
	Note       *string    `json:"note,omitempty"`
}

type bodyMetricUsecase struct {
	repo repository.BodyMetricRepository
}

func NewBodyMetricUsecase(repo repository.BodyMetricRepository) BodyMetricUsecase {
	return &bodyMetricUsecase{repo: repo}
}

func (u *bodyMetricUsecase) List(ctx context.Context, userID string, in BodyMetricListInput) (BodyMetricListOutput, error) {
	f := repository.BodyMetricListFilter{
		From:   in.From,
		To:     in.To,
		Limit:  in.Limit,
		Offset: in.Offset,
	}
	items, total, err := u.repo.ListByUser(ctx, userID, f)
	if err != nil {
	 return BodyMetricListOutput{}, err
	}
	return BodyMetricListOutput{
		Items:  items,
		Total:  total,
		Limit:  f.Limit,
		Offset: f.Offset,
	}, nil
}

func (u *bodyMetricUsecase) Create(ctx context.Context, userID string, in CreateBodyMetricInput) (*models.BodyMetric, error) {
	if in.WeightKg <= 0 {
		return nil, errors.New("weightKg must be > 0")
	}
	m := &models.BodyMetric{
		UserID:     userID,
		MeasuredAt: in.MeasuredAt,
		WeightKg:   in.WeightKg,
		BodyFatPct: in.BodyFatPct,
		Note:       in.Note,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	if err := u.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (u *bodyMetricUsecase) Update(ctx context.Context, userID, id string, in UpdateBodyMetricInput) (*models.BodyMetric, error) {
	upd := repository.UpdateBodyMetricFields{
		MeasuredAt: in.MeasuredAt,
		WeightKg:   in.WeightKg,
		BodyFatPct: in.BodyFatPct,
		Note:       in.Note,
	}
	return u.repo.UpdateOwned(ctx, userID, id, upd)
}

func (u *bodyMetricUsecase) Delete(ctx context.Context, userID, id string) error {
	return u.repo.DeleteOwned(ctx, userID, id)
}