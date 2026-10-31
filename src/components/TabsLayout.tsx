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

const TabsLayout: React.FC = () => (
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

export default TabsLayout;
