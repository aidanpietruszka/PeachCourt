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
export { sendGameReminders } from "./gameReminders";
import { handleMatchUpdated, handleMatchDeleted } from "./matchNotifications";
import { handleGameCreated } from "./gameAlerts";
import { sendGameReminders } from "./gameReminders";
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
    await handleGameCreated(event.params.matchId, data, listUsers, db);
  },
);

export const onMatchUpdated = onDocumentUpdated(
  "matches/{matchId}",
  async (event) => {
    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after = event.data?.after.data() as Record<string, unknown> | undefined;
    if (!before || !after) return;
    await handleMatchUpdated(event.params.matchId, before, after, getFirestore());
  },
);

export const onMatchDeleted = onDocumentDeleted(
  "matches/{matchId}",
  async (event) => {
    const data = event.data?.data() as Record<string, unknown> | undefined;
    if (!data) return;
    await handleMatchDeleted(event.params.matchId, data, getFirestore());
  },
);

export const gameRemindersCron = onSchedule("every 15 minutes", async () => {
  const db = getFirestore();
  const now = Date.now();
  const from = Timestamp.fromMillis(now + 55 * 60_000);
  const to = Timestamp.fromMillis(now + 65 * 60_000);
  const snap = await db
    .collection("matches")
    .where("startAt", ">=", from)
    .where("startAt", "<=", to)
    .get();
  const games = snap.docs.map((d) => ({
    id: d.id,
    data: d.data() as Record<string, unknown>,
  }));
  const getUser = async (uid: string) => {
    const userSnap = await db.collection("users").doc(uid).get();
    return userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;
  };
  await sendGameReminders(games, getUser, db);
});
