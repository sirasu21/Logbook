import { useEffect, useMemo, useState } from "react";
import WorkoutsPanel from "./components/WorkoutsPanel";
import { api, type Me } from "./lib/api";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [activeTab, setActiveTab] = useState<"workouts" | "body">("workouts");
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoadingMe(false));
  }, []);

  const userInitials = useMemo(() => {
    const name = me?.name?.trim();
    if (!name) return "";
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [me?.name]);

  if (loadingMe) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="card-shadow flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl bg-white/80 p-10 text-center shadow-xl">
          <div className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-2xl text-white shadow-lg">
              🏋️
            </span>
            Logbook
          </div>
          <h2 className="text-2xl font-semibold">ログインが必要です</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            LINE アカウントでサインインして、トレーニングの記録を管理しましょう。
          </p>
          <img
            src="https://qr-official.line.me/sid/L/892jcodc.png"
            alt="LINE 友だち追加 QRコード"
            className="h-44 w-44 rounded-2xl border border-slate-200 shadow-sm"
          />
          <p className="text-xs text-slate-500">QRコードを読み取って友だち追加し、ログインしてください。</p>
          <button
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700"
            onClick={() => api.login()}
          >
            LINE でログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-6 rounded-3xl bg-white/80 p-6 shadow-lg shadow-blue-500/10 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-2xl text-white shadow-lg">
            🏋️
          </span>
          <div>
            <div className="text-lg font-semibold text-slate-900">Logbook</div>
            <p className="text-xs text-slate-500">あなたのトレーニングをスマートに記録</p>
          </div>
        </div>
        <nav className="flex items-center gap-4 self-start sm:self-center">
          <button
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              activeTab === "workouts"
                ? "bg-blue-600 text-white shadow-md shadow-blue-400/40"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("workouts")}
          >
            ワークアウト
          </button>
          <button
            className="rounded-full px-5 py-2 text-sm font-semibold text-slate-400"
            disabled
          >
            体組成記録 (準備中)
          </button>
        </nav>
        <div className="flex flex-1 items-center justify-end gap-4">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
              {userInitials || ""}
            </span>
            <span>{me.name ?? me.userId}</span>
          </div>
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            onClick={() => api.logout()}
          >
            ログアウト
          </button>
          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700"
            onClick={() => setAddModalOpen(true)}
          >
            + ワークアウト追加
          </button>
        </div>
      </header>

      <main className="flex-1">
        {activeTab === "workouts" ? (
          <WorkoutsPanel
            addModalOpen={addModalOpen}
            onCloseAddModal={() => setAddModalOpen(false)}
          />
        ) : (
          <div className="rounded-3xl bg-white/70 p-12 text-center text-sm text-slate-500 shadow-md">
            体組成記録は準備中です。
          </div>
        )}
      </main>
    </div>
  );
}
