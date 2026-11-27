import { useEffect, useRef, useState } from "react";
import { useIonRouter } from "@ionic/react";
import { completeRedirectSignIn } from "../services/auth";
import { isStandaloneDisplay } from "../utils/notifications";

export function useRedirectSignIn(): string {
  const ionRouter = useIonRouter();
  const routerRef = useRef(ionRouter);
  routerRef.current = ionRouter;
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isStandaloneDisplay()) {
      return;
    }
    void completeRedirectSignIn().then((result) => {
      if (result.signedIn) {
        routerRef.current.push("/onboarding", "root", "replace");
      } else if (result.error) {
        setError(result.error);
      }
    });
  }, []);

  return error;
}
