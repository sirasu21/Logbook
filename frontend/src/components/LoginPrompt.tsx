type Props = {
  onLogin: () => void;
  qrImageUrl?: string;
};

const DEFAULT_QR_IMAGE =
  "https://qr-official.line.me/sid/L/892jcodc.png";

export default function LoginPrompt({
  onLogin,
  qrImageUrl = DEFAULT_QR_IMAGE,
}: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="card-shadow flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl bg-white/80 p-10 text-center shadow-xl">
        <div className="flex items-center gap-3 text-xl font-bold text-slate-900">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-2xl text-white shadow-lg">
            🏋️
          </span>
          Logbook
        </div>
        <h2 className="text-2xl font-semibold">ログインが必要です</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          LINE アカウントでサインインして、トレーニングの記録を管理しましょう。
        </p>
        <img
          src={qrImageUrl}
          alt="LINE 友だち追加 QRコード"
          className="h-44 w-44 rounded-2xl border border-slate-200 shadow-sm"
        />
        <p className="text-xs text-slate-500">
          QRコードを読み取って友だち追加し、ログインしてください。
        </p>
        <button
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700"
          onClick={onLogin}
        >
          LINE でログイン
        </button>
      </div>
    </div>
  );
}
