import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthState {
  user: User | null;
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    // Firebase calls this once on startup, then on every sign-in / sign-out.
    // It returns an "unsubscribe" function, which React runs on cleanup.
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);