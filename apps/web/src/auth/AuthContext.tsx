import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  endSession,
  getAccessToken,
  refreshSession,
  setAccessToken as persistAccessToken,
} from '../lib/api';

type AuthContextValue = {
  accessToken: string | null;
  isInitializing: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    getAccessToken(),
  );
  const [isInitializing, setIsInitializing] = useState(
    () => !getAccessToken(),
  );

  useEffect(() => {
    if (getAccessToken()) {
      return;
    }

    let active = true;

    refreshSession()
      .then((token) => {
        if (active) {
          setAccessToken(token);
        }
      })
      .catch(() => {
        if (active) {
          setAccessToken(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsInitializing(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      isInitializing,
      login(token: string) {
        persistAccessToken(token);
        setAccessToken(token);
      },
      async logout() {
        await endSession();
        setAccessToken(null);
      },
    }),
    [accessToken, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
