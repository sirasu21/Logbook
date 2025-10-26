package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
)

type BodyMetricRepository interface {
	ListByUser(ctx context.Context, userID string, f BodyMetricListFilter) ([]models.BodyMetric, int64, error)
	Create(ctx context.Context, m *models.BodyMetric) error
	UpdateOwned(ctx context.Context, userID, id string, upd UpdateBodyMetricFields) (*models.BodyMetric, error)
	DeleteOwned(ctx context.Context, userID, id string) error
}

type BodyMetricListFilter struct {
	From   *time.Time
	To     *time.Time
	Limit  int
	Offset int
}

type UpdateBodyMetricFields struct {
	MeasuredAt *time.Time
	WeightKg   *float32
	BodyFatPct *float32 // nil を渡すと NULL に更新したい場合は「ptrは非nilで値は0」を渡す or 別制御でもOK
	Note       *string  // nil を渡すと NULL に
}

type bodyMetricRepository struct {
	db *gorm.DB
}

func NewBodyMetricRepository(db *gorm.DB) BodyMetricRepository {
	return &bodyMetricRepository{db: db}
}

func (r *bodyMetricRepository) ListByUser(ctx context.Context, userID string, f BodyMetricListFilter) ([]models.BodyMetric, int64, error) {
	q := r.db.WithContext(ctx).Model(&models.BodyMetric{}).Where("user_id = ?", userID)

	if f.From != nil {
		q = q.Where("measured_at >= ?", *f.From)
	}
	if f.To != nil {
		q = q.Where("measured_at < ?", *f.To)
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

	var items []models.BodyMetric
	if err := q.Order("measured_at DESC, id ASC").
		Limit(f.Limit).
		Offset(f.Offset).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *bodyMetricRepository) Create(ctx context.Context, m *models.BodyMetric) error {
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *bodyMetricRepository) UpdateOwned(ctx context.Context, userID, id string, upd UpdateBodyMetricFields) (*models.BodyMetric, error) {
	var bm models.BodyMetric
	if err := r.db.WithContext(ctx).
		First(&bm, "id = ? AND user_id = ?", id, userID).Error; err != nil {
		return nil, err
	}

	data := map[string]any{}
	if upd.MeasuredAt != nil {
		data["measured_at"] = *upd.MeasuredAt
	}
	if upd.WeightKg != nil {
		data["weight_kg"] = *upd.WeightKg
	}
	if upd.BodyFatPct != nil {
		// 明示的にNULLにしたい場合は Note 同様、ptrを非nilにして値は0区別が必要。要件次第。
		data["body_fat_pct"] = upd.BodyFatPct
	}
	if upd.Note != nil {
		data["note"] = upd.Note // nilならNULLになる
	}

	if len(data) == 0 {
		return &bm, nil
	}
	if err := r.db.WithContext(ctx).Model(&bm).Updates(data).Error; err != nil {
		return nil, err
	}
	return &bm, nil
}

func (r *bodyMetricRepository) DeleteOwned(ctx context.Context, userID, id string) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.BodyMetric{}).Error
}