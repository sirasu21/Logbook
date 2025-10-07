package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/repository"
)

type ExerciseUsecase interface {
	List(ctx context.Context, userID string, in ListExercisesInput) (ExerciseListOutput, error)
	Get(ctx context.Context, userID string, id string) (*models.Exercise, error)
	Create(ctx context.Context, userID string, in CreateExerciseInput) (*models.Exercise, error)
	Update(ctx context.Context, userID string, id string, in UpdateExerciseInput) (*models.Exercise, error)
	Delete(ctx context.Context, userID string, id string) error
}

type ListExercisesInput struct {
	Q        string
	Type     *string // "strength" | "cardio" | "other"
	OnlyMine bool
	Limit    int
	Offset   int
}

type ExerciseListOutput struct {
	Items  []models.Exercise `json:"items"`
	Total  int64             `json:"total"`
	Limit  int               `json:"limit"`
	Offset int               `json:"offset"`
}

type CreateExerciseInput struct {
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	PrimaryMuscle *string `json:"primaryMuscle,omitempty"`
}

type UpdateExerciseInput struct {
	Name          *string `json:"name,omitempty"`
	Type          *string `json:"type,omitempty"`
	PrimaryMuscle *string `json:"primaryMuscle,omitempty"`
	IsActive      *bool   `json:"isActive,omitempty"`
}

type exerciseUsecase struct {
	repo repository.ExerciseRepository
}

func NewExerciseUsecase(repo repository.ExerciseRepository) ExerciseUsecase {
	return &exerciseUsecase{repo: repo}
}

func (u *exerciseUsecase) List(ctx context.Context, userID string, in ListExercisesInput) (ExerciseListOutput, error) {
	f := repository.ListExercisesFilter{
		Q:        in.Q,
		Type:     in.Type,
		OnlyMine: in.OnlyMine,
		Limit:    in.Limit,
		Offset:   in.Offset,
	}
	items, total, err := u.repo.List(ctx, userID, f)
	if err != nil {
		return ExerciseListOutput{}, err
	}
	return ExerciseListOutput{
		Items:  items,
		Total:  total,
		Limit:  f.Limit,
		Offset: f.Offset,
	}, nil
}

func (u *exerciseUsecase) Get(ctx context.Context, userID string, id string) (*models.Exercise, error) {
	ex, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// 可視性チェック（グローバル or 自分の独自）
	if ex.OwnerUserID != nil && *ex.OwnerUserID != userID {
		return nil, errors.New("not found")
	}
	return ex, nil
}

func (u *exerciseUsecase) Create(ctx context.Context, userID string, in CreateExerciseInput) (*models.Exercise, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	if in.Type == "" {
		return nil, errors.New("type is required")
	}
	now := time.Now()
	ex := &models.Exercise{
		// ID は DB デフォルト（gen_random_uuid）ならゼロ値でOK
		OwnerUserID:   &userID,
		Name:          name,
		Type:          models.ExerciseType(in.Type),
		PrimaryMuscle: in.PrimaryMuscle, // nil 可
		IsActive:      true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := u.repo.Create(ctx, ex); err != nil {
		return nil, err
	}
	return ex, nil
}

func (u *exerciseUsecase) Update(ctx context.Context, userID string, id string, in UpdateExerciseInput) (*models.Exercise, error) {
	upd := repository.UpdateExerciseFields{
		Name:          in.Name,
		Type:          in.Type,
		PrimaryMuscle: in.PrimaryMuscle,
		IsActive:      in.IsActive,
	}
	return u.repo.UpdateOwned(ctx, userID, id, upd)
}

func (u *exerciseUsecase) Delete(ctx context.Context, userID string, id string) error {
	return u.repo.DeleteOwned(ctx, userID, id)
}