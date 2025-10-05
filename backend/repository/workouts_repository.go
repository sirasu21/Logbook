package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
)

type WorkoutRepository interface {
	Create(ctx context.Context, w *models.Workout) error
	// ユーザー本人のワークアウトだけ取得
	FindByIDForUser(ctx context.Context, workoutID string, userID string) (*models.Workout, error)
	// ended_at を更新
	UpdateEndedAt(ctx context.Context, workoutID string, endedAt time.Time) (*models.Workout, error)
	FindWorkoutsByUser(ctx context.Context, userID string, q WorkoutQuery) ([]models.Workout, int, error)
	FindWorkoutByID(ctx context.Context, userID string, id string) (*models.Workout, error)
}

type WorkoutQuery struct {
	From   *time.Time
	To     *time.Time
	Limit  int
	Offset int
}

type workoutRepository struct {
	db *gorm.DB
}

func NewWorkoutRepository(db *gorm.DB) WorkoutRepository {
	return &workoutRepository{db: db}
}

func (r *workoutRepository) Create(ctx context.Context, w *models.Workout) error {
	return r.db.WithContext(ctx).Create(w).Error
}

func (r *workoutRepository) FindByIDForUser(ctx context.Context, workoutID string, userID string) (*models.Workout, error) {
	var w models.Workout
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", workoutID, userID).
		First(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *workoutRepository) UpdateEndedAt(ctx context.Context, workoutID string, endedAt time.Time) (*models.Workout, error) {
	// 更新してから再取得（RETURNING がほしければ Update + First でもOK）
	if err := r.db.WithContext(ctx).
		Model(&models.Workout{}).
		Where("id = ?", workoutID).
		Update("ended_at", endedAt).Error; err != nil {
		return nil, err
	}

	var w models.Workout
	if err := r.db.WithContext(ctx).First(&w, "id = ?", workoutID).Error; err != nil {
		return nil, err
	}
	return &w, nil
}


func (r *workoutRepository) FindWorkoutsByUser(ctx context.Context, userID string, q WorkoutQuery) ([]models.Workout, int, error) {
	tx := r.db.WithContext(ctx).Model(&models.Workout{}).Where("user_id = ?", userID)
	if q.From != nil {
		tx = tx.Where("started_at >= ?", *q.From)
	}
	if q.To != nil {
		tx = tx.Where("started_at < ?", *q.To)
	}

	// total
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// items
	var items []models.Workout
	tx2 := tx.Order("started_at DESC")
	if q.Limit > 0 {
		tx2 = tx2.Limit(q.Limit)
	}
	if q.Offset > 0 {
		tx2 = tx2.Offset(q.Offset)
	}
	if err := tx2.Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, int(total), nil
}

func (r *workoutRepository) FindWorkoutByID(ctx context.Context, userID string, id string) (*models.Workout, error) {
	var w models.Workout
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&w).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &w, nil
}