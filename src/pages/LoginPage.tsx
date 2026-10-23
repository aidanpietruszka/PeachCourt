import { useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonToolbar,
  IonSpinner,
  useIonRouter,
} from "@ionic/react";
import {
  authErrorMessage,
  signInWithEmail,
  signInWithGoogle,
} from "../services/auth";
import "./AuthPages.css";

const LoginPage: React.FC = () => {
  const ionRouter = useIonRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await action();
      ionRouter.push("/courts", "root", "replace");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    run(() => signInWithEmail(email.trim(), password));
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" text="Back" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="pc-screen auth-page">
          <h1 className="pc-title">Log in</h1>
          <p className="pc-subtitle">
            Welcome back. Log in to check in at courts near you.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <IonInput
                type="email"
                placeholder="Email"
                autocomplete="email"
                value={email}
                onIonInput={(e) => setEmail(String(e.detail.value ?? ""))}
              />
            </div>
            <div className="auth-field">
              <IonInput
                type="password"
                placeholder="Password"
                autocomplete="current-password"
                value={password}
                onIonInput={(e) => setPassword(String(e.detail.value ?? ""))}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <IonButton expand="block" type="submit" disabled={busy}>
              {busy ? <IonSpinner name="dots" /> : "Log in"}
            </IonButton>
          </form>

          <div className="auth-divider">or</div>

          <IonButton
            expand="block"
            className="auth-secondary"
            disabled={busy}
            onClick={() => run(signInWithGoogle)}
          >
            Continue with Google
          </IonButton>

          <div className="auth-switch">
            New to PeachCourt?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => ionRouter.push("/signup", "forward", "replace")}
            >
              Create an account
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
