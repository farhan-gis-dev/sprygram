'use client';

import { ActionIcon, Group, Menu, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconFlag3,
  IconHeart,
  IconHeartFilled,
  IconInfoCircle,
  IconLink,
  IconMessageCircle,
  IconSend,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommentsModal } from '@/components/post/comments-modal';
import { FollowButton } from '@/components/profile/follow-button';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { ShareDialog } from '@/components/ui/share-dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { sprygramApi } from '@/lib/api-client';
import type { ReelItem, SprygramProfile } from '@/lib/api-types';
import { FAVORITE_ACCOUNTS_KEY, SAVED_POSTS_KEY, hasStoredId, toggleStoredId } from '@/lib/client-storage';
import { formatRelativeTime } from '@/lib/time';
import { playLikeSound } from '@/lib/sounds';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';

const CAPTION_PREVIEW_LIMIT = 74;

export default function ReelsPage() {
  const auth = useApiAuth();
  const router = useRouter();
  const { isReady, activeIdentity } = useDevAuth();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReelItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewer, setViewer] = useState<SprygramProfile | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favoritedAuthor, setFavoritedAuthor] = useState(false);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutProfile, setAboutProfile] = useState<SprygramProfile | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reelDirection, setReelDirection] = useState<'up' | 'down'>('down');
  const wheelLockRef = useRef<number | null>(null);
  const [reelVideoLoaded, setReelVideoLoaded] = useState(false);

  const load = async (cursor?: string | null) => {
    if (!cursor) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await sprygramApi.getReels({ limit: 10, cursor: cursor || undefined }, auth);
      setItems((previous) => (cursor ? [...previous, ...(response.items || [])] : (response.items || [])));
      setNextCursor(response.nextCursor);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Reels error', message: error.message });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isReady || !auth.token) return;

    void load();
    sprygramApi.getMyProfile(auth).then(setViewer).catch(() => setViewer(null));
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  const active = items[activeIndex] || null;
  const media = active?.post.media[0] || null;

  useEffect(() => {
    if (!active) return;
    setSaved(hasStoredId(SAVED_POSTS_KEY, active.post.id));
    setFavoritedAuthor(hasStoredId(FAVORITE_ACCOUNTS_KEY, active.post.author.userId));
  }, [active?.post.id, active?.post.author.userId]);

  // Reset video loading indicator when reel changes
  useEffect(() => {
    setReelVideoLoaded(false);
  }, [active?.id]);

  const move = async (direction: 1 | -1) => {
    if (!active) return;
    setReelDirection(direction === 1 ? 'down' : 'up');

    if (direction === -1) {
      setActiveIndex((previous) => Math.max(0, previous - 1));
      return;
    }

    const nextIndex = activeIndex + 1;
    if (nextIndex < items.length) {
      setActiveIndex(nextIndex);
      return;
    }

    if (!nextCursor || loadingMore) return;

    const currentLength = items.length;
    await load(nextCursor);
    setActiveIndex(currentLength);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 28) return;
    if (wheelLockRef.current) return;
    if (commentsOpen) return;

    wheelLockRef.current = window.setTimeout(() => {
      if (wheelLockRef.current) window.clearTimeout(wheelLockRef.current);
      wheelLockRef.current = null;
    }, 340);

    void move(event.deltaY > 0 ? 1 : -1);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!active) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        void move(1);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        void move(-1);
      }

      if (event.key === ' ') {
        event.preventDefault();
        void move(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, activeIndex, items.length, nextCursor, loadingMore]);

  const updateActive = (updater: (current: ReelItem) => ReelItem) => {
    setItems((previous) => previous.map((entry, index) => (index === activeIndex ? updater(entry) : entry)));
  };

  const toggleLike = async () => {
    if (!active) return;
    const optimistic = !active.post.isLiked;
    setLikePulse(true);
    if (optimistic) playLikeSound();

    updateActive((entry) => ({
      ...entry,
      post: {
        ...entry.post,
        isLiked: optimistic,
        likeCount: optimistic ? entry.post.likeCount + 1 : Math.max(0, entry.post.likeCount - 1),
      },
    }));

    try {
      const result = optimistic
        ? await sprygramApi.likePost(active.post.id, auth)
        : await sprygramApi.unlikePost(active.post.id, auth);

      updateActive((entry) => ({
        ...entry,
        post: {
          ...entry.post,
          isLiked: result.liked,
          likeCount: result.likeCount,
        },
      }));
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Like failed', message: error.message });
      updateActive((entry) => ({
        ...entry,
        post: {
          ...entry.post,
          isLiked: active.post.isLiked,
          likeCount: active.post.likeCount,
        },
      }));
    }
  };

  useEffect(() => {
    if (!likePulse) return;
    const timer = window.setTimeout(() => setLikePulse(false), 220);
    return () => window.clearTimeout(timer);
  }, [likePulse]);

  useEffect(() => () => {
    if (wheelLockRef.current) window.clearTimeout(wheelLockRef.current);
  }, []);

  const toggleSaved = () => {
    if (!active) return;
    const next = toggleStoredId(SAVED_POSTS_KEY, active.post.id);
    setSaved(next);
    notifications.show({
      color: 'dark',
      title: next ? 'Saved' : 'Removed',
      message: next ? 'Reel saved to your collection.' : 'Reel removed from saved posts.',
    });
  };

  const toggleFavorites = () => {
    if (!active) return;
    const next = toggleStoredId(FAVORITE_ACCOUNTS_KEY, active.post.author.userId);
    setFavoritedAuthor(next);
    notifications.show({
      color: 'dark',
      title: next ? 'Added to favourites' : 'Removed from favourites',
      message: `@${active.post.author.username} ${next ? 'was added to' : 'was removed from'} favourites.`,
    });
  };

  const postUrl = active
    ? (typeof window === 'undefined' ? `/p/${active.post.id}` : new URL(`/p/${active.post.id}`, window.location.origin).toString())
    : '';

  const copyLink = async () => {
    if (!postUrl) return;
    await navigator.clipboard.writeText(postUrl);
    notifications.show({ color: 'teal', title: 'Link copied', message: 'Reel link copied to clipboard.' });
  };

  const shareReel = async () => {
    setShareOpen(true);
  };

  const openAboutAccount = async () => {
    if (!active) return;
    setAboutOpen(true);
    if (aboutProfile) return;

    setAboutLoading(true);
    try {
      const profile = await sprygramApi.getProfileByUsername(active.post.author.username, auth);
      setAboutProfile(profile);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Profile unavailable', message: error.message || 'Unable to load account details.' });
    } finally {
      setAboutLoading(false);
    }
  };

  const captionState = useMemo(() => {
    if (!active?.post.caption) return { expanded: false, showToggle: false, text: '' };
    const expanded = Boolean(expandedCaptions[active.id]);
    const showToggle = active.post.caption.length > CAPTION_PREVIEW_LIMIT;
    return {
      expanded,
      showToggle,
      text: expanded || !showToggle
        ? active.post.caption
        : `${active.post.caption.slice(0, CAPTION_PREVIEW_LIMIT).trimEnd()}...`,
    };
  }, [active, expandedCaptions]);

  if (!isReady || loading) return <LoadingState message="Loading reels..." />;

  if (!active) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <Text fw={700} size="xl" mb={8}>Reels</Text>
        <Text size="sm" c="dimmed">No reels available yet. Create a reel from a video post.</Text>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1360px] items-center justify-start gap-6 px-10 py-6" onWheel={handleWheel}>
        <div className="relative flex w-full items-center justify-center">
          <div
            key={active.id}
            className={`relative overflow-hidden rounded-[28px] border border-border bg-black shadow-[0_32px_70px_rgba(15,23,42,0.24)] ${reelDirection === 'down' ? 'animate-reel-swap-down' : 'animate-reel-swap-up'}`}
            style={{
              height: 'min(92vh, 840px)',
              width: 'min(calc((92vh) * 0.5625), 472px)',
            }}
          >
            {/* Video buffering overlay */}
            {media?.mediaType === 'video' && !reelVideoLoaded ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            ) : null}

            {media?.mediaType === 'video' ? (
              <video
                key={media.id}
                src={media.url}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                onCanPlay={() => setReelVideoLoaded(true)}
              />
            ) : media ? (
              <img src={media.url} alt="Reel media" className="h-full w-full object-cover" />
            ) : null}


            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-4 pb-5 pt-16 text-white">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group align="flex-start" gap={10} wrap="nowrap">
                  <ProfileAvatar
                    size={40}
                    src={active.post.author.avatarUrl}
                    name={active.post.author.displayName || active.post.author.username}
                  />
                  <Stack gap={3}>
                    <Group gap={10} wrap="nowrap">
                      <button type="button" className="text-sm font-semibold" onClick={() => router.push(`/u/${active.post.author.username}`)}>
                        @{active.post.author.username}
                      </button>
                      {viewer?.userId !== active.post.author.userId ? (
                        <div className="[&>button]:rounded-md [&>button]:border-white/40 [&>button]:bg-white/20 [&>button]:px-2.5 [&>button]:text-xs [&>button]:text-white [&>button]:hover:bg-white/30">
                          <FollowButton
                            size="xs"
                            targetUserId={active.post.author.userId}
                            initialStatus={active.post.author.followStatus}
                            onStatusChange={(next) => {
                              updateActive((entry) => ({
                                ...entry,
                                post: {
                                  ...entry.post,
                                  author: {
                                    ...entry.post.author,
                                    followStatus: next,
                                  },
                                },
                              }));
                            }}
                          />
                        </div>
                      ) : null}
                    </Group>
                    {captionState.text ? (
                      <Text size="sm" className="max-w-[300px] leading-5 text-white/95">
                        {captionState.text}{' '}
                        {captionState.showToggle ? (
                          <button
                            type="button"
                            className="font-semibold text-white/90"
                            onClick={() => setExpandedCaptions((previous) => ({
                              ...previous,
                              [active.id]: !previous[active.id],
                            }))}
                          >
                            {captionState.expanded ? 'less' : 'more'}
                          </button>
                        ) : null}
                      </Text>
                    ) : null}
                    <Text size="xs" c="gray.3">{formatRelativeTime(active.createdAt)}</Text>
                  </Stack>
                </Group>

                <Menu width={220} shadow="md" position="left-start">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" className="text-white hover:bg-white/10" aria-label="Reel options" title="Reel options">
                      <IconDots size={20} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconFlag3 size={15} />} onClick={() => notifications.show({ color: 'orange', title: 'Reported', message: 'Thanks. We will review this reel.' })}>
                      Report
                    </Menu.Item>
                    <Menu.Item leftSection={<IconLink size={15} />} onClick={() => router.push(`/p/${active.post.id}`)}>
                      Go to Post
                    </Menu.Item>
                    <Menu.Item leftSection={<IconSend size={15} />} onClick={() => void shareReel()}>
                      Share
                    </Menu.Item>
                    <Menu.Item leftSection={<IconLink size={15} />} onClick={() => void copyLink()}>
                      Copy Link
                    </Menu.Item>
                    <Menu.Item leftSection={<IconInfoCircle size={15} />} onClick={() => void openAboutAccount()}>
                      About this Account
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </div>

            <div onWheel={(e) => e.stopPropagation()}>
              <CommentsModal
                opened={commentsOpen}
                postId={active.post.id}
                onClose={() => setCommentsOpen(false)}
                viewer={viewer}
                onCommentCountIncrement={() => {
                  updateActive((entry) => ({
                    ...entry,
                    post: {
                      ...entry.post,
                      commentCount: entry.post.commentCount + 1,
                    },
                  }));
                }}
              />
            </div>
          </div>

          <Stack gap="md" align="center" className="ml-5">
            <ActionIcon variant="transparent" color="gray" size="xl" onClick={() => void toggleLike()} aria-label={active.post.isLiked ? 'Unlike reel' : 'Like reel'} title={active.post.isLiked ? 'Unlike reel' : 'Like reel'}>
              {active.post.isLiked ? <IconHeartFilled size={30} color="#ef4444" className={likePulse ? 'animate-interact-pop' : ''} /> : <IconHeart size={30} className={`${likePulse ? 'animate-interact-pop ' : ''}text-[#262626]`} />}
            </ActionIcon>
            <Text size="xs" fw={700}>{active.post.likeCount}</Text>

            <ActionIcon variant="transparent" color="gray" size="xl" onClick={() => setCommentsOpen((previous) => !previous)} aria-label={commentsOpen ? 'Hide reel comments' : 'Show reel comments'} title={commentsOpen ? 'Hide reel comments' : 'Show reel comments'}>
              <IconMessageCircle size={28} className="text-[#262626]" />
            </ActionIcon>
            <Text size="xs" fw={700}>{active.post.commentCount}</Text>

            <ActionIcon variant="transparent" color="gray" size="xl" onClick={() => void shareReel()} aria-label="Share reel" title="Share reel">
              <IconSend size={27} className="text-[#262626]" />
            </ActionIcon>

            <ActionIcon variant="transparent" color="gray" size="xl" onClick={toggleSaved} aria-label={saved ? 'Remove reel from saved posts' : 'Save reel'} title={saved ? 'Remove reel from saved posts' : 'Save reel'}>
              {saved ? <IconBookmarkFilled size={27} className="text-[#262626]" /> : <IconBookmark size={27} className="text-[#262626]" />}
            </ActionIcon>

            <button
              type="button"
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition hover:bg-gray-50"
              onClick={toggleFavorites}
            >
              {favoritedAuthor ? 'Favourited' : 'Favourite'}
            </button>
          </Stack>

          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-3">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void move(-1)}
              disabled={activeIndex === 0}
              aria-label="Previous reel"
              title="Previous reel"
            >
              <IconChevronUp size={20} />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel shadow-sm transition hover:translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void move(1)}
              disabled={activeIndex === items.length - 1 && !nextCursor}
              aria-label="Next reel"
              title="Next reel"
            >
              <IconChevronDown size={20} />
            </button>
          </div>
        </div>
      </div>

      <Modal opened={aboutOpen} onClose={() => setAboutOpen(false)} centered title="About this account">
        <Stack gap="sm">
          <Group wrap="nowrap">
            <ProfileAvatar
              size={56}
              src={aboutProfile?.avatarUrl || active.post.author.avatarUrl}
              name={aboutProfile?.displayName || active.post.author.displayName || active.post.author.username}
            />
            <Stack gap={1}>
              <Text fw={700}>{aboutProfile?.username || active.post.author.username}</Text>
              <Text size="sm" c="dimmed">{aboutProfile?.displayName || active.post.author.displayName || 'Sprygram creator'}</Text>
            </Stack>
          </Group>
          {aboutLoading ? <Text size="sm" c="dimmed">Loading account details...</Text> : null}
          {!aboutLoading ? (
            <>
              <Text size="sm">{aboutProfile?.bio || 'No bio provided.'}</Text>
              <Text size="sm"><b>{aboutProfile?.stats.posts ?? 0}</b> posts</Text>
              <Text size="sm"><b>{aboutProfile?.stats.followers ?? 0}</b> followers</Text>
              <Text size="sm"><b>{aboutProfile?.stats.following ?? 0}</b> following</Text>
            </>
          ) : null}
        </Stack>
      </Modal>

      <ShareDialog
        opened={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={postUrl}
        title="reel"
        shareText={active.post.caption || `Check out @${active.post.author.username}'s reel on Sprygram.`}
        storyDriveFileId={viewer?.userId !== active.post.author.userId && active.post.media.length > 0 ? active.post.media[0].driveFileId : undefined}
        storyPreviewUrl={viewer?.userId !== active.post.author.userId && media ? (media as any).url ?? null : null}
        storyAuthorUsername={viewer?.userId !== active.post.author.userId ? active.post.author.username : undefined}
      />
    </>
  );
}
