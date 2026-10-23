export const PIEDMONT_PARK: [number, number] = [33.7851, -84.3738];

export function distanceBetweenMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) *
      Math.cos(radians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1
    ? `${Math.max(1, Math.round(meters * 3.28084))} ft`
    : `${miles.toFixed(1)} mi`;
}

export function formatActivity(
  reported: number | null,
  openGames: number,
): string {
  const reportLabel = reported === null ? "No reports" : `${reported} reported`;
  return `${reportLabel} · ${openGames} open game${openGames === 1 ? "" : "s"}`;
}

export function formatMinutesAgo(date: Date, now: number): string {
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (minutes < 1) {
    return "Updated just now";
  }
  return `Updated ${minutes} min ago`;
}
