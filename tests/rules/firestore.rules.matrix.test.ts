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

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, path), data);
  });
}

type Data = Record<string, unknown>;

function without(data: Data, key: string): Data {
  const copy = { ...data };
  delete copy[key];
  return copy;
}

function checkinData(uid: string): Data {
  return {
    uid,
    courtId: "court-1",
    playerCount: 2,
    checkedInAt: minutesFromNow(0),
    scheduledArrivalAt: minutesFromNow(0),
    durationMinutes: 60,
    expiresAt: minutesFromNow(60),
    distance: 25,
    timeToCheckIn: 1800,
    active: true,
  };
}

function activeCheckinData(uid: string): Data {
  return {
    uid,
    checkinId: "checkin-1",
    courtId: "court-1",
    playerCount: 2,
    checkedInAt: minutesFromNow(0),
    scheduledArrivalAt: minutesFromNow(0),
    durationMinutes: 60,
    expiresAt: minutesFromNow(60),
  };
}

function matchData(hostUid: string): Data {
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
  };
}

function eventData(uid: string, eventName: string, fields: Data): Data {
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

const notTimestamps: [string, unknown][] = [
  ["a number", 1700000000000],
  ["a string", "2026-11-01"],
  ["null", null],
];

const durations = [30, 60];
const badDurations: [string, unknown][] = [
  ["zero", 0],
  ["45", 45],
  ["90", 90],
  ["120", 120],
  ["180", 180],
  ["240", 240],
  ["300", 300],
  ["a string", "60"],
  ["null", null],
];

const badCounts: [string, unknown][] = [
  ["0", 0],
  ["-1", -1],
  ["3", 3],
  ["4", 4],
  ["6", 6],
  ["21", 21],
  ["3.5", 3.5],
  ["a string", "3"],
  ["null", null],
];

describe("matrix: checkins create", () => {
  const create = (db: Firestore, data: Data) =>
    addDoc(collection(db, "checkins"), data);

  it("M-01 each required field is required", async () => {
    for (const key of Object.keys(checkinData("alice"))) {
      if (key === "distance") continue;
      await assertFails(
        create(asUser("alice"), without(checkinData("alice"), key)),
      );
    }
  });

  it("M-02 distance may be null or a number but not missing wrongly typed", async () => {
    await assertSucceeds(
      create(asUser("alice"), { ...checkinData("alice"), distance: null }),
    );
    await assertSucceeds(
      create(asUser("alice"), { ...checkinData("alice"), distance: 0 }),
    );
    await assertFails(
      create(asUser("alice"), { ...checkinData("alice"), distance: "far" }),
    );
  });

  it("M-03 courtId must be a string", async () => {
    for (const bad of [5, null, true]) {
      await assertFails(
        create(asUser("alice"), { ...checkinData("alice"), courtId: bad }),
      );
    }
  });

  it.each(notTimestamps)("M-04 timestamps reject %s", async (_n, bad) => {
    for (const key of ["checkedInAt", "scheduledArrivalAt", "expiresAt"]) {
      await assertFails(
        create(asUser("alice"), { ...checkinData("alice"), [key]: bad }),
      );
    }
  });

  it("M-05 active must be true on create", async () => {
    await assertFails(
      create(asUser("alice"), { ...checkinData("alice"), active: false }),
    );
    await assertFails(
      create(asUser("alice"), { ...checkinData("alice"), active: "true" }),
    );
  });

  it("M-06 timeToCheckIn must be a number", async () => {
    for (const bad of ["1800", null, true]) {
      await assertFails(
        create(asUser("alice"), {
          ...checkinData("alice"),
          timeToCheckIn: bad,
        }),
      );
    }
    await assertSucceeds(
      create(asUser("alice"), { ...checkinData("alice"), timeToCheckIn: 0 }),
    );
    await assertSucceeds(
      create(asUser("alice"), { ...checkinData("alice"), timeToCheckIn: -5 }),
    );
  });

  it.each(durations)("M-07 duration %i is accepted", async (d) => {
    await assertSucceeds(
      create(asUser("alice"), { ...checkinData("alice"), durationMinutes: d }),
    );
  });

  it.each(badDurations)("M-08 duration rejects %s", async (_n, bad) => {
    await assertFails(
      create(asUser("alice"), {
        ...checkinData("alice"),
        durationMinutes: bad,
      }),
    );
  });

  it("M-09 playerCount accepts valid range minimums", async () => {
    for (const ok of [1, 2, 5, 9, 16]) {
      await assertSucceeds(
        create(asUser("alice"), { ...checkinData("alice"), playerCount: ok }),
      );
    }
  });

  it.each(badCounts)("M-10 playerCount rejects %s", async (_n, bad) => {
    await assertFails(
      create(asUser("alice"), { ...checkinData("alice"), playerCount: bad }),
    );
  });

  it("M-11 uid must be the caller", async () => {
    await assertFails(
      create(asUser("alice"), { ...checkinData("alice"), uid: null }),
    );
    await assertFails(create(asGuest(), checkinData("alice")));
  });
});

describe("matrix: checkins read, update, delete", () => {
  const checkout = { active: false, checkedOutAt: Timestamp.now() };

  it("M-12 signed-out users cannot read any check-in", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertFails(getDoc(doc(asGuest(), "checkins/c1")));
  });

  it("M-13 inactive check-ins are readable only by the owner", async () => {
    await seed("checkins/c1", { ...checkinData("alice"), active: false });
    await assertSucceeds(getDoc(doc(asUser("alice"), "checkins/c1")));
    await assertFails(getDoc(doc(asUser("bob"), "checkins/c1")));
  });

  it("M-14 active check-ins are readable by any signed-in user", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertSucceeds(getDoc(doc(asUser("bob"), "checkins/c1")));
  });

  it("M-15 signed-out users cannot update", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertFails(updateDoc(doc(asGuest(), "checkins/c1"), checkout));
  });

  it("M-16 checkout needs active false and a timestamp", async () => {
    await seed("checkins/c1", checkinData("alice"));
    const ref = doc(asUser("alice"), "checkins/c1");
    await assertFails(
      updateDoc(ref, { active: true, checkedOutAt: Timestamp.now() }),
    );
    await assertFails(updateDoc(ref, { active: false, checkedOutAt: 123 }));
    await assertFails(updateDoc(ref, { active: false }));
    await assertFails(updateDoc(ref, { checkedOutAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref, checkout));
  });

  it("M-17 checkout cannot touch other fields", async () => {
    await seed("checkins/c1", checkinData("alice"));
    const ref = doc(asUser("alice"), "checkins/c1");
    await assertFails(updateDoc(ref, { ...checkout, playerCount: 9 }));
    await assertFails(updateDoc(ref, { ...checkout, uid: "bob" }));
    await assertFails(updateDoc(ref, { ...checkout, courtId: "court-2" }));
  });

  it("M-18 nobody can delete a check-in", async () => {
    await seed("checkins/c1", checkinData("alice"));
    await assertFails(deleteDoc(doc(asUser("alice"), "checkins/c1")));
    await assertFails(deleteDoc(doc(asGuest(), "checkins/c1")));
  });
});

describe("matrix: activeCheckins", () => {
  it("M-19 only the owner can read", async () => {
    await seed("activeCheckins/alice", activeCheckinData("alice"));
    await assertSucceeds(getDoc(doc(asUser("alice"), "activeCheckins/alice")));
    await assertFails(getDoc(doc(asUser("bob"), "activeCheckins/alice")));
    await assertFails(getDoc(doc(asGuest(), "activeCheckins/alice")));
  });

  it("M-20 only the owner can write their document", async () => {
    await assertFails(
      setDoc(
        doc(asUser("bob"), "activeCheckins/alice"),
        activeCheckinData("alice"),
      ),
    );
    await assertFails(
      setDoc(
        doc(asGuest(), "activeCheckins/alice"),
        activeCheckinData("alice"),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(asUser("alice"), "activeCheckins/alice"),
        activeCheckinData("alice"),
      ),
    );
  });

  it("M-21 stored uid must equal the path", async () => {
    await assertFails(
      setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
        ...activeCheckinData("alice"),
        uid: "bob",
      }),
    );
  });

  it("M-22 each required field is required", async () => {
    for (const key of Object.keys(activeCheckinData("alice"))) {
      await assertFails(
        setDoc(
          doc(asUser("alice"), "activeCheckins/alice"),
          without(activeCheckinData("alice"), key),
        ),
      );
    }
  });

  it("M-23 string fields must be strings", async () => {
    for (const key of ["checkinId", "courtId"]) {
      for (const bad of [1, null]) {
        await assertFails(
          setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
            ...activeCheckinData("alice"),
            [key]: bad,
          }),
        );
      }
    }
  });

  it.each(notTimestamps)("M-24 timestamps reject %s", async (_n, bad) => {
    for (const key of ["checkedInAt", "scheduledArrivalAt", "expiresAt"]) {
      await assertFails(
        setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
          ...activeCheckinData("alice"),
          [key]: bad,
        }),
      );
    }
  });

  it.each(badDurations)("M-25 duration rejects %s", async (_n, bad) => {
    await assertFails(
      setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
        ...activeCheckinData("alice"),
        durationMinutes: bad,
      }),
    );
  });

  it.each(durations)("M-26 duration %i is accepted", async (d) => {
    await assertSucceeds(
      setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
        ...activeCheckinData("alice"),
        durationMinutes: d,
      }),
    );
  });

  it("M-27 playerCount accepts valid range minimums", async () => {
    for (const ok of [1, 2, 5, 9, 16]) {
      await assertSucceeds(
        setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
          ...activeCheckinData("alice"),
          playerCount: ok,
        }),
      );
    }
    for (const [, bad] of badCounts) {
      await assertFails(
        setDoc(doc(asUser("alice"), "activeCheckins/alice"), {
          ...activeCheckinData("alice"),
          playerCount: bad,
        }),
      );
    }
  });

  it("M-28 update goes through the same validation", async () => {
    await seed("activeCheckins/alice", activeCheckinData("alice"));
    await assertFails(
      updateDoc(doc(asUser("alice"), "activeCheckins/alice"), {
        playerCount: 21,
      }),
    );
    await assertFails(
      updateDoc(doc(asUser("alice"), "activeCheckins/alice"), {
        playerCount: 4,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(asUser("alice"), "activeCheckins/alice"), {
        playerCount: 5,
      }),
    );
  });

  it("M-29 only the owner can delete", async () => {
    await seed("activeCheckins/alice", activeCheckinData("alice"));
    await assertFails(deleteDoc(doc(asUser("bob"), "activeCheckins/alice")));
    await assertFails(deleteDoc(doc(asGuest(), "activeCheckins/alice")));
    await assertSucceeds(
      deleteDoc(doc(asUser("alice"), "activeCheckins/alice")),
    );
  });
});

describe("matrix: courtStatus", () => {
  async function report(
    uid: string,
    fields: Data,
    activeCourt = "court-1",
    target = "court-1",
  ) {
    const db = asUser(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, `activeCheckins/${uid}`), {
      ...activeCheckinData(uid),
      courtId: activeCourt,
    });
    batch.set(doc(db, `courtStatus/${target}`), {
      playerCount: 2,
      reportedBy: uid,
      reportedAt: serverTimestamp(),
      ...fields,
    });
    return batch.commit();
  }

  it("M-30 valid report succeeds", async () => {
    await assertSucceeds(report("alice", {}));
  });

  it("M-31 playerCount accepts valid range minimums", async () => {
    for (const ok of [1, 2, 5, 9, 16]) {
      await assertSucceeds(report("alice", { playerCount: ok }));
    }
    for (const [, bad] of badCounts) {
      await assertFails(report("alice", { playerCount: bad }));
    }
  });

  it("M-32 extra keys are rejected", async () => {
    await assertFails(report("alice", { note: "hi" }));
    await assertFails(report("alice", { admin: true }));
  });

  it("M-33 reportedBy must be the caller", async () => {
    await assertFails(report("alice", { reportedBy: "bob" }));
    await assertFails(report("alice", { reportedBy: null }));
  });

  it("M-34 reportedAt must be the server time", async () => {
    await assertFails(report("alice", { reportedAt: Timestamp.now() }));
    await assertFails(report("alice", { reportedAt: null }));
  });

  it("M-35 required keys cannot be missing", async () => {
    const db = asUser("alice");
    for (const key of ["playerCount", "reportedBy", "reportedAt"]) {
      const batch = writeBatch(db);
      batch.set(doc(db, "activeCheckins/alice"), activeCheckinData("alice"));
      batch.set(
        doc(db, "courtStatus/court-1"),
        without(
          {
            playerCount: 3,
            reportedBy: "alice",
            reportedAt: serverTimestamp(),
          },
          key,
        ),
      );
      await assertFails(batch.commit());
    }
  });

  it("M-36 must be checked in at that court", async () => {
    await assertFails(report("alice", {}, "court-2", "court-1"));
  });

  it("M-37 no active check-in means no report", async () => {
    await assertFails(
      setDoc(doc(asUser("alice"), "courtStatus/court-1"), {
        playerCount: 3,
        reportedBy: "alice",
        reportedAt: serverTimestamp(),
      }),
    );
  });

  it("M-38 signed-out users cannot read or write", async () => {
    await seed("courtStatus/court-1", {
      playerCount: 3,
      reportedBy: "alice",
      reportedAt: Timestamp.now(),
    });
    await assertFails(getDoc(doc(asGuest(), "courtStatus/court-1")));
    await assertFails(
      setDoc(doc(asGuest(), "courtStatus/court-1"), {
        playerCount: 3,
        reportedBy: "alice",
        reportedAt: serverTimestamp(),
      }),
    );
  });

  it("M-39 an existing report can be updated by another checked-in user", async () => {
    await seed("courtStatus/court-1", {
      playerCount: 3,
      reportedBy: "alice",
      reportedAt: Timestamp.now(),
    });
    await assertSucceeds(report("bob", { playerCount: 5 }));
  });
});

describe("matrix: matches create", () => {
  let seq = 0;
  const post = (uid: string, data: Data) =>
    setDoc(doc(asUser(uid), `matches/new-${seq++}`), data);

  it("M-40 each required field is required", async () => {
    for (const key of Object.keys(matchData("alice"))) {
      await assertFails(post("alice", without(matchData("alice"), key)));
    }
  });

  it("M-41 signed-out users cannot post", async () => {
    await assertFails(setDoc(doc(asGuest(), "matches/m1"), matchData("alice")));
  });

  it("M-42 courtId and hostName must be strings", async () => {
    for (const bad of [1, null, true]) {
      await assertFails(post("alice", { ...matchData("alice"), courtId: bad }));
      await assertFails(
        post("alice", { ...matchData("alice"), hostName: bad }),
      );
    }
  });

  it("M-42b courtName must be a string", async () => {
    for (const bad of [1, null, true]) {
      await assertFails(
        post("alice", { ...matchData("alice"), courtName: bad }),
      );
    }
  });

  it("M-42c courtName is required", async () => {
    await assertFails(post("alice", without(matchData("alice"), "courtName")));
  });

  it("M-42d courtName accepts an empty string", async () => {
    await assertSucceeds(
      post("alice", { ...matchData("alice"), courtName: "" }),
    );
  });

  it("M-42e courtName accepts a non-empty string", async () => {
    await assertSucceeds(
      post("alice", { ...matchData("alice"), courtName: "Grove Park" }),
    );
  });

  it("M-43 hostName length bounds", async () => {
    await assertFails(post("alice", { ...matchData("alice"), hostName: "" }));
    await assertSucceeds(
      post("alice", { ...matchData("alice"), hostName: "a" }),
    );
    await assertSucceeds(
      post("alice", { ...matchData("alice"), hostName: "a".repeat(40) }),
    );
    await assertFails(
      post("alice", { ...matchData("alice"), hostName: "a".repeat(41) }),
    );
  });

  it("M-44 sport must be tennis or pickleball", async () => {
    for (const bad of ["golf", "", null, 1, "Tennis"]) {
      await assertFails(post("alice", { ...matchData("alice"), sport: bad }));
    }
  });

  it("M-45 format must be singles or doubles with matching spots", async () => {
    const combos: [string, number, boolean][] = [
      ["singles", 1, true],
      ["doubles", 3, true],
      ["singles", 3, false],
      ["doubles", 1, false],
      ["singles", 0, false],
      ["doubles", 2, false],
      ["triples", 3, false],
      ["", 1, false],
    ];
    for (const [format, spotsTotal, ok] of combos) {
      const data = { ...matchData("alice"), format, spotsTotal };
      if (ok) await assertSucceeds(post("alice", data));
      else await assertFails(post("alice", data));
    }
  });

  it("M-46 startAt must be a future timestamp", async () => {
    for (const [, bad] of notTimestamps) {
      await assertFails(post("alice", { ...matchData("alice"), startAt: bad }));
    }
    await assertFails(
      post("alice", { ...matchData("alice"), startAt: minutesFromNow(-1) }),
    );
  });

  it("M-47 createdAt must be a timestamp", async () => {
    for (const [, bad] of notTimestamps) {
      await assertFails(
        post("alice", { ...matchData("alice"), createdAt: bad }),
      );
    }
  });

  it("M-48 a new game starts empty and open", async () => {
    await assertFails(
      post("alice", { ...matchData("alice"), playerUids: ["alice"] }),
    );
    await assertFails(
      post("alice", { ...matchData("alice"), playerNames: ["Sam"] }),
    );
    await assertFails(post("alice", { ...matchData("alice"), status: "full" }));
    await assertFails(
      post("alice", { ...matchData("alice"), status: "closed" }),
    );
    await assertFails(post("alice", { ...matchData("alice"), status: null }));
  });

  it("M-49 extra keys are rejected", async () => {
    await assertFails(post("alice", { ...matchData("alice"), admin: true }));
  });

  it("M-50 hostUid must be the caller", async () => {
    await assertFails(post("alice", { ...matchData("bob") }));
    await assertFails(post("alice", { ...matchData("alice"), hostUid: null }));
  });

  it("M-51 skill scale per sport", async () => {
    const tennis = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, "any"];
    const pickle = [2, 2.5, 3, 3.5, 4, 4.5, 5, "any"];
    for (const s of tennis) {
      await assertSucceeds(
        setDoc(doc(asUser("alice"), `matches/t-${s}`), {
          ...matchData("alice"),
          skillLevel: s,
        }),
      );
    }
    for (const s of pickle) {
      await assertSucceeds(
        setDoc(doc(asUser("alice"), `matches/p-${s}`), {
          ...matchData("alice"),
          sport: "pickleball",
          skillLevel: s,
        }),
      );
    }
    for (const s of [1, 1.5, 5.25, 7.5, 0, -1, null, "Any"]) {
      await assertFails(
        post("alice", {
          ...matchData("alice"),
          sport: "pickleball",
          skillLevel: s,
        }),
      );
    }
    for (const s of [1, 7.5, 0, null, "ANY"]) {
      await assertFails(
        post("alice", { ...matchData("alice"), skillLevel: s }),
      );
    }
  });
});

describe("matrix: matches read, update, delete", () => {
  const joinFields = (uids: string[], names: string[], status: string) => ({
    playerUids: uids,
    playerNames: names,
    status,
  });

  it("M-52 signed-out users cannot read", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(getDoc(doc(asGuest(), "matches/m1")));
    await assertSucceeds(getDoc(doc(asUser("bob"), "matches/m1")));
  });

  it("M-53 signed-out users cannot join", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(
      updateDoc(
        doc(asGuest(), "matches/m1"),
        joinFields(["bob"], ["Bob"], "open"),
      ),
    );
  });

  it("M-54 joining a started game fails", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      startAt: minutesFromNow(-5),
    });
    await assertFails(
      updateDoc(
        doc(asUser("bob"), "matches/m1"),
        joinFields(["bob"], ["Bob"], "open"),
      ),
    );
  });

  it("M-55 leaving a started game fails", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      startAt: minutesFromNow(-5),
      playerUids: ["bob"],
      playerNames: ["Bob"],
    });
    await assertFails(
      updateDoc(doc(asUser("bob"), "matches/m1"), joinFields([], [], "open")),
    );
  });

  it("M-56 joiner name is required, a string, 1 to 40 chars", async () => {
    await seed("matches/m1", matchData("alice"));
    const ref = doc(asUser("bob"), "matches/m1");
    await assertFails(updateDoc(ref, joinFields(["bob"], [""], "open")));
    await assertFails(updateDoc(ref, joinFields(["bob"], [5], "open")));
    await assertFails(updateDoc(ref, joinFields(["bob"], [null], "open")));
    await assertFails(
      updateDoc(ref, joinFields(["bob"], ["b".repeat(41)], "open")),
    );
    await assertSucceeds(
      updateDoc(ref, joinFields(["bob"], ["b".repeat(40)], "open")),
    );
  });

  it("M-57 names and uids must stay the same length", async () => {
    await seed("matches/m1", matchData("alice"));
    const ref = doc(asUser("bob"), "matches/m1");
    await assertFails(
      updateDoc(ref, joinFields(["bob"], ["Bob", "Extra"], "open")),
    );
    await assertFails(updateDoc(ref, joinFields(["bob"], [], "open")));
  });

  it("M-58 only uids, names and status may change", async () => {
    await seed("matches/m1", matchData("alice"));
    const ref = doc(asUser("bob"), "matches/m1");
    for (const extra of [
      { hostUid: "bob" },
      { spotsTotal: 9 },
      { courtId: "court-9" },
      { startAt: minutesFromNow(500) },
      { skillLevel: "any" },
      { hostName: "Hacker" },
    ]) {
      await assertFails(
        updateDoc(ref, { ...joinFields(["bob"], ["Bob"], "open"), ...extra }),
      );
    }
  });

  it("M-59 join status must reflect fullness", async () => {
    await seed("matches/m1", matchData("alice"));
    const ref = doc(asUser("bob"), "matches/m1");
    await assertFails(updateDoc(ref, joinFields(["bob"], ["Bob"], "full")));
    await assertFails(updateDoc(ref, joinFields(["bob"], ["Bob"], "closed")));
    await assertFails(updateDoc(ref, joinFields(["bob"], ["Bob"], null)));
    await assertSucceeds(updateDoc(ref, joinFields(["bob"], ["Bob"], "open")));
  });

  it("M-60 the last join must set status full", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      playerUids: ["b", "c"],
      playerNames: ["B", "C"],
    });
    const ref = doc(asUser("dan"), "matches/m1");
    await assertFails(
      updateDoc(ref, joinFields(["b", "c", "dan"], ["B", "C", "Dan"], "open")),
    );
    await assertSucceeds(
      updateDoc(ref, joinFields(["b", "c", "dan"], ["B", "C", "Dan"], "full")),
    );
  });

  it("M-61 a singles game fills after one join", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      format: "singles",
      spotsTotal: 1,
    });
    const ref = doc(asUser("bob"), "matches/m1");
    await assertFails(updateDoc(ref, joinFields(["bob"], ["Bob"], "open")));
    await assertSucceeds(updateDoc(ref, joinFields(["bob"], ["Bob"], "full")));
  });

  it("M-62 a full game stays full for a stranger", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      playerUids: ["b", "c", "d"],
      playerNames: ["B", "C", "D"],
      status: "full",
    });
    const ref = doc(asUser("eve"), "matches/m1");
    for (const status of ["full", "open"]) {
      await assertFails(
        updateDoc(
          ref,
          joinFields(["b", "c", "d", "eve"], ["B", "C", "D", "Eve"], status),
        ),
      );
    }
  });

  it("M-63 leaving must reopen the game", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      playerUids: ["b", "c", "d"],
      playerNames: ["B", "C", "D"],
      status: "full",
    });
    const ref = doc(asUser("b"), "matches/m1");
    await assertFails(
      updateDoc(ref, joinFields(["c", "d"], ["C", "D"], "full")),
    );
    await assertSucceeds(
      updateDoc(ref, joinFields(["c", "d"], ["C", "D"], "open")),
    );
  });

  it("M-64 leaving cannot remove someone else", async () => {
    await seed("matches/m1", {
      ...matchData("alice"),
      playerUids: ["b", "c"],
      playerNames: ["B", "C"],
    });
    await assertFails(
      updateDoc(
        doc(asUser("b"), "matches/m1"),
        joinFields(["b"], ["B"], "open"),
      ),
    );
  });

  it("M-65 nobody can delete a game", async () => {
    await seed("matches/m1", matchData("alice"));
    await assertFails(deleteDoc(doc(asUser("alice"), "matches/m1")));
    await assertFails(deleteDoc(doc(asGuest(), "matches/m1")));
  });
});

describe("matrix: events", () => {
  const send = (db: Firestore, data: Data) =>
    addDoc(collection(db, "events"), data);

  const valid: Record<string, Data> = {
    check_in: {
      courtId: "c1",
      playerCount: 2,
      scheduledArrivalAt: Timestamp.now(),
      durationMinutes: 60,
      timeToCheckIn: 30,
      distance: 12,
    },
    check_out: { courtId: "c1", timeToCheckIn: 30, distance: null },
    checkin_feedback: { answer: "forgot" },
    match_posted: {
      courtId: "c1",
      matchId: "m1",
      sport: "tennis",
      format: "doubles",
      skillLevel: 3.5,
      spotsTotal: 3,
    },
    match_joined: { courtId: "c1", matchId: "m1", minutesToJoin: 5 },
    trust_rating: { courtId: "c1", rating: 4, liveCount: 3 },
    trust_skipped: { courtId: "c1", liveCount: 3 },
    court_viewed: { courtId: "c1", reportedCount: null },
    feedback_skipped: {},
    count_updated: { courtId: "c1", playerCount: 2 },
    still_here_yes: { courtId: "c1", playerCount: 2 },
    still_here_skipped: { courtId: "c1" },
  };

  it.each(Object.keys(valid))("M-66 valid %s is accepted", async (name) => {
    await assertSucceeds(
      send(asUser("alice"), eventData("alice", name, valid[name])),
    );
  });

  it.each(Object.keys(valid))("M-67 %s rejects a guest", async (name) => {
    await assertFails(send(asGuest(), eventData("alice", name, valid[name])));
  });

  it.each(Object.keys(valid))("M-68 %s rejects another uid", async (name) => {
    await assertFails(
      send(asUser("bob"), eventData("alice", name, valid[name])),
    );
  });

  it.each(Object.keys(valid))("M-69 %s needs a timestamp", async (name) => {
    for (const [, bad] of notTimestamps) {
      await assertFails(
        send(asUser("alice"), {
          ...eventData("alice", name, valid[name]),
          timestamp: bad,
        }),
      );
    }
    await assertFails(
      send(
        asUser("alice"),
        without(eventData("alice", name, valid[name]), "timestamp"),
      ),
    );
  });

  it("M-70 unknown event names are rejected", async () => {
    for (const name of ["", "admin", "CHECK_IN", null]) {
      await assertFails(
        send(asUser("alice"), eventData("alice", name as string, {})),
      );
    }
  });

  it("M-71 every required field is required per event", async () => {
    const optional = new Set(["distance", "reportedCount"]);
    for (const [name, fields] of Object.entries(valid)) {
      for (const key of Object.keys(fields)) {
        if (optional.has(key)) continue;
        await assertFails(
          send(asUser("alice"), eventData("alice", name, without(fields, key))),
        );
      }
    }
  });

  it("M-72 string id fields must be strings", async () => {
    for (const [name, fields] of Object.entries(valid)) {
      for (const key of ["courtId", "matchId"]) {
        if (!(key in fields)) continue;
        for (const bad of [1, null, true]) {
          await assertFails(
            send(
              asUser("alice"),
              eventData("alice", name, { ...fields, [key]: bad }),
            ),
          );
        }
      }
    }
  });

  it("M-73 check_in field types", async () => {
    const f = valid.check_in;
    for (const bad of badCounts.filter(
      ([n]) => n === "a string" || n === "3.5" || n === "null",
    )) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "check_in", { ...f, playerCount: bad[1] }),
        ),
      );
    }
    for (const [, bad] of badDurations) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "check_in", { ...f, durationMinutes: bad }),
        ),
      );
    }
    for (const [, bad] of notTimestamps) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "check_in", { ...f, scheduledArrivalAt: bad }),
        ),
      );
    }
    await assertFails(
      send(
        asUser("alice"),
        eventData("alice", "check_in", { ...f, timeToCheckIn: "30" }),
      ),
    );
    await assertFails(
      send(
        asUser("alice"),
        eventData("alice", "check_in", { ...f, distance: "far" }),
      ),
    );
    await assertSucceeds(
      send(
        asUser("alice"),
        eventData("alice", "check_in", { ...f, distance: null }),
      ),
    );
  });

  it("M-74 check_out field types", async () => {
    const f = valid.check_out;
    await assertFails(
      send(
        asUser("alice"),
        eventData("alice", "check_out", { ...f, timeToCheckIn: "x" }),
      ),
    );
    await assertFails(
      send(
        asUser("alice"),
        eventData("alice", "check_out", { ...f, distance: "far" }),
      ),
    );
    await assertSucceeds(
      send(
        asUser("alice"),
        eventData("alice", "check_out", { ...f, distance: 4 }),
      ),
    );
  });

  it("M-75 checkin_feedback answers", async () => {
    for (const ok of [
      "forgot",
      "too_much_effort",
      "privacy",
      "nobody_else_uses_it",
    ]) {
      await assertSucceeds(
        send(
          asUser("alice"),
          eventData("alice", "checkin_feedback", { answer: ok }),
        ),
      );
    }
    for (const bad of ["other", "", null, 1, "Forgot"]) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "checkin_feedback", { answer: bad }),
        ),
      );
    }
  });

  it("M-76 match_posted field rules", async () => {
    const f = valid.match_posted;
    const attempt = (over: Data) =>
      send(
        asUser("alice"),
        eventData("alice", "match_posted", { ...f, ...over }),
      );
    for (const bad of ["golf", null, 1])
      await assertFails(attempt({ sport: bad }));
    for (const bad of ["triples", null, 1])
      await assertFails(attempt({ format: bad }));
    for (const bad of [0, 2, 4, "3", null])
      await assertFails(attempt({ spotsTotal: bad }));
    await assertSucceeds(attempt({ format: "singles", spotsTotal: 1 }));
    await assertFails(attempt({ skillLevel: 9 }));
    await assertFails(attempt({ sport: "pickleball", skillLevel: 6 }));
    await assertSucceeds(attempt({ skillLevel: "any" }));
  });

  it("M-77 match_joined minutesToJoin must be an int", async () => {
    const f = valid.match_joined;
    for (const bad of [1.5, "5", null]) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "match_joined", { ...f, minutesToJoin: bad }),
        ),
      );
    }
    await assertSucceeds(
      send(
        asUser("alice"),
        eventData("alice", "match_joined", { ...f, minutesToJoin: 0 }),
      ),
    );
  });

  it("M-78 trust_rating rating and liveCount", async () => {
    const f = valid.trust_rating;
    for (const ok of [1, 2, 3, 4, 5]) {
      await assertSucceeds(
        send(
          asUser("alice"),
          eventData("alice", "trust_rating", { ...f, rating: ok }),
        ),
      );
    }
    for (const bad of [0, 6, -1, 3.5, "4", null]) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "trust_rating", { ...f, rating: bad }),
        ),
      );
    }
    for (const bad of [1.5, "3", null]) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "trust_rating", { ...f, liveCount: bad }),
        ),
      );
    }
  });

  it("M-79 trust_skipped liveCount must be an int", async () => {
    for (const bad of [1.5, "3", null]) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "trust_skipped", {
            ...valid.trust_skipped,
            liveCount: bad,
          }),
        ),
      );
    }
  });

  it("M-80 court_viewed reportedCount is int or null", async () => {
    await assertSucceeds(
      send(
        asUser("alice"),
        eventData("alice", "court_viewed", { courtId: "c1", reportedCount: 4 }),
      ),
    );
    for (const bad of [1.5, "4"]) {
      await assertFails(
        send(
          asUser("alice"),
          eventData("alice", "court_viewed", {
            courtId: "c1",
            reportedCount: bad,
          }),
        ),
      );
    }
  });

  it("M-81 count_updated and still_here_yes playerCount must be an int", async () => {
    for (const name of ["count_updated", "still_here_yes"]) {
      for (const bad of [3.5, "2", null]) {
        await assertFails(
          send(
            asUser("alice"),
            eventData("alice", name, { courtId: "c1", playerCount: bad }),
          ),
        );
      }
    }
  });

  it("M-82 events are write-only", async () => {
    const ref = await send(
      asUser("alice"),
      eventData("alice", "feedback_skipped", {}),
    );
    await assertFails(getDoc(doc(asUser("alice"), `events/${ref.id}`)));
    await assertFails(
      updateDoc(doc(asUser("alice"), `events/${ref.id}`), { uid: "x" }),
    );
    await assertFails(deleteDoc(doc(asUser("alice"), `events/${ref.id}`)));
  });
});

