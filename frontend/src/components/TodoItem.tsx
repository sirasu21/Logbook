// src/components/TodoItem.tsx
import { useState } from "react";
import type { Todo } from "../lib/api";

type Props = {
  todo: Todo;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

export default function TodoItem({ todo, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.content);
  const [busy, setBusy] = useState<"update" | "delete" | null>(null);

  const save = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy("update");
    try {
      await onUpdate(todo.id, t);
      setEditing(false);
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    if (!confirm("削除しますか？")) return;
    setBusy("delete");
    try {
      await onDelete(todo.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="item">
      {editing ? (
        <div className="row">
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <button
            className="btn primary"
            onClick={save}
            disabled={!text.trim() || busy === "update"}
          >
            保存
          </button>
          <button
            className="btn"
            onClick={() => (setEditing(false), setText(todo.content))}
            disabled={busy !== null}
          >
            キャンセル
          </button>
        </div>
      ) : (
        <div>
          <b>{todo.content}</b>
          <div className="mono">
            {new Date(todo.createdAt).toLocaleString("ja-JP")}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button
              className="btn"
              onClick={() => setEditing(true)}
              disabled={busy !== null}
            >
              編集
            </button>
            <button className="btn" onClick={del} disabled={busy !== null}>
              削除
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
