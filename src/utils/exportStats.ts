export const JOIN_WINDOW_MINUTES = 30;
export const TOP_COURTS = 5;
export const BARRIER_ANSWERS: Array<[string, string]> = [
  ["forgot", "Forgot"],
  ["too_much_effort", "Too much effort"],
  ["privacy", "Privacy"],
  ["nobody_else_uses_it", "Nobody else uses it"],
];

export interface ExportEvent {
  participant: string;
  eventName: string;
  timestamp: number;
  [field: string]: unknown;
}

export interface Participant {
  id: string;
  signedUpAt: number | null;
  method: string;
}

export interface ParticipantRow {
  participant: string;
  signedUpAt: number | null;
  method: string;
  courtViews: number;
  checkIns: number;
  checkOuts: number;
  trustRatings: number;
  gamesPosted: number;
  gamesJoined: number;
}

export interface StatRow {
  section: string;
  metric: string;
  value: number | null;
  n: number;
}

export function round(value: number | null, places: number): number | null {
  if (value === null) {
    return null;
  }
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : round((part / whole) * 100, 1);
}

function numbers(events: ExportEvent[], field: string): number[] {
  return events.flatMap((event) =>
    typeof event[field] === "number" && Number.isFinite(event[field])
      ? [event[field] as number]
      : [],
  );
}

function named(events: ExportEvent[], eventName: string): ExportEvent[] {
  return events.filter((event) => event.eventName === eventName);
}

function participantsWith(events: ExportEvent[], eventName: string) {
  return new Set(named(events, eventName).map((event) => event.participant));
}

export function participantRows(
  participants: Participant[],
  events: ExportEvent[],
): ParticipantRow[] {
  const count = (id: string, eventName: string) =>
    events.filter(
      (event) => event.participant === id && event.eventName === eventName,
    ).length;

  return participants.map((participant) => ({
    participant: participant.id,
    signedUpAt: participant.signedUpAt,
    method: participant.method,
    courtViews: count(participant.id, "court_viewed"),
    checkIns: count(participant.id, "check_in"),
    checkOuts: count(participant.id, "check_out"),
    trustRatings: count(participant.id, "trust_rating"),
    gamesPosted: count(participant.id, "match_posted"),
    gamesJoined: count(participant.id, "match_joined"),
  }));
}

export function summarize(
  participants: Participant[],
  events: ExportEvent[],
  courtNames: Record<string, string>,
): StatRow[] {
  const rows: StatRow[] = [];
  const add = (
    section: string,
    metric: string,
    value: number | null,
    n: number,
  ) => rows.push({ section, metric, value, n });

  const testers = participants.length;
  const viewers = participantsWith(events, "court_viewed");
  const checkers = participantsWith(events, "check_in");
  const viewersWhoCheckedIn = [...viewers].filter((id) => checkers.has(id));

  add("Testers", "Testers", testers, testers);
  add("Testers", "Testers who viewed a court", viewers.size, testers);
  add("Testers", "Testers who checked in", checkers.size, testers);

  const checkIns = named(events, "check_in");
  const checkOuts = named(events, "check_out");
  const checkInSeconds = numbers(checkIns, "timeToCheckIn").map(
    (milliseconds) => milliseconds / 1000,
  );
  const headCounts = numbers(checkIns, "playerCount");
  const distances = numbers(checkIns, "distance");

  add(
    "Check-ins",
    "Check-in rate, all testers (%)",
    percent(checkers.size, testers),
    testers,
  );
  add(
    "Check-ins",
    "Check-in rate, testers who viewed a court (%)",
    percent(viewersWhoCheckedIn.length, viewers.size),
    viewers.size,
  );
  add(
    "Check-ins",
    "Median time to check in (s)",
    round(median(checkInSeconds), 1),
    checkInSeconds.length,
  );
  add("Check-ins", "Check-ins", checkIns.length, checkIns.length);
  add("Check-ins", "Check-outs", checkOuts.length, checkOuts.length);
  add(
    "Check-ins",
    "Average head count reported",
    round(mean(headCounts), 2),
    headCounts.length,
  );
  add(
    "Check-ins",
    "Check-ins with location on (%)",
    percent(distances.length, checkIns.length),
    checkIns.length,
  );
  add(
    "Check-ins",
    "Median distance from court (m)",
    round(median(distances), 0),
    distances.length,
  );

  const byCourt = new Map<string, number>();
  checkIns.forEach((event) => {
    if (typeof event.courtId === "string") {
      byCourt.set(event.courtId, (byCourt.get(event.courtId) ?? 0) + 1);
    }
  });
  [...byCourt.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        (courtNames[a[0]] ?? a[0]).localeCompare(courtNames[b[0]] ?? b[0]),
    )
    .slice(0, TOP_COURTS)
    .forEach(([courtId, total], index) =>
      add(
        "Check-ins",
        `Busiest court ${index + 1}: ${courtNames[courtId] ?? "Unknown"}`,
        total,
        checkIns.length,
      ),
    );

  const ratings = numbers(named(events, "trust_rating"), "rating");
  const trustSkips = named(events, "trust_skipped").length;
  const trustShown = ratings.length + trustSkips;

  add("Trust", "Prompts shown", trustShown, trustShown);
  add("Trust", "Ratings", ratings.length, trustShown);
  add("Trust", "Skips", trustSkips, trustShown);
  add(
    "Trust",
    "Response rate (%)",
    percent(ratings.length, trustShown),
    trustShown,
  );
  add("Trust", "Mean rating", round(mean(ratings), 2), ratings.length);
  add("Trust", "Median rating", median(ratings), ratings.length);
  [1, 2, 3, 4, 5].forEach((score) =>
    add(
      "Trust",
      `Rated ${score}`,
      ratings.filter((rating) => rating === score).length,
      ratings.length,
    ),
  );

  const posted = new Set(
    named(events, "match_posted").flatMap((event) =>
      typeof event.matchId === "string" ? [event.matchId] : [],
    ),
  );
  const firstJoin = new Map<string, number>();
  named(events, "match_joined").forEach((event) => {
    if (
      typeof event.matchId !== "string" ||
      !posted.has(event.matchId) ||
      typeof event.minutesToJoin !== "number"
    ) {
      return;
    }
    const previous = firstJoin.get(event.matchId);
    if (previous === undefined || event.minutesToJoin < previous) {
      firstJoin.set(event.matchId, event.minutesToJoin);
    }
  });
  const joinMinutes = [...firstJoin.values()];
  const joinedInWindow = joinMinutes.filter(
    (minutes) => minutes <= JOIN_WINDOW_MINUTES,
  ).length;

  add("Games", "Games posted", posted.size, posted.size);
  add("Games", "Games with at least 1 join", firstJoin.size, posted.size);
  add(
    "Games",
    `Games joined within ${JOIN_WINDOW_MINUTES} min`,
    joinedInWindow,
    posted.size,
  );
  add(
    "Games",
    `Games joined within ${JOIN_WINDOW_MINUTES} min (%)`,
    percent(joinedInWindow, posted.size),
    posted.size,
  );
  add(
    "Games",
    "Median minutes to first join",
    median(joinMinutes),
    joinMinutes.length,
  );

  const answers = named(events, "checkin_feedback");
  const feedbackSkips = named(events, "feedback_skipped").length;
  const asked = answers.length + feedbackSkips;

  add("Barriers", "Asked", asked, asked);
  add("Barriers", "Answered", answers.length, asked);
  add("Barriers", "Skipped", feedbackSkips, asked);
  add("Barriers", "Response rate (%)", percent(answers.length, asked), asked);
  BARRIER_ANSWERS.forEach(([answer, label]) => {
    const total = answers.filter((event) => event.answer === answer).length;
    add("Barriers", label, total, answers.length);
    add(
      "Barriers",
      `${label} (%)`,
      percent(total, answers.length),
      answers.length,
    );
  });

  const views = named(events, "court_viewed");
  const viewedCourts = new Set(
    views.flatMap((event) =>
      typeof event.courtId === "string" ? [event.courtId] : [],
    ),
  );

  add("Court views", "Court views", views.length, views.length);
  add(
    "Court views",
    "Courts viewed at least once",
    viewedCourts.size,
    views.length,
  );

  return rows;
}
