import { useEffect } from "react";
import { IonButton, IonContent, IonPage, useIonRouter } from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { onboardingComplete } from "../utils/onboarding";
import "./WelcomePage.css";

const WelcomePage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      ionRouter.push(
        onboardingComplete(profile) ? "/courts" : "/onboarding",
        "root",
        "replace",
      );
    }
  }, [loading, user, profile, ionRouter]);

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="welcome">
          <div className="welcome__hero">
            <img className="welcome__logo" src="/logo.svg" alt="" />
            <h1 className="welcome__title">PeachCourt</h1>
            <p className="welcome__tagline">
              See which courts are busy and find someone to play with.
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
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default WelcomePage;
