import { useEffect, useState } from "react";
import {
  api,
  type Workout,
  type WorkoutDetail,
  type WorkoutSet,
  type CreateWorkoutSetInput,
  type UpdateWorkoutSetInput,
} from "../lib/api";

type WorkoutDetailState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  data?: WorkoutDetail;
};

type NewSetFormState = {
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

type EditSetFormState = Omit<NewSetFormState, "exerciseId">;

const emptyNewSetForm = (nextIndex?: number): NewSetFormState => ({
  exerciseId: "",
  setIndex: nextIndex != null ? String(nextIndex) : "",
  reps: "",
  weightKg: "",
  rpe: "",
  restSec: "",
  durationSec: "",
  distanceM: "",
  note: "",
  isWarmup: false,
});

const emptyEditSetForm = (): EditSetFormState => ({
  setIndex: "",
  reps: "",
  weightKg: "",
  rpe: "",
  restSec: "",
  durationSec: "",
  distanceM: "",
  note: "",
  isWarmup: false,
});

const toEditForm = (set: WorkoutSet): EditSetFormState => ({
  setIndex: String(set.setIndex ?? ""),
  reps: set.reps != null ? String(set.reps) : "",
  weightKg: set.weightKg != null ? String(set.weightKg) : "",
  rpe: set.rpe != null ? String(set.rpe) : "",
  restSec: set.restSec != null ? String(set.restSec) : "",
  durationSec: set.durationSec != null ? String(set.durationSec) : "",
  distanceM: set.distanceM != null ? String(set.distanceM) : "",
  note: set.note ?? "",
  isWarmup: set.isWarmup,
});

const sortSets = (sets: WorkoutSet[]) =>
  [...sets].sort((a, b) => {
    if (a.setIndex !== b.setIndex) return a.setIndex - b.setIndex;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

const computeNextSetIndex = (sets: WorkoutSet[]) => {
  if (sets.length === 0) return 0;
  let maxIndex = sets[0].setIndex;
  for (const s of sets) {
    if (s.setIndex > maxIndex) maxIndex = s.setIndex;
  }
  return maxIndex + 1;
};

const parseOptionalInt = (value: string, field: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be an integer`);
  }
  return parsed;
};

const parseOptionalFloat = (
  value: string,
  field: string
): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be a number`);
  }
  return parsed;
};

const buildCreatePayload = (form: NewSetFormState): CreateWorkoutSetInput => {
  const exerciseId = form.exerciseId.trim();
  if (!exerciseId) {
    throw new Error("Exercise ID is required");
  }
  const payload: CreateWorkoutSetInput = {
    exerciseId,
    isWarmup: form.isWarmup,
  };

  const setIndex = parseOptionalInt(form.setIndex, "Set index");
  if (setIndex != null) payload.setIndex = setIndex;

  const reps = parseOptionalInt(form.reps, "Reps");
  if (reps != null) payload.reps = reps;

  const weight = parseOptionalFloat(form.weightKg, "Weight (kg)");
  if (weight != null) payload.weightKg = weight;

  const rpe = parseOptionalFloat(form.rpe, "RPE");
  if (rpe != null) payload.rpe = rpe;

  const rest = parseOptionalInt(form.restSec, "Rest (sec)");
  if (rest != null) payload.restSec = rest;

  const duration = parseOptionalInt(form.durationSec, "Duration (sec)");
  if (duration != null) payload.durationSec = duration;

  const distance = parseOptionalFloat(form.distanceM, "Distance (m)");
  if (distance != null) payload.distanceM = distance;

  const note = form.note.trim();
  if (note) payload.note = note;

  return payload;
};

const buildUpdatePayload = (form: EditSetFormState): UpdateWorkoutSetInput => {
  const payload: UpdateWorkoutSetInput = {
    isWarmup: form.isWarmup,
  };

  const setIndex = parseOptionalInt(form.setIndex, "Set index");
  if (setIndex != null) payload.setIndex = setIndex;

  const reps = parseOptionalInt(form.reps, "Reps");
  if (reps != null) payload.reps = reps;

  const weight = parseOptionalFloat(form.weightKg, "Weight (kg)");
  if (weight != null) payload.weightKg = weight;

  const rpe = parseOptionalFloat(form.rpe, "RPE");
  if (rpe != null) payload.rpe = rpe;

  const rest = parseOptionalInt(form.restSec, "Rest (sec)");
  if (rest != null) payload.restSec = rest;

  const duration = parseOptionalInt(form.durationSec, "Duration (sec)");
  if (duration != null) payload.durationSec = duration;

  const distance = parseOptionalFloat(form.distanceM, "Distance (m)");
  if (distance != null) payload.distanceM = distance;

  if (form.note === "") {
    payload.note = "";
  } else {
    const trimmed = form.note.trim();
    if (trimmed) payload.note = trimmed;
  }

  return payload;
};

export default function WorkoutsPanel() {
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkoutDetailState>>({});
  const [newSetForms, setNewSetForms] = useState<Record<string, NewSetFormState>>({});
  const [editForms, setEditForms] = useState<Record<string, EditSetFormState>>({});
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [addingWorkoutId, setAddingWorkoutId] = useState<string | null>(null);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listWorkouts();
      setItems(res.items);
    } catch (e: any) {
      setError(e?.message ?? "failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const startNow = async () => {
    setStarting(true);
    try {
      await api.createWorkout(
        new Date().toISOString(),
        note ? note : undefined
      );
      setNote("");
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const endNow = async (id: string) => {
    setEndingId(id);
    try {
      await api.endWorkout(id);
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEndingId(null);
    }
  };

  const updateDetailSets = (
    workoutId: string,
    mutator: (sets: WorkoutSet[]) => WorkoutSet[]
  ) => {
    let updated: WorkoutSet[] | null = null;
    setDetails((prev) => {
      const current = prev[workoutId];
      if (!current?.data) return prev;
      const nextSets = mutator(current.data.sets);
      updated = nextSets;
      return {
        ...prev,
        [workoutId]: {
          ...current,
          data: { ...current.data, sets: nextSets },
        },
      };
    });
    return updated;
  };

  const loadDetail = async (id: string, opts?: { force?: boolean }) => {
    let shouldSkip = false;
    setDetails((prev) => {
      const current =
        prev[id] ?? ({ open: true, loading: false, error: null } as WorkoutDetailState);
      if (current.loading && !opts?.force) {
        shouldSkip = true;
        return prev;
      }
      return {
        ...prev,
        [id]: { ...current, loading: true, error: null },
      };
    });
    if (shouldSkip) return;

    try {
      const detail = await api.getWorkoutDetail(id);
      setDetails((prev) => {
        const current =
          prev[id] ?? ({ open: true, loading: false, error: null } as WorkoutDetailState);
        return {
          ...prev,
          [id]: { ...current, loading: false, error: null, data: detail },
        };
      });
      setNewSetForms((prev) => {
        if (prev[id]) return prev;
        return {
          ...prev,
          [id]: emptyNewSetForm(computeNextSetIndex(detail.sets)),
        };
      });
    } catch (e) {
      const message = (e as Error).message || "Failed to load detail";
      setDetails((prev) => {
        const current =
          prev[id] ?? ({ open: true, loading: false, error: null } as WorkoutDetailState);
        return {
          ...prev,
          [id]: { ...current, loading: false, error: message },
        };
      });
    }
  };

  const toggleDetail = (id: string) => {
    let shouldLoad = false;
    setDetails((prev) => {
      const current =
        prev[id] ?? ({ open: false, loading: false, error: null } as WorkoutDetailState);
      const nextOpen = !current.open;
      if (nextOpen && !current.data && !current.loading) {
        shouldLoad = true;
      }
      return {
        ...prev,
        [id]: { ...current, open: nextOpen },
      };
    });
    if (shouldLoad) void loadDetail(id);
  };

  const updateNewSetForm = (
    workoutId: string,
    key: keyof NewSetFormState,
    value: string | boolean
  ) => {
    setNewSetForms((prev) => {
      const current = prev[workoutId] ?? emptyNewSetForm();
      return {
        ...prev,
        [workoutId]: {
          ...current,
          [key]: key === "isWarmup" ? Boolean(value) : (value as string),
        } as NewSetFormState,
      };
    });
  };

  const updateEditSetForm = (
    setId: string,
    key: keyof EditSetFormState,
    value: string | boolean
  ) => {
    setEditForms((prev) => {
      const current = prev[setId] ?? emptyEditSetForm();
      return {
        ...prev,
        [setId]: {
          ...current,
          [key]: key === "isWarmup" ? Boolean(value) : (value as string),
        } as EditSetFormState,
      };
    });
  };

  const handleCreateSet = async (workoutId: string) => {
    const detailState = details[workoutId];
    if (!detailState?.data) {
      alert("Load the workout detail before adding sets");
      return;
    }
    const form = newSetForms[workoutId] ?? emptyNewSetForm();
    let payload: CreateWorkoutSetInput;
    try {
      payload = buildCreatePayload(form);
    } catch (e) {
      alert((e as Error).message);
      return;
    }

    setAddingWorkoutId(workoutId);
    try {
      const created = await api.addWorkoutSet(workoutId, payload);
      const updated = updateDetailSets(workoutId, (sets) =>
        sortSets([...sets, created])
      );
      if (updated) {
        setNewSetForms((prev) => {
          const prevForm = prev[workoutId] ?? emptyNewSetForm();
          return {
            ...prev,
            [workoutId]: {
              ...emptyNewSetForm(computeNextSetIndex(updated)),
              exerciseId: prevForm.exerciseId,
            },
          };
        });
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAddingWorkoutId(null);
    }
  };

  const handleEditSet = (set: WorkoutSet) => {
    setEditingSetId(set.id);
    setEditForms((prev) => ({ ...prev, [set.id]: toEditForm(set) }));
  };

  const handleCancelEdit = (setId: string) => {
    setEditingSetId((prev) => (prev === setId ? null : prev));
    setEditForms((prev) => {
      const { [setId]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveSet = async (workoutId: string, setId: string) => {
    const form = editForms[setId];
    if (!form) return;

    let payload: UpdateWorkoutSetInput;
    try {
      payload = buildUpdatePayload(form);
    } catch (e) {
      alert((e as Error).message);
      return;
    }

    setSavingSetId(setId);
    try {
      const updatedSet = await api.updateWorkoutSet(setId, payload);
      updateDetailSets(workoutId, (sets) =>
        sortSets(sets.map((s) => (s.id === setId ? updatedSet : s)))
      );
      handleCancelEdit(setId);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingSetId(null);
    }
  };

  const handleDeleteSet = async (workoutId: string, setId: string) => {
    if (!window.confirm("Delete this set?")) return;
    setDeletingSetId(setId);
    try {
      await api.deleteWorkoutSet(setId);
      const updated = updateDetailSets(workoutId, (sets) =>
        sortSets(sets.filter((s) => s.id !== setId))
      );
      if (updated) {
        setNewSetForms((prev) => {
          const prevForm = prev[workoutId] ?? emptyNewSetForm();
          return {
            ...prev,
            [workoutId]: {
              ...prevForm,
              setIndex: String(computeNextSetIndex(updated)),
            },
          };
        });
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingSetId(null);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Workouts (debug)</h2>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <input
              className="input"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="btn primary"
              onClick={startNow}
              disabled={starting}
            >
              {starting ? "Starting..." : "Start Now"}
            </button>
          </div>
          <button className="btn" onClick={reload} disabled={loading}>
            {loading ? "Reloading..." : "Reload"}
          </button>
        </div>
      </div>
      <div className="card">
        {error && (
          <div style={{ color: "#ffaaaa", marginBottom: 8 }}>
            Error: {error}
          </div>
        )}
        {loading ? (
          <div>Loading workouts...</div>
        ) : items.length === 0 ? (
          <div className="mono">No workouts yet.</div>
        ) : (
          <ul className="list">
            {items.map((w) => {
              const detailState = details[w.id];
              const detailOpen = detailState?.open ?? false;
              const detailData = detailState?.data;
              const newSetForm =
                newSetForms[w.id] ??
                (detailData
                  ? emptyNewSetForm(computeNextSetIndex(detailData.sets))
                  : emptyNewSetForm());
              return (
                <li key={w.id} className="item">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div>
                        <b>{new Date(w.startedAt).toLocaleString()}</b>
                        {w.endedAt ? (
                          <span className="mono" style={{ marginLeft: 8 }}>
                            → {new Date(w.endedAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="mono" style={{ marginLeft: 8 }}>
                            (ongoing)
                          </span>
                        )}
                      </div>
                      {w.note && (
                        <div className="mono" style={{ marginTop: 4 }}>
                          note: {w.note}
                        </div>
                      )}
                      <div className="mono" style={{ marginTop: 4 }}>
                        id: {w.id}
                      </div>
                    </div>
                    {!w.endedAt ? (
                      <button
                        className="btn"
                        onClick={() => endNow(w.id)}
                        disabled={endingId === w.id}
                      >
                        {endingId === w.id ? "Ending..." : "End Now"}
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => toggleDetail(w.id)}
                        disabled={detailState?.loading}
                      >
                        {detailOpen ? "Hide Sets" : "Show Sets"}
                      </button>
                    )}
                  </div>
                  {detailOpen && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid var(--card-border)",
                      }}
                    >
                      <div
                        className="row"
                        style={{ justifyContent: "space-between", marginBottom: 8 }}
                      >
                        <div className="mono">
                          Sets: {detailData?.sets.length ?? 0}
                        </div>
                        <button
                          className="btn"
                          onClick={() => loadDetail(w.id, { force: true })}
                          disabled={detailState?.loading}
                        >
                          {detailState?.loading ? "Loading..." : "Reload detail"}
                        </button>
                      </div>
                      {detailState?.error && (
                        <div style={{ color: "#ffaaaa", marginBottom: 8 }}>
                          Error: {detailState.error}
                        </div>
                      )}
                      {detailState?.loading && !detailData ? (
                        <div className="mono">Loading sets...</div>
                      ) : detailData ? (
                        <>
                          <div>
                            {detailData.sets.length === 0 ? (
                              <div className="mono">No sets yet.</div>
                            ) : (
                              detailData.sets.map((set) => {
                                const isEditing = editingSetId === set.id;
                                const editForm = editForms[set.id] ?? toEditForm(set);
                                return (
                                  <div
                                    key={set.id}
                                    style={{
                                      marginBottom: 12,
                                      padding: 12,
                                      border: "1px solid var(--card-border)",
                                      borderRadius: 10,
                                      background: "rgba(0,0,0,0.15)",
                                    }}
                                  >
                                    <div
                                      className="row"
                                      style={{
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: 12,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <div style={{ flex: 1, minWidth: 240 }}>
                                        <div>
                                          <b>Set {set.setIndex}</b>
                                          <span
                                            className="mono"
                                            style={{ marginLeft: 6 }}
                                          >
                                            {set.id}
                                          </span>
                                        </div>
                                        <div className="mono" style={{ marginTop: 4 }}>
                                          exerciseId: {set.exerciseId}
                                        </div>
                                        <div className="mono" style={{ marginTop: 4 }}>
                                          reps: {set.reps ?? "-"} ／ weight:
                                          {set.weightKg ?? "-"}kg ／ rpe: {set.rpe ?? "-"}
                                        </div>
                                        <div className="mono" style={{ marginTop: 4 }}>
                                          rest: {set.restSec ?? "-"}s ／ duration:
                                          {set.durationSec ?? "-"}s ／ distance:
                                          {set.distanceM ?? "-"}m
                                        </div>
                                        {set.note && (
                                          <div className="mono" style={{ marginTop: 4 }}>
                                            note: {set.note}
                                          </div>
                                        )}
                                        <div className="mono" style={{ marginTop: 4 }}>
                                          warmup: {set.isWarmup ? "yes" : "no"}
                                        </div>
                                      </div>
                                      <div className="row" style={{ gap: 8 }}>
                                        <button
                                          className="btn"
                                          onClick={() =>
                                            isEditing
                                              ? handleCancelEdit(set.id)
                                              : handleEditSet(set)
                                          }
                                          disabled={savingSetId === set.id}
                                        >
                                          {isEditing ? "Cancel" : "Edit"}
                                        </button>
                                        <button
                                          className="btn"
                                          onClick={() => handleDeleteSet(w.id, set.id)}
                                          disabled={
                                            deletingSetId === set.id ||
                                            savingSetId === set.id
                                          }
                                        >
                                          {deletingSetId === set.id
                                            ? "Deleting..."
                                            : "Delete"}
                                        </button>
                                      </div>
                                    </div>
                                    {isEditing && (
                                      <div style={{ marginTop: 12 }}>
                                        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                                          <label style={{ fontSize: 12 }}>
                                            Set index
                                            <input
                                              className="input"
                                              style={{ width: 80, marginLeft: 6 }}
                                              value={editForm.setIndex}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "setIndex",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                          <label style={{ fontSize: 12 }}>
                                            Reps
                                            <input
                                              className="input"
                                              style={{ width: 80, marginLeft: 6 }}
                                              value={editForm.reps}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "reps",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                          <label style={{ fontSize: 12 }}>
                                            Weight (kg)
                                            <input
                                              className="input"
                                              style={{ width: 100, marginLeft: 6 }}
                                              value={editForm.weightKg}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "weightKg",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                          <label style={{ fontSize: 12 }}>
                                            RPE
                                            <input
                                              className="input"
                                              style={{ width: 80, marginLeft: 6 }}
                                              value={editForm.rpe}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "rpe",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                          <label style={{ fontSize: 12 }}>
                                            Rest (sec)
                                            <input
                                              className="input"
                                              style={{ width: 100, marginLeft: 6 }}
                                              value={editForm.restSec}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "restSec",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                          <label style={{ fontSize: 12 }}>
                                            Duration (sec)
                                            <input
                                              className="input"
                                              style={{ width: 120, marginLeft: 6 }}
                                              value={editForm.durationSec}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "durationSec",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                          <label style={{ fontSize: 12 }}>
                                            Distance (m)
                                            <input
                                              className="input"
                                              style={{ width: 120, marginLeft: 6 }}
                                              value={editForm.distanceM}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "distanceM",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </label>
                                        </div>
                                        <div
                                          className="row"
                                          style={{
                                            marginTop: 8,
                                            alignItems: "flex-start",
                                            gap: 8,
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <label className="row" style={{ fontSize: 12 }}>
                                            <input
                                              type="checkbox"
                                              checked={editForm.isWarmup}
                                              onChange={(e) =>
                                                updateEditSetForm(
                                                  set.id,
                                                  "isWarmup",
                                                  e.target.checked
                                                )
                                              }
                                            />
                                            <span style={{ marginLeft: 6 }}>Is warmup</span>
                                          </label>
                                          <textarea
                                            className="input"
                                            style={{
                                              width: "100%",
                                              minHeight: 60,
                                              resize: "vertical",
                                            }}
                                            value={editForm.note}
                                            onChange={(e) =>
                                              updateEditSetForm(
                                                set.id,
                                                "note",
                                                e.target.value
                                              )
                                            }
                                            placeholder="Note"
                                          />
                                        </div>
                                        <div className="row" style={{ marginTop: 10 }}>
                                          <button
                                            className="btn primary"
                                            onClick={() => handleSaveSet(w.id, set.id)}
                                            disabled={savingSetId === set.id}
                                          >
                                            {savingSetId === set.id ? "Saving..." : "Save"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div
                            style={{
                              marginTop: 16,
                              padding: 12,
                              border: "1px dashed var(--card-border)",
                              borderRadius: 10,
                            }}
                          >
                            <div style={{ marginBottom: 8, fontWeight: 600 }}>
                              Add set
                            </div>
                            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                              <input
                                className="input"
                                style={{ minWidth: 220 }}
                                placeholder="Exercise ID"
                                value={newSetForm.exerciseId}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "exerciseId", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 100 }}
                                placeholder="Set index"
                                value={newSetForm.setIndex}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "setIndex", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 80 }}
                                placeholder="Reps"
                                value={newSetForm.reps}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "reps", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 110 }}
                                placeholder="Weight (kg)"
                                value={newSetForm.weightKg}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "weightKg", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 80 }}
                                placeholder="RPE"
                                value={newSetForm.rpe}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "rpe", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 120 }}
                                placeholder="Rest (sec)"
                                value={newSetForm.restSec}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "restSec", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 130 }}
                                placeholder="Duration (sec)"
                                value={newSetForm.durationSec}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "durationSec", e.target.value)
                                }
                              />
                              <input
                                className="input"
                                style={{ width: 120 }}
                                placeholder="Distance (m)"
                                value={newSetForm.distanceM}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "distanceM", e.target.value)
                                }
                              />
                            </div>
                            <div
                              className="row"
                              style={{
                                marginTop: 8,
                                alignItems: "flex-start",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <label className="row" style={{ fontSize: 12 }}>
                                <input
                                  type="checkbox"
                                  checked={newSetForm.isWarmup}
                                  onChange={(e) =>
                                    updateNewSetForm(
                                      w.id,
                                      "isWarmup",
                                      e.target.checked
                                    )
                                  }
                                />
                                <span style={{ marginLeft: 6 }}>Is warmup</span>
                              </label>
                              <textarea
                                className="input"
                                style={{
                                  width: "100%",
                                  minHeight: 60,
                                  resize: "vertical",
                                }}
                                placeholder="Note"
                                value={newSetForm.note}
                                onChange={(e) =>
                                  updateNewSetForm(w.id, "note", e.target.value)
                                }
                              />
                            </div>
                            <div className="row" style={{ marginTop: 10 }}>
                              <button
                                className="btn primary"
                                onClick={() => handleCreateSet(w.id)}
                                disabled={addingWorkoutId === w.id}
                              >
                                {addingWorkoutId === w.id ? "Saving set..." : "Add set"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
