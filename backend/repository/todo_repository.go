package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
)

type TodoRepository interface {
    FindByLineUserID(ctx context.Context, lineUserID string) ([]models.Todo, error)
    Create(ctx context.Context, t *models.Todo) error
    GetByIDAndUser(ctx context.Context, id uint, userID string) (models.Todo, error)
    Update(ctx context.Context, t *models.Todo) error
    DeleteByIDAndUser(ctx context.Context, id uint, userID string) (int64, error)
}

type todoRepository struct {
    db *gorm.DB
}

func NewTodoRepository(db *gorm.DB) TodoRepository {
    return &todoRepository{db: db}
}

func (r *todoRepository) FindByLineUserID(ctx context.Context, lineUserID string) ([]models.Todo, error) {
    var todos []models.Todo
    if err := r.db.WithContext(ctx).
        Where("line_user_id = ?", lineUserID).
        Order("created_at DESC").
        Find(&todos).Error; err != nil {
        return nil, err
    }
    return todos, nil
}

func (r *todoRepository) Create(ctx context.Context, t *models.Todo) error {
    return r.db.WithContext(ctx).Create(t).Error
}

func (r *todoRepository) GetByIDAndUser(ctx context.Context, id uint, userID string) (models.Todo, error) {
	var t models.Todo
	err := r.db.WithContext(ctx).
		Where("id = ? AND line_user_id = ?", id, userID).
		First(&t).Error
	return t, err
}

func (r *todoRepository) Update(ctx context.Context, t *models.Todo) error {
	return r.db.WithContext(ctx).Save(t).Error
}

func (r *todoRepository) DeleteByIDAndUser(ctx context.Context, id uint, userID string) (int64, error) {
	tx := r.db.WithContext(ctx).
		Where("id = ? AND line_user_id = ?", id, userID).
		Delete(&models.Todo{})
	return tx.RowsAffected, tx.Error
}