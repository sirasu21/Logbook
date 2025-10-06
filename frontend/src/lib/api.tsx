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
};
