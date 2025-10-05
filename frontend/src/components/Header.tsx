// src/components/Header.tsx
type Props = {
  name?: string;
  onLogin: () => void;
  onLogout: () => void;
  onReload: () => void;
  reloading: boolean;
};
export default function Header({
  name,
  onLogin,
  onLogout,
  onReload,
  reloading,
}: Props) {
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", marginBottom: 12 }}
    >
      <h1 style={{ margin: 0 }}>To do App</h1>
      <div className="row">
        <button className="btn" onClick={onReload} disabled={reloading}>
          {reloading ? "Reloading..." : "Reload"}
        </button>
        {name ? (
          <button className="btn" onClick={onLogout}>
            Logout
          </button>
        ) : (
          <button className="btn primary" onClick={onLogin}>
            Login with LINE
          </button>
        )}
      </div>
    </div>
  );
}
