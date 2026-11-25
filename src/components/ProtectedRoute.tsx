import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { onboardingComplete } from "../utils/onboarding";

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  onboardingRoute?: boolean;
}> = ({ children, onboardingRoute = false }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IonSpinner />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const complete = onboardingComplete(profile);

  if (onboardingRoute) {
    return complete ? <Navigate to="/courts" replace /> : <>{children}</>;
  }

  return complete ? <>{children}</> : <Navigate to="/onboarding" replace />;
};

export default ProtectedRoute;
