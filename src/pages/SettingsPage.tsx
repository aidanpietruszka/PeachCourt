import { useEffect, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "../hooks/useAuth";
import { UserService } from "../services/UserService";
import type { UserProfile } from "../types/types";
import "./SettingsPage.css";

type HelpSheet = "location" | "notifications" | "stored" | null;
type LocationTab = "iphone" | "android";
type NotifTab = "home-screen" | "blocked";

const LOCATION_IPHONE_STEPS = [
  "In Safari, open options in the address bar",
  "Tap Website Settings",
  "Set Location to Allow",
  "Come back and turn on 'Use my location'",
];

const LOCATION_ANDROID_STEPS = [
  "Open Settings on your phone",
  "Tap Apps → PeachCourt",
  "Tap Permissions → Location",
  "Set to Allow, then return here",
];

const NOTIF_HOME_SCREEN_STEPS = [
  "In Safari, tap Share ⬆︎",
  "Tap Add to Home Screen",
  "Open PeachCourt from your Home Screen",
  "Turn on 'Notifications' in Settings",
];

const NOTIF_BLOCKED_IPHONE_STEPS = [
  "Open the Settings app",
  "Tap Notifications → PeachCourt",
  "Turn on Allow Notifications",
  "Return here and turn on Notifications",
];

const NOTIF_BLOCKED_ANDROID_STEPS = [
  "Tap the lock icon in Chrome's address bar",
  "Tap Notifications",
  "Set to Allow",
  "Return here and turn on Notifications",
];

const SUB_TOGGLES: Array<{
  key: keyof Pick<
    UserProfile,
    | "newGamesAlert"
    | "changesGamesAlert"
    | "gameRemindersAlert"
    | "chatMessagesAlert"
  >;
  label: string;
  defaultOn: boolean;
}> = [
  { key: "newGamesAlert", label: "New games for my sport & skill", defaultOn: true },
  { key: "changesGamesAlert", label: "Changes to my games", defaultOn: true },
  { key: "gameRemindersAlert", label: "Game reminders", defaultOn: true },
  { key: "chatMessagesAlert", label: "Chat messages", defaultOn: false },
];

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [helpSheet, setHelpSheet] = useState<HelpSheet>(null);
  const [locationTab, setLocationTab] = useState<LocationTab>("iphone");
  const [notifTab, setNotifTab] = useState<NotifTab>("home-screen");

  const isIPhone = /iPhone/.test(navigator.userAgent);
  const isStandalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const notifUnavailable =
    !("Notification" in window) ||
    (isIPhone && !isStandalone) ||
    Notification.permission === "denied";

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      try {
        const perm = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        setLocationBlocked(perm.state === "denied");
      } catch {
        // permissions API unavailable
      }

      if ("Notification" in window && Notification.permission === "denied") {
        setNotifTab("blocked");
      }

      try {
        const p = await UserService.getProfile(user.uid);
        const seeds: Partial<UserProfile> = {};
        for (const { key, defaultOn } of SUB_TOGGLES) {
          if (p?.[key] === undefined) {
            (seeds as Record<string, boolean>)[key] = defaultOn;
          }
        }
        if (Object.keys(seeds).length > 0) {
          void UserService.saveSettings(user.uid, seeds);
        }
        setProfile(p ? { ...p, ...seeds } : p);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [user]);

  const save = (updates: Parameters<typeof UserService.saveSettings>[1]) => {
    if (!user) return;
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    void UserService.saveSettings(user.uid, updates);
  };

  const handleLocationToggle = async (checked: boolean) => {
    if (!checked) {
      save({ locationEnabled: false, autoCheckin: false });
      return;
    }
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "granted") {
        setLocationBlocked(false);
        save({ locationEnabled: true });
      } else {
        setLocationBlocked(true);
        save({ locationEnabled: false, autoCheckin: false });
      }
    } catch {
      setLocationBlocked(true);
      save({ locationEnabled: false, autoCheckin: false });
    }
  };

  const handleNotifToggle = async (checked: boolean) => {
    if (!checked) {
      save({ notificationsEnabled: false });
      return;
    }
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      save({ notificationsEnabled: true });
      return;
    }
    const result = await Notification.requestPermission();
    save({ notificationsEnabled: result === "granted" });
  };

  const subDisabled = notifUnavailable || !profile?.notificationsEnabled;

  const locationSteps =
    locationTab === "iphone" ? LOCATION_IPHONE_STEPS : LOCATION_ANDROID_STEPS;

  const notifSteps =
    notifTab === "home-screen"
      ? NOTIF_HOME_SCREEN_STEPS
      : isIPhone
        ? NOTIF_BLOCKED_IPHONE_STEPS
        : NOTIF_BLOCKED_ANDROID_STEPS;

  if (loading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/profile" text="Profile" />
            </IonButtons>
            <IonTitle />
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="settings-page settings-page--loading">
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/profile" text="Profile" />
          </IonButtons>
          <IonTitle />
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={true}>
        <div className="settings-page">
          <h1 className="pc-title settings-page__title">Settings</h1>

          <p className="settings-page__section-title">Location</p>
          <div className="settings-page__card">
            <div className="settings-page__row">
              <div className="settings-page__row-labels">
                <p className="settings-page__row-title">Use my location</p>
                {locationBlocked ? (
                  <>
                    <p className="settings-page__row-error">
                      Blocked in your phone's settings
                    </p>
                    <button
                      type="button"
                      className="settings-page__help-link"
                      onClick={() => setHelpSheet("location")}
                    >
                      How to turn on ›
                    </button>
                  </>
                ) : (
                  <p className="settings-page__row-subtitle">
                    Shows courts near you, sorted by distance
                  </p>
                )}
              </div>
              <IonToggle
                aria-label="Use my location"
                checked={!locationBlocked && !!profile?.locationEnabled}
                disabled={locationBlocked}
                onIonChange={(e) => void handleLocationToggle(e.detail.checked)}
              />
            </div>
            <div
              className={`settings-page__row${!profile?.locationEnabled || locationBlocked ? " settings-page__row--disabled" : ""}`}
            >
              <div className="settings-page__row-labels">
                <p className="settings-page__row-title">Automatic check-in</p>
                <p className="settings-page__row-subtitle">
                  {profile?.locationEnabled && !locationBlocked
                    ? "Only while PeachCourt is open"
                    : "Turn on location access to use this"}
                </p>
              </div>
              <IonToggle
                aria-label="Automatic check-in"
                checked={!!profile?.autoCheckin}
                disabled={!profile?.locationEnabled || locationBlocked}
                onIonChange={(e) => save({ autoCheckin: e.detail.checked })}
              />
            </div>
          </div>

          <p className="settings-page__section-title">Alerts</p>
          <div className="settings-page__card">
            <div className="settings-page__row">
              <div className="settings-page__row-labels">
                <p className="settings-page__row-title">Notifications</p>
                {notifUnavailable ? (
                  <>
                    <p className="settings-page__row-error">
                      {isIPhone && !isStandalone
                        ? "Add PeachCourt to your Home Screen first"
                        : "Blocked in your phone's settings"}
                    </p>
                    <button
                      type="button"
                      className="settings-page__help-link"
                      onClick={() => setHelpSheet("notifications")}
                    >
                      How to turn on ›
                    </button>
                  </>
                ) : (
                  <p className="settings-page__row-subtitle">
                    Alerts on this phone, even when the app is closed
                  </p>
                )}
              </div>
              <IonToggle
                aria-label="Notifications"
                checked={!notifUnavailable && !!profile?.notificationsEnabled}
                disabled={notifUnavailable}
                onIonChange={(e) => void handleNotifToggle(e.detail.checked)}
              />
            </div>
            {SUB_TOGGLES.map(({ key, label, defaultOn }) => (
              <div
                key={key}
                className={`settings-page__row${subDisabled ? " settings-page__row--disabled" : ""}`}
              >
                <div className="settings-page__row-labels">
                  <p className="settings-page__row-title">{label}</p>
                </div>
                <IonToggle
                  aria-label={label}
                  checked={profile?.[key] ?? defaultOn}
                  disabled={subDisabled}
                  onIonChange={(e) => save({ [key]: e.detail.checked })}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="settings-page__stored-link"
            onClick={() => setHelpSheet("stored")}
          >
            See what's stored
          </button>

          <button
            type="button"
            className="settings-page__delete-btn"
            aria-label="Delete my account and data"
          >
            Delete my account and data
          </button>
        </div>

        <IonModal
          isOpen={helpSheet === "location"}
          onDidDismiss={() => setHelpSheet(null)}
          breakpoints={[0, 1]}
          initialBreakpoint={1}
        >
          <IonContent>
            <div className="settings-sheet">
              <h2 className="settings-sheet__title">Turn on location</h2>
              <p className="settings-sheet__subtitle">
                Your phone is blocking location for PeachCourt. Change it here:
              </p>
              <div className="settings-sheet__tabs">
                <button
                  type="button"
                  className={`settings-sheet__tab${locationTab === "iphone" ? " settings-sheet__tab--active" : ""}`}
                  onClick={() => setLocationTab("iphone")}
                >
                  iPhone
                </button>
                <button
                  type="button"
                  className={`settings-sheet__tab${locationTab === "android" ? " settings-sheet__tab--active" : ""}`}
                  onClick={() => setLocationTab("android")}
                >
                  Android
                </button>
              </div>
              <div className="settings-sheet__steps">
                {locationSteps.map((step, i) => (
                  <div key={i} className="settings-sheet__step">
                    <div className="settings-sheet__step-num">{i + 1}</div>
                    <p className="settings-sheet__step-text">{step}</p>
                  </div>
                ))}
              </div>
              <IonButton
                expand="block"
                onClick={() => setHelpSheet(null)}
              >
                Done
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={helpSheet === "notifications"}
          onDidDismiss={() => setHelpSheet(null)}
          breakpoints={[0, 1]}
          initialBreakpoint={1}
        >
          <IonContent>
            <div className="settings-sheet">
              <h2 className="settings-sheet__title">Turn on notifications</h2>
              <p className="settings-sheet__subtitle">
                {notifTab === "home-screen"
                  ? "iPhones only send alerts from the Home Screen app."
                  : "Notifications are blocked. Change it in your phone settings:"}
              </p>
              <div className="settings-sheet__tabs">
                <button
                  type="button"
                  className={`settings-sheet__tab${notifTab === "home-screen" ? " settings-sheet__tab--active" : ""}`}
                  onClick={() => setNotifTab("home-screen")}
                >
                  Add to Home Screen
                </button>
                <button
                  type="button"
                  className={`settings-sheet__tab${notifTab === "blocked" ? " settings-sheet__tab--active" : ""}`}
                  onClick={() => setNotifTab("blocked")}
                >
                  Blocked
                </button>
              </div>
              <div className="settings-sheet__steps">
                {notifSteps.map((step, i) => (
                  <div key={i} className="settings-sheet__step">
                    <div className="settings-sheet__step-num">{i + 1}</div>
                    <p className="settings-sheet__step-text">{step}</p>
                  </div>
                ))}
              </div>
              <IonButton
                expand="block"
                onClick={() => setHelpSheet(null)}
              >
                Done
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={helpSheet === "stored"}
          onDidDismiss={() => setHelpSheet(null)}
          breakpoints={[0, 1]}
          initialBreakpoint={1}
        >
          <IonContent>
            <div className="settings-sheet">
              <h2 className="settings-sheet__title">What PeachCourt stores</h2>
              <ul className="settings-sheet__stored-list">
                <li>
                  Your name ({profile
                    ? `${profile.firstName} ${profile.lastName.charAt(0)}.`
                    : "—"}
                  ) and email address
                </li>
                <li>Sports and skill levels</li>
                <li>Location and alert preferences</li>
                <li>Games you have posted or joined</li>
                <li>Check-in and court report history</li>
              </ul>
              <p className="settings-sheet__stored-note">
                To remove all your data, use "Delete my account and data" on
                this page.
              </p>
              <IonButton
                expand="block"
                onClick={() => setHelpSheet(null)}
              >
                Done
              </IonButton>
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
