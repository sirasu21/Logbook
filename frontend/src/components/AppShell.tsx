// src/components/AppShell.tsx
import "../app.css";
type Props = { children: React.ReactNode };
export default function AppShell({ children }: Props) {
  return <div className="container">{children}</div>;
}
