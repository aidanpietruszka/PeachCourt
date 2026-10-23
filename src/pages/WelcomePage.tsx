import { useEffect, useState } from "react";
import { IonButton, IonContent, IonPage, useIonRouter } from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { authErrorMessage, continueAsGuest } from "../services/auth";
import "./WelcomePage.css";

const WelcomePage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      ionRouter.push("/courts", "root", "replace");
    }
  }, [loading, user, ionRouter]);

  const handleGuest = async () => {
    setError("");
    setBusy(true);
    try {
      await continueAsGuest();
    } catch (guestError) {
      setError(authErrorMessage(guestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="welcome">
          <div className="welcome__hero">
            <img className="welcome__logo" src="/logo.svg" alt="" />
            <h1 className="welcome__title">PeachCourt</h1>
            <p className="welcome__tagline">
              Find open tennis and pickleball courts in Atlanta
            </p>
          </div>

          <div className="welcome__actions">
            <IonButton expand="block" onClick={() => ionRouter.push("/login")}>
              Log in
            </IonButton>
            <IonButton
              expand="block"
              className="welcome__secondary"
              onClick={() => ionRouter.push("/signup")}
            >
              Create account
            </IonButton>
            <button
              type="button"
              className="welcome__guest"
              disabled={busy}
              onClick={() => void handleGuest()}
            >
              {busy ? "Signing in…" : "Continue as guest"}
            </button>
            {error && <p className="welcome__error">{error}</p>}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default WelcomePage;
