import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (!getApps().length) {
  initializeApp();
}

export { deleteAccount } from "./deleteAccount";
export { handleMatchUpdated, handleMatchDeleted } from "./matchNotifications";
export { handleGameCreated } from "./gameAlerts";
export { sendGameReminders, reminderWindow } from "./gameReminders";
export { handleMessageCreated, deleteExpiredChatsImpl } from "./chatNotifications";
import { handleMatchUpdated, handleMatchDeleted } from "./matchNotifications";
import { handleGameCreated } from "./gameAlerts";
import { sendGameReminders, reminderWindow } from "./gameReminders";
import { handleMessageCreated, deleteExpiredChatsImpl } from "./chatNotifications";
import type { CloudEvent } from "firebase-functions/v2";
import type { MessagePublishedData } from "firebase-functions/v2/pubsub";

setGlobalOptions({ region: "us-east1" });

export const health = onRequest({ invoker: "public" }, (_req, res) => {
  res.json({ status: "ok" });
});

interface BudgetMessage {
  costAmount: number;
  budgetAmount: number;
}

export function parseBudgetMessage(data: string): BudgetMessage | null {
  try {
    const json = Buffer.from(data, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (
      typeof parsed.costAmount !== "number" ||
      typeof parsed.budgetAmount !== "number"
    ) {
      return null;
    }
    return { costAmount: parsed.costAmount, budgetAmount: parsed.budgetAmount };
  } catch {
    return null;
  }
}

export function shouldCutoff(msg: BudgetMessage): boolean {
  return msg.costAmount >= msg.budgetAmount;
}

export async function detachBilling(projectId: string): Promise<void> {
  const tokenRes = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } },
  );
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const billingRes = await fetch(
    `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingAccountName: "" }),
    },
  );
  if (!billingRes.ok) {
    throw new Error(`Detach billing failed: ${billingRes.status}`);
  }
}

export async function handleBudgetAlert(
  event: CloudEvent<MessagePublishedData>,
): Promise<void> {
  const msg = parseBudgetMessage(event.data.message.data ?? "");
  if (!msg || !shouldCutoff(msg)) {
    return;
  }
  await detachBilling(process.env.GCLOUD_PROJECT ?? "");
}

export const billingCutoff = onMessagePublished(
  { topic: "billing-alerts" },
  handleBudgetAlert,
);

function chatDocFromMatch(matchId: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    matchId,
    courtId: data.courtId ?? "",
    courtName: data.courtName ?? "",
    format: data.format,
    sport: data.sport,
    startAt: data.startAt,
    hostUid: data.hostUid,
    hostName: data.hostName,
    playerUids: data.playerUids ?? [],
    playerNames: data.playerNames ?? [],
    lastMessage: null,
    lastSenderName: null,
    lastSenderUid: null,
    lastMessageAt: null,
    readAt: {},
    createdAt: new Date(),
  };
}

async function getFlag(db: ReturnType<typeof getFirestore>, key: string): Promise<boolean> {
  const snap = await db.collection("config").doc("flags").get();
  const val = snap.exists ? snap.data()?.[key] : undefined;
  return val !== false;
}

export const onMatchCreated = onDocumentCreated(
  "matches/{matchId}",
  async (event) => {
    const data = event.data?.data() as Record<string, unknown> | undefined;
    if (!data) return;
    const db = getFirestore();
    const listUsers = async () => {
      const snap = await db.collection("users").get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
    };
    const pushAlertsEnabled = await getFlag(db, "pushAlerts");
    await Promise.all([
      handleGameCreated(event.params.matchId, data, listUsers, db, pushAlertsEnabled),
      db.collection("chats").doc(event.params.matchId).set(chatDocFromMatch(event.params.matchId, data)),
    ]);
  },
);

export const onMatchUpdated = onDocumentUpdated(
  "matches/{matchId}",
  async (event) => {
    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after = event.data?.after.data() as Record<string, unknown> | undefined;
    if (!before || !after) return;
    const db = getFirestore();
    await Promise.all([
      handleMatchUpdated(event.params.matchId, before, after, db),
      db.collection("chats").doc(event.params.matchId).set(
        {
          hostUid: after.hostUid,
          hostName: after.hostName,
          playerUids: after.playerUids ?? [],
          playerNames: after.playerNames ?? [],
        },
        { merge: true },
      ),
    ]);
  },
);

export const onMatchDeleted = onDocumentDeleted(
  "matches/{matchId}",
  async (event) => {
    const data = event.data?.data() as Record<string, unknown> | undefined;
    if (!data) return;
    const db = getFirestore();
    await Promise.all([
      handleMatchDeleted(event.params.matchId, data, db),
      db.recursiveDelete(db.collection("chats").doc(event.params.matchId)),
    ]);
  },
);

export const onChatMessageCreated = onDocumentCreated(
  "chats/{matchId}/messages/{msgId}",
  async (event) => {
    const msgData = event.data?.data() as Record<string, unknown> | undefined;
    if (!msgData) return;
    const { matchId } = event.params;
    const db = getFirestore();
    const chatSnap = await db.collection("chats").doc(matchId).get();
    const chatData = chatSnap.data() as Record<string, unknown> | undefined;
    if (!chatData) return;
    await Promise.all([
      db.collection("chats").doc(matchId).set(
        {
          lastMessage: msgData.text,
          lastSenderName: msgData.senderName,
          lastSenderUid: msgData.senderUid,
          lastMessageAt: msgData.createdAt,
        },
        { merge: true },
      ),
      handleMessageCreated(matchId, msgData, chatData, db),
      db.collection("events").add({
        eventName: "chat_message_sent",
        uid: msgData.senderUid ?? null,
        matchId,
        timestamp: new Date(),
      }),
    ]);
  },
);

export const deleteExpiredChatsCron = onSchedule("every 15 minutes", async () => {
  const db = getFirestore();
  await deleteExpiredChatsImpl(Date.now(), db as unknown as Parameters<typeof deleteExpiredChatsImpl>[1]);
});

export const gameRemindersCron = onSchedule("every 15 minutes", async () => {
  const db = getFirestore();
  const { fromMs, toMs } = reminderWindow(Date.now());
  const snap = await db
    .collection("matches")
    .where("startAt", ">=", Timestamp.fromMillis(fromMs))
    .where("startAt", "<=", Timestamp.fromMillis(toMs))
    .get();
  const games = snap.docs.map((d) => ({
    id: d.id,
    data: d.data() as Record<string, unknown>,
  }));
  const getUser = async (uid: string) => {
    const userSnap = await db.collection("users").doc(uid).get();
    return userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;
  };
  const gameRemindersEnabled = await getFlag(db, "gameReminders");
  const markReminded = async (matchId: string) => {
    await db.collection("matches").doc(matchId).update({ reminderSent: true });
  };
  await sendGameReminders(games, getUser, db, gameRemindersEnabled, markReminded);
});
