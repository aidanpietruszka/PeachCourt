import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { participantRows, summarize } from "../src/utils/exportStats.ts";

const USAGE =
  "Usage: npm run export -- --since YYYY-MM-DD --exclude team1@x.com,team2@y.com";

const EVENT_COLUMNS = [
  ["participant", (event) => event.participant],
  ["time", (event) => formatTime(event.timestamp)],
  ["event", (event) => event.eventName],
  ["court", (event) => courtName(event.courtId)],
  ["reported_count", (event) => event.reportedCount],
  ["player_count", (event) => event.playerCount],
  ["duration_minutes", (event) => event.durationMinutes],
  ["scheduled_arrival", (event) => formatTime(event.scheduledArrivalAt)],
  [
    "time_to_check_in_s",
    (event) =>
      typeof event.timeToCheckIn === "number"
        ? Math.round(event.timeToCheckIn / 100) / 10
        : null,
  ],
  [
    "distance_m",
    (event) =>
      typeof event.distance === "number" ? Math.round(event.distance) : null,
  ],
  ["answer", (event) => event.answer],
  ["rating", (event) => event.rating],
  ["live_count", (event) => event.liveCount],
  ["game", (event) => event.matchId],
  ["sport", (event) => event.sport],
  ["format", (event) => event.format],
  ["skill_level", (event) => event.skillLevel],
  ["spots_total", (event) => event.spotsTotal],
  ["minutes_to_join", (event) => event.minutesToJoin],
];

const PARTICIPANT_COLUMNS = [
  ["participant", (row) => row.participant],
  ["signed_up", (row) => formatTime(row.signedUpAt)],
  ["method", (row) => row.method],
  ["court_views", (row) => row.courtViews],
  ["check_ins", (row) => row.checkIns],
  ["check_outs", (row) => row.checkOuts],
  ["trust_ratings", (row) => row.trustRatings],
  ["games_posted", (row) => row.gamesPosted],
  ["games_joined", (row) => row.gamesJoined],
];

const SUMMARY_COLUMNS = [
  ["section", (row) => row.section],
  ["metric", (row) => row.metric],
  ["value", (row) => row.value],
  ["n", (row) => row.n],
];

let courtNames = {};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function courtName(courtId) {
  if (typeof courtId !== "string") {
    return null;
  }
  return courtNames[courtId] ?? "Unknown";
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(milliseconds) {
  if (typeof milliseconds !== "number") {
    return null;
  }
  const date = new Date(milliseconds);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns, rows) {
  const lines = [columns.map(([name]) => name).join(",")];
  rows.forEach((row) =>
    lines.push(columns.map(([, read]) => csvCell(read(row))).join(",")),
  );
  return `${lines.join("\n")}\n`;
}

function signUpMethod(user) {
  const providers = user.providerData.map((provider) => provider.providerId);
  if (providers.includes("google.com")) {
    return "google";
  }
  if (providers.includes("password")) {
    return "email";
  }
  return providers.length === 0 ? "guest" : providers.join("+");
}

function plainValues(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Timestamp ? value.toMillis() : value,
    ]),
  );
}

const { values } = parseArgs({
  options: {
    since: { type: "string" },
    exclude: { type: "string", default: "" },
  },
});

if (!values.since || !/^\d{4}-\d{2}-\d{2}$/.test(values.since)) {
  fail(USAGE);
}
const since = new Date(`${values.since}T00:00:00`);
if (Number.isNaN(since.getTime())) {
  fail(USAGE);
}

const keyUrl = new URL("./serviceAccountKey.json", import.meta.url);
if (!existsSync(keyUrl)) {
  fail("Missing scripts/serviceAccountKey.json");
}

const excludedEmails = new Set(
  values.exclude
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

initializeApp({ credential: cert(JSON.parse(readFileSync(keyUrl, "utf8"))) });
const db = getFirestore();

const users = [];
let pageToken;
do {
  const page = await getAuth().listUsers(1000, pageToken);
  users.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);

const teamUids = new Set();
const foundEmails = new Set();
users.forEach((user) => {
  const email = user.email?.toLowerCase();
  if (email && excludedEmails.has(email)) {
    teamUids.add(user.uid);
    foundEmails.add(email);
  }
});
const missingEmails = [...excludedEmails].filter(
  (email) => !foundEmails.has(email),
);
if (missingEmails.length > 0) {
  console.warn(`No account found for: ${missingEmails.join(", ")}`);
}

const courtsSnapshot = await db.collection("courts").get();
courtNames = Object.fromEntries(
  courtsSnapshot.docs.map((court) => [
    court.id,
    court.data().name ?? "Unknown",
  ]),
);

const eventsSnapshot = await db
  .collection("events")
  .where("timestamp", ">=", Timestamp.fromDate(since))
  .get();
const rawEvents = eventsSnapshot.docs
  .map((item) => plainValues(item.data()))
  .filter(
    (event) =>
      typeof event.uid === "string" &&
      typeof event.timestamp === "number" &&
      !teamUids.has(event.uid),
  );

const usersByUid = new Map(users.map((user) => [user.uid, user]));
const testerUids = new Set(rawEvents.map((event) => event.uid));
users.forEach((user) => {
  const created = Date.parse(user.metadata.creationTime);
  if (!teamUids.has(user.uid) && created >= since.getTime()) {
    testerUids.add(user.uid);
  }
});

const testers = [...testerUids]
  .map((uid) => {
    const user = usersByUid.get(uid);
    return {
      uid,
      signedUpAt: user ? Date.parse(user.metadata.creationTime) : null,
      method: user ? signUpMethod(user) : "Unknown",
    };
  })
  .sort(
    (a, b) =>
      (a.signedUpAt ?? Number.MAX_SAFE_INTEGER) -
        (b.signedUpAt ?? Number.MAX_SAFE_INTEGER) || a.uid.localeCompare(b.uid),
  );

const width = Math.max(2, String(testers.length).length);
const participantIds = new Map(
  testers.map((tester, index) => [
    tester.uid,
    `P${String(index + 1).padStart(width, "0")}`,
  ]),
);
const participants = testers.map((tester) => ({
  id: participantIds.get(tester.uid),
  signedUpAt: tester.signedUpAt,
  method: tester.method,
}));

const events = rawEvents
  .map(({ uid, ...event }) => ({
    ...event,
    participant: participantIds.get(uid),
  }))
  .sort((a, b) => a.timestamp - b.timestamp);

const outputDir = new URL("../exports/", import.meta.url);
mkdirSync(outputDir, { recursive: true });
writeFileSync(new URL("events.csv", outputDir), toCsv(EVENT_COLUMNS, events));
writeFileSync(
  new URL("participants.csv", outputDir),
  toCsv(PARTICIPANT_COLUMNS, participantRows(participants, events)),
);
writeFileSync(
  new URL("summary.csv", outputDir),
  toCsv(SUMMARY_COLUMNS, summarize(participants, events, courtNames)),
);

console.log(
  `Exported ${events.length} events from ${participants.length} testers since ${values.since}.`,
);
console.log(`Team accounts left out: ${teamUids.size}`);
console.log(
  "Files: exports/events.csv, exports/participants.csv, exports/summary.csv",
);
