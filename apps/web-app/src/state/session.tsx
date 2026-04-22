import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { apiRequest, ApiError } from "../lib/api.js";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  handle: string;
  role: string;
  status: string;
  createdAt: string;
  avatarUrl?: string;
};

type SessionContextValue = {
  user: SessionUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; username: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  applySession: (session: AuthSuccess) => void;
};

type ApiUser = {
  id: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  createdAt: string;
};

type StoredSession = {
  accessToken: string;
  user: ApiUser;
};

type AuthSuccess = {
  user: ApiUser;
  accessToken: string;
};

const SESSION_STORAGE_KEY = "neonpulse-session-v1";

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!raw) {
      setIsLoading(false);
      return;
    }

    try {
      const storedSession = JSON.parse(raw) as StoredSession;
      setAccessToken(storedSession.accessToken);
      setUser(mapApiUserToSessionUser(storedSession.user));

      void refreshPersistedSession(storedSession.accessToken, controller.signal)
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          clearPersistedSession();
          setAccessToken(null);
          setUser(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } catch {
      clearPersistedSession();
      setIsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, []);

  function persistSession(session: AuthSuccess) {
    setAccessToken(session.accessToken);
    setUser(mapApiUserToSessionUser(session.user));
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: session.accessToken,
        user: session.user,
      } satisfies StoredSession),
    );
  }

  async function refreshPersistedSession(token: string, signal?: AbortSignal) {
    const response = await apiRequest<{ user: ApiUser }>("/auth/me", {
      token,
      signal,
    });

    const nextUser = mapApiUserToSessionUser(response.user);
    setUser(nextUser);
    setAccessToken(token);
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: token,
        user: response.user,
      } satisfies StoredSession),
    );
  }

  function clearSessionState() {
    setAccessToken(null);
    setUser(null);
    clearPersistedSession();
  }

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: Boolean(user && accessToken),
      login: async ({ email, password }) => {
        const response = await apiRequest<AuthSuccess>("/auth/login", {
          method: "POST",
          body: {
            email,
            password,
          },
        });

        persistSession(response);
      },
      register: async ({ email, password, username }) => {
        const response = await apiRequest<AuthSuccess>("/auth/register", {
          method: "POST",
          body: {
            email,
            password,
            username,
          },
        });

        persistSession(response);
      },
      logout: async () => {
        const token = accessToken;

        try {
          if (token) {
            await apiRequest("/auth/logout", {
              method: "POST",
              token,
            });
          }
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            throw error;
          }
        } finally {
          clearSessionState();
        }
      },
      refreshSession: async () => {
        if (!accessToken) {
          return;
        }

        await refreshPersistedSession(accessToken);
      },
      applySession: (session) => {
        persistSession(session);
      },
    }),
    [accessToken, isLoading, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
}

function mapApiUserToSessionUser(user: ApiUser): SessionUser {
  const displayName = user.username?.trim() || user.email.split("@")[0] || "Pulse User";

  return {
    id: user.id,
    email: user.email,
    name: displayName,
    handle: `@${(user.username?.trim() || user.email.split("@")[0] || "neonpulse").replace(/[^a-zA-Z0-9_]+/g, "").toLowerCase()}`,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}

function clearPersistedSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
