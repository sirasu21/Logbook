package models

import "time"

type ExerciseType string

const (
	ExerciseTypeStrength ExerciseType = "strength"
	ExerciseTypeCardio   ExerciseType = "cardio"
	ExerciseTypeOther    ExerciseType = "other"
)

type Exercise struct {
	ID           string       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OwnerUserID  *string      `gorm:"type:uuid;index"                                json:"ownerUserId,omitempty"` // null=グローバル, 非null=ユーザー独自
	Name         string       `gorm:"size:64;not null"                               json:"name"`
	Type         ExerciseType `gorm:"type:text;not null"                             json:"type"`
	PrimaryMuscle *string     `gorm:"size:64"                                        json:"primaryMuscle,omitempty"`
	IsActive     bool         `gorm:"not null;default:true"                          json:"isActive"`
	CreatedAt    time.Time    `json:"createdAt"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

// （メモ）一意制約はマイグレーションで張るのがおすすめ：
// - グローバル: owner_user_id IS NULL のとき name UNIQUE
// - 独自種目: UNIQUE (owner_user_id, name)