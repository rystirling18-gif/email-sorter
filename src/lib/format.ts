export function formatWhen(iso: string, style: "short" | "full" = "full"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: style === "full" ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function lines(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
