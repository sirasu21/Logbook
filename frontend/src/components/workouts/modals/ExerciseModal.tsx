import type { ExerciseModalState } from "../types";
import { exerciseTypes } from "../types";

type Props = {
  state: ExerciseModalState | null;
  saving: boolean;
  onFieldChange: <K extends keyof ExerciseModalState["form"]>(
    key: K,
    value: ExerciseModalState["form"][K],
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function ExerciseModal({
  state,
  saving,
  onFieldChange,
  onSubmit,
  onClose,
}: Props) {
  if (!state) return null;

  const { mode, form } = state;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === "create" ? "種目を追加" : "種目を編集"}
          </h3>
          <button className="text-slate-400" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              種目名
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="例: ベンチプレス"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              種目タイプ
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.type}
              onChange={(e) => onFieldChange("type", e.target.value)}
            >
              {exerciseTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              主な部位 (任意)
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.primaryMuscle}
              onChange={(e) => onFieldChange("primaryMuscle", e.target.value)}
              placeholder="例: 胸"
            />
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => onFieldChange("isActive", e.target.checked)}
              />
              有効にする
            </label>
          )}
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
