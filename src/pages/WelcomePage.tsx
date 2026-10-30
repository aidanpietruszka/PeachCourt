import { useEffect } from "react";
import { IonButton, IonContent, IonPage, useIonRouter } from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import "./WelcomePage.css";

const WelcomePage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      ionRouter.push("/courts", "root", "replace");
    }
  }, [loading, user, ionRouter]);

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
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default WelcomePage;
