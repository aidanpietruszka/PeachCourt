import { writeFileSync } from "node:fs";
import { COURTS as MANUAL_COURTS } from "./courts.mjs";

const BBOX = { south: 33.7, west: -84.44, north: 33.84, east: -84.33 };
const CLUSTER_RADIUS_M = 150;
const MANUAL_OVERRIDE_RADIUS_M = 300;
const UNKNOWN = "Unknown";
const USER_AGENT = "PeachCourt-seed/1.0";
const OUTPUT = new URL("./courts.json", import.meta.url);

const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
const query = `
[out:json][timeout:90];
nwr["leisure"="pitch"]["sport"~"tennis|pickleball"](${bbox});
out tags center;
(
  way["leisure"~"^(park|sports_centre|recreation_ground)$"]["name"](${bbox});
  relation["leisure"~"^(park|sports_centre|recreation_ground)$"]["name"](${bbox});
  way["amenity"~"^(university|college|school)$"]["name"](${bbox});
  relation["amenity"~"^(university|college|school)$"]["name"](${bbox});
);
out tags bb;
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(text) {
  return text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sportsFromTag(value) {
  return value
    .split(";")
    .map((sport) => sport.trim().toLowerCase())
    .filter((sport) => sport === "tennis" || sport === "pickleball");
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const AREA_RANK = {
  sports_centre: 0,
  recreation_ground: 1,
  park: 1,
  college: 2,
  school: 2,
  university: 3,
};

function areaRank(area) {
  return AREA_RANK[area.tags.leisure] ?? AREA_RANK[area.tags.amenity] ?? 9;
}

function areaSize(bounds) {
  return (bounds.maxlat - bounds.minlat) * (bounds.maxlon - bounds.minlon);
}

function containingArea(lat, lon, areas) {
  const matches = areas
    .filter(
      ({ bounds }) =>
        lat >= bounds.minlat &&
        lat <= bounds.maxlat &&
        lon >= bounds.minlon &&
        lon <= bounds.maxlon,
    )
    .sort(
      (a, b) =>
        areaRank(a) - areaRank(b) || areaSize(a.bounds) - areaSize(b.bounds),
    );
  return matches[0] ?? null;
}

function to12Hour(hour, minute) {
  const suffix = hour >= 12 && hour < 24 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${displayHour} ${suffix}`
    : `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatHours(openingHours) {
  if (!openingHours) {
    return UNKNOWN;
  }
  const match = openingHours
    .trim()
    .match(/^(?:Mo-Su\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) {
    return openingHours;
  }
  const [, openHour, openMinute, closeHour, closeMinute] = match.map(Number);
  return `${to12Hour(openHour, openMinute)}–${to12Hour(closeHour, closeMinute)} daily`;
}

async function fetchOverpass() {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error(
      `Overpass request failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()).elements;
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      return null;
    }
    const { address = {} } = await response.json();
    const street = [address.house_number, address.road]
      .filter(Boolean)
      .join(" ");
    const city = address.city ?? address.town ?? address.village;
    const state = address["ISO3166-2-lvl4"]?.replace("US-", "");
    const line = [
      street,
      city,
      [state, address.postcode].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
    return { line, road: address.road ?? null };
  } catch {
    return null;
  }
}

function clusterPitches(pitches) {
  const clusters = [];
  for (const pitch of pitches) {
    const cluster = clusters.find(
      (item) =>
        distanceMeters(item.lat, item.lon, pitch.lat, pitch.lon) <=
        CLUSTER_RADIUS_M,
    );
    if (cluster) {
      cluster.pitches.push(pitch);
      cluster.lat =
        cluster.pitches.reduce((sum, item) => sum + item.lat, 0) /
        cluster.pitches.length;
      cluster.lon =
        cluster.pitches.reduce((sum, item) => sum + item.lon, 0) /
        cluster.pitches.length;
    } else {
      clusters.push({ lat: pitch.lat, lon: pitch.lon, pitches: [pitch] });
    }
  }
  return clusters;
}

function walkOnRules(tags) {
  if (tags.some((tag) => ["customers", "members"].includes(tag.access))) {
    return "Members or customers only";
  }
  if (tags.some((tag) => tag.fee === "yes")) {
    return "Fee required";
  }
  if (tags.some((tag) => tag.fee === "no")) {
    return "Free";
  }
  return UNKNOWN;
}

function reservationInfo(tags) {
  const values = tags.map((tag) => tag.reservation).filter(Boolean);
  if (values.includes("required")) {
    return "Reservation required";
  }
  if (values.includes("yes") || values.includes("recommended")) {
    return "Reservations accepted";
  }
  if (values.includes("no")) {
    return "No reservations";
  }
  return UNKNOWN;
}

function lights(tags) {
  if (tags.some((tag) => tag.lit === "yes")) {
    return true;
  }
  if (tags.some((tag) => tag.lit === "no")) {
    return false;
  }
  return null;
}

const elements = await fetchOverpass();

const pitches = elements
  .filter((element) => element.tags?.leisure === "pitch")
  .map((element) => ({
    lat: element.lat ?? element.center?.lat,
    lon: element.lon ?? element.center?.lon,
    tags: element.tags,
  }))
  .filter(
    (pitch) =>
      typeof pitch.lat === "number" &&
      typeof pitch.lon === "number" &&
      !["private", "no"].includes(pitch.tags.access) &&
      sportsFromTag(pitch.tags.sport ?? "").length > 0,
  );

const areas = elements.filter(
  (element) => element.tags?.leisure !== "pitch" && element.bounds,
);

const clusters = clusterPitches(pitches).filter((cluster) =>
  MANUAL_COURTS.every(
    (court) =>
      distanceMeters(
        court.latitude,
        court.longitude,
        cluster.lat,
        cluster.lon,
      ) > MANUAL_OVERRIDE_RADIUS_M,
  ),
);

const usedIds = new Set(MANUAL_COURTS.map((court) => court.id));
const courts = [...MANUAL_COURTS];

for (const cluster of clusters) {
  const tags = cluster.pitches.map((pitch) => pitch.tags);
  const area = containingArea(cluster.lat, cluster.lon, areas);
  const allTags = area ? [...tags, area.tags] : tags;
  const geo = await reverseGeocode(cluster.lat, cluster.lon);
  await sleep(1100);

  const name =
    area?.tags.name ??
    mostCommon(tags.map((tag) => tag.name).filter(Boolean)) ??
    (geo?.road ? `Courts on ${geo.road}` : UNKNOWN);

  let id = slugify(name);
  for (let suffix = 2; usedIds.has(id); suffix += 1) {
    id = `${slugify(name)}-${suffix}`;
  }
  usedIds.add(id);

  const surface = mostCommon(tags.map((tag) => tag.surface).filter(Boolean));

  courts.push({
    id,
    name,
    address: geo?.line || UNKNOWN,
    latitude: Number(cluster.lat.toFixed(6)),
    longitude: Number(cluster.lon.toFixed(6)),
    sports: [...new Set(tags.flatMap((tag) => sportsFromTag(tag.sport)))],
    numberOfCourts: cluster.pitches.length,
    surface: surface ? titleCase(surface) : UNKNOWN,
    hasLights: lights(tags),
    hours: formatHours(
      mostCommon(tags.map((tag) => tag.opening_hours).filter(Boolean)) ??
        area?.tags.opening_hours,
    ),
    walkOnRules: walkOnRules(allTags),
    reservationInfo: reservationInfo(allTags),
  });
}

courts.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUTPUT, `${JSON.stringify(courts, null, 2)}\n`);

console.table(
  courts.map(({ name, numberOfCourts, sports, hasLights, hours, address }) => ({
    name,
    courts: numberOfCourts,
    sports: sports.join("/"),
    hours,
    lights: hasLights === null ? UNKNOWN : hasLights ? "yes" : "no",
    address,
  })),
);
console.log(
  `\nWrote ${courts.length} courts to scripts/courts.json. Review it, then run: node scripts/seed.mjs`,
);
