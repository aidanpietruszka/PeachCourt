import { useEffect, useState } from 'react';
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Geolocation } from '@capacitor/geolocation';
import { useParams } from 'react-router-dom';
import { SAMPLE_COURTS } from '../data/sampleCourts';
import { auth } from '../services/firebase';
import { CheckinService, type ActiveCheckIn } from '../services/CheckinService';
import type { Court } from '../types/types';
import './CourtsDetailPage.css';

const DISTANCE_WARNING_METERS = 150;
const FEEDBACK_PROMPT_KEY = 'peachcourt-checkin-feedback-asked';

function toLocalDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function minutesToTimeValue(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const remainingMinutes = String(minutes % 60).padStart(2, '0');
  return `${hours}:${remainingMinutes}`;
}

function parseParkHours(hours: string): { openMinutes: number; closeMinutes: number } | null {
  const matches = [...hours.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length < 2) {
    return null;
  }

  const toMinutes = (match: RegExpMatchArray): number => {
    const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return hour * 60 + Number(match[2] ?? 0);
  };

  return {
    openMinutes: toMinutes(matches[0]),
    closeMinutes: toMinutes(matches[matches.length - 1]),
  };
}

function localDateTimeMillis(dateValue: string, timeValue: string): number {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

function addDays(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  return toLocalDateValue(new Date(year, month - 1, day + days));
}

function distanceBetweenMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) *
      Math.cos(radians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

const CourtDetailPage: React.FC = () => {
  const { courtId } = useParams<{ courtId: string }>();
  const court = SAMPLE_COURTS.find((item) => item.id === courtId);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [arrivalDate, setArrivalDate] = useState(() => toLocalDateValue(new Date()));
  const [arrivalTime, setArrivalTime] = useState('00:00');
  const [hasSelectedArrivalTime, setHasSelectedArrivalTime] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [now, setNow] = useState(() => Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const arrivalTimeMs = localDateTimeMillis(arrivalDate, arrivalTime);
  const currentMinute = Math.floor(now / 60_000) * 60_000;
  const isCurrentArrival =
    hasSelectedArrivalTime &&
    arrivalDate === toLocalDateValue(new Date(now)) &&
    Math.abs(arrivalTimeMs - now) < 60_000;
  const isFutureArrival = !isCurrentArrival && arrivalTimeMs > now;
  const today = toLocalDateValue(new Date(now));
  const maxArrivalDate = addDays(today, 30);
  const parkHours = court ? parseParkHours(court.hours) : null;
  const currentDate = new Date(now);
  const currentMinuteOfDay = currentDate.getHours() * 60 + currentDate.getMinutes();
  const openingMinutes = parkHours?.openMinutes ?? 0;
  const closingMinutes = parkHours?.closeMinutes ?? 23 * 60 + 59;
  const minimumTimeMinutes = Math.max(currentMinuteOfDay, openingMinutes);
  const minimumTime = minutesToTimeValue(minimumTimeMinutes);
  const closingTime = minutesToTimeValue(closingMinutes);
  const hasAvailableArrivalTime = minimumTimeMinutes <= closingMinutes;
  const validActiveCheckIn =
    activeCheckIn && activeCheckIn.expiresAt.toMillis() > now ? activeCheckIn : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          setUid(user.uid);
          return;
        }

        setUid(null);
        void signInAnonymously(auth).catch((error: unknown) => {
          console.error('Unable to start an anonymous Firebase session', error);
          setToastMessage('Unable to start a guest session. Please try again.');
        });
      },
      (error) => {
        console.error('Unable to observe Firebase authentication state', error);
        setToastMessage('Unable to connect to your account. Please try again.');
      },
    );
  }, []);

  useEffect(() => {
    if (!uid) {
      setActiveCheckIn(null);
      return;
    }

    return CheckinService.subscribeToActiveCheckIn(
      uid,
      setActiveCheckIn,
      (error) => {
        console.error('Unable to load your active check-in', error);
        setToastMessage('Unable to load your check-in status. Please try again.');
      },
    );
  }, [uid]);

  const submitFeedback = async (answer: string) => {
    try {
      await CheckinService.recordFeedback(answer);
      setToastMessage('Thanks for sharing your feedback.');
    } catch (error) {
      console.error('Unable to save check-in feedback', error);
      setToastMessage('Your check-in was saved, but the feedback could not be recorded.');
    }
  };

  const handleCheckIn = async (selectedCourt: Court) => {
    if (!hasSelectedArrivalTime) {
      setToastMessage('Select an arrival time before continuing.');
      return;
    }
    const selectedTimeMinutes =
      Number(arrivalTime.slice(0, 2)) * 60 + Number(arrivalTime.slice(3, 5));
    if (
      !hasAvailableArrivalTime ||
      selectedTimeMinutes < minimumTimeMinutes ||
      selectedTimeMinutes > closingMinutes
    ) {
      setToastMessage('Choose an arrival time between now and the park closing time.');
      return;
    }

    setIsBusy(true);
    const requestStartedAt = performance.now();
    let distance: number | null = null;
    let locationNotice = '';

    if (arrivalTimeMs <= Date.now()) {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          maximumAge: 15_000,
          timeout: 1_500,
        });
        distance = distanceBetweenMeters(
          position.coords.latitude,
          position.coords.longitude,
          selectedCourt.latitude,
          selectedCourt.longitude,
        );
        if (distance > DISTANCE_WARNING_METERS) {
          locationNotice = `You're about ${Math.round(distance)} m away. Your check-in was still recorded.`;
        }
      } catch (error) {
        console.warn('Unable to verify check-in location; continuing without it', error);
        locationNotice = 'Location was unavailable; your check-in was still recorded.';
      }
    }

    try {
      await CheckinService.checkIn(
        selectedCourt.id,
        playerCount,
        distance,
        requestStartedAt,
        isCurrentArrival ? Date.now() : arrivalTimeMs,
        durationMinutes,
      );
      const scheduledMessage = arrivalTimeMs > Date.now()
        ? `Check-in scheduled for ${new Date(arrivalTimeMs).toLocaleString()}.`
        : `Checked in with ${playerCount} player${playerCount === 1 ? '' : 's'}.`;
      setToastMessage(locationNotice || scheduledMessage);
      try {
        if (localStorage.getItem(FEEDBACK_PROMPT_KEY) !== 'true') {
          localStorage.setItem(FEEDBACK_PROMPT_KEY, 'true');
          setIsFeedbackOpen(true);
        }
      } catch (error) {
        console.warn('Unable to remember whether the feedback prompt was shown', error);
      }
    } catch (error) {
      console.error('Unable to check in', error);
      setToastMessage(
        error instanceof Error && 'code' in error && error.code === 'permission-denied'
          ? 'Check-in was blocked by Firebase permissions. Enable Anonymous sign-in and confirm the published Firestore rules allow it.'
          : `Check-in failed: ${error instanceof Error ? error.message : 'Please try again.'}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setIsBusy(true);
    try {
      await CheckinService.checkOut();
      setToastMessage('You are checked out.');
    } catch (error) {
      console.error('Unable to check out', error);
      setToastMessage(
        `Check-out failed: ${error instanceof Error ? error.message : 'Please try again.'}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const currentCheckIn =
    validActiveCheckIn?.courtId === courtId ? validActiveCheckIn : null;
  const checkedInHere = currentCheckIn !== null;
  const isScheduledHere =
    currentCheckIn !== null && currentCheckIn.scheduledArrivalAt.toMillis() > now;

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
          {court ? (
            <>
              <h1 className="pc-title">{court.name}</h1>
              <p className="pc-subtitle">{court.address}</p>

              <IonList inset>
                <IonItem>
                  <IonLabel>Sport</IonLabel>
                  <IonText>
                    {court.sports
                      .map((sport) => (sport === 'pickleball' ? 'Pickleball' : 'Tennis'))
                      .join(', ')}
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
              </IonList>

              {validActiveCheckIn && !checkedInHere && (
                <p role="status">
                  You have a check-in at another court. Scheduling here will check it out now.
                </p>
              )}
              {currentCheckIn ? (
                <>
                  <p role="status">
                    {isScheduledHere
                      ? `Check-in scheduled for ${currentCheckIn.scheduledArrivalAt.toDate().toLocaleString()} with ${currentCheckIn.playerCount} player${currentCheckIn.playerCount === 1 ? '' : 's'}.`
                      : `You're checked in here with ${currentCheckIn.playerCount} player${currentCheckIn.playerCount === 1 ? '' : 's'}.`}
                  </p>
                  <p>
                    Duration: {currentCheckIn.durationMinutes} minutes
                  </p>
                  <IonButton expand="block" color="medium" disabled={isBusy} onClick={handleCheckOut}>
                    {isBusy ? 'Please wait…' : isScheduledHere ? 'Cancel Scheduled Check-In' : 'Check Out'}
                  </IonButton>
                </>
              ) : (
                <>
                  <IonItem>
                    <IonLabel>Arrival date</IonLabel>
                    <IonDatetimeButton datetime="arrival-date" />
                  </IonItem>
                  <IonModal keepContentsMounted>
                    <IonDatetime
                      id="arrival-date"
                      presentation="date"
                      value={arrivalDate}
                      min={today}
                      max={maxArrivalDate}
                      showDefaultButtons
                      onIonChange={(event) => {
                        if (typeof event.detail.value === 'string') {
                          const selectedDate = event.detail.value.slice(0, 10);
                          setArrivalDate(
                            hasSelectedArrivalTime &&
                              selectedDate === today &&
                              localDateTimeMillis(selectedDate, arrivalTime) < currentMinute
                              ? addDays(selectedDate, 1)
                              : selectedDate,
                          );
                        }
                      }}
                    />
                  </IonModal>
                  <IonItem>
                    <IonLabel>Arrival time</IonLabel>
                    <IonButton
                      fill="clear"
                      onClick={() => {
                        const currentDate = new Date(now);
                        const roundedCurrentTime =
                          currentDate.getSeconds() > 0 || currentDate.getMilliseconds() > 0
                            ? currentMinuteOfDay + 1
                            : currentMinuteOfDay;
                        const initialTime = Math.max(
                          minimumTimeMinutes,
                          Math.min(roundedCurrentTime, closingMinutes),
                        );
                        setArrivalTime(minutesToTimeValue(initialTime));
                        setHasSelectedArrivalTime(true);
                        setIsTimePickerOpen(true);
                      }}
                    >
                      {arrivalTime}
                    </IonButton>
                  </IonItem>
                  <IonModal
                    isOpen={isTimePickerOpen}
                    keepContentsMounted
                    onDidDismiss={() => setIsTimePickerOpen(false)}
                  >
                    <IonDatetime
                      id="arrival-time"
                      presentation="time"
                      value={`${arrivalDate}T${arrivalTime}:00`}
                      min={`${arrivalDate}T${minimumTime}:00`}
                      max={`${arrivalDate}T${closingTime}:00`}
                      showDefaultButtons
                      onIonChange={(event) => {
                        if (typeof event.detail.value === 'string') {
                          const selectedTime = event.detail.value.slice(11, 16);
                          setArrivalTime(selectedTime);
                          setHasSelectedArrivalTime(true);
                        }
                      }}
                    />
                  </IonModal>
                  {isCurrentArrival && (
                    <IonItem className="checkin-form-row">
                      <IonLabel className="checkin-form-row__label">
                        How many people are there right now?
                      </IonLabel>
                      <IonSelect
                        className="checkin-form-row__select"
                        slot="end"
                        aria-label="How many people are there right now?"
                        value={playerCount}
                        interface="popover"
                        onIonChange={(event) => setPlayerCount(Number(event.detail.value))}
                      >
                        {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                          <IonSelectOption key={count} value={count}>
                            {count}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  )}
                  <IonItem className="checkin-form-row">
                    <IonLabel>Duration</IonLabel>
                    <IonSelect
                      className="checkin-form-row__select checkin-form-row__select--duration"
                      slot="end"
                      aria-label="Check-in duration"
                      value={durationMinutes}
                      interface="popover"
                      justify="end"
                      onIonChange={(event) => setDurationMinutes(Number(event.detail.value))}
                    >
                      {[30, 60, 90, 120, 180, 240].map((minutes) => (
                        <IonSelectOption key={minutes} value={minutes}>
                          {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? '' : 's'}`}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonButton
                    expand="block"
                    disabled={
                      isBusy || !uid || !hasSelectedArrivalTime || !hasAvailableArrivalTime
                    }
                    onClick={() => void handleCheckIn(court)}
                  >
                    {isBusy
                      ? 'Checking In…'
                      : !uid
                        ? 'Starting guest session…'
                        : !hasSelectedArrivalTime
                          ? 'Select Arrival Time'
                          : isFutureArrival
                            ? 'Schedule Check-In'
                            : 'Check In'}
                  </IonButton>
                  {!hasAvailableArrivalTime && (
                    <p role="status">This park is closed for the rest of today.</p>
                  )}
                  {!uid && (
                    <p role="status">
                      Starting a guest session so you can check in.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="pc-title">Court not found</h1>
              <p className="pc-subtitle">This court is not available.</p>
            </>
          )}
        </div>
      </IonContent>
      <IonAlert
        isOpen={isFeedbackOpen}
        header="Quick question"
        message="What would stop you doing this every time you arrive?"
        buttons={[
          { text: 'Forgot', handler: () => void submitFeedback('forgot') },
          { text: 'Too much effort', handler: () => void submitFeedback('too_much_effort') },
          { text: 'Privacy', handler: () => void submitFeedback('privacy') },
          { text: 'Nobody else uses it', handler: () => void submitFeedback('nobody_else_uses_it') },
          { text: 'Not now', role: 'cancel' },
        ]}
        onDidDismiss={() => setIsFeedbackOpen(false)}
      />
      <IonToast
        isOpen={toastMessage.length > 0}
        message={toastMessage}
        duration={3500}
        onDidDismiss={() => setToastMessage('')}
      />
    </IonPage>
  );
};

export default CourtDetailPage;
