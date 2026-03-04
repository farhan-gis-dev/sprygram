'use client';

import { ActionIcon, Badge, Button, Group, Menu, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconBrain,
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
  IconStar,
  IconStarFilled,
  IconVolume,
  IconVolumeOff,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AD_INJECTION_INTERVAL } from '@/components/ads/ad-card';
import { CommentsModal } from '@/components/post/comments-modal';
import { FollowButton } from '@/components/profile/follow-button';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { ShareDialog } from '@/components/ui/share-dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { sprygramApi } from '@/lib/api-client';
import type { ReelItem, SprygramProfile } from '@/lib/api-types';
import { playLikeSound } from '@/lib/sounds';
import { FAVORITE_ACCOUNTS_KEY, SAVED_POSTS_KEY, hasStoredId, toggleStoredId } from '@/lib/client-storage';
import { formatRelativeTime } from '@/lib/time';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';

const CAPTION_PREVIEW_LIMIT = 74;

const ALGORITHM_KEY = 'sprygram:algorithm:tags';
const STOP_WORDS = new Set(['the','and','for','are','but','not','you','all','can','was','had','her','his','they','have','this','with','that','from','will','been','like','just','also','into','more','know','need','want','when','what','your']);

const loadAlgorithmTags = (): Record<string, number> => {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(ALGORITHM_KEY) : null;
    return stored ? (JSON.parse(stored) as Record<string, number>) : {};
  } catch { return {}; }
};

const saveAlgorithmTags = (tags: Record<string, number>) => {
  try { window.localStorage.setItem(ALGORITHM_KEY, JSON.stringify(tags)); } catch { /* ignore */ }
};

const extractTagsFromCaption = (caption: string | null | undefined): string[] => {
  if (!caption) return [];
  return caption
    .toLowerCase()
    .replace(/[^a-z0-9\s#]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 8);
};

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [algorithmOpen, setAlgorithmOpen] = useState(false);
  const [algorithmTags, setAlgorithmTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [videoMuted, setVideoMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wheelLockRef = useRef<number | null>(null);

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
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, activeIndex, items.length, nextCursor, loadingMore]);

  const togglePlayPause = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      void vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, []);

  // Reset play state when active reel changes
  useEffect(() => {
    setIsPlaying(true);
    setVideoLoading(true);
    setCurrentTime(0);
    setDuration(0);
  }, [active?.id]);

  // Explicitly trigger play() when reel changes (autoPlay is unreliable in browsers)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    // Call play immediately — no delay needed since we use preload="auto"
    vid.play().catch(() => {
      // Autoplay policy may block; user interaction will still allow play
    });
  }, [active?.id]);

  // Pause reel when comment panel is open
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (commentsOpen) {
      vid.pause();
      setIsPlaying(false);
    } else if (isPlaying) {
      void vid.play().catch(() => undefined);
    }
  }, [commentsOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track algorithm: log tags from the caption of watched reels
  useEffect(() => {
    if (!active?.post.caption) return;
    const tags = extractTagsFromCaption(active.post.caption);
    if (!tags.length) return;
    const current = loadAlgorithmTags();
    for (const tag of tags) {
      current[tag] = (current[tag] || 0) + 1;
    }
    saveAlgorithmTags(current);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAlgorithm = () => {
    const raw = loadAlgorithmTags();
    const sorted = Object.entries(raw)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    setAlgorithmTags(sorted);
    setAlgorithmOpen(true);
  };

  const removeAlgorithmTag = (tag: string) => {
    const current = loadAlgorithmTags();
    delete current[tag];
    saveAlgorithmTags(current);
    setAlgorithmTags((prev) => prev.filter((t) => t.tag !== tag));
  };

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
            {media?.mediaType === 'video' ? (
              <>
                <video
                  ref={videoRef}
                  key={media.id}
                  src={media.url}
                  className="h-full w-full object-contain bg-black"
                  autoPlay
                  muted={videoMuted}
                  loop
                  playsInline
                  preload="auto"
                  onWaiting={() => setVideoLoading(true)}
                  onCanPlay={() => setVideoLoading(false)}
                  onPlaying={() => setVideoLoading(false)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onClick={togglePlayPause}
                />
                {/* Mute/unmute button */}
                <button
                  type="button"
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65"
                  onClick={() => setVideoMuted((prev) => !prev)}
                  aria-label={videoMuted ? 'Unmute reel' : 'Mute reel'}
                  title={videoMuted ? 'Unmute reel' : 'Mute reel'}
                >
                  {videoMuted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
                </button>
                {/* Loading indicator */}
                {videoLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  </div>
                ) : null}
                {/* Play/pause overlay button */}
                {!isPlaying ? (
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center"
                    onClick={togglePlayPause}
                    aria-label="Play"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 translate-x-0.5">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </button>
                ) : null}
              </>
            ) : media ? (
              <img src={media.url} alt="Reel media" className="h-full w-full object-contain bg-black" />
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
                        <FollowButton
                            targetUserId={active.post.author.userId}
                            initialStatus={active.post.author.followStatus}
                            reelsVariant
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
                    {/* SpryAds sponsored label injected every N reels */}
                    {(activeIndex + 1) % AD_INJECTION_INTERVAL === 0 ? (
                      <a
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60"
                      >
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#a78bfa]" />
                        Sponsored · SpryAds
                      </a>
                    ) : null}
                  </Stack>
                </Group>

                <Menu width={220} shadow="md" position="left-start">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" className="text-white hover:bg-white/10" aria-label="Reel options" title="Reel options">
                      <IconDots size={20} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconFlag3 size={15} />} onClick={() => { setReportReason('spam'); setReportDetails(''); setReportOpen(true); }}>
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

            {/* Progress bar */}
            {media?.mediaType === 'video' && duration > 0 ? (
              <div
                className="absolute inset-x-0 bottom-0 z-30 h-0.5 cursor-pointer bg-white/25"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  const vid = videoRef.current;
                  if (vid) vid.currentTime = ratio * duration;
                }}
              >
                <div
                  className="h-full bg-white transition-none"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            ) : null}
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

            <ActionIcon
              variant="transparent"
              color="gray"
              size="xl"
              onClick={toggleFavorites}
              aria-label={favoritedAuthor ? 'Remove from favourites' : 'Add to favourites'}
              title={favoritedAuthor ? 'Remove from favourites' : 'Add to favourites'}
            >
              {favoritedAuthor
                ? <IconStarFilled size={27} color="#f5a623" />
                : <IconStar size={27} className="text-[#262626]" />}
            </ActionIcon>
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
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel shadow-sm transition hover:bg-white"
              onClick={openAlgorithm}
              aria-label="My Algorithm"
              title="My Algorithm"
            >
              <IconBrain size={20} />
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
              <Text size="sm" c="dimmed">{aboutProfile?.displayName || active.post.author.displayName || 'Sprysnap creator'}</Text>
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
      />

      <Modal opened={reportOpen} onClose={() => setReportOpen(false)} centered title="Report Reel" size="sm">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">Why are you reporting this reel?</Text>
          <Select
            data={[
              { value: 'spam', label: 'Spam' },
              { value: 'nudity', label: 'Nudity or sexual content' },
              { value: 'violence', label: 'Violence or dangerous content' },
              { value: 'harassment', label: 'Bullying or harassment' },
              { value: 'hate', label: 'Hate speech or symbols' },
              { value: 'false_info', label: 'False information' },
              { value: 'other', label: 'Something else' },
            ]}
            value={reportReason}
            onChange={(v) => setReportReason(v || 'spam')}
            label="Reason"
          />
          <Textarea
            label="Additional details (optional)"
            placeholder="Tell us more…"
            value={reportDetails}
            onChange={(e) => setReportDetails(e.currentTarget.value)}
            maxLength={500}
            minRows={3}
            autosize
          />
          <Button
            fullWidth
            color="red"
            loading={reportSubmitting}
            onClick={async () => {
              setReportSubmitting(true);
              await new Promise((r) => setTimeout(r, 600));
              setReportSubmitting(false);
              setReportOpen(false);
              notifications.show({ color: 'teal', title: 'Report submitted', message: 'Thanks. We will review this reel.' });
            }}
          >
            Submit Report
          </Button>
        </Stack>
      </Modal>

      <Modal opened={algorithmOpen} onClose={() => setAlgorithmOpen(false)} title="My Algorithm" centered size="md">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            These interests are built from the reels you watch. Your feed is ranked to show more content
            matching your top interests. Tap × to remove a topic.
          </Text>
          {algorithmTags.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Watch more reels to build your personalised algorithm.
            </Text>
          ) : (
            <div className="flex flex-wrap gap-2">
              {algorithmTags.map(({ tag, count }) => (
                <Badge
                  key={tag}
                  size="lg"
                  variant="light"
                  rightSection={
                    <button
                      type="button"
                      className="ml-1 opacity-60 hover:opacity-100"
                      onClick={() => removeAlgorithmTag(tag)}
                      aria-label={`Remove ${tag}`}
                    >
                      <IconX size={12} />
                    </button>
                  }
                >
                  #{tag} &middot; {count}
                </Badge>
              ))}
            </div>
          )}
          {algorithmTags.length > 0 && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => {
                saveAlgorithmTags({});
                setAlgorithmTags([]);
              }}
            >
              Reset all interests
            </Button>
          )}
        </Stack>
      </Modal>
    </>
  );
}
