import { useEffect, useMemo, useState } from "react";
import WorkoutsPanel from "./components/WorkoutsPanel";
import BodyMetricsPanel from "./components/BodyMetricsPanel";
import Header from "./components/Header";
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
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userInitials={userInitials || ""}
        userName={me.name ?? me.userId}
        onLogout={() => api.logout()}
        onAddWorkout={() => setAddModalOpen(true)}
      />

      <main className="flex-1">
        {activeTab === "workouts" ? (
          <WorkoutsPanel
            addModalOpen={addModalOpen}
            onCloseAddModal={() => setAddModalOpen(false)}
          />
        ) : (
          <BodyMetricsPanel />
        )}
      </main>
    </div>
  );
}
