import { useMemo, useState } from 'react';
import { IonContent, IonPage, IonSegment, IonSegmentButton, IonLabel } from '@ionic/react';
import CourtMap, { CourtMapItem } from '../components/CourtMap';
import { PLACEHOLDER_PLAYERS, SAMPLE_COURTS } from '../data/sampleCourts';
// import { estimateStatus } from '../services/occupancy';
import type { Sport } from '../types/types.ts';
import './CourtsPage.css';

const CourtsPage: React.FC = () => {
  const [sport, setSport] = useState<Sport>('pickleball');

  const items: CourtMapItem[] = useMemo(
    () =>
      SAMPLE_COURTS.filter((c) => c.sports.includes(sport)).map((court) => {
        const players = PLACEHOLDER_PLAYERS[court.id] ?? 0;
        // const status = estimateStatus(players, court.numberOfCourts);
        return { court, players, status: 'open' }; // Placeholder status
      }),
    [sport]
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
    </IonPage>
  );
};

export default CourtsPage;