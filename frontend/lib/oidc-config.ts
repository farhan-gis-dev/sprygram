import { WebStorageStateStore } from 'oidc-client-ts';

const CALLBACK_PATH = '/auth/oidc/callback';
const DEFAULT_APP_URL = 'http://localhost:5177';
const DEFAULT_KEYCLOAK_URL = 'https://auth.sprylogin.com';
const DEFAULT_KEYCLOAK_REALM = 'sprylogin';
const DEFAULT_CLIENT_ID = 'sprygram-spa';
const DEFAULT_SCOPE = 'openid profile email';

const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';
const normalizeUrl = (value: string) => value.replace(/\/+$/, '');

export const getOidcRuntimeConfig = () => {
  const isBrowser = typeof window !== 'undefined';
  const appUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_APP_URL || (isBrowser ? window.location.origin : DEFAULT_APP_URL),
  );
  const origin = isBrowser ? window.location.origin : appUrl;
  const keycloakUrl = normalizeUrl(process.env.NEXT_PUBLIC_KEYCLOAK_URL || DEFAULT_KEYCLOAK_URL);
  const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || DEFAULT_KEYCLOAK_REALM;
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || DEFAULT_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI || `${appUrl}${CALLBACK_PATH}`;
  const postLogoutRedirectUri = process.env.NEXT_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI || appUrl;
  const scope = process.env.NEXT_PUBLIC_OIDC_SCOPE || DEFAULT_SCOPE;
  const webStorage = isBrowser ? new WebStorageStateStore({ store: window.localStorage }) : undefined;

  return {
    isBrowser,
    origin,
    appUrl,
    keycloakUrl,
    keycloakRealm,
    clientId,
    redirectUri,
    postLogoutRedirectUri,
    scope,
    authority: `${keycloakUrl}/realms/${keycloakRealm}`,
    userStore: webStorage,
    stateStore: webStorage,
  };
};

export const isOidcConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_KEYCLOAK_URL
    && process.env.NEXT_PUBLIC_KEYCLOAK_REALM
    && process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  );

const getPostLoginRedirect = (origin: string) => {
  if (typeof window === 'undefined') {
    return '/';
  }

  try {
    const saved = window.sessionStorage.getItem('post_login_redirect');
    if (saved) {
      window.sessionStorage.removeItem('post_login_redirect');

      try {
        const resolved = new URL(saved, origin);
        if (
          resolved.origin === origin
          && normalizePath(resolved.pathname) !== CALLBACK_PATH
        ) {
          return resolved.href;
        }
      } catch {
        return '/';
      }
    }
  } catch {
    return '/';
  }

  return '/';
};

export const cleanupOidcRedirectState = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === CALLBACK_PATH) {
    return;
  }

  try {
    window.localStorage.removeItem('spry_add_account_in_progress');
    window.localStorage.removeItem('spry_add_account_pending');
  } catch {
    // Ignore storage failures.
  }
};

export const matchSignoutCallback = (settings: { post_logout_redirect_uri?: string; redirect_uri?: string }) => {
  if (typeof window === 'undefined') {
    return false;
  }

  const target = settings.post_logout_redirect_uri || settings.redirect_uri;
  if (!target || !window.location.href.startsWith(target)) {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('state')) && !params.get('code');
};

export const buildOidcConfig = () => {
  const runtime = getOidcRuntimeConfig();

  return {
    authority: runtime.authority,
    client_id: runtime.clientId,
    redirect_uri: runtime.redirectUri,
    post_logout_redirect_uri: runtime.postLogoutRedirectUri,
    response_type: 'code',
    scope: runtime.scope,
    automaticSilentRenew: true,
    useRefreshTokens: true,
    loadUserInfo: true,
    userStore: runtime.userStore,
    stateStore: runtime.stateStore,
    onSigninCallback: () => {
      if (typeof window === 'undefined') {
        return;
      }

      if (window.localStorage.getItem('spry_add_account_in_progress') === 'true') {
        try {
          window.localStorage.removeItem('spry:login-in-progress');
          window.localStorage.setItem('spry:last-callback', String(Date.now()));
          window.localStorage.setItem('spry:last-callback-success', 'true');
          window.sessionStorage.removeItem('spry:auth-error');
        } catch {
          // Ignore storage failures.
        }

        return;
      }

      try {
        window.localStorage.removeItem('spry:login-in-progress');
        window.localStorage.setItem('spry:last-callback', String(Date.now()));
        window.localStorage.setItem('spry:last-callback-success', 'true');
        window.sessionStorage.removeItem('spry:auth-error');
      } catch {
        // Ignore storage failures.
      }

      window.location.replace(getPostLoginRedirect(runtime.origin));
    },
  };
};
