import { useEffect, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonActionSheet,
  useIonRouter,
} from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { UserService, TENNIS_SKILL_LEVELS, PICKLEBALL_SKILL_LEVELS } from "../services/UserService";
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

const EditProfilePage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const [presentActionSheet] = useIonActionSheet();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sports, setSports] = useState<Sport[]>([]);
  const [skillLevels, setSkillLevels] = useState<Partial<Record<Sport, number>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    void UserService.getProfile(user.uid).then((profile) => {
      if (profile) {
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setSports(profile.sports);
        setSkillLevels(profile.skillLevels);
      }
    });
  }, [user]);

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

  const handleSave = async () => {
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
      ionRouter.goBack();
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/profile" text="Back" />
          </IonButtons>
          <IonTitle>Edit profile</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={true}>
        <div className="onboarding">
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

          <IonButton expand="block" disabled={busy} onClick={() => void handleSave()}>
            {busy ? <IonSpinner name="dots" /> : "Save"}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default EditProfilePage;
