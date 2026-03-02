export type AuthMode = 'dev' | 'oidc';

const rawMode = (process.env.NEXT_PUBLIC_AUTH_MODE || 'dev').trim().toLowerCase();

export const AUTH_MODE: AuthMode = rawMode === 'oidc' ? 'oidc' : 'dev';

export const isOidcMode = (): boolean => AUTH_MODE === 'oidc';
