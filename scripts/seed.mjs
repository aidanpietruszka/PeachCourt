import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const key = JSON.parse(
  readFileSync(new URL("./serviceAccountKey.json", import.meta.url), "utf8"),
);
const COURTS = JSON.parse(
  readFileSync(new URL("./courts.json", import.meta.url), "utf8"),
);

initializeApp({ credential: cert(key) });
const db = getFirestore();

const batch = db.batch();
for (const court of COURTS) {
  batch.set(db.collection("courts").doc(court.id), court);
}
await batch.commit();

console.log(`Seeded ${COURTS.length} courts.\n`);
console.log("Check each pin on OpenStreetMap:");
for (const c of COURTS) {
  console.log(
    `${c.name}: https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=18/${c.latitude}/${c.longitude}`,
  );
}
