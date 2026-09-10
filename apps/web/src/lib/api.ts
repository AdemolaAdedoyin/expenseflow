const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const ACCESS_TOKEN_KEY = 'token';

type ApiErrorBody = {
  message?: string | string[];
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

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getErrorMessage(body: ApiErrorBody, fallback: string) {
  if (Array.isArray(body.message)) {
    return body.message.join(', ');
  }

  return body.message ?? fallback;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(getErrorMessage(body, 'Request failed'), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
