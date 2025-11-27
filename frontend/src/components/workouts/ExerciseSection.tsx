import type { Exercise } from "../../lib/api";
import type { ExerciseFilterState } from "./types";
import { exerciseTypeLabel } from "./utils";
import { exerciseTypes } from "./types";

type Props = {
  filters: ExerciseFilterState;
  sortedExercises: Exercise[];
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onToggleOnlyMine: () => void;
  onTypeChange: (value: ExerciseFilterState["type"]) => void;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
};

export default function ExerciseSection({
  filters,
  sortedExercises,
  loading,
  error,
  onQueryChange,
  onToggleOnlyMine,
  onTypeChange,
  onRefresh,
  onOpenCreate,
  onOpenEdit,
  onDelete,
}: Props) {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-md shadow-slate-400/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">種目 (デバッグ)</h2>
          <p className="text-xs text-slate-500">
            グローバル種目と自分の独自種目を確認・編集できます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="名前で検索"
            value={filters.query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={filters.type}
            onChange={(e) => onTypeChange(e.target.value as ExerciseFilterState["type"])}
          >
            <option value="all">すべてのタイプ</option>
            {exerciseTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800">
            <input
              type="checkbox"
              checked={filters.onlyMine}
              onChange={onToggleOnlyMine}
            />
            自分の種目のみ
          </label>
          <button
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            onClick={onRefresh}
          >
            再読み込み
          </button>
          <button
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
            onClick={onOpenCreate}
          >
            + 種目追加
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {loading && sortedExercises.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          種目を読み込み中です...
        </div>
      ) : sortedExercises.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
          該当する種目がありません。新しく追加してみてください。
        </div>
      ) : (
        <div className="space-y-3">
          {sortedExercises.map((exercise) => {
            const owned = Boolean(exercise.ownerUserId);
            return (
              <div
                key={exercise.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <span>{exercise.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {exerciseTypeLabel(exercise.type)}
                    </span>
                    {exercise.primaryMuscle && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-500">
                        {exercise.primaryMuscle}
                      </span>
                    )}
                    {!exercise.isActive && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
                        非アクティブ
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ID: <span className="font-mono">{exercise.id}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {exercise.ownerUserId ? "あなたの独自種目" : "管理者共有の標準種目"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onOpenEdit(exercise)}
                    disabled={!owned}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onDelete(exercise)}
                    disabled={!owned}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
