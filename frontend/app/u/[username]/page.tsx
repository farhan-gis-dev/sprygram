'use client';

import {
  ActionIcon,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconGridDots,
  IconLock,
  IconMessage,
  IconPlayerPlay,
  IconSettings,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FollowButton } from '@/components/profile/follow-button';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { sprygramApi } from '@/lib/api-client';
import type { SprygramPost, SprygramProfile } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';

function StatPill({ value, label }: { value: number; label: string }) {
  const fmt =
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1_000
        ? `${(value / 1_000).toFixed(1)}K`
        : String(value);
  return (
    <Stack align="center" gap={0}>
      <Text fw={800} size="lg" lh={1.2}>{fmt}</Text>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
    </Stack>
  );
}

function PostThumbnail({ post, onClick }: { post: SprygramPost; onClick: () => void }) {
  const firstMedia = post.media?.[0];
  const isVideo = firstMedia?.mediaType === 'video';
  const hasMultiple = (post.media?.length ?? 0) > 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square w-full overflow-hidden rounded-[4px] bg-[#f0f2f5] focus:outline-none"
    >
      {firstMedia ? (
        isVideo ? (
          <video src={firstMedia.url} className="h-full w-full object-cover" muted preload="metadata" />
        ) : (
          <img
            src={firstMedia.url}
            alt={post.caption || 'Post'}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#9ca3af]">
          <IconGridDots size={28} />
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="flex items-center gap-1 text-white text-sm font-bold">
          {String.fromCodePoint(0x2764)} {post.likeCount}
        </span>
        <span className="flex items-center gap-1 text-white text-sm font-bold">
          {String.fromCodePoint(0x1F4AC)} {post.commentCount}
        </span>
      </div>

      {isVideo && (
        <span className="absolute right-2 top-2 rounded-full bg-black/50 p-0.5">
          <IconPlayerPlay size={12} color="white" />
        </span>
      )}
      {hasMultiple && !isVideo && (
        <span className="absolute right-2 top-2 rounded-full bg-black/50 p-0.5">
          <IconGridDots size={12} color="white" />
        </span>
      )}
    </button>
  );
}

export default function UserProfilePage() {
  const router = useRouter();
  const { username } = useParams<{ username: string }>();
  const { isReady, activeIdentity } = useDevAuth();
  const auth = useApiAuth();

  const [profile, setProfile] = useState<SprygramProfile | null>(null);
  const [me, setMe] = useState<SprygramProfile | null>(null);
  const [posts, setPosts] = useState<SprygramPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoadingProfile(true);
    try {
      const [profileData, meData] = await Promise.all([
        sprygramApi.getProfileByUsername(username, auth),
        sprygramApi.getMyProfile(auth).catch(() => null),
      ]);
      setProfile(profileData);
      setMe(meData);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Profile not found', message: error.message });
    } finally {
      setLoadingProfile(false);
    }
  }, [username, auth.token, auth.workspaceId]);

  const loadPosts = useCallback(async (cursor?: string | null) => {
    if (!username) return;
    if (cursor) setLoadingMore(true);
    else setLoadingPosts(true);
    try {
      const res = await sprygramApi.getProfilePosts(username, { limit: 18, cursor: cursor ?? undefined }, auth);
      setPosts((prev) => (cursor ? [...prev, ...res.items] : res.items));
      setNextCursor(res.nextCursor);
    } catch {
      // noop
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  }, [username, auth.token, auth.workspaceId]);

  useEffect(() => {
    if (!isReady || !auth.token) return;
    void loadProfile();
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId, username]);

  useEffect(() => {
    if (!profile?.canViewPosts) return;
    setPosts([]);
    setNextCursor(null);
    void loadPosts(null);
  }, [profile?.userId, profile?.canViewPosts]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          void loadPosts(nextCursor);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loadPosts]);

  const isOwnProfile = me?.userId === profile?.userId;

  if (!isReady || loadingProfile) return <LoadingState message="Loading profile..." />;

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState title="Profile not found" description="This account does not exist or has been removed." />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[935px] px-4 py-6">
      <Group mb="md" gap="xs">
        <ActionIcon variant="subtle" color="dark" radius="xl" onClick={() => router.back()}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Text fw={700} size="lg">{profile.username}</Text>
        {profile.isPrivate && (
          <Tooltip label="Private account">
            <IconLock size={16} color="gray" />
          </Tooltip>
        )}
      </Group>

      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <ProfileAvatar src={profile.avatarUrl} name={profile.displayName || profile.username} size={100} />

        <div className="flex-1">
          <Stack gap="sm">
            <Group gap="sm" align="center" wrap="nowrap">
              <Text fw={700} size="xl">{profile.displayName || profile.username}</Text>
              {isOwnProfile && (
                <ActionIcon component={Link} href="/settings" variant="subtle" color="dark" radius="xl" size="sm">
                  <IconSettings size={18} />
                </ActionIcon>
              )}
            </Group>

            <Text size="sm" c="dimmed">@{profile.username}</Text>

            {profile.bio && (
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{profile.bio}</Text>
            )}

            <Group gap="xl" mt="xs">
              <StatPill value={profile.stats.posts} label="Posts" />
              <StatPill value={profile.stats.followers} label="Followers" />
              <StatPill value={profile.stats.following} label="Following" />
            </Group>

            {!isOwnProfile && (
              <Group gap="xs" mt="xs">
                <FollowButton
                  targetUserId={profile.userId}
                  initialStatus={profile.followStatus}
                  size="sm"
                  onStatusChange={(status) =>
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            followStatus: status,
                            stats: {
                              ...prev.stats,
                              followers:
                                status === 'accepted'
                                  ? prev.stats.followers + 1
                                  : Math.max(0, prev.stats.followers - 1),
                            },
                          }
                        : prev,
                    )
                  }
                />
                {profile.followStatus === 'accepted' && (
                  <Button
                    variant="light"
                    color="gray"
                    size="sm"
                    leftSection={<IconMessage size={15} />}
                    component={Link}
                    href={`/messages?user=${profile.userId}`}
                  >
                    Message
                  </Button>
                )}
              </Group>
            )}

            {isOwnProfile && (
              <Button component={Link} href="/settings" variant="light" color="gray" size="sm">
                Edit profile
              </Button>
            )}
          </Stack>
        </div>
      </div>

      {profile.isPrivate && !profile.canViewPosts && !isOwnProfile && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#cfd5db]">
            <IconLock size={36} color="#9ca3af" />
          </div>
          <Text fw={700} size="lg">This account is private</Text>
          <Text size="sm" c="dimmed">Follow this account to see their photos and videos.</Text>
        </div>
      )}

      {(profile.canViewPosts || isOwnProfile) && (
        <Tabs
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'posts' | 'reels')}
          styles={{ tab: { fontSize: '0.8rem', fontWeight: 600 } }}
        >
          <Tabs.List justify="center" mb="md">
            <Tabs.Tab value="posts" leftSection={<IconGridDots size={15} />}>Posts</Tabs.Tab>
            <Tabs.Tab value="reels" leftSection={<IconPlayerPlay size={15} />}>Reels</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="posts">
            {loadingPosts && posts.length === 0 ? (
              <LoadingState message="Loading posts..." />
            ) : posts.length === 0 ? (
              <EmptyState
                title={isOwnProfile ? 'Share your first post' : 'No posts yet'}
                description={
                  isOwnProfile
                    ? 'Your photos and videos will appear here.'
                    : `${profile.displayName || profile.username} has not posted yet.`
                }
              />
            ) : (
              <>
                <SimpleGrid cols={3} spacing={2}>
                  {posts.map((post) => (
                    <PostThumbnail key={post.id} post={post} onClick={() => router.push(`/p/${post.id}`)} />
                  ))}
                </SimpleGrid>
                <div ref={sentinelRef} className="h-8" />
                {loadingMore && <LoadingState message="" />}
              </>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="reels">
            <EmptyState
              title="No reels yet"
              description={
                isOwnProfile
                  ? 'Post a video and tap the reel icon to share it as a reel.'
                  : `${profile.displayName || profile.username} has not shared any reels yet.`
              }
            />
          </Tabs.Panel>
        </Tabs>
      )}
    </div>
  );
}
