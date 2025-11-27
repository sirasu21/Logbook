import type {
  Exercise,
  Workout,
  WorkoutDetail,
} from "../../lib/api";

export type DetailState = {
  loading: boolean;
  data?: WorkoutDetail;
  error?: string;
};

export type CreateWorkoutForm = {
  title: string;
  startedAt: string;
  durationMinutes: string;
};

export type EditWorkoutModalState = {
  workout: Workout;
  title: string;
  startedAt: string;
  endedAt: string;
};

export type SetFormState = {
  exerciseId: string;
  setIndex: string;
  reps: string;
  weightKg: string;
  rpe: string;
  restSec: string;
  durationSec: string;
  distanceM: string;
  note: string;
  isWarmup: boolean;
};

export type SetModalState =
  | {
      mode: "create";
      workoutId: string;
      form: SetFormState;
    }
  | {
      mode: "edit";
      workoutId: string;
      setId: string;
      form: SetFormState;
    };

export type ExerciseFormState = {
  name: string;
  type: string;
  primaryMuscle: string;
  isActive: boolean;
};

export type ExerciseModalState =
  | {
      mode: "create";
      form: ExerciseFormState;
    }
  | {
      mode: "edit";
      exercise: Exercise;
      form: ExerciseFormState;
    };

export type ExerciseFilterState = {
  query: string;
  onlyMine: boolean;
  type: "all" | "strength" | "cardio" | "other";
};

export const exerciseTypes: Array<{ value: string; label: string }> = [
  { value: "strength", label: "筋力" },
  { value: "cardio", label: "有酸素" },
  { value: "other", label: "その他" },
];
