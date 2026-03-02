'use client';

import { Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FollowRequestsPanel } from '@/components/profile/follow-requests-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { sprygramApi } from '@/lib/api-client';
import type { NotificationItem } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/time';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

export default function NotificationsPage() {
  const auth = useApiAuth();
  const router = useRouter();
  const { isReady, activeIdentity } = useDevAuth();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = async (cursor?: string | null) => {
    if (!cursor) setLoading(true);
    try {
      const response = await sprygramApi.getNotifications({ limit: 30, cursor: cursor || undefined }, auth);
      setItems((previous) => (cursor ? [...previous, ...(response.items || [])] : (response.items || [])));
      setNextCursor(response.nextCursor);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Notifications error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !auth.token) return;
    void load();
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  if (!isReady || loading) return <LoadingState message="Loading notifications..." />;

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 py-6">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={800} size="xl">Notifications</Text>
          <button
            type="button"
            className="text-sm font-semibold text-[#0095f6]"
            onClick={async () => {
              await sprygramApi.markNotificationsReadAll(auth);
              setItems((previous) => previous.map((entry) => ({ ...entry, isRead: true })));
            }}
          >
            Mark all as read
          </button>
        </Group>

        <FollowRequestsPanel />

        {items.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="Likes, comments, follows, and messages will appear here."
          />
        ) : (
          <Stack gap="xs">
            {items.map((item) => {
              const isPostLinked = (item.type === 'comment' || item.type === 'like') && item.entityId;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border border-border bg-panel p-3 ${item.isRead ? '' : 'border-[#dbeafe] bg-[#f8fbff]'} ${isPostLinked ? 'cursor-pointer transition hover:bg-gray-50' : ''}`}
                  onClick={isPostLinked ? () => router.push(`/p/${item.entityId}`) : undefined}
                >
                  <Group wrap="nowrap" align="flex-start">
                    <button
                      type="button"
                      className="shrink-0"
                      onClick={(e) => { e.stopPropagation(); if (item.actor?.username) router.push(`/u/${item.actor.username}`); }}
                      aria-label={`View ${item.actor?.username ?? 'account'}'s profile`}
                    >
                      <ProfileAvatar size={38} src={item.actor?.avatarUrl} name={item.actor?.displayName || item.actor?.username || 'Sprygram'} />
                    </button>
                    <Stack gap={1} className="min-w-0">
                      <Text size="sm" lineClamp={2}>
                        <button
                          type="button"
                          className="font-semibold hover:underline"
                          onClick={(e) => { e.stopPropagation(); if (item.actor?.username) router.push(`/u/${item.actor.username}`); }}
                        >
                          {item.actor?.username || 'Sprygram'}
                        </button>{' '}
                        {item.previewText || item.type.replace('_', ' ')}
                      </Text>
                      <Text size="xs" c="dimmed">{formatRelativeTime(item.createdAt)}</Text>
                    </Stack>
                  </Group>
                </div>
              );
            })}

            {nextCursor ? (
              <Group justify="center">
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => void load(nextCursor)}
                >
                  Load more
                </button>
              </Group>
            ) : null}
          </Stack>
        )}
      </Stack>
    </div>
  );
}
