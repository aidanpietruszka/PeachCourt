import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const key = JSON.parse(
  readFileSync(new URL("./serviceAccountKey.json", import.meta.url), "utf8"),
);

initializeApp({ credential: cert(key) });
const db = getFirestore();

function chatMembersFromMatch(data) {
  const members = [];
  for (const uid of [data.hostUid, ...(data.playerUids ?? [])]) {
    if (typeof uid === "string" && uid.length > 0 && !members.includes(uid)) {
      members.push(uid);
    }
  }
  return members;
}

const snap = await db.collection("chats").get();
let updated = 0;
let skipped = 0;
const batch = db.batch();
for (const docSnap of snap.docs) {
  const data = docSnap.data();
  if (Array.isArray(data.memberUids)) {
    skipped += 1;
    continue;
  }
  batch.update(docSnap.ref, { memberUids: chatMembersFromMatch(data) });
  updated += 1;
}
if (updated > 0) {
  await batch.commit();
}

console.log(`Chats scanned: ${snap.size}`);
console.log(`memberUids set: ${updated}`);
console.log(`already had memberUids (skipped): ${skipped}`);
