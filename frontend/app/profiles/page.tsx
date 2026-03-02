'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconLogin2, IconLogout2, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useDevAuth } from '@/lib/dev-auth-context';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';
import type { SprygramProfile } from '@/lib/api-types';
import { LoadingState } from '@/components/ui/loading-state';

const SEEDED_PASSWORD = 'sprygram-seed-password';

const SEEDED_USERS = [
  { label: 'Ava Lens', email: 'sprygram.seed.ava@spry.local' },
  { label: 'Milo Rivers', email: 'sprygram.seed.milo@spry.local' },
  { label: 'Zara Bloom', email: 'sprygram.seed.zara@spry.local' },
  { label: 'Noah Wave', email: 'sprygram.seed.noah@spry.local' },
];

export default function ProfilesPage() {
  const {
    isReady,
    identities,
    activeIdentity,
    addIdentity,
    setActiveIdentity,
    removeIdentity,
    displayName,
    email: authEmail,
    isAuthenticated,
    loginWithKeycloak,
    logoutFromKeycloak,
    oidcEnabled,
  } = useDevAuth();
  const auth = useApiAuth();

  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(SEEDED_PASSWORD);
  const [loginLoading, setLoginLoading] = useState(false);
  const [seedLoginEmail, setSeedLoginEmail] = useState<string | null>(null);
  const [me, setMe] = useState<SprygramProfile | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  useEffect(() => {
    if (!auth.token) {
      setMe(null);
      setLoadingMe(false);
      return;
    }

    setLoadingMe(true);
    sprygramApi.getMyProfile(auth)
      .then((profile) => setMe(profile))
      .catch((error: Error) => {
        notifications.show({
          color: 'red',
          title: 'Failed to load profile',
          message: error.message,
        });
        setMe(null);
      })
      .finally(() => setLoadingMe(false));
  }, [auth.token, auth.workspaceId, activeIdentity?.id]);

  const canSubmit = useMemo(() => label.trim() && token.trim(), [label, token]);
  const canPasswordLogin = useMemo(() => email.trim() && password.trim(), [email, password]);

  const loginWithPassword = async (
    loginEmail: string,
    loginPassword: string,
    defaultLabel?: string,
  ) => {
    const response = await sprygramApi.loginWithPassword(loginEmail.trim(), loginPassword);

    if (!response?.accessToken) {
      throw new Error('Login succeeded but no access token was returned');
    }

    addIdentity({
      label: defaultLabel || response.user.displayName || response.user.name || loginEmail,
      token: response.accessToken,
      workspaceId: response.user.lastActiveWorkspaceId || '',
    });
  };

  if (!isReady) {
    return <LoadingState message="Loading profile settings..." />;
  }

  return (
    <Stack gap="md" className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8">
      <Stack gap={4}>
        <Text fw={700} size="xl">Profiles</Text>
        <Text size="sm" c="dimmed">
          {oidcEnabled
            ? 'Your Sprylogin session is connected to Sprygram.'
            : 'Sign in quickly with seeded users, or provide your own development token override.'}
        </Text>
      </Stack>

      {oidcEnabled ? (
        <div className="rounded-xl border border-border bg-panel p-4">
          <Stack gap="sm">
            <Text fw={600} size="sm">Sprylogin session</Text>
            {isAuthenticated ? (
              <Group justify="space-between">
                <Stack gap={0}>
                  <Text size="sm" fw={600}>{displayName || 'Signed in'}</Text>
                  <Text size="xs" c="dimmed">{authEmail}</Text>
                </Stack>
                <Button variant="default" size="xs" leftSection={<IconLogout2 size={14} />} onClick={() => void logoutFromKeycloak()}>
                  Logout
                </Button>
              </Group>
            ) : (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Not authenticated with Sprylogin.</Text>
                <Button size="xs" leftSection={<IconLogin2 size={14} />} onClick={() => void loginWithKeycloak()}>
                  Login with Sprylogin
                </Button>
              </Group>
            )}
          </Stack>
        </div>
      ) : (
        <Alert color="blue" variant="light">
          OIDC redirect is disabled (`NEXT_PUBLIC_AUTH_MODE=dev`). Use seeded login below to work locally.
        </Alert>
      )}

      {!oidcEnabled ? (
        <>
          <div className="rounded-xl border border-border bg-panel p-4">
            <Stack gap="sm">
              <Text fw={600} size="sm">Seeded user quick sign-in</Text>
              <Text size="xs" c="dimmed">
                Uses backend `/api/auth/login` with seeded credentials from `npm run sprygram:seed`.
              </Text>
              <Stack gap={6}>
                {SEEDED_USERS.map((user) => (
                  <Group key={user.email} justify="space-between" align="center">
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>{user.label}</Text>
                      <Text size="xs" c="dimmed">{user.email}</Text>
                    </Stack>
                    <Button
                      size="xs"
                      loading={seedLoginEmail === user.email}
                      onClick={async () => {
                        setSeedLoginEmail(user.email);
                        try {
                          await loginWithPassword(user.email, SEEDED_PASSWORD, user.label);
                          notifications.show({
                            color: 'teal',
                            title: 'Logged in',
                            message: `Using ${user.label}`,
                          });
                        } catch (error: any) {
                          notifications.show({
                            color: 'red',
                            title: 'Login failed',
                            message: error?.message || 'Unable to login with seeded user',
                          });
                        } finally {
                          setSeedLoginEmail(null);
                        }
                      }}
                    >
                      Use this user
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Stack>
          </div>

          <div className="rounded-xl border border-border bg-panel p-4">
            <Stack gap="sm">
              <Text fw={600} size="sm">Manual local login (dev)</Text>
              <TextInput
                label="Email"
                placeholder="sprygram.seed.ava@spry.local"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <PasswordInput
                label="Password"
                placeholder="Enter account password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Creates a local identity override with returned JWT.</Text>
                <Button
                  size="xs"
                  loading={loginLoading}
                  disabled={!canPasswordLogin}
                  onClick={async () => {
                    setLoginLoading(true);
                    try {
                      await loginWithPassword(email, password);
                      notifications.show({ title: 'Logged in', message: 'Local dev identity added', color: 'teal' });
                    } catch (error: any) {
                      notifications.show({ color: 'red', title: 'Login failed', message: error.message });
                    } finally {
                      setLoginLoading(false);
                    }
                  }}
                >
                  Sign in
                </Button>
              </Group>
            </Stack>
          </div>

          <div className="rounded-xl border border-border bg-panel p-4">
            <Stack gap="sm">
              <Text fw={600} size="sm">Optional raw token override</Text>
              <TextInput label="Label" placeholder="Alice Dev" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
              <TextInput label="Access Token" placeholder="Paste bearer token" value={token} onChange={(e) => setToken(e.currentTarget.value)} />
              <TextInput
                label="Workspace ID (optional)"
                placeholder="UUID workspace id"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.currentTarget.value)}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Stored only in local browser storage.</Text>
                <Button
                  size="xs"
                  disabled={!canSubmit}
                  onClick={() => {
                    addIdentity({ label, token, workspaceId });
                    setLabel('');
                    setToken('');
                    setWorkspaceId('');
                    notifications.show({ title: 'Identity added', message: 'Token override saved', color: 'teal' });
                  }}
                >
                  Save Override
                </Button>
              </Group>
            </Stack>
          </div>

          <div className="rounded-xl border border-border bg-panel">
            <Stack gap={0}>
              {identities.length === 0 ? (
                <Text size="sm" c="dimmed" p="md">No local identities added.</Text>
              ) : (
                identities.map((identity, index) => (
                  <div key={identity.id}>
                    <Group justify="space-between" p="md" align="center">
                      <Group>
                        <Avatar radius="xl" size={34}>{identity.label.slice(0, 2).toUpperCase()}</Avatar>
                        <Stack gap={0}>
                          <Group gap={8}>
                            <Text fw={600} size="sm">{identity.label}</Text>
                            {activeIdentity?.id === identity.id ? <Badge size="xs">Active</Badge> : null}
                          </Group>
                          <Text size="xs" c="dimmed">Token: ...{identity.token.slice(-8)}</Text>
                          {identity.workspaceId ? <Text size="xs" c="dimmed">Workspace: {identity.workspaceId}</Text> : null}
                        </Stack>
                      </Group>

                      <Group gap={6}>
                        <ActionIcon
                          variant={activeIdentity?.id === identity.id ? 'filled' : 'light'}
                          color="blue"
                          onClick={() => setActiveIdentity(identity.id)}
                          aria-label={`Use ${identity.label} identity`}
                          title={`Use ${identity.label} identity`}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon color="red" variant="light" onClick={() => removeIdentity(identity.id)} aria-label={`Remove ${identity.label} identity`} title={`Remove ${identity.label} identity`}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    {index < identities.length - 1 ? <Divider /> : null}
                  </div>
                ))
              )}
            </Stack>
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-border bg-panel p-4">
        <Stack gap="xs">
          <Text fw={600} size="sm">Current API identity preview</Text>
          {loadingMe ? (
            <LoadingState message="Loading profile..." />
          ) : me ? (
            <Stack gap={2}>
              <Text size="sm"><b>@{me.username}</b> ({me.displayName || 'No display name'})</Text>
              <Text size="xs" c="dimmed">Followers {me.stats.followers} | Following {me.stats.following} | Posts {me.stats.posts}</Text>
              <Group gap={8} mt={6}>
                <Button component={Link} href="/feed" size="xs" variant="light">Open Feed</Button>
                <Button component={Link} href={`/u/${me.username}`} size="xs" variant="default">View Profile</Button>
              </Group>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">No active API identity yet.</Text>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
