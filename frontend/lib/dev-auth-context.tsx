'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSpryAuth } from 'spry-apps-dropdown';
import { isOidcMode } from './auth-mode';
import { isOidcConfigured } from './oidc-config';

const STORAGE_KEY = 'sprygram.dev.identities';
const ACTIVE_KEY = 'sprygram.dev.activeIdentity';
const CALLBACK_PATH = '/auth/oidc/callback';
const BOOTSTRAP_ID = 'sprygram-auto-dev';

export type DevIdentity = {
  id: string;
  label: string;
  token: string;
  workspaceId: string;
};

type DevAuthContextValue = {
  isReady: boolean;
  oidcEnabled: boolean;
  oidcConfigured: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  authToken: string;
  identities: DevIdentity[];
  activeIdentity: DevIdentity | null;
  email: string;
  displayName: string;
  setActiveIdentity: (id: string) => void;
  clearActiveIdentity: () => void;
  addIdentity: (payload: Omit<DevIdentity, 'id'>) => void;
  bootstrapIdentity: (payload: Omit<DevIdentity, 'id'>) => void;
  removeIdentity: (id: string) => void;
  updateIdentity: (id: string, payload: Partial<Omit<DevIdentity, 'id'>>) => void;
  loginWithKeycloak: () => Promise<void>;
  logoutFromKeycloak: () => Promise<void>;
};

const DevAuthContext = createContext<DevAuthContextValue | null>(null);

const randomId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const decodeJwtPayload = (token: string | null | undefined) => {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const oidc = useSpryAuth();
  const [storageReady, setStorageReady] = useState(false);
  const [identities, setIdentities] = useState<DevIdentity[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const oidcEnabled = isOidcMode();
  const oidcConfigured = isOidcConfigured();
  const resolvedOidcEnabled = oidcEnabled && oidcConfigured;

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const storedIdentities = raw ? (JSON.parse(raw) as DevIdentity[]) : [];
    const active = window.localStorage.getItem(ACTIVE_KEY);

    setIdentities(Array.isArray(storedIdentities) ? storedIdentities : []);
    setActiveId(active);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identities));
  }, [identities, storageReady]);

  useEffect(() => {
    if (!storageReady) return;

    if (!activeId) {
      window.localStorage.removeItem(ACTIVE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId, storageReady]);

  useEffect(() => {
    if (resolvedOidcEnabled) return;

    const handleInvalidAuth = () => {
      setActiveId(null);
    };

    window.addEventListener('sprysnap:auth-invalid', handleInvalidAuth);
    return () => window.removeEventListener('sprysnap:auth-invalid', handleInvalidAuth);
  }, [resolvedOidcEnabled]);

  const localActiveIdentity = useMemo(() => {
    if (!activeId) return null;
    return identities.find((entry) => entry.id === activeId) || null;
  }, [activeId, identities]);

  const oidcIdentity = useMemo<DevIdentity | null>(() => {
    const token = oidc.user?.access_token;
    if (!token) {
      return null;
    }

    const claims = decodeJwtPayload(token) || (oidc.user?.profile as Record<string, unknown>) || {};
    const username = typeof claims.preferred_username === 'string' ? claims.preferred_username : '';
    const name = typeof claims.name === 'string' ? claims.name : '';
    const email = typeof claims.email === 'string' ? claims.email : '';
    const label = name || username || email || 'Spry user';
    const workspaceId = typeof claims.lastActiveWorkspaceId === 'string'
      ? claims.lastActiveWorkspaceId
      : typeof claims.workspaceId === 'string'
        ? claims.workspaceId
        : '';

    return {
      id: typeof claims.sub === 'string' ? claims.sub : 'oidc-user',
      label,
      token,
      workspaceId,
    };
  }, [oidc.user]);

  const activeIdentity = resolvedOidcEnabled ? oidcIdentity : localActiveIdentity;
  const authToken = activeIdentity?.token || '';
  const authLoading = resolvedOidcEnabled ? oidc.isLoading : !storageReady;
  const isAuthenticated = resolvedOidcEnabled ? Boolean(oidc.isAuthenticated && authToken) : Boolean(localActiveIdentity?.token);
  const authError = resolvedOidcEnabled
    ? (oidc.error ? String(oidc.error.message || oidc.error) : null)
    : null;
  const displayName = useMemo(() => {
    if (resolvedOidcEnabled) {
      return String(oidc.user?.profile?.name || oidc.user?.profile?.preferred_username || activeIdentity?.label || 'Spry user');
    }

    return activeIdentity?.label || 'Spry user';
  }, [activeIdentity?.label, oidc.user?.profile, resolvedOidcEnabled]);
  const email = resolvedOidcEnabled ? String(oidc.user?.profile?.email || '') : '';

  const value = useMemo<DevAuthContextValue>(() => ({
    isReady: resolvedOidcEnabled ? !authLoading : storageReady,
    oidcEnabled: resolvedOidcEnabled,
    oidcConfigured,
    authLoading,
    isAuthenticated,
    authError,
    authToken,
    identities: resolvedOidcEnabled ? (activeIdentity ? [activeIdentity] : []) : identities,
    activeIdentity,
    email,
    displayName,
    setActiveIdentity: (id: string) => {
      if (resolvedOidcEnabled) return;
      setActiveId(id);
    },
    clearActiveIdentity: () => {
      if (resolvedOidcEnabled) return;
      setActiveId(null);
    },
    addIdentity: (payload) => {
      if (resolvedOidcEnabled) return;

      const next: DevIdentity = {
        id: randomId(),
        label: payload.label.trim(),
        token: payload.token.trim(),
        workspaceId: payload.workspaceId.trim(),
      };

      setIdentities((prev) => [...prev, next]);
      setActiveId(next.id);
    },
    bootstrapIdentity: (payload) => {
      if (resolvedOidcEnabled) return;

      const next: DevIdentity = {
        id: BOOTSTRAP_ID,
        label: payload.label.trim(),
        token: payload.token.trim(),
        workspaceId: payload.workspaceId.trim(),
      };

      setIdentities((prev) => {
        const remaining = prev.filter((entry) => entry.id !== BOOTSTRAP_ID);
        return [...remaining, next];
      });
      setActiveId(BOOTSTRAP_ID);
    },
    removeIdentity: (id: string) => {
      if (resolvedOidcEnabled) return;

      setIdentities((prev) => prev.filter((entry) => entry.id !== id));
      setActiveId((prev) => (prev === id ? null : prev));
    },
    updateIdentity: (id, payload) => {
      if (resolvedOidcEnabled) return;

      setIdentities((prev) => prev.map((entry) => {
        if (entry.id !== id) return entry;
        return {
          ...entry,
          ...payload,
          label: payload.label !== undefined ? payload.label.trim() : entry.label,
          token: payload.token !== undefined ? payload.token.trim() : entry.token,
          workspaceId: payload.workspaceId !== undefined ? payload.workspaceId.trim() : entry.workspaceId,
        };
      }));
    },
    loginWithKeycloak: async () => {
      if (!resolvedOidcEnabled) return;

      if (window.location.pathname !== CALLBACK_PATH) {
        try {
          window.sessionStorage.setItem('post_login_redirect', window.location.href);
        } catch {
          // Ignore storage failures.
        }
      }

      await oidc.signinRedirect();
    },
    logoutFromKeycloak: async () => {
      if (!resolvedOidcEnabled) return;
      await oidc.signoutRedirect();
    },
  }), [
    activeIdentity,
    authError,
    authLoading,
    authToken,
    displayName,
    email,
    identities,
    isAuthenticated,
    oidc,
    oidcConfigured,
    resolvedOidcEnabled,
    storageReady,
  ]);

  return <DevAuthContext.Provider value={value}>{children}</DevAuthContext.Provider>;
}

export function useDevAuth() {
  const ctx = useContext(DevAuthContext);
  if (!ctx) {
    throw new Error('useDevAuth must be used inside DevAuthProvider');
  }
  return ctx;
}
