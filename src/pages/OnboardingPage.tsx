import { useState } from "react";
import {
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
  IonToggle,
  useIonActionSheet,
  useIonRouter,
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "../hooks/useAuth";
import {
  UserService,
  TENNIS_SKILL_LEVELS,
  PICKLEBALL_SKILL_LEVELS,
} from "../services/UserService";
import type { Sport, UserProfile } from "../types/types";
import "./OnboardingPage.css";

const SPORTS: { value: Sport; label: string }[] = [
  { value: "tennis", label: "Tennis" },
  { value: "pickleball", label: "Pickleball" },
];

const SKILL_LABELS: Record<Sport, string> = {
  tennis: "Tennis (NTRP)",
  pickleball: "Pickleball",
};

type Step = 1 | 2 | 3;

interface Props {
  onComplete?: () => void;
}

const OnboardingPage: React.FC<Props> = ({ onComplete }) => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const [presentActionSheet] = useIonActionSheet();

  const [step, setStep] = useState<Step>(1);

  const [firstName, setFirstName] = useState(
    user?.displayName?.split(" ")[0] ?? "",
  );
  const [lastName, setLastName] = useState(
    user?.displayName?.split(" ").slice(1).join(" ") ?? "",
  );
  const [sports, setSports] = useState<Sport[]>([]);
  const [skillLevels, setSkillLevels] = useState<
    Partial<Record<Sport, number>>
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [locationEnabled, setLocationEnabled] = useState(false);
  const [autoCheckin, setAutoCheckin] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const isIPhone = /iPhone/.test(navigator.userAgent);
  const isStandalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  const showSafariInstructions = isIPhone && !isStandalone;

  const dotClass = (dotStep: number) =>
    step === dotStep
      ? "onboarding__dot onboarding__dot--active"
      : step > dotStep
        ? "onboarding__dot onboarding__dot--done"
        : "onboarding__dot";

  const displayName =
    firstName.trim() && lastName.trim()
      ? `${firstName.trim()} ${lastName.trim().charAt(0)}.`
      : "";

  const toggleSport = (sport: Sport) => {
    setSports((prev) => {
      if (prev.includes(sport)) {
        const next = prev.filter((s) => s !== sport);
        setSkillLevels((levels) => {
          const copy = { ...levels };
          delete copy[sport];
          return copy;
        });
        return next;
      }
      return [...prev, sport];
    });
  };

  const pickSkill = (sport: Sport) => {
    const levels =
      sport === "tennis" ? TENNIS_SKILL_LEVELS : PICKLEBALL_SKILL_LEVELS;
    void presentActionSheet({
      header: SKILL_LABELS[sport],
      buttons: [
        ...levels.map((level) => ({
          text: String(level),
          handler: () => {
            setSkillLevels((prev) => ({ ...prev, [sport]: level }));
          },
        })),
        { text: "Cancel", role: "cancel" },
      ],
    });
  };

  const handleStep1Next = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) {
      setError("Enter your first name.");
      return;
    }
    if (!ln) {
      setError("Enter your last name.");
      return;
    }
    if (sports.length === 0) {
      setError("Select at least one sport.");
      return;
    }
    for (const sport of sports) {
      if (skillLevels[sport] === undefined) {
        setError(`Select a skill level for ${SKILL_LABELS[sport]}.`);
        return;
      }
    }
    setError("");
    setBusy(true);
    try {
      const profile: UserProfile = {
        firstName: fn,
        lastName: ln,
        sports,
        skillLevels,
      };
      await UserService.saveProfile(user!.uid, profile);
      setStep(2);
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLocationToggle = async (checked: boolean) => {
    if (!checked) {
      setLocationEnabled(false);
      setAutoCheckin(false);
      setLocationBlocked(false);
      return;
    }
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "granted") {
        setLocationEnabled(true);
        setLocationBlocked(false);
      } else {
        setLocationEnabled(false);
        setLocationBlocked(true);
      }
    } catch {
      setLocationEnabled(false);
      setLocationBlocked(true);
    }
  };

  const handleStep2Next = async () => {
    setBusy(true);
    try {
      await UserService.saveOnboardingPrefs(user!.uid, {
        locationEnabled,
        autoCheckin,
      });
    } catch {
      // continue
    } finally {
      setBusy(false);
    }
    setStep(3);
  };

  const handleStep2Skip = async () => {
    try {
      await UserService.saveOnboardingPrefs(user!.uid, {
        locationEnabled: false,
        autoCheckin: false,
      });
    } catch {
      // continue
    }
    setStep(3);
  };

  const handleNotificationsToggle = async (checked: boolean) => {
    if (!checked) {
      setNotificationsEnabled(false);
      return;
    }
    if (!("Notification" in window)) {
      setNotificationsEnabled(false);
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationsEnabled(result === "granted");
  };

  const handleFinish = async (notifEnabled: boolean, prompted: boolean) => {
    setBusy(true);
    try {
      await UserService.saveOnboardingPrefs(user!.uid, {
        notificationsEnabled: notifEnabled,
        ...(prompted ? { notificationsPrompted: true } : {}),
        onboardingDone: true,
      });
    } catch {
      // continue
    } finally {
      setBusy(false);
    }
    if (onComplete) {
      onComplete();
    } else {
      ionRouter.push("/courts", "root", "replace");
    }
  };

  const progress = (
    <div className="onboarding__progress">
      <div className={dotClass(1)} />
      <div className={dotClass(2)} />
      <div className={dotClass(3)} />
      <p className="onboarding__step-label">Step {step} of 3</p>
    </div>
  );

  if (step === 1) {
    return (
      <IonPage>
        <IonContent scrollY={true}>
          <div className="onboarding">
            {progress}

            <p className="onboarding__title">Your game</p>
            <p className="onboarding__subtitle">
              Used to match you with games and alerts.
            </p>

            <div className="onboarding__field">
              <p className="onboarding__field-label">First name</p>
              <input
                className="onboarding__field-input"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-label="First name"
              />
            </div>

            <div className="onboarding__field">
              <p className="onboarding__field-label">Last name</p>
              <input
                className="onboarding__field-input"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-label="Last name"
              />
            </div>

            {displayName && (
              <p className="onboarding__caption">
                Other players see your first name and last initial: {displayName}
              </p>
            )}

            <p className="onboarding__section-title">Sports</p>

            <div className="onboarding__sports">
              {SPORTS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`onboarding__sport-chip${sports.includes(value) ? " onboarding__sport-chip--selected" : ""}`}
                  onClick={() => toggleSport(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {sports.length > 0 && (
              <>
                <p className="onboarding__section-title">Skill level</p>
                <div className="onboarding__skill-rows">
                  {sports.map((sport) => (
                    <button
                      key={sport}
                      type="button"
                      className="onboarding__skill-row"
                      onClick={() => pickSkill(sport)}
                    >
                      <span>{SKILL_LABELS[sport]}</span>
                      <span className="onboarding__skill-value">
                        {skillLevels[sport] !== undefined
                          ? `${skillLevels[sport]}  ›`
                          : "Tap to set  ›"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && <p className="onboarding__error">{error}</p>}

            <div className="onboarding__spacer" />

            <IonButton
              expand="block"
              disabled={busy}
              onClick={() => void handleStep1Next()}
            >
              {busy ? <IonSpinner name="dots" /> : "Next"}
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (step === 2) {
    return (
      <IonPage>
        <IonContent scrollY={true}>
          <div className="onboarding">
            {progress}

            <p className="onboarding__title">Use your location</p>
            <p className="onboarding__subtitle">
              Find courts near you and check in automatically.
            </p>

            <div className="onboarding__toggle-card">
              <div className="onboarding__toggle-row">
                <div className="onboarding__toggle-labels">
                  <p className="onboarding__toggle-title">Use my location</p>
                  <p className="onboarding__toggle-subtitle">
                    {locationEnabled
                      ? "Shows courts near you, sorted by distance"
                      : "Show courts nearest to you"}
                  </p>
                  {locationBlocked && (
                    <p className="onboarding__toggle-blocked">
                      Blocked in your phone's settings · How to turn on ›
                    </p>
                  )}
                </div>
                <IonToggle
                  aria-label="Use my location"
                  checked={locationEnabled}
                  onIonChange={(e) =>
                    void handleLocationToggle(e.detail.checked)
                  }
                />
              </div>
              <div
                className={`onboarding__toggle-row${!locationEnabled ? " onboarding__toggle-row--disabled" : ""}`}
              >
                <div className="onboarding__toggle-labels">
                  <p className="onboarding__toggle-title">Automatic check-in</p>
                  <p className="onboarding__toggle-subtitle">
                    {locationEnabled
                      ? "Checks you in when you arrive at a court"
                      : "Turn on location first"}
                  </p>
                </div>
                <IonToggle
                  aria-label="Automatic check-in"
                  checked={autoCheckin}
                  disabled={!locationEnabled}
                  onIonChange={(e) => setAutoCheckin(e.detail.checked)}
                />
              </div>
            </div>

            <div className="onboarding__spacer" />

            <IonButton
              expand="block"
              disabled={busy}
              onClick={() => void handleStep2Next()}
            >
              {busy ? <IonSpinner name="dots" /> : "Next"}
            </IonButton>
            <button
              type="button"
              className="onboarding__skip-link"
              onClick={() => void handleStep2Skip()}
            >
              Skip for now
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (showSafariInstructions) {
    return (
      <IonPage>
        <IonContent scrollY={true}>
          <div className="onboarding">
            {progress}

            <p className="onboarding__title">Get game alerts</p>
            <p className="onboarding__subtitle">
              Add PeachCourt to your Home Screen to get alerts on iPhone.
            </p>

            <div className="onboarding__steps-card">
              <div className="onboarding__step-row">
                <div className="onboarding__step-number">1</div>
                <p className="onboarding__step-text">
                  Tap the Share button ⬆︎ in Safari
                </p>
              </div>
              <div className="onboarding__step-row">
                <div className="onboarding__step-number">2</div>
                <p className="onboarding__step-text">
                  Choose 'Add to Home Screen'
                </p>
              </div>
              <div className="onboarding__step-row">
                <div className="onboarding__step-number">3</div>
                <p className="onboarding__step-text">
                  Open PeachCourt from your Home Screen
                </p>
              </div>
            </div>

            <p className="onboarding__subtitle">
              Until then you'll still see alerts while PeachCourt is open.
            </p>

            <div className="onboarding__spacer" />

            <IonButton
              expand="block"
              disabled={busy}
              onClick={() => void handleFinish(false, false)}
            >
              {busy ? <IonSpinner name="dots" /> : "Continue"}
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent scrollY={true}>
        <div className="onboarding">
          {progress}

          <p className="onboarding__title">Get game alerts</p>
          <p className="onboarding__subtitle">
            Only for your sports and skill level.
          </p>

          <div className="onboarding__notif-preview">
            <div className="onboarding__notif-card">
              <p className="onboarding__notif-title">
                New doubles game · Bitsy Grant
              </p>
              <p className="onboarding__notif-subtitle">
                Pickleball · 3.0 · Today 6:00 PM
              </p>
            </div>
            <div className="onboarding__notif-card">
              <p className="onboarding__notif-title">
                Alex M. joined your game
              </p>
              <p className="onboarding__notif-subtitle">2 of 4 spots filled</p>
            </div>
          </div>

          <div className="onboarding__toggle-card">
            <div className="onboarding__toggle-row">
              <div className="onboarding__toggle-labels">
                <p className="onboarding__toggle-title">Notifications</p>
                <p className="onboarding__toggle-subtitle">
                  Alerts on this phone, even when the app is closed
                </p>
              </div>
              <IonToggle
                aria-label="Notifications"
                checked={notificationsEnabled}
                onIonChange={(e) =>
                  void handleNotificationsToggle(e.detail.checked)
                }
              />
            </div>
          </div>

          <div className="onboarding__spacer" />

          <IonButton
            expand="block"
            disabled={busy}
            onClick={() => void handleFinish(notificationsEnabled, true)}
          >
            {busy ? <IonSpinner name="dots" /> : "Next"}
          </IonButton>
          <button
            type="button"
            className="onboarding__skip-link"
            onClick={() => void handleFinish(false, true)}
          >
            Skip for now
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnboardingPage;
