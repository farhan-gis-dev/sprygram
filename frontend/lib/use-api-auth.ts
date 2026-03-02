'use client';

import { useEffect, useMemo } from 'react';
import { useDevAuth } from './dev-auth-context';

export function useApiAuth() {
  const { activeIdentity, authToken } = useDevAuth();

  const auth = useMemo(
    () => ({
      token: authToken || undefined,
      workspaceId: activeIdentity?.workspaceId,
    }),
    [activeIdentity?.workspaceId, authToken],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (auth.token) {
      document.cookie = `access-token=${encodeURIComponent(auth.token)}; path=/; SameSite=Lax`;
      return;
    }
    document.cookie = 'access-token=; Max-Age=0; path=/; SameSite=Lax';
  }, [auth.token]);

  return auth;
}
