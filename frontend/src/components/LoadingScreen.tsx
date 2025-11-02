type Props = {
  message?: string;
};

export default function LoadingScreen({ message = "Loading..." }: Props) {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-slate-500">
      {message}
    </div>
  );
}
