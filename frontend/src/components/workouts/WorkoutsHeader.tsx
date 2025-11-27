type Props = {
  refreshing: boolean;
  onRefresh: () => void;
};

export default function WorkoutsHeader({ refreshing, onRefresh }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">最近のワークアウト</h2>
        <p className="text-xs text-slate-500">最新の 50 件を表示しています。</p>
      </div>
      <button
        className="self-start rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? "更新中..." : "再読み込み"}
      </button>
    </div>
  );
}
