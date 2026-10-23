export type StartDay = "today" | "tomorrow";

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

export function formatStart(startAt: Date, now: number): string {
  const time = startAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const dayDifference = Math.round(
    (startOfDay(startAt) - startOfDay(new Date(now))) / 86_400_000,
  );
  if (dayDifference === 0) {
    return `Today ${time}`;
  }
  if (dayDifference === 1) {
    return `Tomorrow ${time}`;
  }
  return `${startAt.toLocaleDateString()} ${time}`;
}

export function buildStart(
  day: StartDay,
  time: string,
  now: Date = new Date(),
): Date | null {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  const date = new Date(now.getTime());
  if (day === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hours, minutes, 0, 0);
  return date;
}
