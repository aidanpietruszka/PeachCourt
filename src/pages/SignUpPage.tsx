import { useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonSpinner,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { authErrorMessage, signInWithGoogle, signUpWithEmail } from '../services/auth';
import './AuthPages.css';

const SignUpPage: React.FC = () => {
  const ionRouter = useIonRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
      ionRouter.push('/onboarding', 'root', 'replace');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter an email and a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    run(() => signUpWithEmail(name, email.trim(), password));
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" text="Back" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="pc-screen auth-page">
          <h1 className="pc-title">Create account</h1>
          <p className="pc-subtitle">Sign up to check in and keep your history.</p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <IonInput
                type="text"
                placeholder="Name (optional)"
                autocomplete="name"
                value={name}
                onIonInput={(e) => setName(String(e.detail.value ?? ''))}
              />
            </div>
            <div className="auth-field">
              <IonInput
                type="email"
                placeholder="Email"
                autocomplete="email"
                value={email}
                onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
              />
            </div>
            <div className="auth-field">
              <IonInput
                type="password"
                placeholder="Password (6+ characters)"
                autocomplete="new-password"
                value={password}
                onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
              />
            </div>
            <div className="auth-field">
              <IonInput
                type="password"
                placeholder="Confirm password"
                autocomplete="new-password"
                value={confirm}
                onIonInput={(e) => setConfirm(String(e.detail.value ?? ''))}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <IonButton expand="block" type="submit" disabled={busy}>
              {busy ? <IonSpinner name="dots" /> : 'Sign up'}
            </IonButton>
          </form>

          <div className="auth-divider">or</div>

          <IonButton
            expand="block"
            className="auth-secondary"
            disabled={busy}
            onClick={() => run(signInWithGoogle)}
          >
            Sign up with Google
          </IonButton>

          <div className="auth-switch">
            Already have an account?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => ionRouter.push('/login', 'back', 'replace')}
            >
              Log in
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SignUpPage;
