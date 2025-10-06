// src/App.tsx
import { useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import Header from "./components/Header";
import NewTodoForm from "./components/NewTodoForm";
import TodoList from "./components/TodoList";
import WorkoutsPanel from "./components/WorkoutsPanel";
import { api, type Me, type Todo } from "./lib/api";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [todoErr, setTodoErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoadingMe(false));
  }, []);

  const reloadTodos = () => {
    if (!me) return;
    setLoadingTodos(true);
    setTodoErr(null);
    api
      .listTodos()
      .then(setTodos)
      .catch((e) => setTodoErr(e.message))
      .finally(() => setLoadingTodos(false));
  };

  useEffect(() => {
    if (me) reloadTodos();
  }, [me]);

  const createTodo = async (content: string) => {
    await api.createTodo(content);
    await reloadTodos();
  };
  const updateTodo = async (id: number, content: string) => {
    await api.updateTodo(id, content);
    await reloadTodos();
  };
  const deleteTodo = async (id: number) => {
    await api.deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id)); // 即時反映
  };

  if (loadingMe) return <p>Loading...</p>;

  return (
    <AppShell>
      <Header
        name={me?.name}
        onLogin={() => api.login()}
        onLogout={() => api.logout()}
        onReload={reloadTodos}
        reloading={loadingTodos}
      />

      {me ? (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row">
              {me?.picture && (
                <img
                  src={me.picture}
                  alt={me.name}
                  width={40}
                  height={40}
                  style={{ borderRadius: 10 }}
                />
              )}
              <div>
                <div>
                  <b>{me.name}</b>
                </div>
                <div className="mono">{me.userId}</div>
              </div>
            </div>
          </div>

          <NewTodoForm onCreate={createTodo} />
          <h2 style={{ marginTop: 24 }}>Your Todos</h2>
          <TodoList
            todos={todos}
            loading={loadingTodos}
            error={todoErr}
            onUpdate={updateTodo}
            onDelete={deleteTodo}
          />
          <WorkoutsPanel />
        </>
      ) : (
        <div className="app-container">
          <div className="card">
            <p>Not signed in.</p>
            <p>まずはLINE公式アカウントを友だち追加してください。</p>
            <img
              src="https://qr-official.line.me/sid/L/892jcodc.png"
              alt="LINE 友だち追加 QRコード"
              className="qr-img"
              style={{
                width: 180,
                height: 180,
                marginTop: 12,
                borderRadius: 8,
              }}
            />
            <p style={{ fontSize: 14, color: "#aaa", marginTop: 8 }}>
              スマホでQRコードを読み取って友だち追加
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
