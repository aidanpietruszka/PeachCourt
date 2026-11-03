import { useEffect, useRef, useState } from "react";
import "./TabsLayout.css";
import {
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonLabel,
  IonIcon,
  useIonRouter,
} from "@ionic/react";
import { Route } from "react-router-dom";
import { locationOutline, personOutline } from "ionicons/icons";
import CourtsPage from "../pages/CourtsPage";
import ProfilePage from "../pages/ProfilePage";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../hooks/useAuth";
import { UserService } from "../services/UserService";
import { useAlerts } from "../hooks/useAlerts";
import { AlertService, type Alert } from "../services/AlertService";
import type { Timestamp } from "firebase/firestore";

function alertBannerTitle(a: Alert): string {
  switch (a.type) {
    case "new_game":
      return `New ${a.gameFormat ?? "game"} at ${a.gameCourtName ?? "a court"}`;
    case "game_reminder":
      return "Starts in 1 hour";
    case "player_joined":
      return `${a.actorName ?? "Someone"} joined your game`;
    case "player_left":
      return `${a.actorName ?? "Someone"} left your game`;
    case "player_removed":
      return "You were removed from a game";
    case "host_transferred":
      return "You're the new host";
    case "game_deleted":
      return `${a.actorName ?? "Host"} cancelled the game`;
  }
}

function alertBannerBody(a: Alert): string {
  const sport = a.gameSport ?? "";
  const venue = a.gameCourtName ?? "";
  const fmt = a.gameFormat ?? "";
  switch (a.type) {
    case "new_game": {
      const parts = [
        sport.charAt(0).toUpperCase() + sport.slice(1),
        a.spotsOpen != null ? `${a.spotsOpen} spots open` : "",
      ].filter(Boolean);
      return parts.join(" · ");
    }
    default:
      return `${fmt.charAt(0).toUpperCase() + fmt.slice(1)} at ${venue}`.trim();
  }
}

const TabsLayout: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const { alerts } = useAlerts(user?.uid ?? null);
  const [bannerAlert, setBannerAlert] = useState<Alert | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerCutoffRef = useRef<number>(Date.now());

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

  useEffect(() => {
    const cutoff = bannerCutoffRef.current;
    const newest = alerts.find((a) => {
      const ts = a.createdAt as Timestamp | undefined;
      if (!ts) return false;
      return ts.toMillis() > cutoff && !a.read;
    });
    if (!newest) return;
    setBannerAlert(newest);
    bannerCutoffRef.current = newest.createdAt.toMillis();
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBannerAlert(null), 6_000);
  }, [alerts]);

  const dismissBanner = () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBannerAlert(null);
  };

  const handleBannerView = () => {
    if (!bannerAlert) return;
    void AlertService.markRead(bannerAlert.id).catch((err: unknown) => {
      console.error("Unable to mark alert read", err);
    });
    if (bannerAlert.gameCourtId) {
      ionRouter.push(`/courts/${bannerAlert.gameCourtId}`, "forward");
    }
    dismissBanner();
  };

  return (
    <>
      {bannerAlert && (
        <div className="alert-banner" role="status" aria-live="polite">
          <span className="alert-banner__dot" aria-hidden="true" />
          <div className="alert-banner__body">
            <p className="alert-banner__title">{alertBannerTitle(bannerAlert)}</p>
            <p className="alert-banner__sub">{alertBannerBody(bannerAlert)}</p>
          </div>
          <button
            type="button"
            className="alert-banner__view"
            onClick={handleBannerView}
          >
            View
          </button>
        </div>
      )}
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
    </>
  );
};

export default TabsLayout;
