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
};
