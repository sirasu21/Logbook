type Props = { children: React.ReactNode };

export default function AppShell({ children }: Props) {
  return <div className="mx-auto w-full max-w-5xl px-6 lg:px-8">{children}</div>;
}
