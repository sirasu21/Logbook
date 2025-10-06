import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type CreateWorkoutSetInput,
  type UpdateWorkoutInput,
  type UpdateWorkoutSetInput,
  type Workout,
  type WorkoutDetail,
  type WorkoutSet,
} from "../lib/api";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

const formatDateTimeLocal = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const minutesBetween = (start: string, end?: string) => {
  if (!end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
};

type DetailState = {
  loading: boolean;
  data?: WorkoutDetail;
  error?: string;
};

type CreateWorkoutForm = {
  title: string;
  startedAt: string;
  durationMinutes: string;
};

type EditWorkoutModalState = {
  workout: Workout;
  title: string;
  startedAt: string;
  endedAt: string;
};

type SetFormState = {
  exerciseId: string;
  setIndex: string;
  reps: string;
  weightKg: string;
  rpe: string;
  restSec: string;
  durationSec: string;
  distanceM: string;
  note: string;
  isWarmup: boolean;
};

type SetModalState =
  | {
      mode: "create";
      workoutId: string;
      form: SetFormState;
    }
  | {
      mode: "edit";
      workoutId: string;
      setId: string;
      form: SetFormState;
    };

type Props = {
  addModalOpen: boolean;
  onCloseAddModal: () => void;
};

const emptyCreateForm = (): CreateWorkoutForm => ({
  title: "",
  startedAt: formatDateTimeLocal(new Date()),
  durationMinutes: "",
});

const emptySetForm = (defaults?: Partial<SetFormState>): SetFormState => ({
  exerciseId: "",
  setIndex: "",
  reps: "",
  weightKg: "",
  rpe: "",
  restSec: "",
  durationSec: "",
  distanceM: "",
  note: "",
  isWarmup: false,
  ...defaults,
});

const setFormFromSet = (set: WorkoutSet): SetFormState => ({
  exerciseId: set.exerciseId,
  setIndex: set.setIndex != null ? String(set.setIndex) : "",
  reps: set.reps != null ? String(set.reps) : "",
  weightKg: set.weightKg != null ? String(set.weightKg) : "",
  rpe: set.rpe != null ? String(set.rpe) : "",
  restSec: set.restSec != null ? String(set.restSec) : "",
  durationSec: set.durationSec != null ? String(set.durationSec) : "",
  distanceM: set.distanceM != null ? String(set.distanceM) : "",
  note: set.note ?? "",
  isWarmup: set.isWarmup,
});

const parseOptionalInt = (value: string, label: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} は整数で入力してください`);
  }
  return parsed;
};

const parseOptionalFloat = (value: string, label: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} は数値で入力してください`);
  }
  return parsed;
};

export default function WorkoutsPanel({ addModalOpen, onCloseAddModal }: Props) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [createForm, setCreateForm] = useState<CreateWorkoutForm>(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [editingWorkout, setEditingWorkout] = useState<EditWorkoutModalState | null>(null);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);

  const [setModal, setSetModal] = useState<SetModalState | null>(null);
  const [savingSet, setSavingSet] = useState(false);

  const sortedWorkouts = useMemo(
    () =>
      [...workouts].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      ),
    [workouts]
  );

  const loadWorkouts = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setLoadingList(true);
        setListError(null);
      } else {
        setRefreshing(true);
      }
      try {
        const res = await api.listWorkouts({ limit: 50 });
        setWorkouts(res.items);
      } catch (e) {
        setListError((e as Error).message ?? "ワークアウトの取得に失敗しました");
      } finally {
        setLoadingList(false);
        setRefreshing(false);
      }
    },
    []
  );

  const loadDetail = useCallback(
    async (id: string, options?: { force?: boolean }) => {
      setDetails((prev) => {
        const current = prev[id];
        if (current?.loading && !options?.force) return prev;
        return {
          ...prev,
          [id]: { ...current, loading: true, error: undefined },
        };
      });
      try {
        const detail = await api.getWorkoutDetail(id);
        setDetails((prev) => ({
          ...prev,
          [id]: { loading: false, data: detail },
        }));
      } catch (e) {
        setDetails((prev) => ({
          ...prev,
          [id]: {
            loading: false,
            data: prev[id]?.data,
            error: (e as Error).message ?? "詳細の取得に失敗しました",
          },
        }));
      }
    },
    []
  );

  useEffect(() => {
    loadWorkouts("initial");
  }, [loadWorkouts]);

  useEffect(() => {
    if (addModalOpen) {
      setCreateForm(emptyCreateForm());
    }
  }, [addModalOpen]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void loadDetail(id);
      }
      return next;
    });
  };

  const handleCreateWorkout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    if (!createForm.startedAt.trim()) {
      alert("開始日時を入力してください");
      return;
    }
    setCreating(true);
    try {
      const startedAt = new Date(createForm.startedAt);
      if (Number.isNaN(startedAt.getTime())) {
        throw new Error("開始日時の形式が正しくありません");
      }
      const note = createForm.title.trim();
      const workout = await api.createWorkout(
        startedAt.toISOString(),
        note ? note : undefined
      );
      const duration = createForm.durationMinutes.trim();
      if (duration) {
        const parsed = Number(duration);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("時間 (分) は正の数で入力してください");
        }
        const ended = new Date(startedAt.getTime() + parsed * 60000);
        await api.endWorkout(workout.id, ended.toISOString());
      }
      onCloseAddModal();
      await loadWorkouts("refresh");
    } catch (e) {
      alert((e as Error).message ?? "ワークアウトの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const openEditWorkoutModal = (workout: Workout) => {
    setEditingWorkout({
      workout,
      title: workout.note ?? "",
      startedAt: formatDateTimeLocal(new Date(workout.startedAt)),
      endedAt: workout.endedAt
        ? formatDateTimeLocal(new Date(workout.endedAt))
        : "",
    });
  };

  const handleSaveWorkout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingWorkout || savingWorkout) return;

    const { workout, title, startedAt, endedAt } = editingWorkout;
    const payload: UpdateWorkoutInput = {};

    if (title !== workout.note) {
      payload.note = title;
    }

    if (startedAt) {
      const dt = new Date(startedAt);
      if (Number.isNaN(dt.getTime())) {
        alert("開始日時の形式が正しくありません");
        return;
      }
      if (dt.toISOString() !== workout.startedAt) {
        payload.startedAt = dt.toISOString();
      }
    }

    if (endedAt) {
      const dt = new Date(endedAt);
      if (Number.isNaN(dt.getTime())) {
        alert("終了日時の形式が正しくありません");
        return;
      }
      if (workout.endedAt !== dt.toISOString()) {
        payload.endedAt = dt.toISOString();
      }
    } else if (!workout.endedAt) {
      // nothing
    }

    if (Object.keys(payload).length === 0) {
      setEditingWorkout(null);
      return;
    }

    setSavingWorkout(true);
    try {
      const updated = await api.updateWorkout(workout.id, payload);
      setWorkouts((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      void loadDetail(workout.id, { force: true });
      setEditingWorkout(null);
    } catch (e) {
      alert((e as Error).message ?? "ワークアウトの更新に失敗しました");
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleDeleteWorkout = async (workout: Workout) => {
    if (!window.confirm("このワークアウトを削除しますか？セットも削除されます。")) {
      return;
    }
    setDeletingWorkoutId(workout.id);
    try {
      await api.deleteWorkout(workout.id);
      setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
      setDetails((prev) => {
        const next = { ...prev };
        delete next[workout.id];
        return next;
      });
    } catch (e) {
      alert((e as Error).message ?? "ワークアウトの削除に失敗しました");
    } finally {
      setDeletingWorkoutId(null);
    }
  };

  const handleEndWorkoutNow = async (workout: Workout) => {
    try {
      const ended = await api.endWorkout(workout.id);
      setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? ended : w)));
      void loadDetail(workout.id, { force: true });
    } catch (e) {
      alert((e as Error).message ?? "終了の更新に失敗しました");
    }
  };

  const openCreateSetModal = (workoutId: string) => {
    const currentSets = details[workoutId]?.data?.sets ?? [];
    const nextIndex = currentSets.length;
    setSetModal({
      mode: "create",
      workoutId,
      form: emptySetForm({ setIndex: String(nextIndex) }),
    });
  };

  const openEditSetModal = (workoutId: string, set: WorkoutSet) => {
    setSetModal({
      mode: "edit",
      workoutId,
      setId: set.id,
      form: setFormFromSet(set),
    });
  };

  const handleSubmitSet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setModal || savingSet) return;

    const form = setModal.form;
    const exerciseId = form.exerciseId.trim();
    if (!exerciseId) {
      alert("種目 ID を入力してください");
      return;
    }

    try {
      const commonPayload = {
        setIndex: parseOptionalInt(form.setIndex, "セット番号"),
        reps: parseOptionalInt(form.reps, "回数"),
        weightKg: parseOptionalFloat(form.weightKg, "重量"),
        rpe: parseOptionalFloat(form.rpe, "RPE"),
        restSec: parseOptionalInt(form.restSec, "休憩秒数"),
        durationSec: parseOptionalInt(form.durationSec, "時間"),
        distanceM: parseOptionalFloat(form.distanceM, "距離"),
        isWarmup: form.isWarmup,
      } satisfies UpdateWorkoutSetInput;

      const trimmedNote = form.note.trim();
      if (setModal.mode === "create") {
        const payload: CreateWorkoutSetInput = {
          exerciseId,
          ...commonPayload,
          note: trimmedNote === "" ? undefined : trimmedNote,
        };
        setSavingSet(true);
        await api.addWorkoutSet(setModal.workoutId, payload);
      } else {
        const payload: UpdateWorkoutSetInput = {
          ...commonPayload,
          note: trimmedNote === "" ? "" : trimmedNote,
        };
        setSavingSet(true);
        await api.updateWorkoutSet(setModal.setId, payload);
      }
      setSetModal(null);
      void loadDetail(setModal.workoutId, { force: true });
    } catch (e) {
      alert((e as Error).message ?? "セットの保存に失敗しました");
    } finally {
      setSavingSet(false);
    }
  };

  const handleDeleteSet = async (workoutId: string, setId: string) => {
    if (!window.confirm("このセットを削除しますか？")) return;
    try {
      await api.deleteWorkoutSet(setId);
      void loadDetail(workoutId, { force: true });
    } catch (e) {
      alert((e as Error).message ?? "セットの削除に失敗しました");
    }
  };

  const renderSetRow = (workoutId: string, set: WorkoutSet) => {
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
            種目 ID: <span className="font-mono">{set.exerciseId}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{summary || "記録なし"}</div>
          {set.note && <div className="mt-2 text-xs text-slate-500">メモ: {set.note}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            onClick={() => openEditSetModal(workoutId, set)}
          >
            編集
          </button>
          <button
            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-300 hover:text-red-600"
            onClick={() => handleDeleteSet(workoutId, set.id)}
          >
            削除
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">最近のワークアウト</h2>
          <p className="text-xs text-slate-500">最新の 50 件を表示しています。</p>
        </div>
        <button
          className="self-start rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          onClick={() => loadWorkouts("refresh")}
          disabled={refreshing}
        >
          {refreshing ? "更新中..." : "再読み込み"}
        </button>
      </div>

      {listError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
          {listError}
        </div>
      )}

      {loadingList && workouts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-12 text-center text-sm text-slate-500 shadow-lg">
          ワークアウトを読み込み中です...
        </div>
      ) : workouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center text-sm text-slate-500 shadow-inner">
          記録されたワークアウトがまだありません。右上の「ワークアウト追加」から登録しましょう。
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {sortedWorkouts.map((workout) => {
            const detailState = details[workout.id];
            const isExpanded = expanded.has(workout.id);
            const sets = detailState?.data?.sets ?? [];
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
                      onClick={() => openEditWorkoutModal(workout)}
                    >
                      編集
                    </button>
                    <button
                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-300 hover:text-red-600"
                      onClick={() => handleDeleteWorkout(workout)}
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
                      onClick={() => handleEndWorkoutNow(workout)}
                    >
                      今すぐ終了
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono">ID: {workout.id}</span>
                  <button
                    className="text-blue-600 transition hover:underline"
                    onClick={() => toggleExpanded(workout.id)}
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
                        {sets.map((set) => renderSetRow(workout.id, set))}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
                        onClick={() => openCreateSetModal(workout.id)}
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
      )}

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={onCloseAddModal}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">ワークアウトを追加</h3>
              <button className="text-slate-400" onClick={onCloseAddModal}>
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateWorkout}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  タイトル
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="例: 胸・腕トレーニング"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  開始日時
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={createForm.startedAt}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, startedAt: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  時間 (分)
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="例: 60"
                  value={createForm.durationMinutes}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, durationMinutes: e.target.value }))
                  }
                />
                <p className="mt-1 text-xs text-slate-400">
                  入力すると終了時刻を自動で記録します。空欄でも保存できます。
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  onClick={onCloseAddModal}
                  disabled={creating}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
                  disabled={creating}
                >
                  {creating ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingWorkout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setEditingWorkout(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">ワークアウトを編集</h3>
              <button className="text-slate-400" onClick={() => setEditingWorkout(null)}>
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSaveWorkout}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  タイトル
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={editingWorkout.title}
                  onChange={(e) =>
                    setEditingWorkout((prev) =>
                      prev ? { ...prev, title: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  開始日時
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={editingWorkout.startedAt}
                  onChange={(e) =>
                    setEditingWorkout((prev) =>
                      prev ? { ...prev, startedAt: e.target.value } : prev
                    )
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  終了日時 (任意)
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={editingWorkout.endedAt}
                  onChange={(e) =>
                    setEditingWorkout((prev) =>
                      prev ? { ...prev, endedAt: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  onClick={() => setEditingWorkout(null)}
                  disabled={savingWorkout}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
                  disabled={savingWorkout}
                >
                  {savingWorkout ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {setModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setSetModal(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {setModal.mode === "create" ? "セットを追加" : "セットを編集"}
              </h3>
              <button className="text-slate-400" onClick={() => setSetModal(null)}>
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmitSet}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    種目 ID
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.exerciseId}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              form: { ...prev.form, exerciseId: e.target.value },
                            }
                          : prev
                      )
                    }
                    placeholder="種目 ID を入力"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    セット番号
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.setIndex}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? { ...prev, form: { ...prev.form, setIndex: e.target.value } }
                          : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    回数
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.reps}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? { ...prev, form: { ...prev.form, reps: e.target.value } }
                          : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    重量 (kg)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.weightKg}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? { ...prev, form: { ...prev.form, weightKg: e.target.value } }
                          : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    RPE
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.rpe}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? { ...prev, form: { ...prev.form, rpe: e.target.value } }
                          : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    休憩 (秒)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.restSec}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? { ...prev, form: { ...prev.form, restSec: e.target.value } }
                          : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    時間 (秒)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.durationSec}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              form: { ...prev.form, durationSec: e.target.value },
                            }
                          : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    距離 (m)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={setModal.form.distanceM}
                    onChange={(e) =>
                      setSetModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              form: { ...prev.form, distanceM: e.target.value },
                            }
                          : prev
                      )
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  メモ
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  rows={3}
                  value={setModal.form.note}
                  onChange={(e) =>
                    setSetModal((prev) =>
                      prev ? { ...prev, form: { ...prev.form, note: e.target.value } } : prev
                    )
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={setModal.form.isWarmup}
                  onChange={(e) =>
                    setSetModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            form: { ...prev.form, isWarmup: e.target.checked },
                          }
                        : prev
                    )
                  }
                />
                ウォームアップセット
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  onClick={() => setSetModal(null)}
                  disabled={savingSet}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
                  disabled={savingSet}
                >
                  {savingSet ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
