import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

const ACCESS_TOKEN_KEY = 'token';

type AuthContextValue = {
  accessToken: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      login(token: string) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        setAccessToken(token);
      },
      logout() {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        setAccessToken(null);
      },
    }),
    [accessToken],
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
