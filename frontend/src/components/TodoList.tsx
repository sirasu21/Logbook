// src/components/TodoList.tsx
import type { Todo } from "../lib/api";
import TodoItem from "./TodoItem";

type Props = {
  todos: Todo[];
  loading: boolean;
  error?: string | null;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};
export default function TodoList({
  todos,
  loading,
  error,
  onUpdate,
  onDelete,
}: Props) {
  if (loading) return <p>Loading todos...</p>;
  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (todos.length === 0) return <p>No todos yet.</p>;
  return (
    <ul className="list">
      {todos.map((t) => (
        <TodoItem key={t.id} todo={t} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </ul>
  );
}
