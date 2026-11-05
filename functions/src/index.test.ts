import { describe, expect, it, vi, afterEach } from "vitest";
import {
  health,
  handleBudgetAlert,
  parseBudgetMessage,
  shouldCutoff,
} from "./index";
import { handleDeleteAccount } from "./deleteAccount";
import { handleMatchUpdated, handleMatchDeleted } from "./matchNotifications";
import { handleGameCreated } from "./gameAlerts";
import {
  sendGameReminders,
  reminderWindow,
  REMINDER_WINDOW_FROM_MINUTES,
  REMINDER_WINDOW_TO_MINUTES,
} from "./gameReminders";
import {
  handleMessageCreated,
  deleteExpiredChatsImpl,
  chatDeletionCutoffMillis,
  GAME_DURATION_MINUTES,
  CHAT_DELETION_DELAY_MINUTES,
} from "./chatNotifications";

function mockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(),
    json: vi.fn(),
    set: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });
  response.set.mockReturnValue(response);
  response.send.mockReturnValue(response);
  return response;
}

function mockRequest(method: string) {
  return { method, headers: {}, url: "/", get: vi.fn() };
}

function encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

function budgetEvent(data: string) {
  return {
    data: { message: { data, messageId: "1", publishTime: "" } },
  } as never;
}

function mockFetch(responses: { ok: boolean; json?: unknown }[]) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call++] ?? { ok: true, json: {} };
    return Promise.resolve({
      ok: r.ok,
      status: r.ok ? 200 : 500,
      statusText: r.ok ? "OK" : "Internal Server Error",
      json: () => Promise.resolve(r.json ?? {}),
    });
  });
}

describe("parseBudgetMessage", () => {
  it("F-04a returns null for empty string", () => {
    expect(parseBudgetMessage("")).toBeNull();
  });

  it("F-04b returns null when costAmount is missing", () => {
    expect(parseBudgetMessage(encode({ budgetAmount: 5 }))).toBeNull();
  });

  it("F-04c returns the parsed amounts for a valid message", () => {
    expect(
      parseBudgetMessage(encode({ costAmount: 3, budgetAmount: 5 })),
    ).toEqual({ costAmount: 3, budgetAmount: 5 });
  });
});

describe("shouldCutoff", () => {
  it("F-04d returns false when cost is below budget", () => {
    expect(shouldCutoff({ costAmount: 4.99, budgetAmount: 5 })).toBe(false);
  });

  it("F-04e returns true when cost equals budget", () => {
    expect(shouldCutoff({ costAmount: 5, budgetAmount: 5 })).toBe(true);
  });

  it("F-04f returns true when cost exceeds budget", () => {
    expect(shouldCutoff({ costAmount: 5.01, budgetAmount: 5 })).toBe(true);
  });
});

describe("billingCutoff handler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("F-04 does not call billing API when cost is below budget", async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 3, budgetAmount: 5 })),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("F-05 detaches billing when cost equals budget", async () => {
    const fetch = mockFetch([
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 5, budgetAmount: 5 })),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("billingInfo");
    expect(JSON.parse(init.body as string)).toEqual({ billingAccountName: "" });
  });

  it("F-06 detaches billing when cost exceeds budget", async () => {
    const fetch = mockFetch([
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 6, budgetAmount: 5 })),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("F-07 does not throw on malformed message data", async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal("fetch", fetch);
    await expect(
      handleBudgetAlert(budgetEvent("not-valid-base64-json!!")),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("F-08 succeeds when billing is already detached (idempotent)", async () => {
    const fetch = mockFetch([
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 5, budgetAmount: 5 })),
    );
    const fetch2 = mockFetch([
      { ok: true, json: { access_token: "tok2" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch2);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 5, budgetAmount: 5 })),
    );
    expect(fetch2).toHaveBeenCalledTimes(2);
  });
});

type MockRef = {
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function makeRef(): MockRef {
  return { delete: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) };
}

function makeSnap(data: Record<string, unknown>, ref?: MockRef) {
  const r = ref ?? makeRef();
  return { ref: r, data: () => data };
}

function makeDb(collections: Record<string, { whereDocs?: ReturnType<typeof makeSnap>[]; docRef?: MockRef }> = {}) {
  const callCounts: Record<string, number> = {};
  return {
    collection: (name: string) => {
      if (!(name in callCounts)) callCounts[name] = 0;
      const cfg = collections[name] ?? {};
      return {
        where: () => {
          const docs = callCounts[name]++ === 0 ? (cfg.whereDocs ?? []) : [];
          return { get: () => Promise.resolve({ docs }) };
        },
        doc: () => cfg.docRef ?? makeRef(),
      };
    },
  };
}

function makeAuth(deleteUser = vi.fn().mockResolvedValue(undefined)) {
  return { deleteUser };
}

describe("handleDeleteAccount", () => {
  it("F-09 deletes profile, activeCheckin, and auth account when user has no games or checkins", async () => {
    const usersDocRef = makeRef();
    const activeCheckinsRef = makeRef();
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    const db = makeDb({
      matches: { whereDocs: [] },
      checkins: { whereDocs: [] },
      activeCheckins: { docRef: activeCheckinsRef },
      users: { docRef: usersDocRef },
    });
    await handleDeleteAccount("uid1", db, makeAuth(deleteUser));
    expect(usersDocRef.delete).toHaveBeenCalledOnce();
    expect(activeCheckinsRef.delete).toHaveBeenCalledOnce();
    expect(deleteUser).toHaveBeenCalledWith("uid1");
  });

  it("F-10 hosted game with no other players is deleted", async () => {
    const gameRef = makeRef();
    const gameSnap = makeSnap({ hostUid: "uid1", playerUids: [] }, gameRef);
    const db = makeDb({
      matches: { whereDocs: [gameSnap] },
      checkins: { whereDocs: [] },
      activeCheckins: { docRef: makeRef() },
      users: { docRef: makeRef() },
    });
    await handleDeleteAccount("uid1", db, makeAuth());
    expect(gameRef.delete).toHaveBeenCalledOnce();
    expect(gameRef.update).not.toHaveBeenCalled();
  });

  it("F-11 hosted game with one other player passes host and removes that player from array", async () => {
    const gameRef = makeRef();
    const gameSnap = makeSnap(
      { hostUid: "uid1", hostName: "Me", playerUids: ["uid2"], playerNames: ["Bob"] },
      gameRef,
    );
    const db = makeDb({
      matches: { whereDocs: [gameSnap] },
      checkins: { whereDocs: [] },
      activeCheckins: { docRef: makeRef() },
      users: { docRef: makeRef() },
    });
    await handleDeleteAccount("uid1", db, makeAuth());
    expect(gameRef.update).toHaveBeenCalledOnce();
    const updateArg = gameRef.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.hostUid).toBe("uid2");
    expect(updateArg.hostName).toBe("Bob");
    expect(updateArg.playerUids).toEqual([]);
    expect(updateArg.playerNames).toEqual([]);
    expect(gameRef.delete).not.toHaveBeenCalled();
  });

  it("F-12 hosted game with multiple players picks first player as new host", async () => {
    const gameRef = makeRef();
    const gameSnap = makeSnap(
      {
        hostUid: "uid1",
        hostName: "Me",
        playerUids: ["uid2", "uid3"],
        playerNames: ["Bob", "Cara"],
      },
      gameRef,
    );
    const db = makeDb({
      matches: { whereDocs: [gameSnap] },
      checkins: { whereDocs: [] },
      activeCheckins: { docRef: makeRef() },
      users: { docRef: makeRef() },
    });
    await handleDeleteAccount("uid1", db, makeAuth());
    const updateArg = gameRef.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.hostUid).toBe("uid2");
    expect(updateArg.hostName).toBe("Bob");
    expect(updateArg.playerUids).toEqual(["uid3"]);
    expect(updateArg.playerNames).toEqual(["Cara"]);
  });

  it("F-13 joined game has uid removed from playerUids and playerNames stay aligned", async () => {
    const joinedRef = makeRef();
    const joinedSnap = makeSnap(
      {
        hostUid: "uid2",
        hostName: "Host",
        playerUids: ["uid3", "uid1"],
        playerNames: ["Cara", "Me"],
      },
      joinedRef,
    );
    let matchesCallCount = 0;
    const db = {
      collection: (name: string) => {
        if (name === "matches") {
          return {
            where: () => {
              const docs = matchesCallCount++ === 0 ? [] : [joinedSnap];
              return { get: () => Promise.resolve({ docs }) };
            },
            doc: () => makeRef(),
          };
        }
        return makeDb({ [name]: { whereDocs: [], docRef: makeRef() } }).collection(name);
      },
    };
    await handleDeleteAccount("uid1", db, makeAuth());
    expect(joinedRef.update).toHaveBeenCalledOnce();
    const updateArg = joinedRef.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.playerUids).toEqual(["uid3"]);
    expect(updateArg.playerNames).toEqual(["Cara"]);
  });

  it("F-14 all checkin documents are deleted", async () => {
    const ref1 = makeRef();
    const ref2 = makeRef();
    const db = makeDb({
      matches: { whereDocs: [] },
      checkins: { whereDocs: [makeSnap({ uid: "uid1" }, ref1), makeSnap({ uid: "uid1" }, ref2)] },
      activeCheckins: { docRef: makeRef() },
      users: { docRef: makeRef() },
    });
    await handleDeleteAccount("uid1", db, makeAuth());
    expect(ref1.delete).toHaveBeenCalledOnce();
    expect(ref2.delete).toHaveBeenCalledOnce();
  });

  it("F-15 auth deleteUser is called with the correct uid", async () => {
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    const db = makeDb({
      matches: { whereDocs: [] },
      checkins: { whereDocs: [] },
      activeCheckins: { docRef: makeRef() },
      users: { docRef: makeRef() },
    });
    await handleDeleteAccount("specific-uid", db, { deleteUser });
    expect(deleteUser).toHaveBeenCalledWith("specific-uid");
  });

  it("F-16 deletes multiple hosted games independently", async () => {
    const emptyRef = makeRef();
    const fullRef = makeRef();
    const emptyGame = makeSnap({ hostUid: "uid1", playerUids: [] }, emptyRef);
    const fullGame = makeSnap({ hostUid: "uid1", playerUids: ["uid2"] }, fullRef);
    const db = makeDb({
      matches: { whereDocs: [emptyGame, fullGame] },
      checkins: { whereDocs: [] },
      activeCheckins: { docRef: makeRef() },
      users: { docRef: makeRef() },
    });
    await handleDeleteAccount("uid1", db, makeAuth());
    expect(emptyRef.delete).toHaveBeenCalledOnce();
    expect(fullRef.update).toHaveBeenCalledOnce();
    expect(fullRef.delete).not.toHaveBeenCalled();
  });
});

describe("health", () => {
  it("F-01 returns status ok", async () => {
    const response = mockResponse();
    await health(mockRequest("GET") as never, response as never);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.statusCode).toBe(200);
  });

  it("F-02 does not depend on the request method", async () => {
    for (const method of ["GET", "POST", "HEAD"]) {
      const response = mockResponse();
      await health(mockRequest(method) as never, response as never);
      expect(response.body).toEqual({ status: "ok" });
    }
  });

  it("F-03 is deployed to us-east1 and is public", () => {
    expect(health.__endpoint.region).toEqual(["us-east1"]);
    expect(health.__endpoint.httpsTrigger?.invoker).toEqual(["public"]);
  });
});

function makeAlertDb() {
  const addedAlerts: Record<string, unknown>[] = [];
  return {
    collection: (name: string) => ({
      add: (data: Record<string, unknown>) => {
        if (name === "alerts") addedAlerts.push(data);
        return Promise.resolve({ id: "alert-1" });
      },
    }),
    addedAlerts,
  };
}

const baseMatch: Record<string, unknown> = {
  hostUid: "alice",
  hostName: "Alice",
  playerUids: ["bob"],
  playerNames: ["Bob"],
  removedUids: [],
  sport: "tennis",
  format: "doubles",
  startAt: { seconds: 9999999 },
  courtName: "City Park",
};

describe("handleMatchUpdated", () => {
  it("F-17 sends player_left alert to host when non-host player leaves", async () => {
    const db = makeAlertDb();
    const after = { ...baseMatch, playerUids: [], playerNames: [] };
    await handleMatchUpdated("m1", baseMatch, after, db);
    expect(db.addedAlerts).toHaveLength(1);
    expect(db.addedAlerts[0]).toMatchObject({
      recipientUid: "alice",
      type: "player_left",
      actorName: "Bob",
      gameId: "m1",
    });
  });

  it("F-18 sends host_transferred alert to new host when host hands off", async () => {
    const db = makeAlertDb();
    const before = { ...baseMatch, playerUids: ["bob"], playerNames: ["Bob"] };
    const after = {
      ...baseMatch,
      hostUid: "bob",
      hostName: "Bob",
      playerUids: [],
      playerNames: [],
    };
    await handleMatchUpdated("m1", before, after, db);
    expect(db.addedAlerts).toHaveLength(1);
    expect(db.addedAlerts[0]).toMatchObject({
      recipientUid: "bob",
      type: "host_transferred",
      actorName: "Alice",
      gameId: "m1",
    });
  });

  it("F-19 sends player_removed alert to removed player when removedUids grows", async () => {
    const db = makeAlertDb();
    const after = {
      ...baseMatch,
      playerUids: [],
      playerNames: [],
      removedUids: ["bob"],
    };
    await handleMatchUpdated("m1", baseMatch, after, db);
    expect(db.addedAlerts).toHaveLength(1);
    expect(db.addedAlerts[0]).toMatchObject({
      recipientUid: "bob",
      type: "player_removed",
      actorName: "Alice",
      gameId: "m1",
    });
  });

  it("F-20 sends no alert when no meaningful change occurs", async () => {
    const db = makeAlertDb();
    const after = { ...baseMatch, status: "full" };
    await handleMatchUpdated("m1", baseMatch, after, db);
    expect(db.addedAlerts).toHaveLength(0);
  });
});

describe("handleMatchDeleted", () => {
  it("F-21 sends game_deleted alert to each player when game is deleted", async () => {
    const db = makeAlertDb();
    const data = { ...baseMatch, playerUids: ["bob", "cara"], playerNames: ["Bob", "Cara"] };
    await handleMatchDeleted("m1", data, db);
    expect(db.addedAlerts).toHaveLength(2);
    expect(db.addedAlerts[0]).toMatchObject({
      recipientUid: "bob",
      type: "game_deleted",
      actorName: "Alice",
      gameId: "m1",
    });
    expect(db.addedAlerts[1]).toMatchObject({
      recipientUid: "cara",
      type: "game_deleted",
    });
  });

  it("F-22 sends no alerts when deleted game has no players", async () => {
    const db = makeAlertDb();
    const data = { ...baseMatch, playerUids: [], playerNames: [] };
    await handleMatchDeleted("m1", data, db);
    expect(db.addedAlerts).toHaveLength(0);
  });
});

describe("handleMatchUpdated player_joined", () => {
  it("F-30 sends player_joined alert to host when a player joins", async () => {
    const db = makeAlertDb();
    const before = { ...baseMatch, playerUids: [], playerNames: [] };
    const after = { ...baseMatch, playerUids: ["bob"], playerNames: ["Bob"] };
    await handleMatchUpdated("m1", before, after, db);
    expect(db.addedAlerts).toHaveLength(1);
    expect(db.addedAlerts[0]).toMatchObject({
      recipientUid: "alice",
      type: "player_joined",
      actorName: "Bob",
      gameId: "m1",
    });
  });

  it("F-31 player_joined alert includes createdAt", async () => {
    const db = makeAlertDb();
    const before = { ...baseMatch, playerUids: [], playerNames: [] };
    const after = { ...baseMatch, playerUids: ["bob"], playerNames: ["Bob"] };
    await handleMatchUpdated("m1", before, after, db);
    expect(db.addedAlerts[0].createdAt).toBeInstanceOf(Date);
  });
});

const baseNewGame: Record<string, unknown> = {
  hostUid: "alice",
  hostName: "Alice",
  courtId: "court-1",
  courtName: "City Park",
  sport: "tennis",
  format: "doubles",
  skillLevel: 3.5,
  spotsTotal: 3,
  playerUids: [],
  playerNames: [],
  startAt: { seconds: 9999999 },
};

function makeUsers(users: Record<string, Record<string, unknown>>) {
  return async () =>
    Object.entries(users).map(([id, data]) => ({ id, data }));
}

describe("handleGameCreated", () => {
  const twoEligible = {
    bob: { sports: ["tennis"], skillLevels: { tennis: 3.5 }, newGamesAlert: true },
    cara: { sports: ["tennis"], skillLevels: { tennis: 3.5 }, newGamesAlert: true },
  };

  it("F-23 sends new_game alerts to eligible players", async () => {
    const db = makeAlertDb();
    await handleGameCreated("m1", baseNewGame, makeUsers(twoEligible), db);
    expect(db.addedAlerts).toHaveLength(2);
    expect(db.addedAlerts[0]).toMatchObject({
      type: "new_game",
      gameId: "m1",
      gameSport: "tennis",
      gameCourtName: "City Park",
    });
  });

  it("F-24 never sends an alert to the host", async () => {
    const db = makeAlertDb();
    await handleGameCreated(
      "m1",
      baseNewGame,
      makeUsers({ alice: { sports: ["tennis"], skillLevels: { tennis: 3.5 }, newGamesAlert: true } }),
      db,
    );
    const recipients = db.addedAlerts.map((a) => a.recipientUid);
    expect(recipients).not.toContain("alice");
    expect(db.addedAlerts).toHaveLength(0);
  });

  it("F-25 skips users with newGamesAlert off", async () => {
    const db = makeAlertDb();
    await handleGameCreated(
      "m1",
      baseNewGame,
      makeUsers({ bob: { sports: ["tennis"], skillLevels: { tennis: 3.5 }, newGamesAlert: false } }),
      db,
    );
    expect(db.addedAlerts).toHaveLength(0);
  });

  it("F-26 skips users who don't play the sport", async () => {
    const db = makeAlertDb();
    await handleGameCreated(
      "m1",
      baseNewGame,
      makeUsers({ bob: { sports: ["pickleball"], skillLevels: { pickleball: 3.5 }, newGamesAlert: true } }),
      db,
    );
    expect(db.addedAlerts).toHaveLength(0);
  });

  it("F-27 skips users outside the skill range", async () => {
    const db = makeAlertDb();
    await handleGameCreated(
      "m1",
      baseNewGame,
      makeUsers({ bob: { sports: ["tennis"], skillLevels: { tennis: 2.0 }, newGamesAlert: true } }),
      db,
    );
    expect(db.addedAlerts).toHaveLength(0);
  });

  it("F-28 alerts all players who opted in when game is any level", async () => {
    const db = makeAlertDb();
    const anyGame = { ...baseNewGame, skillLevel: "any" };
    await handleGameCreated(
      "m1",
      anyGame,
      makeUsers({ bob: { sports: ["tennis"], skillLevels: {}, newGamesAlert: true } }),
      db,
    );
    expect(db.addedAlerts).toHaveLength(1);
    expect(db.addedAlerts[0].recipientUid).toBe("bob");
  });
});

describe("sendGameReminders", () => {
  const reminderGame: Record<string, unknown> = {
    hostUid: "alice",
    hostName: "Alice",
    playerUids: ["bob"],
    playerNames: ["Bob"],
    courtId: "court-1",
    courtName: "City Park",
    sport: "tennis",
    format: "doubles",
    startAt: { seconds: 9999999 },
  };

  it("F-29 sends game_reminder to each player with gameRemindersAlert on", async () => {
    const db = makeAlertDb();
    const getUser = async (uid: string) =>
      ({ alice: { gameRemindersAlert: true }, bob: { gameRemindersAlert: true } }[uid] ?? null);
    await sendGameReminders([{ id: "m1", data: reminderGame }], getUser, db);
    expect(db.addedAlerts).toHaveLength(2);
    expect(db.addedAlerts[0]).toMatchObject({ type: "game_reminder", gameId: "m1" });
  });

  it("F-32 skips players with gameRemindersAlert off", async () => {
    const db = makeAlertDb();
    const getUser = async (uid: string) =>
      ({ alice: { gameRemindersAlert: true }, bob: { gameRemindersAlert: false } }[uid] ?? null);
    await sendGameReminders([{ id: "m1", data: reminderGame }], getUser, db);
    expect(db.addedAlerts).toHaveLength(1);
    expect(db.addedAlerts[0].recipientUid).toBe("alice");
  });

  it("F-32a reminder window is at least as wide as the 15-minute cron so no start time is skipped", () => {
    const now = 1_000_000_000_000;
    const { fromMs, toMs } = reminderWindow(now);
    expect(fromMs).toBe(now + REMINDER_WINDOW_FROM_MINUTES * 60_000);
    expect(toMs).toBe(now + REMINDER_WINDOW_TO_MINUTES * 60_000);
    expect(toMs - fromMs).toBeGreaterThanOrEqual(15 * 60_000);
  });

  it("F-32b marks each reminded game and never reminds a game twice", async () => {
    const db = makeAlertDb();
    const getUser = async () => ({ gameRemindersAlert: true });
    const marked: string[] = [];
    const markReminded = async (id: string) => {
      marked.push(id);
    };
    await sendGameReminders(
      [{ id: "m1", data: reminderGame }],
      getUser,
      db,
      true,
      markReminded,
    );
    expect(marked).toEqual(["m1"]);

    const alreadyReminded = { ...reminderGame, reminderSent: true };
    const db2 = makeAlertDb();
    const marked2: string[] = [];
    await sendGameReminders(
      [{ id: "m1", data: alreadyReminded }],
      getUser,
      db2,
      true,
      async (id) => {
        marked2.push(id);
      },
    );
    expect(db2.addedAlerts).toHaveLength(0);
    expect(marked2).toEqual([]);
  });
});

describe("handleMessageCreated", () => {
  const chatData: Record<string, unknown> = {
    courtId: "court-1",
    courtName: "City Park",
    sport: "tennis",
    format: "doubles",
    startAt: { seconds: 9999999 },
    playerUids: ["alice", "bob", "carol"],
  };

  it("F-33 sends new_message alert to all players except the sender", async () => {
    const db = makeAlertDb();
    const msgData: Record<string, unknown> = {
      senderUid: "alice",
      senderName: "Alice",
      text: "Hello",
    };
    await handleMessageCreated("m1", msgData, chatData, db);
    expect(db.addedAlerts).toHaveLength(2);
    const recipients = db.addedAlerts.map((a) => a.recipientUid);
    expect(recipients).toContain("bob");
    expect(recipients).toContain("carol");
    expect(recipients).not.toContain("alice");
  });

  it("F-34 alert has correct type and gameId", async () => {
    const db = makeAlertDb();
    await handleMessageCreated(
      "m1",
      { senderUid: "alice", senderName: "Alice", text: "Hi" },
      chatData,
      db,
    );
    expect(db.addedAlerts[0]).toMatchObject({
      type: "new_message",
      gameId: "m1",
      actorName: "Alice",
    });
  });

  it("F-35 no alerts when sender is the only player", async () => {
    const db = makeAlertDb();
    await handleMessageCreated(
      "m1",
      { senderUid: "alice", senderName: "Alice", text: "Hi" },
      { ...chatData, playerUids: ["alice"] },
      db,
    );
    expect(db.addedAlerts).toHaveLength(0);
  });
});

describe("deleteExpiredChatsImpl", () => {
  function makeChatDb(docs: Array<{ id: string }>) {
    const deletedPaths: string[] = [];
    const db = {
      collection: (name: string) => ({
        where: () => ({
          get: () =>
            Promise.resolve({
              docs: docs.map((d) => ({
                id: d.id,
                ref: { path: `${name}/${d.id}` },
              })),
            }),
        }),
      }),
      recursiveDelete: (ref: { path: string }) => {
        deletedPaths.push(ref.path);
        return Promise.resolve();
      },
      doc: (path: string) => ({ path }),
    };
    return { db, deletedPaths };
  }

  it("F-36 deletes each expired chat with recursiveDelete", async () => {
    const { db, deletedPaths } = makeChatDb([{ id: "m1" }, { id: "m2" }]);
    await deleteExpiredChatsImpl(Date.now(), db as never);
    expect(deletedPaths).toEqual(["chats/m1", "chats/m2"]);
  });

  it("F-37 does nothing when no expired chats exist", async () => {
    const { db, deletedPaths } = makeChatDb([]);
    await deleteExpiredChatsImpl(Date.now(), db as never);
    expect(deletedPaths).toHaveLength(0);
  });

  it("F-37a cutoff keeps a chat until one hour after the game ends", () => {
    const now = 1_000_000_000_000;
    const cutoff = chatDeletionCutoffMillis(now);
    expect(cutoff).toBe(
      now - (GAME_DURATION_MINUTES + CHAT_DELETION_DELAY_MINUTES) * 60_000,
    );
    const startedNinetyMinutesAgo = now - 90 * 60_000;
    const startedTwoHoursAgo = now - 130 * 60_000;
    expect(startedNinetyMinutesAgo > cutoff).toBe(true);
    expect(startedTwoHoursAgo <= cutoff).toBe(true);
  });
});

describe("feature flags in Cloud Functions", () => {
  const twoEligible = {
    bob: { sports: ["tennis"], skillLevels: { tennis: 3.5 }, newGamesAlert: true },
  };

  it("F-38 handleGameCreated sends no alerts when pushAlertsEnabled is false", async () => {
    const db = makeAlertDb();
    await handleGameCreated("m1", baseNewGame, makeUsers(twoEligible), db, false);
    expect(db.addedAlerts).toHaveLength(0);
  });

  it("F-39 handleGameCreated sends alerts when pushAlertsEnabled is true", async () => {
    const db = makeAlertDb();
    await handleGameCreated("m1", baseNewGame, makeUsers(twoEligible), db, true);
    expect(db.addedAlerts).toHaveLength(1);
  });

  it("F-40 sendGameReminders sends no reminders when gameRemindersEnabled is false", async () => {
    const db = makeAlertDb();
    const getUser = async () => ({ gameRemindersAlert: true });
    const game = { id: "m1", data: { hostUid: "alice", playerUids: [], courtId: "c1", sport: "tennis", format: "singles", startAt: { seconds: 9999999 }, courtName: "City Park" } };
    await sendGameReminders([game], getUser, db, false);
    expect(db.addedAlerts).toHaveLength(0);
  });

  it("F-41 sendGameReminders sends reminders when gameRemindersEnabled is true", async () => {
    const db = makeAlertDb();
    const getUser = async (uid: string) =>
      uid === "alice" ? { gameRemindersAlert: true } : null;
    const game = { id: "m1", data: { hostUid: "alice", playerUids: [], courtId: "c1", sport: "tennis", format: "singles", startAt: { seconds: 9999999 }, courtName: "City Park" } };
    await sendGameReminders([game], getUser, db, true);
    expect(db.addedAlerts).toHaveLength(1);
  });
});
