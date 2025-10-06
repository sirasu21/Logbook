package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
)

type WorkoutSetRepository interface {
	FindByID(ctx context.Context, id string) (*models.WorkoutSet, error)
	Create(ctx context.Context, ws *models.WorkoutSet) error
	Update(ctx context.Context, ws *models.WorkoutSet) error
	Delete(ctx context.Context, id string) error
}

type workoutSetRepository struct {
	db *gorm.DB
}

func NewWorkoutSetRepository(db *gorm.DB) WorkoutSetRepository {
	return &workoutSetRepository{db: db}
}

func (r *workoutSetRepository) FindByID(ctx context.Context, id string) (*models.WorkoutSet, error) {
	var ws models.WorkoutSet
	if err := r.db.WithContext(ctx).First(&ws, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &ws, nil
}

func (r *workoutSetRepository) Create(ctx context.Context, ws *models.WorkoutSet) error {
	return r.db.WithContext(ctx).Create(ws).Error
}

func (r *workoutSetRepository) Update(ctx context.Context, ws *models.WorkoutSet) error {
	return r.db.WithContext(ctx).Save(ws).Error
}

func (r *workoutSetRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&models.WorkoutSet{}, "id = ?", id).Error
}