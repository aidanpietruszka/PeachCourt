import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { cleanupDeletedAccounts } from "../functions/lib/cleanupDeletedAccounts.js";

const key = JSON.parse(
  readFileSync(new URL("./serviceAccountKey.json", import.meta.url), "utf8"),
);

initializeApp({ credential: cert(key) });
const db = getFirestore();
const auth = getAuth();

const { scanned, cleaned } = await cleanupDeletedAccounts(db, auth);

console.log(`Candidate uids scanned: ${scanned}`);
console.log(`Accounts cleaned: ${cleaned}`);
