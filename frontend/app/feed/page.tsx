'use client';

import { Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { PostCard } from '@/components/post/post-card';
import { FollowRequestsPanel } from '@/components/profile/follow-requests-panel';
import { StoryViewer } from '@/components/story/story-viewer';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { sprygramApi } from '@/lib/api-client';
import type { LiveRoomView, SearchAccountResult, SprySnapPost, SprySnapProfile, StoryTrayItem } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { AdCard, AD_INJECTION_INTERVAL } from '@/components/ads/ad-card';

export default function FeedPage() {
  const router = useRouter();
  const { isReady, activeIdentity } = useDevAuth();
  const auth = useApiAuth();

  const [loading, setLoading] = useState(false);
  const [feed, setFeed] = useState<SprySnapPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [me, setMe] = useState<SprySnapProfile | null>(null);
  const [storyTray, setStoryTray] = useState<StoryTrayItem[]>([]);
  const [selectedStoryUsername, setSelectedStoryUsername] = useState<string | null>(null);
  const [suggestedAccounts, setSuggestedAccounts] = useState<SearchAccountResult[]>([]);
  const [liveRooms, setLiveRooms] = useState<LiveRoomView[]>([]);

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
      sprygramApi.getLiveRooms(auth).catch(() => ({ items: [] })),
    ])
      .then(([meProfile, tray, search, live]) => {
        setMe(meProfile);
        setStoryTray(tray.items || []);
        setSuggestedAccounts((search.items || []).filter((item) => item.userId !== meProfile?.userId).slice(0, 6));
        setLiveRooms((live.items || []).filter((r: LiveRoomView) => r.status === 'live').slice(0, 10));
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
        {/* Story tray — live rooms integrated as first items */}
        <div className="mb-4">
          <div className="hide-scrollbar overflow-x-auto pb-2">
            <div className="flex min-w-max items-start gap-4">
              {/* Live rooms first in the same row */}
              {liveRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => router.push(`/live/${room.id}`)}
                  className="relative flex w-[76px] flex-col items-center gap-2 text-center"
                >
                  <div className="relative">
                    <div className="h-[68px] w-[68px] overflow-hidden rounded-full ring-2 ring-red-500 ring-offset-2 ring-offset-canvas">
                      <ProfileAvatar size={68} src={room.hostAvatarUrl} name={room.hostUsername} />
                    </div>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">LIVE</span>
                  </div>
                  <Text size="xs" lineClamp={1}>{room.hostUsername}</Text>
                </button>
              ))}
              {/* Story tray items directly in the same flex row */}
              {me ? (
                <div className="relative flex w-[76px] flex-col items-center gap-2 text-center">
                  <button
                    type="button"
                    className="relative"
                    onClick={() => myStoryItem ? setSelectedStoryUsername(me.username) : router.push('/create?mode=story')}
                  >
                    <ProfileAvatar
                      size={68}
                      src={me.avatarUrl}
                      name={me.displayName || me.username}
                      ringTone={myStoryItem ? (myStoryItem.unviewedCount > 0 ? 'story' : 'viewed') : 'none'}
                    />
                    <span
                      role="button"
                      tabIndex={0}
                      className="absolute bottom-0 right-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#0095f6] text-white shadow-sm hover:bg-[#0077cc]"
                      onClick={(e) => { e.stopPropagation(); router.push('/create?mode=story'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); router.push('/create?mode=story'); } }}
                      aria-label="Add story"
                    >
                      <span className="text-[10px] font-bold leading-none">+</span>
                    </span>
                  </button>
                  <Text size="xs" lineClamp={1}>Your story</Text>
                </div>
              ) : null}
              {storyTray
                .filter((item) => item.author.userId !== me?.userId)
                .map((item) => (
                  <button
                    key={item.author.userId}
                    type="button"
                    className="flex w-[76px] flex-col items-center gap-2 text-center"
                    onClick={() => setSelectedStoryUsername(item.author.username)}
                  >
                    <ProfileAvatar
                      size={68}
                      src={item.author.avatarUrl}
                      name={item.author.displayName || item.author.username}
                      ringTone={item.unviewedCount > 0 ? 'story' : 'viewed'}
                    />
                    <Text size="xs" lineClamp={1}>{item.author.username}</Text>
                  </button>
                ))}
            </div>
          </div>
        </div>

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
          {feed.map((post, index) => (
            <React.Fragment key={post.id}>
              <PostCard
                post={post}
                viewer={me}
                storyRingTone={storyRingByUsername.get(post.author.username.toLowerCase()) || 'none'}
                onOpenStory={(username) => setSelectedStoryUsername(username)}
                onPostChange={(next) => {
                  setFeed((prev) => prev.map((entry) => (entry.id === next.id ? next : entry)));
                }}
              />
              {/* Inject ad every AD_INJECTION_INTERVAL posts */}
              {(index + 1) % AD_INJECTION_INTERVAL === 0 ? <AdCard key={`ad-${index}`} /> : null}
            </React.Fragment>
          ))}

          {nextCursor ? (
            <Group justify="center">
              <button
                type="button"
                className="rounded-md border border-border bg-panel px-4 py-2 text-sm hover:bg-hover"
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
                  className="w-full rounded-md px-1 py-1 text-left hover:bg-hover"
                  onClick={() => router.push(`/u/${encodeURIComponent(account.username)}`)}
                >
                  <Group wrap="nowrap" justify="space-between">
                    <Group wrap="nowrap">
                      <ProfileAvatar size={32} src={account.avatarUrl} name={account.displayName || account.username} />
                      <div>
                        <Text size="xs" fw={700}>{account.username}</Text>
                        <Text size="10px" c="dimmed" lineClamp={1}>{account.displayName || 'Sprysnap account'}</Text>
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
        viewerUserId={me?.userId}
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
