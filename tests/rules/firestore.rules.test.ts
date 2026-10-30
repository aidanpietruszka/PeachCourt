import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const minutesFromNow = (minutes: number) =>
  Timestamp.fromMillis(Date.now() + minutes * 60_000);

const asUser = (uid: string) =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;
const asGuest = () =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;
const asAnonymous = (uid = "anon-uid") =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore() as unknown as Firestore;

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, path), data);
  });
}

function checkinData(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    courtId: "court-1",
    playerCount: 3,
    checkedInAt: minutesFromNow(0),
    scheduledArrivalAt: minutesFromNow(0),
    durationMinutes: 60,
    expiresAt: minutesFromNow(60),
    distance: 25,
    timeToCheckIn: 1800,
    active: true,
    ...overrides,
  };
}

function activeCheckinData(uid: string, courtId = "court-1") {
  return {
    uid,
    checkinId: "checkin-1",
    courtId,
    playerCount: 3,
    checkedInAt: minutesFromNow(0),
    scheduledArrivalAt: minutesFromNow(0),
    durationMinutes: 60,
    expiresAt: minutesFromNow(60),
  };
}

function matchData(hostUid: string, overrides: Record<string, unknown> = {}) {
  return {
    courtId: "court-1",
    courtName: "City Park",
    sport: "tennis",
    hostUid,
    hostName: "Sam",
    format: "doubles",
    startAt: minutesFromNow(60),
    skillLevel: 3.5,
    spotsTotal: 3,
    playerUids: [],
    playerNames: [],
    status: "open",
    createdAt: minutesFromNow(0),
    ...overrides,
  };
}

function eventData(
  uid: string,
  eventName: string,
  fields: Record<string, unknown>,
) {
  return { uid, eventName, timestamp: Timestamp.now(), ...fields };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-peachcourt",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe("courts", () => {
  it("R-01 anyone can read a court", async () => {
    await seed("courts/court-1", { name: "Piedmont Park" });
    await assertSucceeds(getDoc(doc(asGuest(), "courts/court-1")));
  });

  it("R-02 no one can write a court", async () => {
    await assertFails(
      setDoc(doc(asUser("alice"), "courts/court-1"), { name: "Fake" }),
    );
  });
});

describe("checkins", () => {
  it("R-03 a user can create their own check-in", async () => {
    await assertSucceeds(
      addDoc(collection(asUser("alice"), "checkins"), checkinData("alice")),
    );
  });

  it("R-04 a user cannot check in as someone else", async () => {
    await assertFails(
      addDoc(collection(asUser("alice"), "checkins"), checkinData("bob")),
    );
  });

  it("R-05 a signed-out user cannot check in", async () => {
    await assertFails(
      addDoc(collection(asGuest(), "checkins"), checkinData("alice")),
    );
  });

  it("R-06 head count must be 1 to 20", async () => {
    const db = asUser("alice");
    await assertFails(
      addDoc(
        collection(db, "checkins"),
        checkinData("alice", { playerCount: 0 }),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "checkins"),
        checkinData("alice", { playerCount: 21 }),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "checkins"),
        checkinData("alice", { playerCount: 2.5 }),
      ),
    );
  });

  it("R-07 duration must be an allowed value", async () => {
    await assertFails(
      addDoc(
        collection(asUser("alice"), "checkins"),
        checkinData("alice", { durationMinutes: 45 }),
      ),
    );
  });

  it("R-08 other users can read active check-ins but not inactive ones", async () => {
    await seed("checkins/active", checkinData("alice"));
    await seed("checkins/old", checkinData("alice", { active: false }));
    await assertSucceeds(getDoc(doc(asUser("bob"), "checkins/active")));
    await assertFails(getDoc(doc(asUser("bob"), "checkins/old")));
    await assertSucceeds(getDoc(doc(asUser("alice"), "checkins/old")));
  });

  it("R-09 a user can check out their own check-in only", async () => {
    await seed("checkins/c1", checkinData("alice"));
    const checkout = { active: false, checkedOutAt: Timestamp.now() };
    await assertFails(updateDoc(doc(asUser("bob"), "checkins/c1"), checkout));
    await assertSucceeds(
      updateDoc(doc(asUser("alice"), "checkins/c1"), checkout),
    );
  });

  it("R-10 check-out cannot change other fields", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertFails(
      updateDoc(doc(asUser("alice"), "checkins/c1"), {
        active: false,
        checkedOutAt: Timestamp.now(),
        playerCount: 9,
      }),
    );
  });

  it("R-11 no one can delete a check-in", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertFails(deleteDoc(doc(asUser("alice"), "checkins/c1")));
  });
});

describe("activeCheckins", () => {
  it("R-12 a user can write and read only their own", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser("alice"), "activeCheckins/alice"),
        activeCheckinData("alice"),
      ),
    );
    await assertSucceeds(getDoc(doc(asUser("alice"), "activeCheckins/alice")));
    await assertFails(getDoc(doc(asUser("bob"), "activeCheckins/alice")));
    await assertFails(
      setDoc(
        doc(asUser("bob"), "activeCheckins/alice"),
        activeCheckinData("alice"),
      ),
    );
  });

  it("R-13 a user can delete their own", async () => {
    await seed("activeCheckins/alice", activeCheckinData("alice"));
    await assertSucceeds(
      deleteDoc(doc(asUser("alice"), "activeCheckins/alice")),
    );
  });
});

describe("courtStatus", () => {
  function reportBatch(
    db: Firestore,
    uid: string,
    courtId: string,
    checkedInCourt: string,
  ) {
    const batch = writeBatch(db);
    batch.set(
      doc(db, `activeCheckins/${uid}`),
      activeCheckinData(uid, checkedInCourt),
    );
    batch.set(doc(db, `courtStatus/${courtId}`), {
      playerCount: 2,
      reportedBy: uid,
      reportedAt: serverTimestamp(),
    });
    return batch.commit();
  }

  it("R-14 a report saves with a check-in at the same court", async () => {
    await assertSucceeds(
      reportBatch(asUser("alice"), "alice", "court-1", "court-1"),
    );
  });

  it("R-15 a report fails for a court you are not checked in at", async () => {
    await assertFails(
      reportBatch(asUser("alice"), "alice", "court-2", "court-1"),
    );
  });

  it("R-16 a report fails without a check-in", async () => {
    await assertFails(
      setDoc(doc(asUser("alice"), "courtStatus/court-1"), {
        playerCount: 2,
        reportedBy: "alice",
        reportedAt: serverTimestamp(),
      }),
    );
  });

  it("R-17 a report cannot claim another user or a client time", async () => {
    const db = asUser("alice");
    const wrongUser = writeBatch(db);
    wrongUser.set(doc(db, "activeCheckins/alice"), activeCheckinData("alice"));
    wrongUser.set(doc(db, "courtStatus/court-1"), {
      playerCount: 2,
      reportedBy: "bob",
      reportedAt: serverTimestamp(),
    });
    await assertFails(wrongUser.commit());

    const clientTime = writeBatch(db);
    clientTime.set(doc(db, "activeCheckins/alice"), activeCheckinData("alice"));
    clientTime.set(doc(db, "courtStatus/court-1"), {
      playerCount: 2,
      reportedBy: "alice",
      reportedAt: Timestamp.fromMillis(Date.now() + 3_600_000),
    });
    await assertFails(clientTime.commit());
  });

  it("R-18 signed-in users can read reports, signed-out users cannot", async () => {
    await seed("courtStatus/court-1", {
      playerCount: 2,
      reportedBy: "alice",
      reportedAt: Timestamp.now(),
    });
    await assertSucceeds(getDoc(doc(asUser("bob"), "courtStatus/court-1")));
    await assertFails(getDoc(doc(asGuest(), "courtStatus/court-1")));
  });

  it("R-19 no one can delete a report", async () => {
    await seed("courtStatus/court-1", {
      playerCount: 2,
      reportedBy: "alice",
      reportedAt: Timestamp.now(),
    });
    await assertFails(deleteDoc(doc(asUser("alice"), "courtStatus/court-1")));
  });
});

describe("matches: posting", () => {
  it("R-20 a valid tennis game posts", async () => {
    await assertSucceeds(
      setDoc(doc(asUser("alice"), "matches/m1"), matchData("alice")),
    );
  });

  it("R-21 a valid pickleball singles game posts", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser("alice"), "matches/m1"),
        matchData("alice", {
          sport: "pickleball",
          format: "singles",
          spotsTotal: 1,
          skillLevel: 5,
        }),
      ),
    );
  });

  it("R-22 any skill level posts", async () => {
    await assertSucceeds(
      setDoc(
        doc(asUser("alice"), "matches/m1"),
        matchData("alice", { skillLevel: "any" }),
      ),
    );
  });

  it("R-23 skill must be on the sport's numeric scale", async () => {
    const db = asUser("alice");
    await assertFails(
      setDoc(
        doc(db, "matches/m1"),
        matchData("alice", { skillLevel: "beginner" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "matches/m2"),
        matchData("alice", { sport: "pickleball", skillLevel: 6 }),
      ),
    );
    await assertFails(
      setDoc(doc(db, "matches/m3"), matchData("alice", { skillLevel: 3.25 })),
    );
  });

  it("R-24 sport is required", async () => {
    const data: Record<string, unknown> = matchData("alice");
    delete data.sport;
    await assertFails(setDoc(doc(asUser("alice"), "matches/m1"), data));
  });

  it("R-25 spots must match the format", async () => {
    await assertFails(
      setDoc(
        doc(asUser("alice"), "matches/m1"),
        matchData("alice", { format: "singles", spotsTotal: 3 }),
      ),
    );
  });

  it("R-26 start time must be in the future", async () => {
    await assertFails(
      setDoc(
        doc(asUser("alice"), "matches/m1"),
        matchData("alice", { startAt: minutesFromNow(-5) }),
      ),
    );
  });

  it("R-27 you cannot post as someone else", async () => {
    await assertFails(
      setDoc(doc(asUser("alice"), "matches/m1"), matchData("bob")),
    );
  });

  it("R-28 host name must be 1 to 40 characters", async () => {
    const db = asUser("alice");
    await assertFails(
      setDoc(doc(db, "matches/m1"), matchData("alice", { hostName: "" })),
    );
    await assertFails(
      setDoc(
        doc(db, "matches/m2"),
        matchData("alice", { hostName: "x".repeat(41) }),
      ),
    );
  });

  it("R-29 a new game must start empty and open", async () => {
    await assertFails(
      setDoc(
        doc(asUser("alice"), "matches/m1"),
        matchData("alice", { playerUids: ["bob"], playerNames: ["Bob"] }),
      ),
    );
  });

  it("R-30 extra fields are rejected", async () => {
    await assertFails(
      setDoc(
        doc(asUser("alice"), "matches/m1"),
        matchData("alice", { notes: "hi" }),
      ),
    );
  });

  it("R-31 signed-out users cannot read games", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(getDoc(doc(asGuest(), "matches/m1")));
    await assertSucceeds(getDoc(doc(asUser("bob"), "matches/m1")));
  });
});

describe("matches: joining and leaving", () => {
  it("R-32 another user can join", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertSucceeds(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["bob"],
        playerNames: ["Bob"],
        status: "open",
      }),
    );
  });

  it("R-33 the last spot marks the game full", async () => {
    await seed(
      "matches/m1",
      matchData("alice", {
        playerUids: ["bob", "cara"],
        playerNames: ["Bob", "Cara"],
      }),
    );
    const db = asUser("dan");
    await assertFails(
      updateDoc(doc(db, "matches/m1"), {
        playerUids: ["bob", "cara", "dan"],
        playerNames: ["Bob", "Cara", "Dan"],
        status: "open",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, "matches/m1"), {
        playerUids: ["bob", "cara", "dan"],
        playerNames: ["Bob", "Cara", "Dan"],
        status: "full",
      }),
    );
  });

  it("R-34 no one can join a full game", async () => {
    await seed(
      "matches/m1",
      matchData("alice", {
        playerUids: ["bob", "cara", "dan"],
        playerNames: ["Bob", "Cara", "Dan"],
        status: "full",
      }),
    );
    await assertFails(
      updateDoc(doc(asUser("eve"), "matches/m1"), {
        playerUids: ["bob", "cara", "dan", "eve"],
        playerNames: ["Bob", "Cara", "Dan", "Eve"],
        status: "full",
      }),
    );
  });

  it("R-35 the host cannot join their own game", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(
      updateDoc(doc(asUser("alice"), "matches/m1"), {
        playerUids: ["alice"],
        playerNames: ["Sam"],
        status: "open",
      }),
    );
  });

  it("R-36 a player cannot join twice", async () => {
    await seed(
      "matches/m1",
      matchData("alice", { playerUids: ["bob"], playerNames: ["Bob"] }),
    );
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["bob", "bob"],
        playerNames: ["Bob", "Bob"],
        status: "open",
      }),
    );
  });

  it("R-37 you cannot add someone else", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["cara"],
        playerNames: ["Cara"],
        status: "open",
      }),
    );
  });

  it("R-38 a join needs a name", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["bob"],
        playerNames: [""],
        status: "open",
      }),
    );
  });

  it("R-39 no one can join a game that has started", async () => {
    await seed(
      "matches/m1",
      matchData("alice", { startAt: minutesFromNow(-1) }),
    );
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["bob"],
        playerNames: ["Bob"],
        status: "open",
      }),
    );
  });

  it("R-40 a player can leave and the game reopens", async () => {
    await seed(
      "matches/m1",
      matchData("alice", {
        playerUids: ["bob", "cara", "dan"],
        playerNames: ["Bob", "Cara", "Dan"],
        status: "full",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(asUser("cara"), "matches/m1"), {
        playerUids: ["bob", "dan"],
        playerNames: ["Bob", "Dan"],
        status: "open",
      }),
    );
  });

  it("R-41 you cannot remove another player", async () => {
    await seed(
      "matches/m1",
      matchData("alice", {
        playerUids: ["bob", "cara"],
        playerNames: ["Bob", "Cara"],
      }),
    );
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["bob"],
        playerNames: ["Bob"],
        status: "open",
      }),
    );
  });

  it("R-42 you cannot leave a game you are not in", async () => {
    await seed(
      "matches/m1",
      matchData("alice", { playerUids: ["bob"], playerNames: ["Bob"] }),
    );
    await assertFails(
      updateDoc(doc(asUser("cara"), "matches/m1"), {
        playerUids: [],
        playerNames: [],
        status: "open",
      }),
    );
  });

  it("R-43 joining cannot change other fields", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), {
        playerUids: ["bob"],
        playerNames: ["Bob"],
        status: "open",
        skillLevel: 7,
      }),
    );
  });

  it("R-44 no one can delete a game", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(deleteDoc(doc(asUser("alice"), "matches/m1")));
  });
});

describe("events", () => {
  const valid: Array<[string, Record<string, unknown>]> = [
    [
      "check_in",
      {
        courtId: "court-1",
        playerCount: 3,
        scheduledArrivalAt: Timestamp.now(),
        durationMinutes: 60,
        timeToCheckIn: 1200,
        distance: null,
      },
    ],
    ["check_out", { courtId: "court-1", timeToCheckIn: 1200, distance: 40 }],
    ["checkin_feedback", { answer: "privacy" }],
    [
      "match_posted",
      {
        courtId: "court-1",
        matchId: "m1",
        sport: "tennis",
        format: "doubles",
        skillLevel: 4,
        spotsTotal: 3,
      },
    ],
    ["match_joined", { courtId: "court-1", matchId: "m1", minutesToJoin: 12 }],
    ["trust_rating", { courtId: "court-1", rating: 4, liveCount: 2 }],
    ["trust_skipped", { courtId: "court-1", liveCount: 2 }],
    ["court_viewed", { courtId: "court-1", reportedCount: 3 }],
    ["feedback_skipped", {}],
  ];

  for (const [name, fields] of valid) {
    it(`R-45 ${name} is allowed`, async () => {
      await assertSucceeds(
        addDoc(
          collection(asUser("alice"), "events"),
          eventData("alice", name, fields),
        ),
      );
    });
  }

  it("R-46 unknown events are rejected", async () => {
    await assertFails(
      addDoc(
        collection(asUser("alice"), "events"),
        eventData("alice", "page_view", {}),
      ),
    );
  });

  it("R-47 events cannot be logged for another user", async () => {
    await assertFails(
      addDoc(
        collection(asUser("alice"), "events"),
        eventData("bob", "checkin_feedback", { answer: "forgot" }),
      ),
    );
  });

  it("R-48 bad values are rejected", async () => {
    const db = asUser("alice");
    await assertFails(
      addDoc(
        collection(db, "events"),
        eventData("alice", "checkin_feedback", { answer: "other" }),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "events"),
        eventData("alice", "trust_rating", {
          courtId: "court-1",
          rating: 6,
          liveCount: 2,
        }),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "events"),
        eventData("alice", "match_posted", {
          courtId: "court-1",
          matchId: "m1",
          sport: "tennis",
          format: "doubles",
          skillLevel: "advanced",
          spotsTotal: 3,
        }),
      ),
    );
  });

  it("R-49 no one can read events", async () => {
    await seed(
      "events/e1",
      eventData("alice", "checkin_feedback", { answer: "forgot" }),
    );
    await assertFails(getDoc(doc(asUser("alice"), "events/e1")));
  });

  it("R-50 a court view without a recent report is allowed", async () => {
    await assertSucceeds(
      addDoc(
        collection(asUser("alice"), "events"),
        eventData("alice", "court_viewed", {
          courtId: "court-1",
          reportedCount: null,
        }),
      ),
    );
  });

  it("R-51 new events reject bad values", async () => {
    const db = asUser("alice");
    await assertFails(
      addDoc(
        collection(db, "events"),
        eventData("alice", "court_viewed", {
          courtId: "court-1",
          reportedCount: "3",
        }),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "events"),
        eventData("alice", "court_viewed", { reportedCount: 3 }),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "events"),
        eventData("alice", "trust_skipped", { courtId: "court-1" }),
      ),
    );
  });
});

describe("anonymous users are blocked", () => {
  it("R-anon-01 anonymous user cannot read checkins", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertFails(getDoc(doc(asAnonymous(), "checkins/c1")));
  });

  it("R-anon-02 anonymous user cannot create a checkin", async () => {
    await assertFails(
      addDoc(collection(asAnonymous(), "checkins"), checkinData("anon-uid")),
    );
  });

  it("R-anon-03 anonymous user cannot read or write activeCheckins", async () => {
    await assertFails(
      getDoc(doc(asAnonymous(), "activeCheckins/anon-uid")),
    );
    await assertFails(
      setDoc(
        doc(asAnonymous(), "activeCheckins/anon-uid"),
        activeCheckinData("anon-uid"),
      ),
    );
  });

  it("R-anon-04 anonymous user cannot read courtStatus", async () => {
    await seed("courtStatus/court-1", { playerCount: 2, reportedBy: "alice", reportedAt: minutesFromNow(0) });
    await assertFails(getDoc(doc(asAnonymous(), "courtStatus/court-1")));
  });

  it("R-anon-05 anonymous user cannot read matches", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(getDoc(doc(asAnonymous(), "matches/m1")));
  });

  it("R-anon-06 anonymous user cannot create a match", async () => {
    await assertFails(
      addDoc(collection(asAnonymous(), "matches"), matchData("anon-uid")),
    );
  });

  it("R-anon-07 anonymous user cannot create an event", async () => {
    await assertFails(
      addDoc(
        collection(asAnonymous(), "events"),
        eventData("anon-uid", "court_viewed", { courtId: "court-1", reportedCount: null }),
      ),
    );
  });
});
