import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Actor, Permission } from '@servicedesk/shared';
import { ApiClient } from './api-client';

interface AuthContextValue {
  api: ApiClient;
  user: Actor | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Actor>;
  register: (input: {
    email: string;
    name: string;
    password: string;
    company?: string;
  }) => Promise<Actor>;
  logout: () => Promise<void>;
  /** Affordance hiding only; the API enforces the same permission server-side. */
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const api = useMemo(() => new ApiClient(baseUrl), [baseUrl]);
  const [user, setUser] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!api.isAuthenticated) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((actor) => {
        if (!cancelled) setUser(actor);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const login = useCallback(
    async (email: string, password: string) => {
      const actor = await api.login(email, password);
      setUser(actor);
      return actor;
    },
    [api],
  );

  const register = useCallback(
    async (input: { email: string; name: string; password: string; company?: string }) => {
      const actor = await api.register(input);
      setUser(actor);
      return actor;
    },
    [api],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, [api]);

  const can = useCallback(
    (permission: Permission) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const value = useMemo(
    () => ({ api, user, loading, login, register, logout, can }),
    [api, user, loading, login, register, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
