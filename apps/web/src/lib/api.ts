const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const ACCESS_TOKEN_KEY = 'token';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type ApiErrorBody = {
  message?: string | string[];
};

type RefreshResponse = {
  accessToken: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshRequest: Promise<string> | null = null;

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function getErrorMessage(body: ApiErrorBody, fallback: string) {
  if (Array.isArray(body.message)) {
    return body.message.join(', ');
  }

  return body.message ?? fallback;
}

async function parseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return new ApiError(getErrorMessage(body, 'Request failed'), response.status);
}

export function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw await parseError(response);
        }

        const body = (await response.json()) as RefreshResponse;
        setAccessToken(body.accessToken);
        return body.accessToken;
      })
      .catch((error) => {
        clearAccessToken();
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

export async function endSession() {
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  } finally {
    clearAccessToken();
  }
}

function withIdempotencyKey(options: RequestInit): RequestInit {
  const method = (options.method ?? 'GET').toUpperCase();

  if (!MUTATION_METHODS.has(method)) {
    return options;
  }

  const headers = new Headers(options.headers);

  if (!headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', crypto.randomUUID());
  }

  return {
    ...options,
    headers,
  };
}

async function request<T>(
  path: string,
  options: RequestInit,
  allowRefresh: boolean,
): Promise<T> {
  const accessToken = getAccessToken();
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (
    response.status === 401 &&
    allowRefresh &&
    path !== '/auth/login' &&
    path !== '/auth/refresh'
  ) {
    await refreshSession();
    return request<T>(path, options, false);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function api<T>(path: string, options: RequestInit = {}) {
  return request<T>(path, withIdempotencyKey(options), true);
}

export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
