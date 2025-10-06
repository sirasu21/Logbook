package models

import "time"

type WorkoutSet struct {
	ID         string   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	WorkoutID  string   `gorm:"type:uuid;index:idx_workout_order,priority:1;not null" json:"workoutId"`
	ExerciseID string   `gorm:"type:uuid;index;not null"                       json:"exerciseId"`
	SetIndex   int      `gorm:"not null;index:idx_workout_order,priority:2"    json:"setIndex"`

	// 筋トレ向け
	Reps     *int     `json:"reps,omitempty"`
	WeightKg *float32 `json:"weightKg,omitempty"`
	RPE      *float32 `json:"rpe,omitempty"` // 0〜10 をアプリ側でバリデーション

	// 有酸素向け
	DurationSec *int     `json:"durationSec,omitempty"` // 秒
	DistanceM   *float32 `json:"distanceM,omitempty"`   // メートル

	// 共通
	RestSec  *int    `json:"restSec,omitempty"`
	IsWarmup bool    `gorm:"not null;default:false" json:"isWarmup"`
	Note     *string `gorm:"type:text"              json:"note,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}


type WorkoutSetCreateInput struct {
	ExerciseID  string   `json:"exerciseId"  validate:"required,uuid4"`
	SetIndex    int      `json:"setIndex"` // 0なら repoで自動採番でもOK
	Reps        *int     `json:"reps,omitempty"`
	WeightKg    *float32 `json:"weightKg,omitempty"`
	RPE         *float32 `json:"rpe,omitempty"`
	IsWarmup    bool     `json:"isWarmup"`
	RestSec     *int     `json:"restSec,omitempty"`
	Note        *string  `json:"note,omitempty"`
	DurationSec *int     `json:"durationSec,omitempty"`
	DistanceM   *float32 `json:"distanceM,omitempty"`
}

type WorkoutSetUpdateInput struct {
	SetIndex    *int     `json:"setIndex,omitempty"`
	Reps        *int     `json:"reps,omitempty"`
	WeightKg    *float32 `json:"weightKg,omitempty"`
	RPE        *float32 `json:"rpe,omitempty"`
	IsWarmup    *bool    `json:"isWarmup,omitempty"`
	RestSec     *int     `json:"restSec,omitempty"`
	Note        *string  `json:"note,omitempty"`
	DurationSec *int     `json:"durationSec,omitempty"`
	DistanceM   *float32 `json:"distanceM,omitempty"`
}

