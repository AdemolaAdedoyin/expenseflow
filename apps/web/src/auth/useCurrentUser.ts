import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CurrentUser } from '../types/auth';
import { useAuth } from './AuthContext';

export const currentUserQueryKey = ['me'] as const;

export function useCurrentUser() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => api<CurrentUser>('/auth/me'),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    retry: false,
  });
}
