package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
)

type ExerciseRepository interface {
	FindByID(ctx context.Context, id string) (*models.Exercise, error)
}

type exerciseRepository struct{ db *gorm.DB }

func NewExerciseRepository(db *gorm.DB) ExerciseRepository {
	return &exerciseRepository{db: db}
}

func (r *exerciseRepository) FindByID(ctx context.Context, id string) (*models.Exercise, error) {
	var ex models.Exercise
	if err := r.db.WithContext(ctx).First(&ex, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &ex, nil
}