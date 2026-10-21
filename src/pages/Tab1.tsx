import { IonContent, IonPage } from '@ionic/react';
import InfoCard from '../components/InfoCard';
import StatusBadge from '../components/StatusBadge';
// import { estimateStatus } from '../services/occupancy';

const Home: React.FC = () => (
  <IonPage>
    <IonContent>
      <div className="pc-screen">
        <h1 className="pc-title">Design test</h1>
        <p className="pc-subtitle">Temporary page to check theme and components</p>

        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status="open" />
          <StatusBadge status="busy" />
          <StatusBadge status="full" />
        </div>

        <h2 className="pc-section-heading">Courts</h2>
        <InfoCard
          rows={[
            { label: 'Courts', value: '3 outdoor' },
            { label: 'Surface', value: 'Concrete' },
            { label: 'Lights', value: 'Yes' },
          ]}
        />

        <h2 className="pc-section-heading">Status logic (8 players, 3 courts)</h2>
        {/* <StatusBadge status={estimateStatus(8, 3)} /> */}
      </div>
    </IonContent>
  </IonPage>
);

export default Home;