import { useEffect, useMemo, useState } from 'react';
import { IonContent, IonLabel, IonPage, IonSegment, IonSegmentButton, IonToast } from '@ionic/react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  type QueryDocumentSnapshot,
  where,
} from 'firebase/firestore';
import CourtMap, { CourtMapItem } from '../components/CourtMap';
import { SAMPLE_COURTS } from '../data/sampleCourts';
import { db } from '../services/firebase';
import type { Sport } from '../types/types.ts';
import './CourtsPage.css';

const CourtsPage: React.FC = () => {
  const [sport, setSport] = useState<Sport>('pickleball');
  const [playersByCourt, setPlayersByCourt] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const activeCheckinsQuery = query(collection(db, 'checkins'), where('active', '==', true));
    let latestDocs: QueryDocumentSnapshot[] = [];
    const recalculateCounts = () => {
      const counts: Record<string, number> = {};
      latestDocs.forEach((snapshot) => {
        const checkin = snapshot.data();
        if (
          checkin.expiresAt instanceof Timestamp &&
          checkin.expiresAt.toMillis() > Date.now() &&
          typeof checkin.courtId === 'string' &&
          typeof checkin.playerCount === 'number'
        ) {
          counts[checkin.courtId] = (counts[checkin.courtId] ?? 0) + checkin.playerCount;
        }
      });
      setPlayersByCourt(counts);
    };

    const unsubscribe = onSnapshot(
      activeCheckinsQuery,
      (snapshots) => {
        latestDocs = snapshots.docs;
        recalculateCounts();
      },
      (error) => {
        console.error('Unable to load live check-in counts', error);
        setToastMessage('Live player counts are unavailable right now.');
      },
    );
    const expiryTimer = window.setInterval(recalculateCounts, 30_000);

    return () => {
      unsubscribe();
      window.clearInterval(expiryTimer);
    };
  }, []);

  const items: CourtMapItem[] = useMemo(
    () =>
      SAMPLE_COURTS.filter((c) => c.sports.includes(sport)).map((court) => {
        const players = playersByCourt[court.id] ?? 0;
        return { court, players, status: 'open' };
      }),
    [sport, playersByCourt]
  );

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="courts-page">
          <div className="pc-screen courts-page__header">
            <h1 className="pc-title">Courts near you</h1>
            <p className="pc-subtitle">Near Piedmont Park, Midtown Atlanta</p>

            <IonSegment
              value={sport}
              onIonChange={(e) => setSport(e.detail.value as Sport)}
              className="courts-page__segment"
            >
              <IonSegmentButton value="pickleball">
                <IonLabel>Pickleball</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="tennis">
                <IonLabel>Tennis</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </div>

          <div className="courts-page__map">
            <CourtMap items={items} />
          </div>
        </div>
      </IonContent>
      <IonToast
        isOpen={toastMessage.length > 0}
        message={toastMessage}
        duration={3500}
        onDidDismiss={() => setToastMessage('')}
      />
    </IonPage>
  );
};

export default CourtsPage;