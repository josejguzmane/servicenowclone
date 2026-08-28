import type { Actor, SessionResponse } from '@servicedesk/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'servicedesk.session';

function readSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly baseUrl: string) {}

  get isAuthenticated(): boolean {
    return readSession() !== null;
  }

  async login(email: string, password: string): Promise<Actor> {
    const session = await this.request<SessionResponse>('POST', '/auth/login', {
      body: { email, password },
      anonymous: true,
    });
    writeSession({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    return session.user;
  }

  async register(input: {
    email: string;
    name: string;
    password: string;
    company?: string;
  }): Promise<Actor> {
    const session = await this.request<SessionResponse>('POST', '/auth/register', {
      body: input,
      anonymous: true,
    });
    writeSession({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    return session.user;
  }

  async me(): Promise<Actor> {
    return this.request<Actor>('GET', '/auth/me');
  }

  async logout(): Promise<void> {
    const session = readSession();
    if (session) {
      await this.request('POST', '/auth/logout', {
        body: { refreshToken: session.refreshToken },
      }).catch(() => undefined);
    }
    writeSession(null);
  }

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; anonymous?: boolean; retry?: boolean } = {},
  ): Promise<T> {
    const session = readSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!options.anonymous && session) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    // One transparent refresh attempt on expiry, then give up and sign out.
    if (response.status === 401 && !options.anonymous && !options.retry && session) {
      const refreshed = await this.refreshSession();
      if (refreshed) return this.request<T>(method, path, { ...options, retry: true });
      writeSession(null);
    }

    if (!response.ok) {
      throw new ApiError(response.status, await extractError(response));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private refreshSession(): Promise<boolean> {
    this.refreshing ??= (async () => {
      const session = readSession();
      if (!session) return false;
      try {
        const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (!response.ok) return false;
        const next = (await response.json()) as SessionResponse;
        writeSession({ accessToken: next.accessToken, refreshToken: next.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }
}

async function extractError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
