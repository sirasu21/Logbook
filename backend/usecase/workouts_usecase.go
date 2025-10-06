package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/repository"
)

type WorkoutUsecase interface {
	Create(ctx context.Context, userID string, in models.CreateWorkoutInput) (*models.Workout, error)
	End(ctx context.Context, workoutID string, userID string, endedAt time.Time) (*models.Workout, error)
	ListByUser(ctx context.Context, userID string, f WorkoutListFilter) ([]models.Workout, int, error)
	GetDetail(ctx context.Context, userID string, workoutID string) (*models.WorkoutDetail, error)
	
}

type WorkoutListFilter struct {
	From   *time.Time
	To     *time.Time
	Limit  int
	Offset int
}

type workoutUsecase struct {
	repo repository.WorkoutRepository
}

func NewWorkoutUsecase(repo repository.WorkoutRepository) WorkoutUsecase {
	return &workoutUsecase{repo: repo}	
}

func (u *workoutUsecase) Create(ctx context.Context, userID string, in models.CreateWorkoutInput) (*models.Workout, error) {
	if userID == "" {
		return nil, errors.New("unauthorized")
	}
	// 最小バリデーション（startedAt 必須）
	if in.StartedAt.IsZero() {
		return nil, errors.New("startedAt is required")
	}
	// 未来禁止などのルールは後で拡張
	_ = time.Now()

	w := &models.Workout{
		UserID:    userID,
		StartedAt: in.StartedAt,
		Note:      in.Note,
	}
	if err := u.repo.Create(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}


// backend/usecase/workout_usecase.go
func (u *workoutUsecase) End(ctx context.Context, workoutID string, userID string, endedAt time.Time) (*models.Workout, error) {
	// 1) 本人のレコードか確認
	if _, err := u.repo.FindByIDForUser(ctx, workoutID, userID); err != nil {
		return nil, err
	}
	// 2) 更新
	return u.repo.UpdateEndedAt(ctx, workoutID, endedAt)
}

func (u *workoutUsecase) ListByUser(ctx context.Context, userID string, f WorkoutListFilter) ([]models.Workout, int, error) {
	return u.repo.FindWorkoutsByUser(ctx, userID, repository.WorkoutQuery{
		From: f.From, To: f.To, Limit: f.Limit, Offset: f.Offset,
	})
}

func (u *workoutUsecase) GetDetail(ctx context.Context, userID string, workoutID string) (*models.WorkoutDetail, error) {
	w, err := u.repo.FindByIDAndUser(ctx, workoutID, userID)
	if err != nil {
		return nil, err // gorm.ErrRecordNotFound なら 404 に相当
	}
	sets, err := u.repo.ListSetsByWorkout(ctx, workoutID)
	if err != nil {
		return nil, err
	}

	// 念のため所有者一致を保険でチェック（二重チェック）
	if w.UserID != userID {
		return nil, errors.New("forbidden")
	}

	return &models.WorkoutDetail{
		Workout: *w,
		Sets:    sets,
	}, nil
}
// 共通 NotFound 判定

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}