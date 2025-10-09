// src/lib/api.ts
export const backend = import.meta.env.VITE_BACKEND_ORIGIN as string;

async function jfetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${backend}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export type Me = {
  provider: string;
  userId: string;
  name: string;
  picture?: string;
  statusMessage?: string;
};
export type Todo = {
  id: number;
  lineUserId: string;
  content: string;
  createdAt: string;
};

export type Workout = {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};
export type WorkoutList = {
  items: Workout[];
  total: number;
  limit: number;
  offset: number;
};

export type WorkoutSet = {
  id: string;
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  restSec?: number;
  note?: string;
  durationSec?: number;
  distanceM?: number;
  isWarmup: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutDetail = {
  workout: Workout;
  sets: WorkoutSet[];
};

export type UpdateWorkoutInput = {
  note?: string | null;
  startedAt?: string;
  endedAt?: string | null;
};

export type CreateWorkoutSetInput = {
  exerciseId: string;
  setIndex?: number;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  restSec?: number;
  note?: string;
  durationSec?: number;
  distanceM?: number;
  isWarmup?: boolean;
};

export type UpdateWorkoutSetInput = {
  setIndex?: number;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  restSec?: number;
  note?: string;
  durationSec?: number;
  distanceM?: number;
  isWarmup?: boolean;
};

export type Exercise = {
  id: string;
  ownerUserId?: string;
  name: string;
  type: string;
  primaryMuscle?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseList = {
  items: Exercise[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateExerciseInput = {
  name: string;
  type: string;
  primaryMuscle?: string;
};

export type UpdateExerciseInput = {
  name?: string;
  type?: string;
  primaryMuscle?: string | null;
  isActive?: boolean;
};

export type BodyMetric = {
  id: string;
  userId: string;
  measuredAt: string;
  weightKg: number;
  bodyFatPct?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type BodyMetricList = {
  items: BodyMetric[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateBodyMetricInput = {
  measuredAt: string;
  weightKg: number;
  bodyFatPct?: number;
  note?: string;
};

export type UpdateBodyMetricInput = {
  measuredAt?: string;
  weightKg?: number;
  bodyFatPct?: number | null;
  note?: string | null;
};

export const api = {
  me: () => jfetch<Me>("/api/me"),
  listTodos: () => jfetch<Todo[]>("/api/todos"),
  createTodo: (content: string) =>
    jfetch<Todo>("/api/todos", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  updateTodo: (id: number, content: string) =>
    jfetch<Todo>(`/api/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  deleteTodo: (id: number) =>
    jfetch<void>(`/api/todos/${id}`, { method: "DELETE" }),
  login: () => (window.location.href = `${backend}/api/auth/line/login`),
  logout: () => (window.location.href = `${backend}/api/logout`),
  listWorkouts: (params?: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    const path = qs ? `/api/workouts?${qs}` : "/api/workouts";
    return jfetch<WorkoutList>(path);
  },
  createWorkout: (startedAt: string, note?: string) =>
    jfetch<Workout>("/api/workouts", {
      method: "POST",
      body: JSON.stringify({ startedAt, note }),
    }),
  endWorkout: (id: string, endedAt?: string) =>
    jfetch<Workout>(`/api/workouts/${id}/end`, {
      method: "PATCH",
      body: JSON.stringify(endedAt ? { endedAt } : {}),
    }),
  updateWorkout: (id: string, input: UpdateWorkoutInput) =>
    jfetch<Workout>(`/api/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteWorkout: (id: string) =>
    jfetch<void>(`/api/workouts/${id}`, { method: "DELETE" }),
  getWorkoutDetail: (id: string) =>
    jfetch<WorkoutDetail>(`/api/workouts/${id}/detail`),
  addWorkoutSet: (workoutId: string, input: CreateWorkoutSetInput) =>
    jfetch<WorkoutSet>(`/api/workouts/${workoutId}/sets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateWorkoutSet: (setId: string, input: UpdateWorkoutSetInput) =>
    jfetch<WorkoutSet>(`/api/workout_sets/${setId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteWorkoutSet: (setId: string) =>
    jfetch<void>(`/api/workout_sets/${setId}`, { method: "DELETE" }),
  listExercises: (params?: {
    q?: string;
    type?: string;
    onlyMine?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.type) search.set("type", params.type);
    if (params?.onlyMine) search.set("onlyMine", "true");
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.offset != null) search.set("offset", String(params.offset));
    const qs = search.toString();
    const path = qs ? `/api/exercises?${qs}` : "/api/exercises";
    return jfetch<ExerciseList>(path);
  },
  getExercise: (id: string) => jfetch<Exercise>(`/api/exercises/${id}`),
  createExercise: (input: CreateExerciseInput) =>
    jfetch<Exercise>("/api/exercises", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateExercise: (id: string, input: UpdateExerciseInput) =>
    jfetch<Exercise>(`/api/exercises/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteExercise: (id: string) =>
    jfetch<void>(`/api/exercises/${id}`, { method: "DELETE" }),
  listBodyMetrics: (params?: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.offset != null) search.set("offset", String(params.offset));
    const qs = search.toString();
    const path = qs ? `/api/body_metrics?${qs}` : "/api/body_metrics";
    return jfetch<BodyMetricList>(path);
  },
  createBodyMetric: (input: CreateBodyMetricInput) =>
    jfetch<BodyMetric>("/api/body_metrics", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateBodyMetric: (id: string, input: UpdateBodyMetricInput) =>
    jfetch<BodyMetric>(`/api/body_metrics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteBodyMetric: (id: string) =>
    jfetch<void>(`/api/body_metrics/${id}`, { method: "DELETE" }),
};
