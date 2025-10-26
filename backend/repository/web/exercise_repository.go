package repository

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
)

type ExerciseRepository interface {
	FindByID(ctx context.Context, id string) (*models.Exercise, error)
	List(ctx context.Context, userID string, f ListExercisesFilter) ([]models.Exercise, int64, error)
	GetByID(ctx context.Context, id string) (*models.Exercise, error)
	Create(ctx context.Context, ex *models.Exercise) error
	UpdateOwned(ctx context.Context, userID string, id string, upd UpdateExerciseFields) (*models.Exercise, error)
	DeleteOwned(ctx context.Context, userID string, id string) error
	baseVisibleQuery(userID string) *gorm.DB
}

type ListExercisesFilter struct {
	Q        string
	Type     *string
	OnlyMine bool
	Limit    int
	Offset   int
}

type UpdateExerciseFields struct {
	Name          *string
	Type          *string
	PrimaryMuscle *string
	IsActive      *bool
}

type exerciseRepository struct {
	db *gorm.DB
}

func NewExerciseRepository(db *gorm.DB) ExerciseRepository {
	return &exerciseRepository{db: db}
}

func (r *exerciseRepository) baseVisibleQuery(userID string) *gorm.DB {
	// 可視対象: グローバル（owner_user_id IS NULL）or 自分の独自種目
	return r.db.Model(&models.Exercise{}).
		Where("owner_user_id IS NULL OR owner_user_id = ?", userID)
}

func (r *exerciseRepository) List(ctx context.Context, userID string, f ListExercisesFilter) ([]models.Exercise, int64, error) {
	q := r.db.WithContext(ctx).Model(&models.Exercise{})

	if f.OnlyMine {
		q = q.Where("owner_user_id = ?", userID)
	} else {
		q = q.Where("owner_user_id IS NULL OR owner_user_id = ?", userID)
	}

	if s := strings.TrimSpace(f.Q); s != "" {
		q = q.Where("name ILIKE ?", "%"+s+"%")
	}
	if f.Type != nil && *f.Type != "" {
		q = q.Where("type = ?", *f.Type)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Offset < 0 {
		f.Offset = 0
	}

	var items []models.Exercise
	if err := q.Order("name ASC, id ASC").
		Limit(f.Limit).
		Offset(f.Offset).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *exerciseRepository) GetByID(ctx context.Context, id string) (*models.Exercise, error) {
	var ex models.Exercise
	if err := r.db.WithContext(ctx).
		First(&ex, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &ex, nil
}

func (r *exerciseRepository) Create(ctx context.Context, ex *models.Exercise) error {
	return r.db.WithContext(ctx).Create(ex).Error
}

func (r *exerciseRepository) UpdateOwned(ctx context.Context, userID string, id string, upd UpdateExerciseFields) (*models.Exercise, error) {
	// 自分の独自種目のみ
	var ex models.Exercise
	if err := r.db.WithContext(ctx).
		First(&ex, "id = ? AND owner_user_id = ?", id, userID).Error; err != nil {
		return nil, err
	}

	data := map[string]any{}
	if upd.Name != nil {
		data["name"] = *upd.Name
	}
	if upd.Type != nil {
		data["type"] = *upd.Type
	}
	if upd.PrimaryMuscle != nil {
		data["primary_muscle"] = upd.PrimaryMuscle // nil なら NULL になる
	}
	if upd.IsActive != nil {
		data["is_active"] = *upd.IsActive
	}
	if len(data) == 0 {
		return &ex, nil
	}

	if err := r.db.WithContext(ctx).
		Model(&ex).Updates(data).Error; err != nil {
		return nil, err
	}

	return &ex, nil
}

func (r *exerciseRepository) DeleteOwned(ctx context.Context, userID string, id string) error {
	// 自分の独自種目のみ削除可
	return r.db.WithContext(ctx).
		Where("id = ? AND owner_user_id = ?", id, userID).
		Delete(&models.Exercise{}).Error
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