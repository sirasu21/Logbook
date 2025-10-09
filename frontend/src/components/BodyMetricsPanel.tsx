import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type BodyMetric,
  type CreateBodyMetricInput,
  type UpdateBodyMetricInput,
} from "../lib/api";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const toInputDateTime = (iso: string) => {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const fromInputDateTime = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

type MetricFormState = {
  measuredAt: string;
  weightKg: string;
  bodyFatPct: string;
  note: string;
};

type MetricModalState =
  | { mode: "create"; form: MetricFormState }
  | { mode: "edit"; metric: BodyMetric; form: MetricFormState };

const emptyForm = (): MetricFormState => ({
  measuredAt: toInputDateTime(new Date().toISOString()),
  weightKg: "",
  bodyFatPct: "",
  note: "",
});

type Props = {};

export default function BodyMetricsPanel(_props: Props) {
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<MetricModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listBodyMetrics({ limit: 200 });
      setMetrics(res.items);
    } catch (e) {
      setError((e as Error).message ?? "体組成の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const sortedDesc = useMemo(
    () =>
      [...metrics].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
      ),
    [metrics]
  );

  const chartData = useMemo(() => {
    if (metrics.length === 0) return [] as BodyMetric[];
    return [...metrics].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    );
  }, [metrics]);

  const weightMinMax = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 0 };
    let min = chartData[0].weightKg;
    let max = chartData[0].weightKg;
    for (const m of chartData) {
      if (m.weightKg < min) min = m.weightKg;
      if (m.weightKg > max) max = m.weightKg;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return { min, max };
  }, [chartData]);

  const openCreateModal = () => {
    setModal({ mode: "create", form: emptyForm() });
  };

  const openEditModal = (metric: BodyMetric) => {
    setModal({
      mode: "edit",
      metric,
      form: {
        measuredAt: toInputDateTime(metric.measuredAt),
        weightKg: metric.weightKg.toString(),
        bodyFatPct:
          metric.bodyFatPct != null ? Number(metric.bodyFatPct).toString() : "",
        note: metric.note ?? "",
      },
    });
  };

  const updateForm = <K extends keyof MetricFormState>(key: K, value: MetricFormState[K]) => {
    setModal((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modal || saving) return;

    const measuredAtIso = fromInputDateTime(modal.form.measuredAt);
    if (!measuredAtIso) {
      alert("測定日時の形式が不正です");
      return;
    }

    const weight = Number(modal.form.weightKg);
    if (!Number.isFinite(weight) || weight <= 0) {
      alert("体重は正の数で入力してください");
      return;
    }

    const bodyFat = modal.form.bodyFatPct.trim();
    const bodyFatValue = bodyFat === "" ? undefined : Number(bodyFat);
    if (bodyFatValue != null && !Number.isFinite(bodyFatValue)) {
      alert("体脂肪率は数値で入力してください");
      return;
    }

    const note = modal.form.note.trim();

    setSaving(true);
    try {
      if (modal.mode === "create") {
        const payload: CreateBodyMetricInput = {
          measuredAt: measuredAtIso,
          weightKg: weight,
          bodyFatPct: bodyFatValue,
          note: note ? note : undefined,
        };
        await api.createBodyMetric(payload);
      } else {
        const payload: UpdateBodyMetricInput = {};
        if (measuredAtIso !== modal.metric.measuredAt) payload.measuredAt = measuredAtIso;
        if (weight !== modal.metric.weightKg) payload.weightKg = weight;
        if (
          (bodyFatValue == null && modal.metric.bodyFatPct != null) ||
          (bodyFatValue != null && bodyFatValue !== modal.metric.bodyFatPct)
        ) {
          payload.bodyFatPct = bodyFatValue ?? null;
        }
        if (note !== (modal.metric.note ?? "")) payload.note = note || null;
        await api.updateBodyMetric(modal.metric.id, payload);
      }
      await loadMetrics();
      setModal(null);
    } catch (e) {
      alert((e as Error).message ?? "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (metric: BodyMetric) => {
    if (!window.confirm("この記録を削除しますか？")) return;
    setDeletingId(metric.id);
    try {
      await api.deleteBodyMetric(metric.id);
      await loadMetrics();
    } catch (e) {
      alert((e as Error).message ?? "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const latestMetric = sortedDesc[0];

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-blue-500/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">体組成データ</h2>
            <p className="text-xs text-slate-500">最近の測定値を一覧とグラフで確認できます。</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              onClick={() => void loadMetrics()}
              disabled={loading}
            >
              {loading ? "更新中..." : "再読み込み"}
            </button>
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
              onClick={openCreateModal}
            >
              + 記録追加
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow">
            <div className="text-xs text-slate-500">最新体重</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {latestMetric ? `${latestMetric.weightKg.toFixed(1)} kg` : "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow">
            <div className="text-xs text-slate-500">最新体脂肪率</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {latestMetric && latestMetric.bodyFatPct != null
                ? `${latestMetric.bodyFatPct.toFixed(1)} %`
                : "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow">
            <div className="text-xs text-slate-500">記録件数</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{metrics.length}</div>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow">
          <div className="mb-2 text-xs font-semibold text-slate-500">体重推移</div>
          {chartData.length === 0 ? (
            <div className="text-xs text-slate-500">データがありません。</div>
          ) : (
            <div className="h-40 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <polyline
                  fill="none"
                  stroke="url(#weightGradient)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  points={chartData
                    .map((m, index) => {
                      const x = (index / Math.max(chartData.length - 1, 1)) * 100;
                      const y =
                        100 -
                        ((m.weightKg - weightMinMax.min) /
                          (weightMinMax.max - weightMinMax.min)) *
                          100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
                <defs>
                  <linearGradient id="weightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-500 shadow-sm">
          {error}
        </div>
      )}

      {loading && metrics.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-12 text-center text-sm text-slate-500 shadow">
          体組成データを読み込み中です...
        </div>
      ) : metrics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center text-sm text-slate-500 shadow-inner">
          記録はまだありません。右上の「記録追加」から登録しましょう。
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDesc.map((metric) => (
            <div
              key={metric.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {metric.weightKg.toFixed(1)} kg
                  {metric.bodyFatPct != null && (
                    <span className="ml-3 text-sm text-slate-500">
                      体脂肪 {metric.bodyFatPct.toFixed(1)} %
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">{formatDateTime(metric.measuredAt)}</div>
                {metric.note && (
                  <div className="mt-1 text-xs text-slate-500">メモ: {metric.note}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  onClick={() => openEditModal(metric)}
                >
                  編集
                </button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-300 hover:text-red-600"
                  onClick={() => handleDelete(metric)}
                  disabled={deletingId === metric.id}
                >
                  {deletingId === metric.id ? "削除中..." : "削除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => (!saving ? setModal(null) : undefined)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {modal.mode === "create" ? "体組成を追加" : "体組成を編集"}
              </h3>
              <button
                className="text-slate-400"
                onClick={() => (!saving ? setModal(null) : undefined)}
              >
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  測定日時
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={modal.form.measuredAt}
                  onChange={(e) => updateForm("measuredAt", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  体重 (kg)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={modal.form.weightKg}
                  onChange={(e) => updateForm("weightKg", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  体脂肪率 (%)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={modal.form.bodyFatPct}
                  onChange={(e) => updateForm("bodyFatPct", e.target.value)}
                  placeholder="任意"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  メモ (任意)
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  rows={3}
                  value={modal.form.note}
                  onChange={(e) => updateForm("note", e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  onClick={() => setModal(null)}
                  disabled={saving}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
                  disabled={saving}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
