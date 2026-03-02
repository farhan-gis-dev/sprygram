'use client';

import { Alert, Button, Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getOidcRuntimeConfig } from '@/lib/oidc-config';
import { sprygramApi } from '@/lib/api-client';
import { useDevAuth } from '@/lib/dev-auth-context';

const CALLBACK_PATH = '/auth/oidc/callback';
const DEV_AUTO_LOGIN_EMAIL = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL || 'sprygram.seed.ava@spry.local';
const DEV_AUTO_LOGIN_PASSWORD = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN_PASSWORD || 'sprygram-seed-password';

export function SpryLoginGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const redirectStartedRef = useRef(false);
  const devBootstrapRef = useRef(false);
  const [devSessionReady, setDevSessionReady] = useState(false);
  const [devBootstrapError, setDevBootstrapError] = useState<string | null>(null);
  const {
    activeIdentity,
    bootstrapIdentity,
    clearActiveIdentity,
    oidcEnabled,
    oidcConfigured,
    authLoading,
    isAuthenticated,
    authError,
    loginWithKeycloak,
  } = useDevAuth();

  const runtimeConfig = getOidcRuntimeConfig();
  const configuredRedirectUri = runtimeConfig.redirectUri;
  const configuredClientId = runtimeConfig.clientId;
  const isCallbackPath = pathname.startsWith(CALLBACK_PATH);

  useEffect(() => {
    if (oidcEnabled) return;

    if (pathname === '/profiles') {
      devBootstrapRef.current = false;
      setDevSessionReady(true);
      setDevBootstrapError(null);
      return;
    }

    if (isAuthenticated && devSessionReady) {
      devBootstrapRef.current = false;
      return;
    }

    if (devBootstrapRef.current) return;
    devBootstrapRef.current = true;
    setDevSessionReady(false);
    setDevBootstrapError(null);

    const bootstrap = async () => {
      const response = await sprygramApi.loginWithPassword(DEV_AUTO_LOGIN_EMAIL, DEV_AUTO_LOGIN_PASSWORD);

      if (!response?.accessToken) {
        throw new Error('Local dev login succeeded but no access token was returned');
      }

      bootstrapIdentity({
        label: response.user.displayName || response.user.name || DEV_AUTO_LOGIN_EMAIL,
        token: response.accessToken,
        workspaceId: response.user.lastActiveWorkspaceId || '',
      });
      setDevSessionReady(true);
      setDevBootstrapError(null);
      devBootstrapRef.current = false;
    };

    const validateOrBootstrap = async () => {
      try {
        if (activeIdentity?.token) {
          await sprygramApi.getMyProfile({
            token: activeIdentity.token,
            workspaceId: activeIdentity.workspaceId || undefined,
          });
          setDevSessionReady(true);
          setDevBootstrapError(null);
          devBootstrapRef.current = false;
          return;
        }

        await bootstrap();
      } catch (error) {
        clearActiveIdentity();
        try {
          await bootstrap();
        } catch (bootstrapError) {
          devBootstrapRef.current = false;
          setDevSessionReady(false);
          setDevBootstrapError(
            bootstrapError instanceof Error ? bootstrapError.message : 'Unable to prepare local dev session',
          );
          router.replace('/profiles');
        }
      }
    };

    void validateOrBootstrap();
  }, [activeIdentity, bootstrapIdentity, clearActiveIdentity, devSessionReady, isAuthenticated, oidcEnabled, pathname, router]);

  useEffect(() => {
    if (!oidcEnabled) return;
    if (!oidcConfigured) return;
    if (isCallbackPath) return;
    if (pathname === '/profiles') return;
    if (authLoading || isAuthenticated) return;
    if (redirectStartedRef.current) return;

    redirectStartedRef.current = true;

    void loginWithKeycloak().catch(() => {
      redirectStartedRef.current = false;
    });
  }, [authLoading, isAuthenticated, isCallbackPath, loginWithKeycloak, oidcConfigured, oidcEnabled, pathname]);

  if (!oidcEnabled) {
    if (pathname !== '/profiles' && (!isAuthenticated || !devSessionReady)) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
          <div className="mb-8 flex flex-col items-center gap-4">
            <img src="/logo.png" alt="Sprygram" className="h-24 w-24 rounded-[28px] object-cover shadow-[0_16px_48px_rgba(0,0,0,0.14)]" />
            <span className="text-2xl font-extrabold tracking-tight text-[#1a1a1a]">Sprygram</span>
          </div>
          <div className="w-40 overflow-hidden rounded-full bg-gray-100" style={{ height: 3 }}>
            <div
              className="h-full rounded-full bg-[#0095f6]"
              style={{ animation: 'sprygram-loading-bar 1.4s ease-in-out infinite', width: '40%' }}
            />
          </div>
          <Text size="xs" c="dimmed" mt={16}>
            {devBootstrapError ? 'Opening profiles...' : 'Preparing session...'}
          </Text>
          <style>{`
            @keyframes sprygram-loading-bar {
              0%   { transform: translateX(-150%); }
              50%  { transform: translateX(100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </div>
      );
    }

    return <>{children}</>;
  }

  if (isCallbackPath) {
    return <>{children}</>;
  }

  if (pathname === '/profiles') {
    return <>{children}</>;
  }

  if (!oidcConfigured) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Alert color="yellow" maw={440}>
          <div className="flex flex-col gap-1">
            <Text fw={600}>Sprylogin is not configured</Text>
            <Text size="sm">Set `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, and `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` to enable OIDC mode.</Text>
          </div>
        </Alert>
      </div>
    );
  }

  if (authLoading || (!isAuthenticated && !authError)) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img src="/logo.png" alt="Sprygram" className="h-24 w-24 rounded-[28px] object-cover shadow-[0_16px_48px_rgba(0,0,0,0.14)]" />
          <span className="text-2xl font-extrabold tracking-tight text-[#1a1a1a]">Sprygram</span>
        </div>
        <div className="w-40 overflow-hidden rounded-full bg-gray-100" style={{ height: 3 }}>
          <div
            className="h-full rounded-full bg-[#0095f6]"
            style={{ animation: 'sprygram-loading-bar 1.4s ease-in-out infinite', width: '40%' }}
          />
        </div>
        <Text size="xs" c="dimmed" mt={16}>Redirecting to Sprylogin...</Text>
        <style>{`
          @keyframes sprygram-loading-bar {
            0%   { transform: translateX(-150%); }
            50%  { transform: translateX(100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Alert color="red" maw={420}>
          <div className="flex flex-col gap-2">
            <Text fw={600}>Sprylogin authentication failed</Text>
            <Text size="sm">{authError}</Text>
            <Text size="xs" c="dimmed">Client: {configuredClientId}</Text>
            <Text size="xs" c="dimmed">Redirect URI: {configuredRedirectUri}</Text>
            <Button size="xs" onClick={() => void loginWithKeycloak()}>
              Try Sign In Again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
