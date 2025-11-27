import type { Exercise } from "../../../lib/api";
import type { SetModalState } from "../types";

type Props = {
  modal: SetModalState | null;
  exercises: Exercise[];
  saving: boolean;
  onFormChange: <K extends keyof SetModalState["form"]>(
    key: K,
    value: SetModalState["form"][K],
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function WorkoutSetModal({
  modal,
  exercises,
  saving,
  onFormChange,
  onSubmit,
  onClose,
}: Props) {
  if (!modal) return null;

  const { form, mode } = modal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === "create" ? "セットを追加" : "セットを編集"}
          </h3>
          <button className="text-slate-400" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                種目
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  list="exercise-id-options"
                  value={form.exerciseId}
                  onChange={(e) => onFormChange("exerciseId", e.target.value)}
                  placeholder="種目を選択 (ID または名前を検索)"
                />
                <datalist id="exercise-id-options">
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                セット番号
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.setIndex}
                onChange={(e) => onFormChange("setIndex", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                回数
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.reps}
                onChange={(e) => onFormChange("reps", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                重量 (kg)
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.weightKg}
                onChange={(e) => onFormChange("weightKg", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                RPE
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.rpe}
                onChange={(e) => onFormChange("rpe", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                休憩 (秒)
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.restSec}
                onChange={(e) => onFormChange("restSec", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                時間 (秒)
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.durationSec}
                onChange={(e) => onFormChange("durationSec", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                距離 (m)
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.distanceM}
                onChange={(e) => onFormChange("distanceM", e.target.value)}
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
              value={form.note}
              onChange={(e) => onFormChange("note", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.isWarmup}
              onChange={(e) => onFormChange("isWarmup", e.target.checked)}
            />
            ウォームアップセット
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              onClick={onClose}
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
  );
}
