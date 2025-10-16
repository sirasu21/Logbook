package models

import "time"

type Workout struct {
	ID        string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    string     `gorm:"type:uuid;index;not null"                       json:"userId"`
	StartedAt time.Time  `gorm:"not null"                                       json:"startedAt"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	Note      *string    `gorm:"type:text"                                      json:"note,omitempty"`
	IsFromLine bool      `gorm:"not null;default:false"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`

	// 便利に preload したいとき用（必要になったら）
	Sets []WorkoutSet `gorm:"foreignKey:WorkoutID" json:"-"`
}

type CreateWorkoutInput struct {
	StartedAt time.Time `json:"startedAt"`      // 必須（RFC3339）
	Note      *string   `json:"note,omitempty"` // 任意
}

type UpdateWorkoutInput struct {
	StartedAt *time.Time `json:"startedAt,omitempty"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	Note      *string    `json:"note,omitempty"`
}
