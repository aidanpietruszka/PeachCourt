import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { createInterface } from "node:readline";

const OFFSET = 1000;
const LANE_B_CONFIG = ".e2e-firebase-b.json";

const base = JSON.parse(readFileSync("firebase.json", "utf8"));
const laneB = JSON.parse(JSON.stringify(base));
laneB.emulators = {
  auth: { host: "127.0.0.1", port: 9099 + OFFSET },
  firestore: { host: "127.0.0.1", port: 8080 + OFFSET },
  functions: { host: "127.0.0.1", port: 5001 + OFFSET },
  eventarc: { host: "127.0.0.1", port: 9299 + OFFSET },
  tasks: { host: "127.0.0.1", port: 9499 + OFFSET },
  pubsub: { host: "127.0.0.1", port: 8085 + OFFSET },
  hub: { host: "127.0.0.1", port: 4400 + OFFSET },
  logging: { host: "127.0.0.1", port: 4500 + OFFSET },
  ui: { enabled: false },
  singleProjectMode: true,
};
writeFileSync(LANE_B_CONFIG, JSON.stringify(laneB, null, 2));

const passthrough = process.argv.slice(2).join(" ");

function runLane(label, project, extraArgs, env) {
  const playwright =
    `npx playwright test --project=${project}` +
    (passthrough ? ` ${passthrough}` : "");
  const args = [
    "emulators:exec",
    "--only",
    "auth,firestore,functions",
    "--project",
    "demo-peachcourt",
    ...extraArgs,
    playwright,
  ];
  const child = spawn("firebase", args, {
    env: { ...process.env, ...env },
  });
  const prefix = (stream) =>
    createInterface({ input: stream }).on("line", (line) =>
      console.log(`[${label}] ${line}`),
    );
  prefix(child.stdout);
  prefix(child.stderr);
  return new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
}

const iphone = runLane("iPhone", "iPhone", [], {
  E2E_APP_PORT: "5174",
  E2E_AUTH_PORT: "9099",
  E2E_FIRESTORE_PORT: "8080",
  E2E_FUNCTIONS_PORT: "5001",
  E2E_OUTPUT_DIR: "test-results/iphone",
});
const android = runLane("Android", "Android", ["--config", LANE_B_CONFIG], {
  E2E_APP_PORT: "5175",
  E2E_AUTH_PORT: String(9099 + OFFSET),
  E2E_FIRESTORE_PORT: String(8080 + OFFSET),
  E2E_FUNCTIONS_PORT: String(5001 + OFFSET),
  E2E_OUTPUT_DIR: "test-results/android",
});

const [codeA, codeB] = await Promise.all([iphone, android]);
try {
  rmSync(LANE_B_CONFIG, { force: true });
} catch {
  void 0;
}
const failed = codeA !== 0 || codeB !== 0;
console.log(
  `\n[parallel] iPhone exit ${codeA}, Android exit ${codeB} -> ${failed ? "FAIL" : "PASS"}`,
);
process.exit(failed ? 1 : 0);
