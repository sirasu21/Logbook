package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sirasu21/Logbook/backend/models"
	repository "github.com/sirasu21/Logbook/backend/repository/web"
	"gorm.io/gorm"
)

type WorkoutUsecase interface {
	Create(ctx context.Context, userID string, in models.CreateWorkoutInput, isFromLine bool) (*models.Workout, error)
	End(ctx context.Context, workoutID string, userID string, endedAt time.Time) (*models.Workout, error)
	ListByUser(ctx context.Context, userID string, f WorkoutListFilter) ([]models.Workout, int, error)
	GetDetail(ctx context.Context, userID string, workoutID string) (*models.WorkoutDetail, error)
	Update(ctx context.Context, workoutID, userID string, in models.UpdateWorkoutInput) (*models.Workout, error)
	Delete(ctx context.Context, workoutID, userID string) error
	GetLatestLineWorkoutID(ctx context.Context, userID string, onlyOpen bool) (string, error)
}

type WorkoutListFilter struct {
	From   *time.Time
	To     *time.Time
	Limit  int
	Offset int
}

type workoutUsecase struct {
	repo    repository.WorkoutRepository
	setRepo repository.WorkoutSetRepository
}

func NewWorkoutUsecase(repo repository.WorkoutRepository, setRepo repository.WorkoutSetRepository) WorkoutUsecase {
	return &workoutUsecase{repo: repo, setRepo: setRepo}
}

func (u *workoutUsecase) Create(ctx context.Context, userID string, in models.CreateWorkoutInput, isFromLine bool) (*models.Workout, error) {
	if err := ensureUserID(userID); err != nil {
		return nil, err
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
		IsFromLine:isFromLine ,
	}
	if err := u.repo.Create(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

// backend/usecase/workout_usecase.go
func (u *workoutUsecase) End(ctx context.Context, workoutID string, userID string, endedAt time.Time) (*models.Workout, error) {
	// 1) 本人のレコードか確認
	if err := ensureUserID(userID); err != nil {
		return nil, err
	}
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
	w, err := u.ensureWorkout(ctx, workoutID, userID)
	if err != nil {
		return nil, err // gorm.ErrRecordNotFound なら 404 に相当
	}
	sets, err := u.repo.ListSetsByWorkout(ctx, workoutID)
	if err != nil {
		return nil, err
	}

	return &models.WorkoutDetail{
		Workout: *w,
		Sets:    sets,
	}, nil
}

func (u *workoutUsecase) Update(ctx context.Context, workoutID, userID string, in models.UpdateWorkoutInput) (*models.Workout, error) {
	if err := ensureUserID(userID); err != nil {
		return nil, err
	}
	updates := collectWorkoutUpdates(in)
	return u.repo.UpdateWorkoutByIDAndUser(ctx, workoutID, userID, updates)
}

func (u *workoutUsecase) Delete(ctx context.Context, workoutID, userID string) error {
	if _, err := u.ensureWorkout(ctx, workoutID, userID); err != nil {
		return err
	}
	if err := u.setRepo.DeleteByWorkoutID(ctx, workoutID); err != nil {
		return err
	}
	return u.repo.DeleteWorkoutByIDAndUser(ctx, workoutID, userID)
}

// 共通 NotFound 判定

func IsNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

// internal helpers ----------------------------------------------------------

func ensureUserID(userID string) error {
	if userID == "" {
		return errors.New("unauthorized")
	}
	return nil
}

func (u *workoutUsecase) ensureWorkout(ctx context.Context, workoutID, userID string) (*models.Workout, error) {
	if err := ensureUserID(userID); err != nil {
		return nil, err
	}
	w, err := u.repo.FindByIDAndUser(ctx, workoutID, userID)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return w, nil
}

func collectWorkoutUpdates(in models.UpdateWorkoutInput) map[string]any {
	updates := make(map[string]any)
	if in.StartedAt != nil {
		updates["started_at"] = *in.StartedAt
	}
	if in.EndedAt != nil {
		updates["ended_at"] = in.EndedAt
	}
	if in.Note != nil {
		note := strings.TrimSpace(*in.Note)
		if note == "" {
			updates["note"] = nil
		} else {
			updates["note"] = note
		}
	}
	return updates
}

func (u *workoutUsecase) GetLatestLineWorkoutID(ctx context.Context, userID string, onlyOpen bool) (string, error) {
	if userID == "" {
		return "", errors.New("unauthorized")
	}
	w, err := u.repo.FindLatestFromLineByUser(ctx, userID, onlyOpen)
	if err != nil {
		return "", err
	}
	if w == nil {
		return "", errors.New("not found")
	}
	return w.ID, nil
}