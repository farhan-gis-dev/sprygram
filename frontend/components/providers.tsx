'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Suspense, useEffect, useMemo } from 'react';
import { SpryAuthProvider } from 'spry-apps-dropdown';
import { DevAuthProvider } from '@/lib/dev-auth-context';
import { NavShell } from '@/components/navigation/nav-shell';
import { buildOidcConfig, cleanupOidcRedirectState, matchSignoutCallback } from '@/lib/oidc-config';
import { SpryLoginGuard } from '@/components/auth/sprylogin-guard';
import { RouteProgress } from '@/components/ui/route-progress';

export function Providers({ children }: { children: React.ReactNode }) {
  const oidcConfig = useMemo(() => buildOidcConfig(), []);
  const { onSigninCallback, ...oidcSettings } = oidcConfig;

  useEffect(() => {
    cleanupOidcRedirectState();
  }, []);

  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        primaryColor: 'blue',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      <Notifications position="top-right" />
      <Suspense>
        <RouteProgress />
      </Suspense>
      <SpryAuthProvider
        config={oidcSettings}
        onSigninCallback={onSigninCallback}
        matchSignoutCallback={matchSignoutCallback}
      >
        <DevAuthProvider>
          <SpryLoginGuard>
            <NavShell>{children}</NavShell>
          </SpryLoginGuard>
        </DevAuthProvider>
      </SpryAuthProvider>
    </MantineProvider>
  );
}
