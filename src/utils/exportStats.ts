import { rangeFromCount } from "./crowdRange";

export const JOIN_WINDOW_MINUTES = 30;
export const JOIN_WINDOW_WIDE_MINUTES = 60;
export const TOP_COURTS = 5;
export const NOTIFICATION_SOURCES = ["push", "banner", "inbox"] as const;

export function includeInExport(
  event: { uid?: unknown; timestamp?: unknown; eventName?: unknown },
  teamUids: Set<string>,
): boolean {
  if (typeof event.uid !== "string" || typeof event.timestamp !== "number") {
    return false;
  }
  if (teamUids.has(event.uid)) {
    return event.eventName === "in_person_count";
  }
  return true;
}

export function checkInMethod(event: {
  eventName?: unknown;
  method?: unknown;
}): "auto" | "manual" | null {
  if (event.eventName !== "check_in") {
    return null;
  }
  return event.method === "auto" ? "auto" : "manual";
}
const AUTO_TEST = "Auto check-in test";
const AUTO_VARIANTS: Array<[string, string]> = [
  ["auto_on", "Default on"],
  ["auto_off", "Default off"],
];
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
  /** A/B group from users/{uid}.checkinVariant ("auto_on" or "auto_off"). */
  variant?: string | null;
  /** users/{uid}.locationEnabled right now. */
  locationEnabled?: boolean | null;
  /** users/{uid}.autoCheckin right now. */
  autoCheckin?: boolean | null;
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
  variant: string | null;
  locationOn: boolean | null;
  autoCheckinNow: boolean | null;
  autoOnToOff: number;
  autoOffToOn: number;
  autoOffByLocation: number;
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

/** Changes of the automatic check-in setting (SAC-50). "user" changes are
 *  the player flipping the toggle; "location_off" changes happen because the
 *  player turned location off, which switches auto check-in off too. */
function autoChanges(
  events: ExportEvent[],
  cause: "user" | "location_off",
  from: boolean,
  to: boolean,
): ExportEvent[] {
  return named(events, "auto_checkin_changed").filter(
    (event) =>
      event.cause === cause && event.wasOn === from && event.isOn === to,
  );
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
    variant: participant.variant ?? null,
    locationOn: participant.locationEnabled ?? null,
    autoCheckinNow: participant.autoCheckin ?? null,
    autoOnToOff: ownEvents(participant.id, events, "user", true, false),
    autoOffToOn: ownEvents(participant.id, events, "user", false, true),
    autoOffByLocation: ownEvents(
      participant.id,
      events,
      "location_off",
      true,
      false,
    ),
  }));
}

function ownEvents(
  id: string,
  events: ExportEvent[],
  cause: "user" | "location_off",
  from: boolean,
  to: boolean,
): number {
  return autoChanges(events, cause, from, to).filter(
    (event) => event.participant === id,
  ).length;
}

export function rangesMatch(
  appPlayerCount: unknown,
  realPlayerCount: unknown,
): boolean {
  if (typeof appPlayerCount !== "number" || !Number.isFinite(appPlayerCount)) {
    return false;
  }
  if (typeof realPlayerCount !== "number" || !Number.isFinite(realPlayerCount)) {
    return false;
  }
  return rangeFromCount(appPlayerCount) === rangeFromCount(realPlayerCount);
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
  const joinedInWideWindow = joinMinutes.filter(
    (minutes) => minutes <= JOIN_WINDOW_WIDE_MINUTES,
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
    `Games joined within ${JOIN_WINDOW_WIDE_MINUTES} min`,
    joinedInWideWindow,
    posted.size,
  );
  add(
    "Games",
    `Games joined within ${JOIN_WINDOW_WIDE_MINUTES} min (%)`,
    percent(joinedInWideWindow, posted.size),
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

  const inTest = participants.filter(
    (participant) =>
      participant.variant === "auto_on" || participant.variant === "auto_off",
  );
  const compared = inTest.filter(
    (participant) => participant.locationEnabled === true,
  );
  add(AUTO_TEST, "Testers in the test", inTest.length, testers);
  add(
    AUTO_TEST,
    "Testers in the test who allowed location (compared)",
    compared.length,
    inTest.length,
  );
  AUTO_VARIANTS.forEach(([variant, label]) => {
    const inVariant = inTest.filter((p) => p.variant === variant);
    const group = compared.filter((p) => p.variant === variant);
    const ids = new Set(group.map((p) => p.id));
    const mine = (list: ExportEvent[]) =>
      list.filter((event) => ids.has(event.participant));
    const changers = new Set(
      mine(named(events, "auto_checkin_changed"))
        .filter((event) => event.cause === "user")
        .map((event) => event.participant),
    );

    add(
      AUTO_TEST,
      `${label}: testers who allowed location`,
      group.length,
      inVariant.length,
    );
    add(
      AUTO_TEST,
      `${label}: auto check-in on now (%)`,
      percent(group.filter((p) => p.autoCheckin === true).length, group.length),
      group.length,
    );
    add(
      AUTO_TEST,
      `${label}: turned on to off (times)`,
      mine(autoChanges(events, "user", true, false)).length,
      group.length,
    );
    add(
      AUTO_TEST,
      `${label}: turned off to on (times)`,
      mine(autoChanges(events, "user", false, true)).length,
      group.length,
    );
    add(
      AUTO_TEST,
      `${label}: turned off by switching location off (times)`,
      mine(autoChanges(events, "location_off", true, false)).length,
      group.length,
    );
    add(
      AUTO_TEST,
      `${label}: testers who changed the setting (%)`,
      percent(changers.size, group.length),
      group.length,
    );
    add(
      AUTO_TEST,
      `${label}: testers who checked in (%)`,
      percent(group.filter((p) => checkers.has(p.id)).length, group.length),
      group.length,
    );

    const groupCheckIns = mine(named(events, "check_in"));
    const autoGroupCheckIns = groupCheckIns.filter(
      (event) => event.method === "auto",
    ).length;
    add(
      AUTO_TEST,
      `${label}: manual check-ins`,
      groupCheckIns.length - autoGroupCheckIns,
      groupCheckIns.length,
    );
    add(
      AUTO_TEST,
      `${label}: automatic check-ins`,
      autoGroupCheckIns,
      groupCheckIns.length,
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

  const inPersonCounts = named(events, "in_person_count").filter(
    (event) => typeof event.appPlayerCount === "number",
  );
  const rangesMatchedCount = inPersonCounts.filter((event) =>
    rangesMatch(event.appPlayerCount, event.playerCount),
  ).length;
  add(
    "Real count accuracy (Q2)",
    "In-person counts recorded",
    inPersonCounts.length,
    inPersonCounts.length,
  );
  add(
    "Real count accuracy (Q2)",
    "App range matches real range (%)",
    percent(rangesMatchedCount, inPersonCounts.length),
    inPersonCounts.length,
  );

  const allJoins = named(events, "match_joined");
  const notifJoins = allJoins.filter(
    (event) =>
      typeof event.joinSource === "string" &&
      (NOTIFICATION_SOURCES as readonly string[]).includes(event.joinSource),
  ).length;
  add(
    "Notification-driven joins (Q4)",
    "Games joined",
    allJoins.length,
    allJoins.length,
  );
  add(
    "Notification-driven joins (Q4)",
    "Joined via notification (%)",
    percent(notifJoins, allJoins.length),
    allJoins.length,
  );

  const notificationsSent = named(events, "notification_sent").length;
  const notificationsOpened = named(events, "notification_opened").length;
  add(
    "Notification-driven joins (Q4)",
    "Notifications sent",
    notificationsSent,
    notificationsSent,
  );
  add(
    "Notification-driven joins (Q4)",
    "Notifications opened",
    notificationsOpened,
    notificationsSent,
  );
  add(
    "Notification-driven joins (Q4)",
    "Open rate (%)",
    percent(notificationsOpened, notificationsSent),
    notificationsSent,
  );

  const homeScreenJoins = allJoins.filter((event) => event.homeScreen === true);
  const homeScreenNotifJoins = homeScreenJoins.filter(
    (event) =>
      typeof event.joinSource === "string" &&
      (NOTIFICATION_SOURCES as readonly string[]).includes(event.joinSource),
  ).length;
  add(
    "Notification-driven joins (Q4)",
    "Joins from notifications among Home Screen players (%)",
    percent(homeScreenNotifJoins, homeScreenJoins.length),
    homeScreenJoins.length,
  );

  return rows;
}
