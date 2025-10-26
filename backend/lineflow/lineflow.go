// state.go
package lineflow

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	usecaseLine "github.com/sirasu21/Logbook/backend/usecase/LINE"
)

type State string

const (
	StateIdle        State = "idle"
	StateAddExercise State = "add_exercise"
	StateAddWeight   State = "add_weight"
	StateAddCount    State = "add_count"
)

type Pending struct {
	ExerciseID  string   `json:"exerciseId"`
	Weight      *float64 `json:"weight,omitempty"`
	Repetitions *int     `json:"repetitions,omitempty"`
}

type LineWorkoutState struct {
	State     State     `json:"state"`
	WorkoutID string    `json:"workoutId"`
	Pending   Pending   `json:"pending"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func defaultState() LineWorkoutState {
	return LineWorkoutState{State: StateIdle, UpdatedAt: time.Now().UTC()}
}
func (s *LineWorkoutState) Touch() { s.UpdatedAt = time.Now().UTC() }
func (s *LineWorkoutState) Ready() bool {
	return s.WorkoutID != "" &&
		s.Pending.ExerciseID != "" &&
		s.Pending.Weight != nil &&
		s.Pending.Repetitions != nil
}

func redisKey(lineUserID string) string {
	return fmt.Sprintf("line:ctx:%s:state", lineUserID)
}



func LoadState(ctx context.Context, lineuc usecaseLine.LineUsecase, lineUID string) (LineWorkoutState, error) {
	raw, err := lineuc.Get(ctx, redisKey(lineUID))
	if err != nil || raw == "" {
		return defaultState(), nil
	}
	var s LineWorkoutState
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		return defaultState(), nil
	}
	return s, nil
}

func SaveState(ctx context.Context, lineuc usecaseLine.LineUsecase, lineUID string, s LineWorkoutState, ttl time.Duration) error {
	s.Touch()
	return lineuc.Set(ctx, redisKey(lineUID), s, ttl)
}

func ClearState(ctx context.Context, lineuc usecaseLine.LineUsecase, lineUID string) { _ = lineuc.Del(ctx, redisKey(lineUID)) }