import type { EditWorkoutModalState } from "../types";

type Props = {
  state: EditWorkoutModalState | null;
  saving: boolean;
  onFieldChange: <K extends "title" | "startedAt" | "endedAt">(
    key: K,
    value: EditWorkoutModalState[K],
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function EditWorkoutModal({
  state,
  saving,
  onFieldChange,
  onSubmit,
  onClose,
}: Props) {
  if (!state) return null;

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
          <h3 className="text-lg font-semibold text-slate-900">ワークアウトを編集</h3>
          <button className="text-slate-400" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              タイトル
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={state.title}
              onChange={(e) => onFieldChange("title", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              開始日時
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={state.startedAt}
              onChange={(e) => onFieldChange("startedAt", e.target.value)}
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
              value={state.endedAt}
              onChange={(e) => onFieldChange("endedAt", e.target.value)}
            />
          </div>
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
