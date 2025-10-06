package models

type WorkoutDetail struct {
	Workout Workout      `json:"workout"`
	Sets    []WorkoutSet `json:"sets"`
}
