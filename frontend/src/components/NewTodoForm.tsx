// src/components/NewTodoForm.tsx
import { useState } from "react";
type Props = { onCreate: (content: string) => Promise<void> };
export default function NewTodoForm({ onCreate }: Props) {
  const [content, setContent] = useState("");
  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    await onCreate(text);
    setContent("");
  };
  return (
    <div className="card" style={{ margin: "16px 0" }}>
      <h2 style={{ marginTop: 0 }}>New Todo</h2>
      <div className="row">
        <input
          className="input"
          placeholder="やること"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button
          className="btn primary"
          onClick={submit}
          disabled={!content.trim()}
        >
          追加
        </button>
      </div>
    </div>
  );
}
