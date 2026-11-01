import { getApps, initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onMessagePublished } from "firebase-functions/v2/pubsub";

if (!getApps().length) {
  initializeApp();
}

export { deleteAccount } from "./deleteAccount";
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
