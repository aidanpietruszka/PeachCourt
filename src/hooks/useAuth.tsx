import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../services/firebase";
import { UserService } from "../services/UserService";
import type { UserProfile } from "../types/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let unsubscribeProfile = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile();
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      setState((prev) => ({ ...prev, user, loading: true }));
      unsubscribeProfile = UserService.subscribeToProfile(
        user.uid,
        (profile) => setState({ user, profile, loading: false }),
        () => setState({ user, profile: null, loading: false }),
        { serverOnly: true },
      );
    });
    return () => {
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
