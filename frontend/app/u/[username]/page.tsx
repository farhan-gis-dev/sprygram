'use client';

import {
  ActionIcon,
  Button,
  Divider,
  FileButton,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconDotsVertical,
  IconGridDots,
  IconLock,
  IconMessage,
  IconPencil,
  IconPlayerPlay,
  IconSettings,
  IconShieldOff,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FollowButton } from '@/components/profile/follow-button';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { sprygramApi } from '@/lib/api-client';
import type { ReelItem, SprygramPost, SprygramProfile, StoryItem } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { StoryViewer } from '@/components/story/story-viewer';

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
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [followersList, setFollowersList] = useState<import('@/lib/api-types').SearchAccountResult[]>([]);
  const [followingList, setFollowingList] = useState<import('@/lib/api-types').SearchAccountResult[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);
  const [reelsFetched, setReelsFetched] = useState(false);
  const [highlights, setHighlights] = useState<StoryItem[]>([]);
  const [highlightViewer, setHighlightViewer] = useState<{ open: boolean; label: string; items: StoryItem[] }>({ open: false, label: '', items: [] });
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [restrictLoading, setRestrictLoading] = useState(false);
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

  const loadReels = useCallback(async () => {
    if (!username || loadingReels) return;
    setLoadingReels(true);
    try {
      const res = await sprygramApi.getProfileReels(username, { limit: 30 }, auth);
      setReels(res.items || []);
      setReelsFetched(true);
    } catch {
      setReelsFetched(true);
    } finally {
      setLoadingReels(false);
    }
  }, [username, auth.token, auth.workspaceId]);

  useEffect(() => {
    if (activeTab === 'reels' && !reelsFetched && profile?.canViewPosts) {
      void loadReels();
    }
  }, [activeTab, reelsFetched, profile?.canViewPosts]);

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

  // Load story highlights for the profile
  useEffect(() => {
    if (!profile?.userId || !auth.token) return;
    sprygramApi.getStoriesByUsername(profile.username, auth)
      .then((res) => {
        const hl = (res.items ?? []).filter((s) => s.isHighlight);
        setHighlights(hl);
      })
      .catch(() => setHighlights([]));
  }, [profile?.userId, auth.token, auth.workspaceId]);

  const handleToggleBlock = async () => {
    if (!profile) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await sprygramApi.unblockUser(profile.userId, auth);
        setIsBlocked(false);
        notifications.show({ color: 'teal', title: 'Unblocked', message: `@${profile.username} has been unblocked.` });
      } else {
        await sprygramApi.blockUser(profile.userId, auth);
        setIsBlocked(true);
        notifications.show({ color: 'orange', title: 'Blocked', message: `@${profile.username} has been blocked.` });
      }
    } catch {
      notifications.show({ color: 'red', title: 'Error', message: 'Could not update block status.' });
    } finally {
      setBlockLoading(false);
    }
  };

  const handleToggleRestrict = async () => {
    if (!profile) return;
    setRestrictLoading(true);
    try {
      if (isRestricted) {
        await sprygramApi.unrestrictUser(profile.userId, auth);
        setIsRestricted(false);
        notifications.show({ color: 'teal', title: 'Restriction removed', message: `@${profile.username} can interact normally now.` });
      } else {
        await sprygramApi.restrictUser(profile.userId, auth);
        setIsRestricted(true);
        notifications.show({ color: 'orange', title: 'Restricted', message: `@${profile.username} has been restricted.` });
      }
    } catch {
      notifications.show({ color: 'red', title: 'Error', message: 'Could not update restriction.' });
    } finally {
      setRestrictLoading(false);
    }
  };

  // Group highlights by label
  const highlightGroups = highlights.reduce<Record<string, StoryItem[]>>((acc, item) => {
    const label = item.highlightLabel ?? 'Highlights';
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

  const openFollowers = async () => {
    setFollowersOpen(true);
    if (!profile) return;
    setLoadingFollowers(true);
    try {
      const res = await sprygramApi.getProfileFollowers(profile.username, { limit: 50 }, auth);
      setFollowersList(res.items || []);
    } catch { setFollowersList([]); }
    finally { setLoadingFollowers(false); }
  };

  const openFollowing = async () => {
    setFollowingOpen(true);
    if (!profile) return;
    setLoadingFollowing(true);
    try {
      const res = await sprygramApi.getProfileFollowing(profile.username, { limit: 50 }, auth);
      setFollowingList(res.items || []);
    } catch { setFollowingList([]); }
    finally { setLoadingFollowing(false); }
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await sprygramApi.uploadAvatar(file, auth);
      setProfile((prev) => prev ? { ...prev, avatarUrl: res.profile.avatarUrl } : prev);
      notifications.show({ color: 'teal', title: 'Photo updated', message: 'Your profile photo was updated.' });
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Upload failed', message: error.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveBio = async () => {
    setSavingBio(true);
    try {
      const updated = await sprygramApi.updateMyProfile({ bio: bioInput }, auth);
      setProfile((prev) => prev ? { ...prev, bio: updated.bio } : prev);
      setEditingBio(false);
      notifications.show({ color: 'teal', title: 'Saved', message: 'Bio updated.' });
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Save failed', message: error.message });
    } finally {
      setSavingBio(false);
    }
  };

  if (!isReady || loadingProfile) return <LoadingState message="Loading profile..." />;

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState title="Profile not found" description="This account does not exist or has been removed." />
      </div>
    );
  }

  return (
    <>
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
        {/* Avatar — clickable to upload for own profile */}
        <div className="relative shrink-0">
          <ProfileAvatar src={profile.avatarUrl} name={profile.displayName || profile.username} size={96} />
          {isOwnProfile && (
            <FileButton onChange={(file) => void handleAvatarUpload(file)} accept="image/*">
              {(props) => (
                <button
                  {...props}
                  type="button"
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition hover:opacity-100 focus:opacity-100"
                  aria-label="Change profile photo"
                >
                  {uploadingAvatar
                    ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <IconCamera size={22} color="white" />}
                </button>
              )}
            </FileButton>
          )}
        </div>

        <div className="flex-1">
          <Stack gap={4}>
            <Group gap="sm" align="center" wrap="nowrap">
              <Text fw={800} size="xl">@{profile.username}</Text>
              {isOwnProfile && (
                <ActionIcon component={Link} href="/settings" variant="subtle" color="dark" radius="xl" size="sm" title="Settings">
                  <IconSettings size={17} />
                </ActionIcon>
              )}
              {profile.isPrivate && !isOwnProfile && (
                <Tooltip label="Private account">
                  <IconLock size={15} color="gray" />
                </Tooltip>
              )}
            </Group>

            {profile.displayName && (
              <Text size="sm" c="dimmed" fw={500}>{profile.displayName}</Text>
            )}

            {editingBio ? (
              <Group align="flex-end" gap="xs" mt={4}>
                <Textarea
                  value={bioInput}
                  onChange={(e) => setBioInput(e.currentTarget.value)}
                  placeholder="Write a bio…"
                  maxLength={160}
                  minRows={2}
                  maxRows={4}
                  autosize
                  className="flex-1"
                  style={{ maxWidth: 380 }}
                />
                <ActionIcon loading={savingBio} onClick={() => void saveBio()} color="teal" variant="filled" title="Save bio" aria-label="Save bio"><IconCheck size={16} /></ActionIcon>
                <ActionIcon onClick={() => setEditingBio(false)} variant="light" color="gray" title="Cancel" aria-label="Cancel editing bio"><IconX size={16} /></ActionIcon>
              </Group>
            ) : (
              <Group gap={4} align="center" mt={2}>
                {profile.bio ? (
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>{profile.bio}</Text>
                ) : isOwnProfile ? (
                  <Text size="xs" c="dimmed" fs="italic">No bio yet. Add one!</Text>
                ) : null}
                {isOwnProfile && (
                  <ActionIcon
                    variant="subtle" color="gray" size="xs"
                    onClick={() => { setBioInput(profile.bio || ''); setEditingBio(true); }}
                    title="Edit bio" aria-label="Edit bio"
                  >
                    <IconPencil size={13} />
                  </ActionIcon>
                )}
              </Group>
            )}

            <Group gap="xl" mt="sm">
              <Stack align="center" gap={0}>
                <Text fw={800} size="lg" lh={1.2}>{profile.stats.posts >= 1_000_000 ? `${(profile.stats.posts / 1_000_000).toFixed(1)}M` : profile.stats.posts >= 1_000 ? `${(profile.stats.posts / 1_000).toFixed(1)}K` : String(profile.stats.posts)}</Text>
                <Text size="xs" c="dimmed" fw={500}>Posts</Text>
              </Stack>
              <button type="button" className="flex flex-col items-center gap-0 hover:opacity-70" onClick={() => void openFollowers()}>
                <Text fw={800} size="lg" lh={1.2}>{profile.stats.followers >= 1_000 ? `${(profile.stats.followers / 1_000).toFixed(1)}K` : String(profile.stats.followers)}</Text>
                <Text size="xs" c="dimmed" fw={500}>Followers</Text>
              </button>
              <button type="button" className="flex flex-col items-center gap-0 hover:opacity-70" onClick={() => void openFollowing()}>
                <Text fw={800} size="lg" lh={1.2}>{profile.stats.following >= 1_000 ? `${(profile.stats.following / 1_000).toFixed(1)}K` : String(profile.stats.following)}</Text>
                <Text size="xs" c="dimmed" fw={500}>Following</Text>
              </button>
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
                <Menu shadow="md" width={180} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="light" color="gray" size="sm" radius="xl" aria-label="More options">
                      <IconDotsVertical size={15} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconShieldOff size={15} />}
                      color={isBlocked ? 'teal' : 'red'}
                      disabled={blockLoading}
                      onClick={() => void handleToggleBlock()}
                    >
                      {isBlocked ? 'Unblock' : 'Block'}
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconShieldOff size={15} />}
                      color={isRestricted ? 'teal' : 'orange'}
                      disabled={restrictLoading}
                      onClick={() => void handleToggleRestrict()}
                    >
                      {isRestricted ? 'Unrestrict' : 'Restrict'}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}

            {isOwnProfile && (
              <Group gap="xs" mt="xs">
                <Button component={Link} href="/settings" variant="light" color="gray" size="sm">
                  Edit profile
                </Button>
              </Group>
            )}
          </Stack>
        </div>
      </div>

      {/* Story Highlights Tray */}
      {Object.keys(highlightGroups).length > 0 && (
        <div className="mb-6">
          <div className="flex gap-5 overflow-x-auto pb-1 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {Object.entries(highlightGroups).map(([label, items]) => (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center gap-1.5 shrink-0 group"
                onClick={() => setHighlightViewer({ open: true, label, items })}
              >
                <div className="h-16 w-16 rounded-full ring-2 ring-[var(--spry-accent)] ring-offset-2 overflow-hidden bg-[#f0f2f5] group-hover:opacity-80 transition-opacity">
                  {items[0]?.mediaType === 'image' ? (
                    <img src={items[0].mediaUrl} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <video src={items[0]?.mediaUrl} className="h-full w-full object-cover" muted />
                  )}
                </div>
                <Text size="xs" fw={500} ta="center" lineClamp={1} style={{ maxWidth: 64 }}>{label}</Text>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Highlight viewer modal */}
      <Modal
        opened={highlightViewer.open}
        onClose={() => setHighlightViewer({ open: false, label: '', items: [] })}
        title={highlightViewer.label}
        centered
        size="sm"
        padding="xs"
      >
        <Stack gap="xs">
          {highlightViewer.items.map((item, idx) => (
            <div key={item.id} className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: 420 }}>
              {item.mediaType === 'image' ? (
                <img src={item.mediaUrl} alt={item.caption ?? `Story ${idx + 1}`} className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={item.mediaUrl} controls className="h-full w-full object-contain" />
              )}
              {item.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                  <Text size="sm" c="white">{item.caption}</Text>
                </div>
              )}
            </div>
          ))}
        </Stack>
      </Modal>

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
            {loadingReels ? (
              <LoadingState message="Loading reels…" />
            ) : reels.length === 0 ? (
              <EmptyState
                title="No reels yet"
                description={
                  isOwnProfile
                    ? 'Post a video and tap the reel icon to share it as a reel.'
                    : `${profile.displayName || profile.username} has not shared any reels yet.`
                }
              />
            ) : (
              <SimpleGrid cols={{ base: 3, sm: 3 }} spacing={2}>
                {reels.map((reel) => {
                  const firstMedia = reel.post.media?.[0];
                  return (
                    <button
                      key={reel.id}
                      type="button"
                      onClick={() => router.push('/reels')}
                      className="group relative aspect-square w-full overflow-hidden rounded-[4px] bg-[#f0f2f5] focus:outline-none"
                    >
                      {firstMedia ? (
                        <video
                          src={firstMedia.url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#9ca3af]">
                          <IconPlayerPlay size={28} />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <span className="flex items-center gap-1 text-white text-sm font-bold">
                          {String.fromCodePoint(0x2764)} {reel.post.likeCount}
                        </span>
                      </div>
                      <span className="absolute right-2 top-2 rounded-full bg-black/50 p-0.5">
                        <IconPlayerPlay size={12} color="white" />
                      </span>
                    </button>
                  );
                })}
              </SimpleGrid>
            )}
          </Tabs.Panel>
        </Tabs>
      )}
    </div>

    {/* Followers modal */}
    <Modal opened={followersOpen} onClose={() => setFollowersOpen(false)} title="Followers" centered size="sm">
      {loadingFollowers ? (
        <Text size="sm" c="dimmed" ta="center" py="md">Loading…</Text>
      ) : followersList.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">No followers yet.</Text>
      ) : (
        <Stack gap="xs">
          {followersList.map((acc) => (
            <button
              key={acc.userId}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
              onClick={() => { setFollowersOpen(false); router.push(`/u/${acc.username}`); }}
            >
              <ProfileAvatar size={38} src={acc.avatarUrl} name={acc.displayName || acc.username} />
              <div>
                <Text size="sm" fw={700}>@{acc.username}</Text>
                {acc.displayName && <Text size="xs" c="dimmed">{acc.displayName}</Text>}
              </div>
            </button>
          ))}
        </Stack>
      )}
    </Modal>

    {/* Following modal */}
    <Modal opened={followingOpen} onClose={() => setFollowingOpen(false)} title="Following" centered size="sm">
      {loadingFollowing ? (
        <Text size="sm" c="dimmed" ta="center" py="md">Loading…</Text>
      ) : followingList.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">Not following anyone yet.</Text>
      ) : (
        <Stack gap="xs">
          {followingList.map((acc) => (
            <button
              key={acc.userId}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
              onClick={() => { setFollowingOpen(false); router.push(`/u/${acc.username}`); }}
            >
              <ProfileAvatar size={38} src={acc.avatarUrl} name={acc.displayName || acc.username} />
              <div>
                <Text size="sm" fw={700}>@{acc.username}</Text>
                {acc.displayName && <Text size="xs" c="dimmed">{acc.displayName}</Text>}
              </div>
            </button>
          ))}
        </Stack>
      )}
    </Modal>
    </>
  );
}
