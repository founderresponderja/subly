import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authMe, loginWithEmail, loginWithGoogle, logout, registerWithEmail, type AuthUser } from './api';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string) => Promise<void>;
  loginGoogle: (idToken: string) => Promise<void>;
  logoutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void authMe()
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    loginEmail: async (email, password) => {
      const result = await loginWithEmail(email, password);
      setUser(result.user);
    },
    registerEmail: async (email, password) => {
      const result = await registerWithEmail(email, password);
      setUser(result.user);
    },
    loginGoogle: async (idToken) => {
      const result = await loginWithGoogle(idToken);
      setUser(result.user);
    },
    logoutUser: async () => {
      await logout();
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
