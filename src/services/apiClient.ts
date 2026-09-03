import { API_ORIGIN } from '@/services/catalog';
import { sessionStore } from '@/services/sessionStore';
import type { AuthSession } from '@/types/customer';

export class CustomerServiceError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
  }
}
let session: AuthSession | null = null;
let generation = 0;
let refreshing: Promise<AuthSession | null> | null = null;
const listeners = new Set<(value: AuthSession | null) => void>();
export function validSession(value: AuthSession) {
  return typeof value?.user?.id === 'string' && !!value.user.id &&
    typeof value.accessToken === 'string' && !!value.accessToken &&
    typeof value.refreshToken === 'string' && !!value.refreshToken &&
    Number.isFinite(value.expiresAt) && value.expiresAt > Date.now();
}
function publish(value: AuthSession | null) {
  session = value;
  listeners.forEach((listener) => listener(value));
}
export const apiSession = {
  get: () => session,
  set: (value: AuthSession) => {
    generation++;
    publish(value);
  },
  updateUser: (user: AuthSession['user']) => {
    if (session?.user.id === user.id) publish({ ...session, user });
  },
  clear: async () => {
    generation++;
    publish(null);
    await sessionStore.clear();
  },
  subscribe: (listener: (value: AuthSession | null) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: 'none' | 'optional' | 'required';
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
};
async function send<T>(
  path: string,
  options: RequestOptions,
  accessToken?: string,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, options.timeout ?? 12000);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort);
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...options.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new CustomerServiceError(
        data?.error || 'unavailable',
        response.status,
      );
    if (data === null) throw new CustomerServiceError('invalid_response');
    return data as T;
  } catch (error) {
    if (error instanceof CustomerServiceError) throw error;
    throw new CustomerServiceError('network');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
export function refreshSession(): Promise<AuthSession | null> {
  if (refreshing) return refreshing;
  const version = generation;
  refreshing = (async () => {
    const raw = session?.refreshToken || (await sessionStore.read());
    if (!raw || version !== generation) return null;
    try {
      const next = await send<AuthSession>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken: raw },
      });
      if (!validSession(next))
        throw new CustomerServiceError('invalid_response');
      if (version !== generation) return null;
      await sessionStore.write(next.refreshToken);
      if (version !== generation) return null;
      publish(next);
      return next;
    } catch (error) {
      if (
        error instanceof CustomerServiceError &&
        error.status === 401 &&
        version === generation
      )
        await apiSession.clear();
      throw error;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const mode = options.auth ?? 'required';
  if (mode === 'none') return send<T>(path, options);
  const version = generation;
  if (session && session.expiresAt <= Date.now() + 5000) await refreshSession();
  if (version !== generation)
    throw new CustomerServiceError('unauthorized', 401);
  if (mode === 'required' && !session)
    throw new CustomerServiceError('unauthorized', 401);
  let token = session?.accessToken;
  try {
    const result = await send<T>(path, options, token);
    if (generation !== version)
      throw new CustomerServiceError('unauthorized', 401);
    return result;
  } catch (error) {
    if (
      !(error instanceof CustomerServiceError) ||
      error.status !== 401 ||
      !token ||
      version !== generation
    )
      throw error;
    // A concurrent request may already have rotated this access token.
    if (session?.accessToken === token) await refreshSession();
    if (!session || version !== generation)
      throw new CustomerServiceError('unauthorized', 401);
    token = session.accessToken;
    try {
      const result = await send<T>(path, options, token);
      if (version !== generation) throw new CustomerServiceError('unauthorized', 401);
      return result;
    } catch (retryError) {
      if (retryError instanceof CustomerServiceError && retryError.status === 401 && version === generation && session?.accessToken === token)
        await apiSession.clear();
      throw retryError;
    }
  }
}
