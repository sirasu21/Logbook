export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

export const exerciseTypeLabel = (type: string) => {
  switch (type) {
    case "strength":
      return "筋力";
    case "cardio":
      return "有酸素";
    case "other":
      return "その他";
    default:
      return type;
  }
};

export const minutesBetween = (start: string, end?: string | null) => {
  if (!end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
};
