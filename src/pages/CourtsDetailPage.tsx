import { useEffect, useState } from 'react';
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
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

const DISTANCE_WARNING_METERS = 150;
const FEEDBACK_PROMPT_KEY = 'peachcourt-checkin-feedback-asked';

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
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

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
    setIsBusy(true);
    const requestStartedAt = performance.now();
    let distance: number | null = null;
    let locationNotice = '';

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

    try {
      await CheckinService.checkIn(selectedCourt.id, playerCount, distance, requestStartedAt);
      setToastMessage(locationNotice || `Checked in with ${playerCount} player${playerCount === 1 ? '' : 's'}.`);
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

  const checkedInHere = activeCheckIn?.courtId === courtId;

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

              {activeCheckIn && !checkedInHere && (
                <p role="status">
                  You&apos;re checked in at another court. Checking in here will check you out there.
                </p>
              )}
              {checkedInHere ? (
                <>
                  <p role="status">
                    You&apos;re checked in here with {activeCheckIn?.playerCount} player
                    {activeCheckIn?.playerCount === 1 ? '' : 's'}.
                  </p>
                  <IonButton expand="block" color="medium" disabled={isBusy} onClick={handleCheckOut}>
                    {isBusy ? 'Please wait…' : 'Check Out'}
                  </IonButton>
                </>
              ) : (
                <>
                  <IonItem>
                    <IonLabel>How many players are here right now?</IonLabel>
                    <IonSelect
                      aria-label="How many players are here right now?"
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
                  <IonButton
                    expand="block"
                    disabled={isBusy || !uid}
                    onClick={() => void handleCheckIn(court)}
                  >
                    {isBusy ? 'Checking In…' : uid ? 'Check In' : 'Starting guest session…'}
                  </IonButton>
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
