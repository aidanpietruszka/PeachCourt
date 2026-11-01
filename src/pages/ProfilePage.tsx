import { useEffect, useState } from "react";
import {
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  useIonRouter,
} from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { logout } from "../services/auth";
import { UserService } from "../services/UserService";
import type { UserProfile } from "../types/types";
import "./ProfilePage.css";

const SKILL_LABELS: Record<string, string> = {
  tennis: "Tennis (NTRP)",
  pickleball: "Pickleball",
};

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tennis",
  pickleball: "Pickleball",
};

const ProfilePage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }
    return UserService.subscribeToProfile(
      user.uid,
      (p) => {
        setProfile(p);
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load profile", error);
        setLoading(false);
      },
    );
  }, [user]);

  const handleLogout = async () => {
    try {
      ionRouter.push("/login", "root", "replace");
      await logout();
    } catch (error) {
      console.error("Unable to log out", error);
    }
  };

  const displayName =
    profile
      ? `${profile.firstName} ${profile.lastName.charAt(0)}.`
      : "";

  return (
    <IonPage>
      <IonContent>
        <div className="pc-screen profile-page">
          {loading && <IonSpinner name="dots" />}

          {!loading && profile && (
            <>
              <p className="profile-page__name">{displayName}</p>

              <div className="profile-page__section">
                <p className="profile-page__section-title">Sports</p>
                <div className="profile-page__sports">
                  {profile.sports.map((sport) => (
                    <span key={sport} className="profile-page__sport-chip">
                      {SPORT_LABELS[sport] ?? sport}
                    </span>
                  ))}
                </div>
              </div>

              <div className="profile-page__section">
                <p className="profile-page__section-title">Skill level</p>
                <IonList inset>
                  {profile.sports.map((sport) => (
                    <IonItem key={sport}>
                      <IonLabel>
                        <span>{SKILL_LABELS[sport] ?? sport}</span>
                      </IonLabel>
                      <span slot="end" className="ion-color-medium">
                        {profile.skillLevels[sport] ?? "—"}
                      </span>
                    </IonItem>
                  ))}
                </IonList>
              </div>
            </>
          )}

          <div className="profile-page__actions">
            {!loading && profile && (
              <IonButton
                expand="block"
                onClick={() => ionRouter.push("/profile/edit", "forward")}
              >
                Edit profile
              </IonButton>
            )}
            {!loading && profile && (
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => ionRouter.push("/settings", "forward")}
              >
                Settings
              </IonButton>
            )}
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => void handleLogout()}
            >
              Log out
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
