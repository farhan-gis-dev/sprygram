'use client';

import { Group, Stack, Tabs, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { sprygramApi } from '@/lib/api-client';
import type { ActivityItem } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/time';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';

const TABS = ['likes', 'comments', 'story_replies', 'reviews'] as const;
type ActivityTab = (typeof TABS)[number];

const TAB_LABELS: Record<ActivityTab, string> = {
  likes: 'Likes',
  comments: 'Comments',
  story_replies: 'Story Replies',
  reviews: 'Reviews',
};

export default function ActivityPage() {
  const auth = useApiAuth();
  const { isReady, activeIdentity } = useDevAuth();
  const [tab, setTab] = useState<ActivityTab>('likes');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (cursor?: string | null) => {
    setLoading(true);
    try {
      const response = await sprygramApi.getActivity(tab, { limit: 20, cursor: cursor || undefined }, auth);
      setItems((previous) => (cursor ? [...previous, ...(response.items || [])] : (response.items || [])));
      setNextCursor(response.nextCursor);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Activity error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !auth.token) return;
    void load();
  }, [isReady, tab, activeIdentity?.id, auth.token, auth.workspaceId]);

  if (!isReady) return <LoadingState message="Loading activity..." />;

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 py-6">
      <Stack gap="md">
        <Text fw={800} size="xl">Your Activity</Text>

        <Tabs value={tab} onChange={(value) => setTab((value as ActivityTab) || 'likes')}>
          <Tabs.List>
            {TABS.map((entry) => (
              <Tabs.Tab value={entry} key={entry}>{TAB_LABELS[entry]}</Tabs.Tab>
            ))}
          </Tabs.List>

          <Tabs.Panel value={tab} pt="md">
            {loading && items.length === 0 ? <LoadingState message="Loading activity..." /> : null}

            {!loading && items.length === 0 ? (
              <EmptyState
                title={`No ${TAB_LABELS[tab].toLowerCase()} yet`}
                description={`When you interact with content, your ${TAB_LABELS[tab].toLowerCase()} activity appears here.`}
              />
            ) : (
              <Stack gap="sm">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-panel p-4">
                    <Text size="xs" c="dimmed">{formatRelativeTime(item.createdAt)}</Text>
                    {item.tab === 'likes' ? (
                      <Text size="sm" mt={4}>You liked a post.</Text>
                    ) : null}
                    {item.tab === 'comments' ? (
                      <Text size="sm" mt={4}>You commented: {String(item.payload?.content || '')}</Text>
                    ) : null}
                    {item.tab === 'story_replies' ? (
                      <Text size="sm" mt={4}>Story reply sent to {String((item.payload?.receiver as any)?.username || 'user')}.</Text>
                    ) : null}
                    {item.tab === 'reviews' ? (
                      <Text size="sm" mt={4}>No review items yet.</Text>
                    ) : null}
                  </div>
                ))}

                {nextCursor ? (
                  <Group justify="center">
                    <button
                      type="button"
                      className="rounded-md border border-border px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => void load(nextCursor)}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Load more'}
                    </button>
                  </Group>
                ) : null}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </div>
  );
}
