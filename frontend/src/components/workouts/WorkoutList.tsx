import type {
  Exercise,
  Workout,
  WorkoutSet,
} from "../../lib/api";
import type { DetailState } from "./types";
import {
  exerciseTypeLabel,
  formatDate,
  minutesBetween,
} from "./utils";

type Props = {
  workouts: Workout[];
  expandedIds: Set<string>;
  details: Record<string, DetailState>;
  exerciseMap: Map<string, Exercise>;
  deletingWorkoutId: string | null;
  onToggle: (id: string) => void;
  onOpenCreateSet: (workoutId: string) => void;
  onOpenEditSet: (workoutId: string, set: WorkoutSet) => void;
  onDeleteSet: (workoutId: string, setId: string) => void;
  onOpenEditWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workout: Workout) => void;
  onEndWorkoutNow: (workout: Workout) => void;
};

const renderSetRow = (
  workoutId: string,
  set: WorkoutSet,
  exerciseMap: Map<string, Exercise>,
  onOpenEditSet: (workoutId: string, set: WorkoutSet) => void,
  onDeleteSet: (workoutId: string, setId: string) => void,
) => {
  const exerciseMeta = exerciseMap.get(set.exerciseId);
  const summary = [
    set.weightKg != null ? `${set.weightKg} kg` : null,
    set.reps != null ? `${set.reps} 回` : null,
    set.rpe != null ? `RPE ${set.rpe}` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div
      key={set.id}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <span>セット {set.setIndex + 1}</span>
          {set.isWarmup && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600">
              ウォームアップ
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          種目:{" "}
          {exerciseMeta ? (
            <>
              <span className="font-medium text-slate-700">{exerciseMeta.name}</span>
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {exerciseTypeLabel(exerciseMeta.type)}
              </span>
              {exerciseMeta.ownerUserId ? (
                <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-500">
                  独自種目
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  共有
                </span>
              )}
            </>
          ) : (
            <span className="font-mono">{set.exerciseId}</span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">{summary || "記録なし"}</div>
        {set.note && <div className="mt-2 text-xs text-slate-500">メモ: {set.note}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          onClick={() => onOpenEditSet(workoutId, set)}
        >
          編集
        </button>
        <button
          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-300 hover:text-red-600"
          onClick={() => onDeleteSet(workoutId, set.id)}
        >
          削除
        </button>
      </div>
    </div>
  );
};

export default function WorkoutList({
  workouts,
  expandedIds,
  details,
  exerciseMap,
  deletingWorkoutId,
  onToggle,
  onOpenCreateSet,
  onOpenEditSet,
  onDeleteSet,
  onOpenEditWorkout,
  onDeleteWorkout,
  onEndWorkoutNow,
}: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {workouts.map((workout) => {
        const detailState = details[workout.id];
        const sets = detailState?.data?.sets ?? [];
        const isExpanded = expandedIds.has(workout.id);
        const duration = minutesBetween(workout.startedAt, workout.endedAt);

        return (
          <div
            key={workout.id}
            className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-400/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {workout.note ?? "ワークアウト"}
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatDate(workout.startedAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  onClick={() => onOpenEditWorkout(workout)}
                >
                  編集
                </button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-300 hover:text-red-600"
                  onClick={() => onDeleteWorkout(workout)}
                  disabled={deletingWorkoutId === workout.id}
                >
                  {deletingWorkoutId === workout.id ? "削除中..." : "削除"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">
                🧱 {detailState?.loading && !detailState?.data ? "…" : sets.length} セット
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                ⏱ {duration != null ? `${duration} 分` : "-"}
              </span>
              {workout.endedAt ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-600">
                  完了
                </span>
              ) : (
                <button
                  className="rounded-full bg-blue-100 px-3 py-1 text-blue-600 transition hover:bg-blue-200"
                  onClick={() => onEndWorkoutNow(workout)}
                >
                  今すぐ終了
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">ID: {workout.id}</span>
              <button
                className="text-blue-600 transition hover:underline"
                onClick={() => onToggle(workout.id)}
              >
                {isExpanded ? "閉じる" : "詳細を表示"}
              </button>
            </div>

            {isExpanded && (
              <div className="space-y-4">
                {detailState?.error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-500">
                    {detailState.error}
                  </div>
                )}
                {detailState?.loading && !detailState?.data ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                    セット情報を読み込み中...
                  </div>
                ) : sets.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                    セットの記録はまだありません。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sets.map((set) =>
                      renderSetRow(workout.id, set, exerciseMap, onOpenEditSet, onDeleteSet)
                    )}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
                    onClick={() => onOpenCreateSet(workout.id)}
                  >
                    + セット追加
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
