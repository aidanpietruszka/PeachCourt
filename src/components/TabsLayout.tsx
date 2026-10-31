import { useEffect } from "react";
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from "@ionic/react";
import { Route } from "react-router-dom";
import { locationOutline, personOutline } from "ionicons/icons";
import CourtsPage from "../pages/CourtsPage";
import ProfilePage from "../pages/ProfilePage";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../hooks/useAuth";
import { UserService } from "../services/UserService";

const TabsLayout: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const isStandalone =
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;
    if (!("Notification" in window)) return;

    void UserService.getProfile(user.uid).then((profile) => {
      if (!profile?.onboardingDone || profile.notificationsPrompted) return;
      void Notification.requestPermission().then((result) => {
        void UserService.saveOnboardingPrefs(user.uid, {
          notificationsEnabled: result === "granted",
          notificationsPrompted: true,
        });
      });
    });
  }, [user?.uid]);

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route
          path="/courts"
          element={
            <ProtectedRoute>
              <CourtsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="courts" href="/courts">
          <IonIcon icon={locationOutline} />
          <IonLabel>Courts</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>Profile</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default TabsLayout;
