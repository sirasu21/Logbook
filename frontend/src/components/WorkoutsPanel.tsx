import { useEffect, useState } from "react";
import { api, type Workout } from "../lib/api";
export default function WorkoutsPanel() {
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
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
      // surface minimal error
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
            {items.map((w) => (
              <li key={w.id} className="item">
                <div
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
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
                    <span />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
