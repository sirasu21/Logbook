import type { CreateWorkoutForm } from "../types";

type Props = {
  open: boolean;
  form: CreateWorkoutForm;
  creating: boolean;
  onChange: (patch: Partial<CreateWorkoutForm>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function CreateWorkoutModal({
  open,
  form,
  creating,
  onChange,
  onSubmit,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={!creating ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">ワークアウトを追加</h3>
          <button className="text-slate-400" onClick={onClose} disabled={creating}>
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
              placeholder="例: 胸・腕トレーニング"
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              開始日時
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.startedAt}
              onChange={(e) => onChange({ startedAt: e.target.value })}
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
              value={form.durationMinutes}
              onChange={(e) => onChange({ durationMinutes: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-400">
              入力すると終了時刻を自動で記録します。空欄でも保存できます。
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              onClick={onClose}
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
  );
}
