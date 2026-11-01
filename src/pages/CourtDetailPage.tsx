import { useEffect, useState } from "react";
import {
  IonActionSheet,
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
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import { useParams } from "react-router-dom";
import MatchBoard from "../components/MatchBoard";
import { useAuth } from "../hooks/useAuth";
import { EMPTY_ACTIVITY, useLiveCourtData } from "../hooks/useLiveCourtData";
import { CheckinService, type ActiveCheckIn } from "../services/CheckinService";
import { CourtService } from "../services/CourtService";
import { EventService } from "../services/EventService";
import type { Court } from "../types/types";
import {
  courtSummary,
  formatCount,
  formatHours,
  formatSurfaces,
  formatText,
  formatYesNo,
} from "../utils/courts";
import {
  distanceBetweenMeters,
  formatDistance,
  formatMinutesAgo,
} from "../utils/geo";
import { CROWD_RANGES, displayRange } from "../utils/crowdRange";
import "./CourtDetailPage.css";

const CHECK_IN_MINUTES = 60;
const DISTANCE_WARNING_METERS = 150;
const FEEDBACK_PROMPT_KEY = "peachcourt-checkin-feedback-asked";
const TRUST_PROMPT_KEY = "peachcourt-trust-asked";
const STILL_HERE_KEY = "peachcourt-still-here";
const DETAILS_EXPANDED_KEY = "peachcourt-details-expanded";
const TRUST_PROMPT_DELAY_MS = 5_000;
const STILL_HERE_DELAY_MS = 30 * 60 * 1000;

type RangePickerMode = "checkin" | "update" | "stillhere";

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

function loadDetailsExpanded(): boolean {
  try {
    return localStorage.getItem(DETAILS_EXPANDED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveDetailsExpanded(value: boolean) {
  try {
    localStorage.setItem(DETAILS_EXPANDED_KEY, String(value));
  } catch (error) {
    console.warn("Unable to save details state", error);
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
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const [rangePickerMode, setRangePickerMode] =
    useState<RangePickerMode>("checkin");
  const [selectedRange, setSelectedRange] = useState<number | null>(null);
  const [isMoveAlertOpen, setIsMoveAlertOpen] = useState(false);
  const [isStillHereOpen, setIsStillHereOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ players: number } | null>(
    null,
  );
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isTrustOpen, setIsTrustOpen] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);
  const [checkInStartedAt, setCheckInStartedAt] = useState(0);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(
    loadDetailsExpanded,
  );

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
  const hoursLines = court ? formatHours(court.openingHours) : [];
  const reportedAtMs = courtActivity.reportedAt?.getTime() ?? null;

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

  useEffect(() => {
    if (!checkedInHere || reportedAtMs === null) return;
    if (now - reportedAtMs < STILL_HERE_DELAY_MS) return;
    let lastPromptMs = 0;
    try {
      lastPromptMs = Number(sessionStorage.getItem(STILL_HERE_KEY) ?? "0");
    } catch {
      lastPromptMs = 0;
    }
    if (now - lastPromptMs < STILL_HERE_DELAY_MS) return;
    try {
      sessionStorage.setItem(STILL_HERE_KEY, String(now));
    } catch {
      /* ignore */
    }
    setIsStillHereOpen(true);
  }, [checkedInHere, reportedAtMs, now]);

  const toggleDetails = () => {
    const next = !isDetailsExpanded;
    setIsDetailsExpanded(next);
    saveDetailsExpanded(next);
  };

  const openRangePicker = (mode: RangePickerMode, defaultRange?: number) => {
    setRangePickerMode(mode);
    setSelectedRange(defaultRange ?? null);
    setIsRangePickerOpen(true);
  };

  const startCheckIn = () => {
    setCheckInStartedAt(performance.now());
    if (validActiveCheckIn && !checkedInHere) {
      setIsMoveAlertOpen(true);
    } else {
      openRangePicker("checkin");
    }
  };

  const handleCheckIn = async (selectedCourt: Court, playerCount: number) => {
    setIsRangePickerOpen(false);
    setSelectedRange(null);
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

  const handleUpdateCount = async (
    selectedCourt: Court,
    playerCount: number,
  ) => {
    setIsRangePickerOpen(false);
    setSelectedRange(null);
    setIsBusy(true);
    try {
      await CheckinService.updateCount(selectedCourt.id, playerCount);
      setToastMessage("Count updated.");
    } catch (error) {
      console.error("Unable to update count", error);
      setToastMessage(
        `Update failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmStillHere = async (
    selectedCourt: Court,
    playerCount: number,
  ) => {
    setIsRangePickerOpen(false);
    setSelectedRange(null);
    setIsBusy(true);
    try {
      await CheckinService.confirmStillHere(selectedCourt.id, playerCount);
      setToastMessage("Count updated.");
    } catch (error) {
      console.error("Unable to confirm still here", error);
      setToastMessage(
        `Update failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRangePickerConfirm = () => {
    if (!court || selectedRange === null) return;
    if (rangePickerMode === "update") {
      void handleUpdateCount(court, selectedRange);
    } else if (rangePickerMode === "stillhere") {
      void handleConfirmStillHere(court, selectedRange);
    } else {
      void handleCheckIn(court, selectedRange);
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

  const handleStillHereNo = async () => {
    setIsStillHereOpen(false);
    if (court) {
      try {
        await CheckinService.stillHereSkipped(court.id);
      } catch (error) {
        console.error("Unable to log still here skipped", error);
      }
    }
    void handleCheckOut();
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

  const detailsSummary = court
    ? (() => {
        const base = courtSummary(court);
        const surfaces = formatSurfaces(court.surfaces);
        return surfaces === "Unknown" ? base : `${base} · ${surfaces}`;
      })()
    : "";

  const reportedLabel =
    courtActivity.reported === null
      ? "No recent reports"
      : displayRange(courtActivity.reported);

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
              <div className="court-title-row">
                <h1 className="pc-title">{court.name}</h1>
                <button
                  type="button"
                  className="court-directions-btn"
                  onClick={() => setIsDirectionsOpen(true)}
                >
                  Directions
                </button>
              </div>
              <p className="pc-subtitle">
                {court.address}
                {distance !== null ? ` · ${formatDistance(distance)}` : ""}
              </p>

              <section className="live-card" aria-live="polite">
                <p className="live-card__count">{reportedLabel}</p>
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

              <div className="court-details">
                <button
                  type="button"
                  className="court-details__toggle"
                  aria-expanded={isDetailsExpanded}
                  onClick={toggleDetails}
                >
                  <span>Court details</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={`court-details__chevron${isDetailsExpanded ? " court-details__chevron--up" : ""}`}
                  >
                    <polyline
                      points="3,6 8,11 13,6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {!isDetailsExpanded && (
                  <p className="court-details__summary">{detailsSummary}</p>
                )}
                {isDetailsExpanded && (
                  <IonList inset className="court-info">
                    <IonItem>
                      <IonLabel>Tennis courts</IonLabel>
                      <IonText>{formatCount(court.tennisCourts)}</IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Pickleball courts</IonLabel>
                      <IonText>{formatCount(court.pickleballCourts)}</IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Hours</IonLabel>
                      <IonText className="court-info__lines">
                        {hoursLines.length > 0
                          ? hoursLines.join("\n")
                          : "Unknown"}
                      </IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Reservations</IonLabel>
                      <IonText className="court-info__lines">
                        {formatText(court.reservationInfo)}
                      </IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Walk-on rules</IonLabel>
                      <IonText>{formatText(court.walkOnRules)}</IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Lights</IonLabel>
                      <IonText>{formatYesNo(court.hasLights)}</IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Surface</IonLabel>
                      <IonText>{formatSurfaces(court.surfaces)}</IonText>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Pickleball lines</IonLabel>
                      <IonText>{formatYesNo(court.pickleballLines)}</IonText>
                    </IonItem>
                  </IonList>
                )}
              </div>

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
                  disabled={isBusy || !uid}
                  onClick={() =>
                    openRangePicker(
                      "update",
                      validActiveCheckIn?.playerCount ?? undefined,
                    )
                  }
                >
                  Update count
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

      {court && (
        <IonActionSheet
          isOpen={isDirectionsOpen}
          header={court.address}
          buttons={[
            {
              text: "Open in Apple Maps",
              handler: () => {
                window.open(
                  `maps://maps.apple.com/?ll=${court.latitude},${court.longitude}`,
                  "_blank",
                );
              },
            },
            {
              text: "Open in Google Maps",
              handler: () => {
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`,
                  "_blank",
                );
              },
            },
            {
              text: "Copy address",
              handler: () => {
                navigator.clipboard
                  .writeText(court.address)
                  .then(() => setToastMessage("Copied"))
                  .catch((error: unknown) =>
                    console.error("Unable to copy address", error),
                  );
              },
            },
            {
              text: "Cancel",
              role: "cancel",
            },
          ]}
          onDidDismiss={() => setIsDirectionsOpen(false)}
        />
      )}

      <IonAlert
        isOpen={isMoveAlertOpen}
        header="Move your check-in?"
        message={`You're currently checked in at ${validActiveCheckIn ? "another court" : "a court"}. Checking in here will move you.`}
        buttons={[
          { text: "Cancel", role: "cancel" },
          {
            text: "Move here",
            handler: () => {
              setIsMoveAlertOpen(false);
              openRangePicker("checkin");
            },
          },
        ]}
        onDidDismiss={() => setIsMoveAlertOpen(false)}
      />

      <IonModal
        isOpen={isRangePickerOpen}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        onDidDismiss={() => {
          setIsRangePickerOpen(false);
          setSelectedRange(null);
        }}
      >
        <IonContent>
          <div className="range-picker">
            <h2 className="range-picker__title">
              {rangePickerMode === "update" ? "Update count" : "Check in at"}{" "}
              {court?.name}
            </h2>
            <p className="range-picker__subtitle">
              How many people are here right now, including you?
            </p>
            {CROWD_RANGES.map(({ min, label, countText }) => (
              <button
                key={min}
                type="button"
                className={`range-picker__row${selectedRange === min ? " range-picker__row--selected" : ""}`}
                onClick={() => setSelectedRange(min)}
              >
                <span className="range-picker__label">{label}</span>
                <span className="range-picker__count">{countText}</span>
              </button>
            ))}
            <IonButton
              expand="block"
              disabled={selectedRange === null || isBusy}
              onClick={handleRangePickerConfirm}
            >
              {rangePickerMode === "update" ? "Update" : "Check in"}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={confirmation !== null} onDidDismiss={closeConfirmation}>
        <IonContent>
          <div className="checked-in">
            <div className="checked-in__icon" aria-hidden="true">
              ✓
            </div>
            <h1 className="checked-in__title">You're checked in</h1>
            <p className="checked-in__subtitle">
              {court?.name} ·{" "}
              {confirmation !== null ? displayRange(confirmation.players) : ""}
            </p>
            <p className="checked-in__note">
              Others can now see this court is in use. Your check-in ends after
              1 hour or when you check out.
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

      {court && (
        <IonAlert
          isOpen={isStillHereOpen}
          header="Still here?"
          message={`Are you still at ${court.name}?`}
          buttons={[
            {
              text: "No, I left",
              role: "cancel",
              handler: () => void handleStillHereNo(),
            },
            {
              text: "Yes, update count",
              handler: () => {
                setIsStillHereOpen(false);
                openRangePicker(
                  "stillhere",
                  validActiveCheckIn?.playerCount ?? undefined,
                );
              },
            },
          ]}
          onDidDismiss={() => setIsStillHereOpen(false)}
        />
      )}

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
        message={`How much do you trust "${reportedLabel}"? 1 = not at all, 5 = completely.`}
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
