import { useEffect, useState } from "react";
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonText,
  IonToast,
  IonToolbar,
  type AlertInput,
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import { useParams } from "react-router-dom";
import MatchBoard from "../components/MatchBoard";
import { useAuth } from "../components/useAuth";
import {
  EMPTY_ACTIVITY,
  useLiveCourtData,
} from "../components/useLiveCourtData";
import { CheckinService, type ActiveCheckIn } from "../services/CheckinService";
import { CourtService } from "../services/CourtService";
import { EventService } from "../services/EventService";
import type { Court } from "../types/types";
import {
  distanceBetweenMeters,
  formatDistance,
  formatMinutesAgo,
} from "../utils/geo";
import "./CourtsDetailPage.css";

const CHECK_IN_MINUTES = 120;
const DISTANCE_WARNING_METERS = 150;
const FEEDBACK_PROMPT_KEY = "peachcourt-checkin-feedback-asked";
const TRUST_PROMPT_KEY = "peachcourt-trust-asked";
const TRUST_PROMPT_DELAY_MS = 5_000;
const HEAD_COUNT_INPUTS: AlertInput[] = [
  { name: "playerCount", type: "number", value: 1, min: 1, max: 20 },
];

function lightsLabel(hasLights: boolean | null): string {
  if (hasLights === null) {
    return "Unknown";
  }
  return hasLights ? "Yes" : "No";
}

function isSkip(role: string | undefined): boolean {
  return role === "cancel" || role === "backdrop";
}

function sessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, "true");
  } catch (error) {
    console.warn("Unable to save session flag", error);
  }
}

const CourtDetailPage: React.FC = () => {
  const { courtId } = useParams<{ courtId: string }>();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const activity = useLiveCourtData();
  const [court, setCourt] = useState<Court | null | undefined>(undefined);
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isCountPromptOpen, setIsCountPromptOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ players: number } | null>(
    null,
  );
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isTrustOpen, setIsTrustOpen] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [checkInStartedAt, setCheckInStartedAt] = useState(0);

  const courtActivity = (courtId && activity[courtId]) || EMPTY_ACTIVITY;
  const validActiveCheckIn =
    activeCheckIn && activeCheckIn.expiresAt.toMillis() > now
      ? activeCheckIn
      : null;
  const checkedInHere = validActiveCheckIn?.courtId === courtId;
  const courtLoaded = Boolean(court);
  const hasReport = courtActivity.reported !== null;
  const distance =
    court && userLocation
      ? distanceBetweenMeters(
          userLocation[0],
          userLocation[1],
          court.latitude,
          court.longitude,
        )
      : null;

  useEffect(() => {
    if (!courtId) {
      setCourt(null);
      return;
    }

    setCourt(undefined);
    return CourtService.subscribeToCourt(courtId, setCourt, (error) => {
      console.error("Unable to load this court", error);
      setCourt(null);
    });
  }, [courtId]);

  useEffect(() => {
    if (!uid) {
      setActiveCheckIn(null);
      return;
    }

    return CheckinService.subscribeToActiveCheckIn(
      uid,
      setActiveCheckIn,
      (error) => {
        console.error("Unable to load your active check-in", error);
      },
    );
  }, [uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 10_000,
    })
      .then((position) =>
        setUserLocation([position.coords.latitude, position.coords.longitude]),
      )
      .catch((error: unknown) => console.warn("Location unavailable", error));
  }, []);

  useEffect(() => {
    if (!courtId || !courtLoaded || !uid) {
      return;
    }
    EventService.recordCourtView(courtId).catch((error: unknown) =>
      console.error("Unable to log court view", error),
    );
  }, [courtId, courtLoaded, uid]);

  useEffect(() => {
    if (!courtLoaded || !hasReport || sessionFlag(TRUST_PROMPT_KEY)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSessionFlag(TRUST_PROMPT_KEY);
      setIsTrustOpen(true);
    }, TRUST_PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [courtLoaded, hasReport]);

  const startCheckIn = () => {
    setCheckInStartedAt(performance.now());
    setIsCountPromptOpen(true);
  };

  const handleCheckIn = async (selectedCourt: Court, rawCount: string) => {
    const playerCount = Math.round(Number(rawCount));
    if (!Number.isFinite(playerCount) || playerCount < 1 || playerCount > 20) {
      setToastMessage("Enter a number of players from 1 to 20.");
      return;
    }

    setIsBusy(true);
    try {
      await CheckinService.checkIn(
        selectedCourt.id,
        playerCount,
        distance,
        checkInStartedAt,
        Date.now(),
        CHECK_IN_MINUTES,
      );
      setConfirmation({ players: playerCount });
      if (distance !== null && distance > DISTANCE_WARNING_METERS) {
        setToastMessage(
          `You're about ${formatDistance(distance)} away. Your check-in was still recorded.`,
        );
      }
    } catch (error) {
      console.error("Unable to check in", error);
      setToastMessage(
        `Check-in failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setIsBusy(true);
    try {
      await CheckinService.checkOut();
      setConfirmation(null);
      setToastMessage("You are checked out.");
    } catch (error) {
      console.error("Unable to check out", error);
      setToastMessage(
        `Check-out failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const closeConfirmation = () => {
    setConfirmation(null);
    try {
      if (localStorage.getItem(FEEDBACK_PROMPT_KEY) !== "true") {
        localStorage.setItem(FEEDBACK_PROMPT_KEY, "true");
        setIsFeedbackOpen(true);
      }
    } catch (error) {
      console.warn(
        "Unable to remember whether the feedback prompt was shown",
        error,
      );
    }
  };

  const submitFeedback = async (answer: string) => {
    try {
      await CheckinService.recordFeedback(answer);
      setToastMessage("Thanks for sharing your feedback.");
    } catch (error) {
      console.error("Unable to save check-in feedback", error);
    }
  };

  const skipFeedback = async () => {
    try {
      await EventService.recordFeedbackSkipped();
    } catch (error) {
      console.error("Unable to log skipped feedback", error);
    }
  };

  const skipTrust = async () => {
    if (!courtId) {
      return;
    }
    try {
      await EventService.recordTrustSkipped(
        courtId,
        courtActivity.reported ?? 0,
      );
    } catch (error) {
      console.error("Unable to log skipped trust rating", error);
    }
  };

  const submitTrust = async (rating: number) => {
    if (!courtId) {
      return;
    }
    try {
      await EventService.recordTrustRating(
        courtId,
        rating,
        courtActivity.reported ?? 0,
      );
      setToastMessage("Thanks for your rating.");
    } catch (error) {
      console.error("Unable to save trust rating", error);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/courts" text="Courts" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="pc-screen">
          {court === undefined ? (
            <p className="pc-subtitle">Loading court…</p>
          ) : court ? (
            <>
              <h1 className="pc-title">{court.name}</h1>
              <p className="pc-subtitle">{court.address}</p>

              <IonList inset className="court-info">
                <IonItem>
                  <IonLabel>Distance</IonLabel>
                  <IonText>
                    {distance === null ? "Unknown" : formatDistance(distance)}
                  </IonText>
                </IonItem>
                <IonItem>
                  <IonLabel>Courts</IonLabel>
                  <IonText>{court.numberOfCourts}</IonText>
                </IonItem>
                <IonItem>
                  <IonLabel>Hours</IonLabel>
                  <IonText>{court.hours}</IonText>
                </IonItem>
                <IonItem>
                  <IonLabel>Walk-on rules</IonLabel>
                  <IonText>{court.walkOnRules}</IonText>
                </IonItem>
                <IonItem>
                  <IonLabel>Lights</IonLabel>
                  <IonText>{lightsLabel(court.hasLights)}</IonText>
                </IonItem>
                <IonItem>
                  <IonLabel>Surface</IonLabel>
                  <IonText>{court.surface}</IonText>
                </IonItem>
              </IonList>

              <section className="live-card" aria-live="polite">
                <p className="live-card__count">
                  {courtActivity.reported === null
                    ? "No recent reports"
                    : `${courtActivity.reported} reported`}
                </p>
                <p className="live-card__updated">
                  {courtActivity.checkedIn} checked in
                  {courtActivity.reportedAt
                    ? ` · ${formatMinutesAgo(courtActivity.reportedAt, now)}`
                    : ""}
                </p>
                {checkedInHere && (
                  <p className="live-card__you">You're checked in here.</p>
                )}
                {validActiveCheckIn && !checkedInHere && (
                  <p className="live-card__you">
                    You're checked in at another court. Checking in here moves
                    you.
                  </p>
                )}
              </section>

              <MatchBoard
                court={court}
                isPostOpen={isPostOpen}
                onClosePost={() => setIsPostOpen(false)}
              />
            </>
          ) : (
            <>
              <h1 className="pc-title">Court not found</h1>
              <p className="pc-subtitle">This court is not available.</p>
            </>
          )}
        </div>
      </IonContent>

      {court && (
        <IonFooter className="court-actions">
          <IonToolbar>
            <div className="court-actions__buttons">
              <IonButton
                expand="block"
                disabled={!uid}
                onClick={() => setIsPostOpen(true)}
              >
                Post a game
              </IonButton>
              {checkedInHere ? (
                <IonButton
                  expand="block"
                  fill="outline"
                  disabled={isBusy}
                  onClick={() => void handleCheckOut()}
                >
                  {isBusy ? "Please wait…" : "Check out"}
                </IonButton>
              ) : (
                <IonButton
                  expand="block"
                  fill="outline"
                  disabled={isBusy || !uid}
                  onClick={startCheckIn}
                >
                  {isBusy ? "Checking in…" : "Check in"}
                </IonButton>
              )}
            </div>
          </IonToolbar>
        </IonFooter>
      )}

      <IonAlert
        isOpen={isCountPromptOpen}
        header="Check in"
        message="How many people are here right now, including you?"
        inputs={HEAD_COUNT_INPUTS}
        buttons={[
          { text: "Cancel", role: "cancel" },
          {
            text: "Check in",
            handler: (values: { playerCount?: string }) => {
              if (court) {
                void handleCheckIn(court, values.playerCount ?? "1");
              }
            },
          },
        ]}
        onDidDismiss={() => setIsCountPromptOpen(false)}
      />

      <IonModal isOpen={confirmation !== null} onDidDismiss={closeConfirmation}>
        <IonContent>
          <div className="checked-in">
            <div className="checked-in__icon" aria-hidden="true">
              ✓
            </div>
            <h1 className="checked-in__title">You're checked in</h1>
            <p className="checked-in__subtitle">
              {court?.name} · {confirmation?.players ?? 0} reported here
            </p>
            <p className="checked-in__note">
              Others can now see this court is in use. Your check-in ends after
              2 hours or when you check out.
            </p>
            <IonButton expand="block" onClick={closeConfirmation}>
              Done
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              disabled={isBusy}
              onClick={() => void handleCheckOut()}
            >
              Check out
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={isFeedbackOpen}
        header="Quick question"
        message="What would stop you doing this every time you arrive?"
        buttons={[
          { text: "Forgot", handler: () => void submitFeedback("forgot") },
          {
            text: "Too much effort",
            handler: () => void submitFeedback("too_much_effort"),
          },
          { text: "Privacy", handler: () => void submitFeedback("privacy") },
          {
            text: "Nobody else uses it",
            handler: () => void submitFeedback("nobody_else_uses_it"),
          },
          { text: "Not now", role: "cancel" },
        ]}
        onDidDismiss={(event) => {
          setIsFeedbackOpen(false);
          if (isSkip(event.detail.role)) {
            void skipFeedback();
          }
        }}
      />

      <IonAlert
        isOpen={isTrustOpen}
        header="Quick question"
        message={`How much do you trust "${courtActivity.reported === null ? "No recent reports" : `${courtActivity.reported} reported`}"? 1 = not at all, 5 = completely.`}
        buttons={[
          ...[1, 2, 3, 4, 5].map((rating) => ({
            text: String(rating),
            handler: () => void submitTrust(rating),
          })),
          { text: "Skip", role: "cancel" },
        ]}
        onDidDismiss={(event) => {
          setIsTrustOpen(false);
          if (isSkip(event.detail.role)) {
            void skipTrust();
          }
        }}
      />

      <IonToast
        isOpen={toastMessage.length > 0}
        message={toastMessage}
        duration={3500}
        onDidDismiss={() => setToastMessage("")}
      />
    </IonPage>
  );
};

export default CourtDetailPage;
