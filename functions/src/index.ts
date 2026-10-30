import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

setGlobalOptions({ region: "us-east1" });

export const health = onRequest({ invoker: "public" }, (_req, res) => {
  res.json({ status: "ok" });
});
