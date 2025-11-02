type Props = {
  activeTab: "workouts" | "body";
  onTabChange: (tab: "workouts" | "body") => void;
  userInitials?: string;
  userName?: string | null;
  onLogout: () => void;
  onAddWorkout: () => void;
};

export default function Header({
  activeTab,
  onTabChange,
  userInitials,
  userName,
  onLogout,
  onAddWorkout,
}: Props) {
  return (
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
          onClick={() => onTabChange("workouts")}
        >
          ワークアウト
        </button>
        <button
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
            activeTab === "body"
              ? "bg-blue-600 text-white shadow-md shadow-blue-400/40"
              : "text-slate-500 hover:bg-slate-100"
          }`}
          onClick={() => onTabChange("body")}
        >
          体組成記録
        </button>
      </nav>

      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
            {userInitials || ""}
          </span>
          <span>{userName ?? ""}</span>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          onClick={onLogout}
        >
          ログアウト
        </button>
        <button
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700"
          onClick={onAddWorkout}
        >
          + ワークアウト追加
        </button>
      </div>
    </header>
  );
}
