import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type CreateWorkoutSetInput,
  type Exercise,
  type UpdateWorkoutInput,
  type UpdateWorkoutSetInput,
  type Workout,
  type WorkoutSet,
} from "../lib/api";
import {
  type CreateWorkoutForm,
  type DetailState,
  type EditWorkoutModalState,
  type ExerciseFilterState,
  type ExerciseFormState,
  type ExerciseModalState,
  type SetFormState,
  type SetModalState,
} from "./workouts/types";
import WorkoutsHeader from "./workouts/WorkoutsHeader";
import WorkoutList from "./workouts/WorkoutList";
import ExerciseSection from "./workouts/ExerciseSection";
import CreateWorkoutModal from "./workouts/modals/CreateWorkoutModal";
import EditWorkoutModal from "./workouts/modals/EditWorkoutModal";
import WorkoutSetModal from "./workouts/modals/WorkoutSetModal";
import ExerciseModalComponent from "./workouts/modals/ExerciseModal";

const formatDateTimeLocal = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const resolveExerciseId = (
  value: string,
  exercises: Exercise[],
  exerciseMap: Map<string, Exercise>
) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const byId = exerciseMap.get(trimmed);
  if (byId) return byId.id;
  const byName = exercises.find((ex) => ex.name === trimmed);
  if (byName) return byName.id;
  return null;
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

const emptyExerciseForm = (): ExerciseFormState => ({
  name: "",
  type: "strength",
  primaryMuscle: "",
  isActive: true,
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

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [exerciseFilters, setExerciseFilters] = useState<ExerciseFilterState>({
    query: "",
    onlyMine: false,
    type: "all",
  });
  const [exerciseModal, setExerciseModal] = useState<ExerciseModalState | null>(null);
  const [savingExercise, setSavingExercise] = useState(false);

  const sortedWorkouts = useMemo(
    () =>
      [...workouts].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      ),
    [workouts]
  );

  const sortedExercises = useMemo(
    () =>
      [...exercises].sort((a, b) =>
        a.name.localeCompare(b.name, "ja", { sensitivity: "base" })
      ),
    [exercises]
  );

  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of exercises) {
      map.set(ex.id, ex);
    }
    return map;
  }, [exercises]);

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

  const loadExercises = useCallback(async () => {
    setExerciseLoading(true);
    setExerciseError(null);
    try {
      const res = await api.listExercises({
        q: exerciseFilters.query.trim(),
        type: exerciseFilters.type === "all" ? undefined : exerciseFilters.type,
        onlyMine: exerciseFilters.onlyMine,
        limit: 200,
        offset: 0,
      });
      setExercises(res.items);
    } catch (e) {
      setExerciseError((e as Error).message ?? "種目一覧の取得に失敗しました");
    } finally {
      setExerciseLoading(false);
    }
  }, [exerciseFilters.onlyMine, exerciseFilters.query, exerciseFilters.type]);

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
    void loadExercises();
  }, [loadExercises]);

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

  const openCreateExerciseModal = () => {
    setExerciseModal({ mode: "create", form: emptyExerciseForm() });
  };

  const openEditExerciseModal = (exercise: Exercise) => {
    setExerciseModal({
      mode: "edit",
      exercise,
      form: {
        name: exercise.name,
        type: exercise.type,
        primaryMuscle: exercise.primaryMuscle ?? "",
        isActive: exercise.isActive,
      },
    });
  };

  const updateExerciseForm = <K extends keyof ExerciseFormState>(
    key: K,
    value: ExerciseFormState[K]
  ) => {
    setExerciseModal((prev) =>
      prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev
    );
  };

  const handleSubmitExercise = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!exerciseModal || savingExercise) return;

    const form = exerciseModal.form;
    const name = form.name.trim();
    if (!name) {
      alert("種目名を入力してください");
      return;
    }
    if (!form.type) {
      alert("種目タイプを選択してください");
      return;
    }

    setSavingExercise(true);
    try {
      let createdExercise: Exercise | null = null;
      if (exerciseModal.mode === "create") {
        createdExercise = await api.createExercise({
          name,
          type: form.type,
          primaryMuscle: form.primaryMuscle.trim() || undefined,
        });
      } else {
        const { exercise } = exerciseModal;
        const payload: Record<string, unknown> = {};
        if (name !== exercise.name) payload.name = name;
        if (form.type !== exercise.type) payload.type = form.type;
        const trimmedMuscle = form.primaryMuscle.trim();
        if (trimmedMuscle !== (exercise.primaryMuscle ?? "")) {
          payload.primaryMuscle = trimmedMuscle === "" ? null : trimmedMuscle;
        }
        if (form.isActive !== exercise.isActive) {
          payload.isActive = form.isActive;
        }
        await api.updateExercise(exercise.id, payload);
      }
      await loadExercises();
      if (createdExercise?.id) {
        const newId = createdExercise.id;
        setSetModal((prev) =>
          prev ? { ...prev, form: { ...prev.form, exerciseId: newId } } : prev
        );
      }
      setExerciseModal(null);
    } catch (e) {
      alert((e as Error).message ?? "種目の保存に失敗しました");
    } finally {
      setSavingExercise(false);
    }
  };

  const handleDeleteExercise = async (exercise: Exercise) => {
    if (!exercise.ownerUserId) return;
    if (!window.confirm(`「${exercise.name}」を削除しますか？`)) return;
    try {
      await api.deleteExercise(exercise.id);
      await loadExercises();
    } catch (e) {
      alert((e as Error).message ?? "種目の削除に失敗しました");
    }
  };

  const handleRefreshExercises = () => {
    void loadExercises();
  };

  const setExerciseQuery = (value: string) => {
    setExerciseFilters((prev) => ({ ...prev, query: value }));
  };

  const toggleExerciseOnlyMine = () => {
    setExerciseFilters((prev) => ({ ...prev, onlyMine: !prev.onlyMine }));
  };

  const setExerciseTypeFilter = (value: ExerciseFilterState["type"]) => {
    setExerciseFilters((prev) => ({ ...prev, type: value }));
  };

  const openCreateSetModal = (workoutId: string) => {
    const currentSets = details[workoutId]?.data?.sets ?? [];
    const nextIndex = currentSets.length;
    const defaultExerciseId = sortedExercises[0]?.id ?? "";
    setSetModal({
      mode: "create",
      workoutId,
      form: emptySetForm({ setIndex: String(nextIndex), exerciseId: defaultExerciseId }),
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

  const updateCreateForm = (patch: Partial<CreateWorkoutForm>) => {
    setCreateForm((prev) => ({ ...prev, ...patch }));
  };

  const updateEditingWorkoutField = <K extends "title" | "startedAt" | "endedAt">(
    key: K,
    value: EditWorkoutModalState[K],
  ) => {
    setEditingWorkout((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateSetModalForm = <K extends keyof SetFormState>(
    key: K,
    value: SetFormState[K],
  ) => {
    setSetModal((prev) =>
      prev
        ? {
            ...prev,
            form: { ...prev.form, [key]: value },
          }
        : prev,
    );
  };

  const handleSubmitSet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setModal || savingSet) return;

    const form = setModal.form;
    const resolvedExerciseId = resolveExerciseId(
      form.exerciseId,
      sortedExercises,
      exerciseMap
    );
    if (!resolvedExerciseId) {
      alert("存在する種目を選択してください");
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
          exerciseId: resolvedExerciseId,
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

  return (
    <div className="space-y-8">
      <WorkoutsHeader refreshing={refreshing} onRefresh={() => loadWorkouts("refresh")} />

      {listError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
          {listError}
        </div>
      )}

      {loadingList && workouts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-12 text-center text-sm text-slate-500 shadow-lg">
          ワークアウトを読み込み中です...
        </div>
      ) : sortedWorkouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center text-sm text-slate-500 shadow-inner">
          記録されたワークアウトがまだありません。右上の「ワークアウト追加」から登録しましょう。
        </div>
      ) : (
        <WorkoutList
          workouts={sortedWorkouts}
          expandedIds={expanded}
          details={details}
          exerciseMap={exerciseMap}
          deletingWorkoutId={deletingWorkoutId}
          onToggle={toggleExpanded}
          onOpenCreateSet={openCreateSetModal}
          onOpenEditSet={openEditSetModal}
          onDeleteSet={handleDeleteSet}
          onOpenEditWorkout={openEditWorkoutModal}
          onDeleteWorkout={handleDeleteWorkout}
          onEndWorkoutNow={handleEndWorkoutNow}
        />
      )}

      <ExerciseSection
        filters={exerciseFilters}
        sortedExercises={sortedExercises}
        loading={exerciseLoading}
        error={exerciseError}
        onQueryChange={setExerciseQuery}
        onToggleOnlyMine={toggleExerciseOnlyMine}
        onTypeChange={setExerciseTypeFilter}
        onRefresh={handleRefreshExercises}
        onOpenCreate={openCreateExerciseModal}
        onOpenEdit={openEditExerciseModal}
        onDelete={handleDeleteExercise}
      />

      <CreateWorkoutModal
        open={addModalOpen}
        form={createForm}
        creating={creating}
        onChange={updateCreateForm}
        onSubmit={handleCreateWorkout}
        onClose={onCloseAddModal}
      />

      <EditWorkoutModal
        state={editingWorkout}
        saving={savingWorkout}
        onFieldChange={updateEditingWorkoutField}
        onSubmit={handleSaveWorkout}
        onClose={() => setEditingWorkout(null)}
      />

      <WorkoutSetModal
        modal={setModal}
        exercises={sortedExercises}
        saving={savingSet}
        onFormChange={updateSetModalForm}
        onSubmit={handleSubmitSet}
        onClose={() => setSetModal(null)}
      />

      <ExerciseModalComponent
        state={exerciseModal}
        saving={savingExercise}
        onFieldChange={updateExerciseForm}
        onSubmit={handleSubmitExercise}
        onClose={() => setExerciseModal(null)}
      />
    </div>
  );
}
