'use client';

import {
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconBell,
  IconBookmark,
  IconChevronLeft,
  IconCirclePlus,
  IconFlag3,
  IconHome2,
  IconLogout2,
  IconMenu2,
  IconMessageCircle,
  IconMoon,
  IconMovie,
  IconSearch,
  IconSettings,
  IconSun,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { NotificationItem, SearchAccountResult, SprygramProfile } from '@/lib/api-types';
import { useDevAuth } from '@/lib/dev-auth-context';
import { useApiAuth } from '@/lib/use-api-auth';
import { formatRelativeTime } from '@/lib/time';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

type SearchHistoryItem = Pick<SearchAccountResult, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;

const SIDEBAR_WIDTH = 244;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const CONTENT_LEFT_PADDING = SIDEBAR_WIDTH + 28;
const PANEL_WIDTH = 380;
const SEARCH_HISTORY_KEY = 'sprygram.search.history';
const SEARCH_HISTORY_LIMIT = 12;
const ACTIVE_NAV_CLASS = 'border border-[var(--spry-accent-border)] bg-[var(--spry-accent-soft)] text-[var(--spry-accent)] shadow-sm';
const IDLE_NAV_CLASS = 'text-[var(--spry-nav-text)] hover:bg-[#f7f9fc]';

const routeIsActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const parseSearchHistory = (raw: string | null): SearchHistoryItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SearchHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.username === 'string');
  } catch {
    return [];
  }
};

const persistSearchHistory = (items: SearchHistoryItem[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
};

export function NavShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useApiAuth();
  const {
    activeIdentity,
    clearActiveIdentity,
    displayName,
    isAuthenticated,
    logoutFromKeycloak,
    oidcEnabled,
  } = useDevAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const [me, setMe] = useState<SprygramProfile | null>(null);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchAccountResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const panelMode = searchOpen || notificationsOpen;
  const sidebarExpanded = sidebarPinned || panelMode;
  const currentSidebarWidth = sidebarExpanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
  const isCallbackPath = pathname.startsWith('/auth/oidc/callback');

  const closePanels = () => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  };

  const navigateTo = (href: string) => {
    closePanels();
    router.push(href);
  };

  useEffect(() => {
    if (!auth.token) {
      setMe(null);
      return;
    }

    if (isCallbackPath) {
      setMe(null);
      return;
    }

    sprygramApi.getMyProfile(auth)
      .then((profile) => setMe(profile))
      .catch(() => setMe(null));
  }, [auth.token, auth.workspaceId, activeIdentity?.id, isCallbackPath]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSearchHistory(parseSearchHistory(window.localStorage.getItem(SEARCH_HISTORY_KEY)));
  }, []);

  useEffect(() => {
    if (!auth.token) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    if (!searchOpen) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await sprygramApi.searchAccounts(trimmed, 20, auth);
        if (!cancelled) {
          setSearchResults(response.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchError(error instanceof Error ? error.message : 'Search is unavailable right now');
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery, auth.token, auth.workspaceId, activeIdentity?.id]);

  useEffect(() => {
    if (!auth.token) {
      setNotificationItems([]);
      setNotificationsLoading(false);
      setNotificationsError(null);
      return;
    }

    let cancelled = false;
    const fetchNotifications = async (showSpinner: boolean) => {
      if (showSpinner) setNotificationsLoading(true);
      setNotificationsError(null);

      try {
        const response = await sprygramApi.getNotifications({ limit: 40 }, auth);
        if (!cancelled) setNotificationItems(response.items || []);
      } catch (error) {
        if (!cancelled) {
          setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications');
        }
      } finally {
        if (!cancelled && showSpinner) setNotificationsLoading(false);
      }
    };

    void fetchNotifications(notificationsOpen);

    const interval = window.setInterval(() => {
      void fetchNotifications(false);
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [notificationsOpen, auth.token, auth.workspaceId, activeIdentity?.id]);

  const openProfile = () => {
    closePanels();
    if (me?.username) {
      router.push(`/u/${encodeURIComponent(me.username)}`);
      return;
    }
    router.push('/profiles');
  };

  const logout = () => {
    if (oidcEnabled && isAuthenticated) {
      void logoutFromKeycloak();
      return;
    }

    clearActiveIdentity();

    notifications.show({
      color: 'blue',
      title: 'Signed out',
      message: 'Select another profile identity to continue.',
    });

    router.push('/profiles');
  };

  const reportProblem = async () => {
    const snapshot = {
      route: pathname,
      username: me?.username || null,
      generatedAt: new Date().toISOString(),
    };

    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    notifications.show({
      color: 'teal',
      title: 'Problem details copied',
      message: 'Open Settings > Help and diagnostics to continue your report.',
    });
    closePanels();
    router.push('/settings#help-diagnostics');
  };

  const openSearch = () => {
    setSearchOpen((previous) => !previous);
    setNotificationsOpen(false);
  };

  const openNotifications = () => {
    setNotificationsOpen((previous) => !previous);
    setSearchOpen(false);
  };

  const selectSearchResult = (result: SearchHistoryItem) => {
    const deduped = [
      result,
      ...searchHistory.filter((entry) => entry.username.toLowerCase() !== result.username.toLowerCase()),
    ].slice(0, SEARCH_HISTORY_LIMIT);

    setSearchHistory(deduped);
    persistSearchHistory(deduped);
    setSearchOpen(false);
    setSearchQuery('');
    router.push(`/u/${encodeURIComponent(result.username)}`);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    persistSearchHistory([]);
  };

  const unreadNotifications = useMemo(
    () => notificationItems.filter((item) => !item.isRead).length,
    [notificationItems],
  );

  const identityName = me?.displayName || activeIdentity?.label || displayName || 'Spry user';
  const identityHandle = me?.username ? `@${me.username}` : 'Open profile';

  if (isCallbackPath) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <aside
        className="fixed inset-y-0 left-0 z-30 border-r border-border bg-panel px-3 py-5 transition-[width] duration-200 ease-out"
        style={{ width: currentSidebarWidth }}
      >
        <Stack h="100%" justify="space-between" gap="xl">
          <Stack gap="lg">
            <div className={`flex h-10 items-center ${sidebarExpanded ? 'justify-between px-2' : 'justify-center'}`}>
              {sidebarExpanded ? (
                <>
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Sprygram" className="h-8 w-8 rounded-xl object-cover" />
                    <Text fw={800} size="xl" className="tracking-tight">Sprygram</Text>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-1 hover:bg-gray-100"
                    onClick={() => setSidebarPinned(false)}
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                  >
                    <IconChevronLeft size={18} stroke={2} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="rounded-lg p-1 hover:bg-gray-100"
                  onClick={() => setSidebarPinned(true)}
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                >
                  <img src="/logo.png" alt="Sprygram" className="h-8 w-8 rounded-xl object-cover" />
                </button>
              )}
            </div>

            <Stack gap={4}>
              <Link
                href="/feed"
                onClick={closePanels}
                prefetch={false}
                title="Home"
                aria-label="Home"
                className={`flex h-12 items-center rounded-lg py-2.5 ${sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'} ${(!panelMode && routeIsActive(pathname, '/feed')) ? ACTIVE_NAV_CLASS : IDLE_NAV_CLASS}`}
              >
                <IconHome2 size={22} stroke={(!panelMode && routeIsActive(pathname, '/feed')) ? 2.3 : 1.9} />
                {sidebarExpanded ? <Text size="sm" fw={(!panelMode && routeIsActive(pathname, '/feed')) ? 700 : 500}>Home</Text> : null}
              </Link>

              <Link
                href="/reels"
                onClick={closePanels}
                prefetch={false}
                title="Reels"
                aria-label="Reels"
                className={`flex h-12 items-center rounded-lg py-2.5 ${sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'} ${(!panelMode && routeIsActive(pathname, '/reels')) ? ACTIVE_NAV_CLASS : IDLE_NAV_CLASS}`}
              >
                <IconMovie size={22} stroke={(!panelMode && routeIsActive(pathname, '/reels')) ? 2.3 : 1.9} />
                {sidebarExpanded ? <Text size="sm" fw={(!panelMode && routeIsActive(pathname, '/reels')) ? 700 : 500}>Reels</Text> : null}
              </Link>

              <Link
                href="/messages"
                onClick={closePanels}
                prefetch={false}
                title="Messages"
                aria-label="Messages"
                className={`flex h-12 items-center rounded-lg py-2.5 ${sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'} ${(!panelMode && routeIsActive(pathname, '/messages')) ? ACTIVE_NAV_CLASS : IDLE_NAV_CLASS}`}
              >
                <IconMessageCircle size={22} stroke={(!panelMode && routeIsActive(pathname, '/messages')) ? 2.3 : 1.9} />
                {sidebarExpanded ? <Text size="sm" fw={(!panelMode && routeIsActive(pathname, '/messages')) ? 700 : 500}>Messages</Text> : null}
              </Link>

              <button
                type="button"
                onClick={openSearch}
                title="Search"
                aria-label="Search"
                className={`flex h-12 w-full items-center rounded-lg py-2.5 text-left ${sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'} ${searchOpen ? ACTIVE_NAV_CLASS : IDLE_NAV_CLASS}`}
              >
                <IconSearch size={22} stroke={searchOpen ? 2.3 : 1.9} />
                {sidebarExpanded ? <Text size="sm" fw={searchOpen ? 700 : 500}>Search</Text> : null}
              </button>

              <button
                type="button"
                onClick={openNotifications}
                title="Notifications"
                aria-label="Notifications"
                className={`flex h-12 w-full items-center rounded-lg py-2.5 text-left ${sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'} ${notificationsOpen ? ACTIVE_NAV_CLASS : IDLE_NAV_CLASS}`}
              >
                <div className="relative">
                  <IconBell size={22} stroke={notificationsOpen ? 2.3 : 1.9} />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3040] px-1 text-[10px] font-bold text-white">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  ) : null}
                </div>
                {sidebarExpanded ? <Text size="sm" fw={notificationsOpen ? 700 : 500}>Notifications</Text> : null}
              </button>

              <Link
                href="/create"
                onClick={closePanels}
                prefetch={false}
                title="Create"
                aria-label="Create"
                className={`flex h-12 items-center rounded-lg py-2.5 ${sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'} ${(!panelMode && routeIsActive(pathname, '/create')) ? ACTIVE_NAV_CLASS : IDLE_NAV_CLASS}`}
              >
                <IconCirclePlus size={22} stroke={(!panelMode && routeIsActive(pathname, '/create')) ? 2.3 : 1.9} />
                {sidebarExpanded ? <Text size="sm" fw={(!panelMode && routeIsActive(pathname, '/create')) ? 700 : 500}>Create</Text> : null}
              </Link>

              <Menu width={250} shadow="md" withArrow>
                <Menu.Target>
                  <button
                    type="button"
                    title="More"
                    aria-label="More"
                    className={`flex h-12 w-full items-center rounded-lg py-2.5 text-left ${
                      sidebarExpanded ? 'gap-3 px-3 justify-start' : 'justify-center px-0'
                    } ${
                      !panelMode && (routeIsActive(pathname, '/settings') || routeIsActive(pathname, '/activity') || routeIsActive(pathname, '/saved'))
                        ? ACTIVE_NAV_CLASS
                        : IDLE_NAV_CLASS
                    }`}
                  >
                    <IconMenu2 size={22} />
                    {sidebarExpanded ? <Text size="sm" fw={500}>More</Text> : null}
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => navigateTo('/settings')}>Settings</Menu.Item>
                  <Menu.Item leftSection={<IconActivity size={16} />} onClick={() => navigateTo('/activity')}>Your Activity</Menu.Item>
                  <Menu.Item leftSection={<IconBookmark size={16} />} onClick={() => navigateTo('/saved')}>Saved</Menu.Item>
                  <Menu.Item
                    leftSection={colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
                    onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                  >
                    {colorScheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFlag3 size={16} />}
                    onClick={() => void reportProblem()}
                  >
                    Report a Problem
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconLogout2 size={16} />} color="red" onClick={logout}>Log Out</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Stack>
          </Stack>

          <div>
            <button
              type="button"
              onClick={() => void openProfile()}
              title="Open profile"
              aria-label="Open profile"
              className={`w-full transition hover:border-border hover:bg-gray-50 ${
                sidebarExpanded
                  ? 'rounded-xl border border-border/80 bg-canvas px-2 py-2 text-left'
                  : 'flex h-12 items-center justify-center rounded-full border border-transparent bg-transparent'
              }`}
            >
              {sidebarExpanded ? (
                <Group gap={10} wrap="nowrap">
                  <ProfileAvatar size={36} src={me?.avatarUrl} name={me?.displayName || me?.username || 'Me'} />
                  <Stack gap={0} className="min-w-0">
                    <Text size="sm" fw={700} lineClamp={1}>{identityName}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{identityHandle}</Text>
                  </Stack>
                </Group>
              ) : (
                <ProfileAvatar size={32} src={me?.avatarUrl} name={me?.displayName || me?.username || 'Me'} />
              )}
            </button>
            {sidebarExpanded ? (
              <button
                type="button"
                onClick={logout}
                className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#d9485f] transition hover:bg-[#fff1f2]"
              >
                Log Out
              </button>
            ) : null}
          </div>
        </Stack>
      </aside>

      {searchOpen ? (
        <section
          className="fixed inset-y-0 z-40 border-r border-border bg-panel"
          style={{ left: currentSidebarWidth, width: PANEL_WIDTH }}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-4">
              <Group justify="space-between">
                <Text fw={700} size="xl">Search</Text>
                <button type="button" className="rounded-md p-1 hover:bg-gray-100" onClick={() => setSearchOpen(false)} aria-label="Close search panel" title="Close search panel">
                  <IconX size={18} />
                </button>
              </Group>
              <TextInput
                mt="sm"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="Search"
                leftSection={<IconSearch size={16} />}
              />
            </div>

            <div className="hide-scrollbar flex-1 overflow-y-auto p-3">
              {searchQuery.trim() ? (
                <>
                  {searchLoading ? <Text size="sm" c="dimmed" px={8} py={8}>Searching...</Text> : null}
                  {searchError ? <Text size="sm" c="red" px={8} py={8}>{searchError}</Text> : null}
                  {!searchLoading && !searchError && searchResults.length === 0 ? (
                    <Text size="sm" c="dimmed" px={8} py={8}>No matching accounts.</Text>
                  ) : null}
                  <Stack gap={2}>
                    {searchResults.map((result) => (
                      <button
                        key={result.userId}
                        type="button"
                        className="w-full rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                        onClick={() => selectSearchResult(result)}
                      >
                        <Group wrap="nowrap">
                          <ProfileAvatar size={38} src={result.avatarUrl} name={result.displayName || result.username} />
                          <Stack gap={0} className="min-w-0">
                            <Text size="sm" fw={700} lineClamp={1}>{result.username}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{result.displayName || 'Sprygram user'}</Text>
                          </Stack>
                        </Group>
                      </button>
                    ))}
                  </Stack>
                </>
              ) : (
                <>
                  <Group justify="space-between" mb="xs" px={6}>
                    <Text size="xs" fw={700} c="dimmed">Recent</Text>
                    {searchHistory.length > 0 ? (
                      <button type="button" className="text-xs font-semibold text-[#0095f6]" onClick={clearSearchHistory}>Clear all</button>
                    ) : null}
                  </Group>
                  {searchHistory.length === 0 ? (
                    <Text size="sm" c="dimmed" px={8} py={8}>No recent searches.</Text>
                  ) : (
                    <Stack gap={2}>
                      {searchHistory.map((entry) => (
                        <button
                          key={`${entry.userId}-${entry.username}`}
                          type="button"
                          className="w-full rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                          onClick={() => selectSearchResult(entry)}
                        >
                          <Group wrap="nowrap">
                            <ProfileAvatar size={38} src={entry.avatarUrl} name={entry.displayName || entry.username} />
                            <Stack gap={0} className="min-w-0">
                              <Text size="sm" fw={700} lineClamp={1}>{entry.username}</Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>{entry.displayName || 'Sprygram user'}</Text>
                            </Stack>
                          </Group>
                        </button>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {notificationsOpen ? (
        <section
          className="fixed inset-y-0 z-40 border-r border-border bg-panel"
          style={{ left: currentSidebarWidth, width: PANEL_WIDTH }}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-4">
              <Group justify="space-between">
                <Text fw={700} size="xl">Notifications</Text>
                <button type="button" className="rounded-md p-1 hover:bg-gray-100" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications panel" title="Close notifications panel">
                  <IconX size={18} />
                </button>
              </Group>
              <Group justify="space-between" mt={8}>
                <Text size="xs" c="dimmed">Recent account activity</Text>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#0095f6]"
                  onClick={async () => {
                    await sprygramApi.markNotificationsReadAll(auth);
                    setNotificationItems((previous) => previous.map((entry) => ({ ...entry, isRead: true })));
                  }}
                >
                  Mark all as read
                </button>
              </Group>
            </div>

            <div className="hide-scrollbar flex-1 overflow-y-auto p-3">
              {notificationsLoading ? <Text size="sm" c="dimmed" px={8} py={8}>Loading notifications...</Text> : null}
              {notificationsError ? <Text size="sm" c="red" px={8} py={8}>{notificationsError}</Text> : null}
              {!notificationsLoading && !notificationsError && notificationItems.length === 0 ? (
                <Text size="sm" c="dimmed" px={8} py={8}>No notifications yet.</Text>
              ) : null}

              <Stack gap={2}>
                {notificationItems.map((item) => (
                  <div key={item.id} className={`rounded-lg px-2 py-2 ${item.isRead ? '' : 'bg-[#f5f8ff]'}`}>
                    <Group wrap="nowrap" align="flex-start">
                      <ProfileAvatar size={36} src={item.actor?.avatarUrl} name={item.actor?.displayName || item.actor?.username || 'Sprygram'} />
                      <Stack gap={1} className="min-w-0">
                        <Text size="sm" lineClamp={2}>
                          <span className="font-semibold">{item.actor?.username || 'Sprygram'}</span>{' '}
                          {item.previewText || item.type.replace('_', ' ')}
                        </Text>
                        <Text size="xs" c="dimmed">{formatRelativeTime(item.createdAt)}</Text>
                      </Stack>
                    </Group>
                  </div>
                ))}
              </Stack>
            </div>
          </div>
        </section>
      ) : null}

      <div style={{ paddingLeft: CONTENT_LEFT_PADDING }} className="min-h-screen">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
