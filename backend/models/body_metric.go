package models

import "time"

type BodyMetric struct {
	ID         string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID     string     `gorm:"type:uuid;index;not null"                       json:"userId"`
	MeasuredAt time.Time  `gorm:"not null;index"                                  json:"measuredAt"`
	WeightKg   float32    `gorm:"not null"                                        json:"weightKg"`
	BodyFatPct *float32   `json:"bodyFatPct,omitempty"`
	Note       *string    `gorm:"type:text"                                       json:"note,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// （メモ）重複防止のため UNIQUE (user_id, measured_at) をマイグレーションで付けると良い