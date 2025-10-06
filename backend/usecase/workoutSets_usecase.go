package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/repository"
)

type WorkoutSetUsecase interface {
	AddSet(ctx context.Context, userID, workoutID string, in models.WorkoutSetCreateInput) (*models.WorkoutSet, error)
	UpdateSet(ctx context.Context, userID, setID string, in models.WorkoutSetUpdateInput) (*models.WorkoutSet, error)
	DeleteSet(ctx context.Context, userID, setID string) error
}

type workoutSetUsecase struct {
	wr repository.WorkoutRepository
	sr repository.WorkoutSetRepository
	er repository.ExerciseRepository
}

func NewWorkoutSetUsecase(wr repository.WorkoutRepository, sr repository.WorkoutSetRepository, er repository.ExerciseRepository) WorkoutSetUsecase {
	return &workoutSetUsecase{wr: wr, sr: sr, er: er}
}

func (u *workoutSetUsecase) AddSet(ctx context.Context, userID, workoutID string, in models.WorkoutSetCreateInput) (*models.WorkoutSet, error) {
	// 1) ワークアウトの所有者チェック
	w, err := u.wr.FindByID(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	if w == nil || w.UserID != userID {
		return nil, errors.New("workout not found or forbidden")
	}
	// 2) 種目存在チェック（外部キーで落とすでもOKだが、UXのため先に確認）
	if _, err := u.er.FindByID(ctx, in.ExerciseID); err != nil {
		return nil, err
	}

	now := time.Now()
	ws := &models.WorkoutSet{
		WorkoutID:   workoutID,
		ExerciseID:  in.ExerciseID,
		SetIndex:    in.SetIndex,   // 0/未指定なら repo 側で自動採番でも可
		Reps:        in.Reps,
		WeightKg:    in.WeightKg,
		RPE:         in.RPE,
		IsWarmup:    in.IsWarmup,
		RestSec:     in.RestSec,
		Note:        in.Note,
		DurationSec: in.DurationSec,
		DistanceM:   in.DistanceM,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := u.sr.Create(ctx, ws); err != nil {
		return nil, err
	}
	return ws, nil
}

func (u *workoutSetUsecase) UpdateSet(ctx context.Context, userID, setID string, in models.WorkoutSetUpdateInput) (*models.WorkoutSet, error) {
	// 1) セット取得（ワークアウト経由で権限チェック）
	ws, err := u.sr.FindByID(ctx, setID)
	if err != nil {
		return nil, err
	}
	if ws == nil {
		return nil, errors.New("set not found")
	}
	w, err := u.wr.FindByID(ctx, ws.WorkoutID)
	if err != nil {
		return nil, err
	}
	if w == nil || w.UserID != userID {
		return nil, errors.New("forbidden")
	}

	// 2) パッチ適用
	if in.SetIndex != nil {
		ws.SetIndex = *in.SetIndex
	}
	if in.Reps != nil {
		ws.Reps = in.Reps
	}
	if in.WeightKg != nil {
		ws.WeightKg = in.WeightKg
	}
	if in.RPE != nil {
		ws.RPE = in.RPE
	}
	if in.IsWarmup != nil {
		ws.IsWarmup = *in.IsWarmup
	}
	if in.RestSec != nil {
		ws.RestSec = in.RestSec
	}
	if in.Note != nil {
		ws.Note = in.Note
	}
	if in.DurationSec != nil {
		ws.DurationSec = in.DurationSec
	}
	if in.DistanceM != nil {
		ws.DistanceM = in.DistanceM
	}
	ws.UpdatedAt = time.Now()

	if err := u.sr.Update(ctx, ws); err != nil {
		return nil, err
	}
	return ws, nil
}

func (u *workoutSetUsecase) DeleteSet(ctx context.Context, userID, setID string) error {
	// 1) セット取得→ワークアウト所有者チェック
	ws, err := u.sr.FindByID(ctx, setID)
	if err != nil {
		return err
	}
	if ws == nil {
		return errors.New("set not found")
	}
	w, err := u.wr.FindByID(ctx, ws.WorkoutID)
	if err != nil {
		return err
	}
	if w == nil || w.UserID != userID {
		return errors.New("forbidden")
	}

	// 2) 削除
	return u.sr.Delete(ctx, setID)
}