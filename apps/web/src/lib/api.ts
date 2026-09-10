const BASE =
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000/api';

export const getAccessToken = () =>
  localStorage.getItem('token');

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken = getAccessToken();

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',

      ...(accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {}),

      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      body.message || 'Request failed',
    );
  }

  return response.json();
}

export const money = (
  cents: number,
  currency = 'USD',
) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);