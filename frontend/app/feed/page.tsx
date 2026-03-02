'use client';

import { Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostCard } from '@/components/post/post-card';
import { FollowRequestsPanel } from '@/components/profile/follow-requests-panel';
import { StoryTray } from '@/components/story/story-tray';
import { StoryViewer } from '@/components/story/story-viewer';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { sprygramApi } from '@/lib/api-client';
import type { SearchAccountResult, SprygramPost, SprygramProfile, StoryTrayItem } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

export default function FeedPage() {
  const router = useRouter();
  const { isReady, activeIdentity } = useDevAuth();
  const auth = useApiAuth();

  const [loading, setLoading] = useState(false);
  const [feed, setFeed] = useState<SprygramPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [me, setMe] = useState<SprygramProfile | null>(null);
  const [storyTray, setStoryTray] = useState<StoryTrayItem[]>([]);
  const [selectedStoryUsername, setSelectedStoryUsername] = useState<string | null>(null);
  const [suggestedAccounts, setSuggestedAccounts] = useState<SearchAccountResult[]>([]);

  const loadFeed = async (cursor?: string | null) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);

    try {
      const response = await sprygramApi.getFeed({ limit: 10, cursor: cursor || undefined }, auth);
      setFeed((prev) => (cursor ? [...prev, ...(response.items || [])] : (response.items || [])));
      setNextCursor(response.nextCursor);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Feed error', message: error.message });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isReady || !auth.token) return;

    loadFeed();

    Promise.all([
      sprygramApi.getMyProfile(auth).catch(() => null),
      sprygramApi.getStoryTray(20, auth).catch(() => ({ items: [] })),
      sprygramApi.searchAccounts('', 8, auth).catch(() => ({ items: [] })),
    ])
      .then(([meProfile, tray, search]) => {
        setMe(meProfile);
        setStoryTray(tray.items || []);
        setSuggestedAccounts((search.items || []).filter((item) => item.userId !== meProfile?.userId).slice(0, 6));
      });
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  const storyRingByUsername = useMemo(() => {
    const map = new Map<string, 'story' | 'viewed'>();
    storyTray.forEach((item) => {
      map.set(item.author.username.toLowerCase(), item.unviewedCount > 0 ? 'story' : 'viewed');
    });
    return map;
  }, [storyTray]);
  const myStoryItem = useMemo(
    () => storyTray.find((item) => item.author.userId === me?.userId) || null,
    [storyTray, me?.userId],
  );

  if (!isReady) return <LoadingState message="Preparing feed..." />;

  return (
    <div className="mx-auto grid w-full max-w-[1060px] grid-cols-1 gap-8 px-6 py-6 lg:grid-cols-[minmax(0,640px)_300px]">
      <section>
        <StoryTray
          items={storyTray}
          onOpen={(username) => setSelectedStoryUsername(username)}
          currentUser={me ? {
            username: me.username,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            hasStories: Boolean(myStoryItem),
            ringTone: myStoryItem ? (myStoryItem.unviewedCount > 0 ? 'story' : 'viewed') : 'none',
          } : null}
          onCreateStory={() => router.push('/create?mode=story')}
          myStoryItems={myStoryItem?.stories || []}
          onDeleteStory={async (storyId) => {
            try {
              await sprygramApi.deleteStory(storyId, auth);
              setStoryTray((prev) =>
                prev
                  .map((item) =>
                    item.author.userId === me?.userId
                      ? { ...item, stories: item.stories.filter((s) => s.id !== storyId), totalCount: Math.max(0, item.totalCount - 1) }
                      : item,
                  )
                  .filter((item) => item.author.userId !== me?.userId || item.stories.length > 0),
              );
            } catch (error: any) {
              notifications.show({ color: 'red', title: 'Delete failed', message: error.message });
            }
          }}
        />

        {loading ? <LoadingState message="Loading feed..." /> : null}

        {!loading && feed.length === 0 ? (
          <EmptyState
            title="No posts in your feed"
            description="Follow more profiles or create your first post to start seeing content."
            actionLabel="Refresh"
            onAction={() => loadFeed()}
          />
        ) : null}

        <Stack gap="md" mt="sm">
          {feed.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              viewer={me}
              storyRingTone={storyRingByUsername.get(post.author.username.toLowerCase()) || 'none'}
              onOpenStory={(username) => setSelectedStoryUsername(username)}
              onPostChange={(next) => {
                setFeed((prev) => prev.map((entry) => (entry.id === next.id ? next : entry)));
              }}
            />
          ))}

          {nextCursor ? (
            <Group justify="center">
              <button
                type="button"
                className="rounded-md border border-border bg-panel px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => loadFeed(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </Group>
          ) : null}
        </Stack>
      </section>

      <aside className="hidden lg:block">
        <Stack gap="md" className="sticky top-5">
          <div className="rounded-xl border border-border bg-panel p-4">
            <Group justify="space-between" mb={8}>
              <Text size="sm" fw={700}>Suggested for you</Text>
              <Text size="xs" c="dimmed">See all</Text>
            </Group>
            <Stack gap="xs">
              {suggestedAccounts.map((account) => (
                <button
                  key={account.userId}
                  type="button"
                  className="w-full rounded-md px-1 py-1 text-left hover:bg-gray-50"
                  onClick={() => router.push(`/u/${encodeURIComponent(account.username)}`)}
                >
                  <Group wrap="nowrap" justify="space-between">
                    <Group wrap="nowrap">
                      <ProfileAvatar size={32} src={account.avatarUrl} name={account.displayName || account.username} />
                      <div>
                        <Text size="xs" fw={700}>{account.username}</Text>
                        <Text size="10px" c="dimmed" lineClamp={1}>{account.displayName || 'Sprygram account'}</Text>
                      </div>
                    </Group>
                    <Text size="xs" c="blue">View</Text>
                  </Group>
                </button>
              ))}
            </Stack>
          </div>

          <FollowRequestsPanel />
        </Stack>
      </aside>

      <StoryViewer
        opened={Boolean(selectedStoryUsername)}
        username={selectedStoryUsername}
        usernames={storyTray.map((item) => item.author.username)}
        onClose={() => setSelectedStoryUsername(null)}
        onAccountCompleted={(username) => {
          setStoryTray((previous) => previous.map((item) => (
            item.author.username.toLowerCase() === username.toLowerCase()
              ? { ...item, unviewedCount: 0 }
              : item
          )));
        }}
      />
    </div>
  );
}
