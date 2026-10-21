import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router-dom';

const CheckInPage: React.FC = () => {
  const { courtId } = useParams<{ courtId: string }>();
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/courts/${courtId}`} text="Back" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="pc-screen">
          <h1 className="pc-title">Check-in (placeholder)</h1>
          <p className="pc-subtitle">courtId: {courtId}</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CheckInPage;