import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../components/useAuth';
import { authErrorMessage, continueAsGuest } from '../services/auth';
import './WelcomePage.css';
import { useState } from 'react';


  const WelcomePage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { user, loading } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Already signed in (account or guest)? Skip the welcome page.
    if (!loading && user) return <Navigate to="/courts" replace />;

    const handleGuest = async () => {
      setError('');
      setBusy(true);
      try {
        await continueAsGuest();
        ionRouter.push('/courts', 'root', 'replace');
      } catch (e) {
        setError(authErrorMessage(e));
      } finally {
        setBusy(false);
      }
    };
  

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="welcome">
          <div className="welcome__hero">
            <div className="welcome__icon">
              <IonIcon icon={checkmark} /> {/* TODO: Replace with a custom icon or logo for PeachCourt. */}
            </div>
            <h1 className="welcome__title">PeachCourt</h1>
            <p className="welcome__tagline">
              Find open tennis and pickleball courts in Atlanta before you leave home.
            </p>
          </div>

          <div className="welcome__actions">
            <IonButton expand="block" onClick={() => ionRouter.push('/login')}>
              Log in
            </IonButton>
            <IonButton
              expand="block"
              className="welcome__secondary"
              onClick={() => ionRouter.push('/signup')}
            >
              Create account
            </IonButton>
            <button type="button" className="welcome__guest" onClick={handleGuest}>
              Continue as guest
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default WelcomePage;