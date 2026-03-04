'use client';

import { ActionIcon, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconHeartFilled,
  IconPlayerPause,
  IconPlayerPlay,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { StoryItem, UserStoriesResponse } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { formatRelativeTime } from '@/lib/time';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { ShareDialog } from '@/components/ui/share-dialog';
import { playLikeSound } from '@/lib/sounds';

type Props = {
  username: string | null;
  usernames?: string[];
  opened: boolean;
  onClose: () => void;
  onAccountCompleted?: (username: string) => void;
  viewerUserId?: string | null;
};

const IMAGE_STORY_DURATION_MS = 6000;
const QUICK_REACTIONS = ['\u2764\uFE0F', '\u{1F525}', '\u{1F60D}', '\u{1F44F}', '\u{1F602}', '\u{1F64C}'];

export function StoryViewer({ username, usernames = [], opened, onClose, onAccountCompleted, viewerUserId }: Props) {
  const auth = useApiAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageElapsedRef = useRef(0);
  const imageLastTickRef = useRef<number | null>(null);
  const imageFrameRef = useRef<number | null>(null);
  const sessionViewedRef = useRef<Record<string, Set<string>>>({});
  const completedAccountsRef = useRef<Set<string>>(new Set());

  const orderedUsernames = useMemo(() => {
    const source = usernames.length ? usernames : (username ? [username] : []);
    return Array.from(new Set(source.filter(Boolean)));
  }, [usernames, username]);

  const initialIndex = useMemo(() => {
    if (!username) return 0;
    const found = orderedUsernames.findIndex((entry) => entry.toLowerCase() === username.toLowerCase());
    return found >= 0 ? found : 0;
  }, [orderedUsernames, username]);

  const [loading, setLoading] = useState(false);
  const [storyData, setStoryData] = useState<UserStoriesResponse | null>(null);
  const [activeUsernameIndex, setActiveUsernameIndex] = useState(initialIndex);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const [currentDurationMs, setCurrentDurationMs] = useState(IMAGE_STORY_DURATION_MS);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [storyLiked, setStoryLiked] = useState<Record<string, boolean>>({});
  const [pendingEdge, setPendingEdge] = useState<'first' | 'last'>('first');
  const pausedByInputRef = useRef(false);

  const activeUsername = orderedUsernames[activeUsernameIndex] || username || null;
  const stories = storyData?.items || [];
  const activeStory = stories[activeIndex] || null;
  const isOwnStory = Boolean(viewerUserId && storyData?.profile.userId && viewerUserId === storyData.profile.userId);
  const storyShareUrl = activeUsername && typeof window !== 'undefined'
    ? new URL(`/u/${encodeURIComponent(activeUsername)}`, window.location.origin).toString()
    : '';

  useEffect(() => {
    if (!opened) return;
    setActiveUsernameIndex(initialIndex);
    setPendingEdge('first');
    sessionViewedRef.current = {};
    completedAccountsRef.current = new Set();
  }, [opened, initialIndex]);

  useEffect(() => {
    if (!opened || !activeUsername || !auth.token) return;

    setLoading(true);
    setReply('');
    setPaused(false);
    setProgressMs(0);
    setCurrentDurationMs(IMAGE_STORY_DURATION_MS);

    sprygramApi.getStoriesByUsername(activeUsername, auth)
      .then((data) => {
        setStoryData(data);
        setActiveIndex(pendingEdge === 'last' ? Math.max(0, data.items.length - 1) : 0);
      })
      .catch((error) => {
        notifications.show({ color: 'red', title: 'Story error', message: error.message });
        setStoryData(null);
      })
      .finally(() => setLoading(false));
  }, [opened, activeUsername, auth.token, auth.workspaceId, pendingEdge]);

  const markStorySeenLocally = (storyId: string, accountUsername: string) => {
    const normalizedUsername = accountUsername.toLowerCase();
    if (!sessionViewedRef.current[normalizedUsername]) {
      sessionViewedRef.current[normalizedUsername] = new Set();
    }
    sessionViewedRef.current[normalizedUsername].add(storyId);

    setStoryData((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        items: previous.items.map((story) => (
          story.id === storyId ? { ...story, viewed: true } : story
        )),
      };
    });
  };

  const completeAccountIfFinished = (accountUsername: string | null, accountStories: StoryItem[]) => {
    if (!accountUsername || !accountStories.length) return;

    const normalizedUsername = accountUsername.toLowerCase();
    if (completedAccountsRef.current.has(normalizedUsername)) return;

    const sessionViewed = sessionViewedRef.current[normalizedUsername] || new Set<string>();
    const finished = accountStories.every((story) => story.viewed || sessionViewed.has(story.id));
    if (!finished) return;

    completedAccountsRef.current.add(normalizedUsername);
    onAccountCompleted?.(accountUsername);
  };

  useEffect(() => {
    if (!opened || !activeStory || !auth.token || !activeUsername) return;

    setProgressMs(0);
    setPaused(false);
    setReply('');
    imageElapsedRef.current = 0;
    imageLastTickRef.current = null;
    setCurrentDurationMs(activeStory.mediaType === 'video' ? 8000 : IMAGE_STORY_DURATION_MS);

    markStorySeenLocally(activeStory.id, activeUsername);
    void sprygramApi.markStoryViewed(activeStory.id, auth).catch(() => undefined);
  }, [opened, activeStory?.id, activeUsername, auth.token, auth.workspaceId]);

  const moveToNextUser = () => {
    completeAccountIfFinished(activeUsername, stories);
    if (activeUsernameIndex < orderedUsernames.length - 1) {
      setPendingEdge('first');
      setActiveUsernameIndex((previous) => previous + 1);
      return true;
    }
    return false;
  };

  const moveToPreviousUser = () => {
    completeAccountIfFinished(activeUsername, stories);
    if (activeUsernameIndex > 0) {
      setPendingEdge('last');
      setActiveUsernameIndex((previous) => previous - 1);
      return true;
    }
    return false;
  };

  const next = () => {
    if (!activeStory) return;
    if (activeIndex < stories.length - 1) {
      setActiveIndex((previous) => previous + 1);
      return;
    }
    if (!moveToNextUser()) {
      completeAccountIfFinished(activeUsername, stories);
      onClose();
    }
  };

  const previous = () => {
    if (!activeStory) return;
    if (activeIndex > 0) {
      setActiveIndex((previousIndex) => Math.max(0, previousIndex - 1));
      return;
    }
    void moveToPreviousUser();
  };

  useEffect(() => {
    if (!opened || !activeStory || paused || activeStory.mediaType === 'video') return undefined;

    const tick = (timestamp: number) => {
      if (imageLastTickRef.current == null) {
        imageLastTickRef.current = timestamp;
      } else {
        imageElapsedRef.current += timestamp - imageLastTickRef.current;
        imageLastTickRef.current = timestamp;
      }

      const nextProgress = Math.min(imageElapsedRef.current, currentDurationMs);
      setProgressMs(nextProgress);

      if (nextProgress >= currentDurationMs) {
        imageFrameRef.current = null;
        next();
        return;
      }

      imageFrameRef.current = window.requestAnimationFrame(tick);
    };

    imageFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (imageFrameRef.current != null) window.cancelAnimationFrame(imageFrameRef.current);
      imageFrameRef.current = null;
      imageLastTickRef.current = null;
    };
  }, [opened, activeStory?.id, paused, currentDurationMs]);

  useEffect(() => {
    if (!activeStory || activeStory.mediaType !== 'video') return;

    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
    } else {
      void video.play().catch(() => undefined);
    }
  }, [paused, activeStory?.id]);

  useEffect(() => {
    if (!opened) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }

      if (event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar') {
        event.preventDefault();
        setPaused((previousValue) => !previousValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, activeIndex, activeStory?.id, activeUsernameIndex, stories.length]);

  const progress = useMemo(
    () => stories.map((_, index) => {
      if (index < activeIndex) return 100;
      if (index > activeIndex) return 0;
      return currentDurationMs > 0 ? Math.max(0, Math.min(100, (progressMs / currentDurationMs) * 100)) : 0;
    }),
    [stories, activeIndex, progressMs, currentDurationMs],
  );

  const submitReply = async (content: string) => {
    if (!activeStory) return;
    const value = content.trim();
    if (!value) return;

    try {
      await sprygramApi.replyToStory(activeStory.id, { content: value }, auth);
      setReply('');
      notifications.show({ color: 'teal', title: 'Reply sent', message: 'Your story reply was delivered.' });
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Reply failed', message: error.message || 'Unable to send reply' });
    }
  };

  const likeStory = async () => {
    if (!activeStory || storyLiked[activeStory.id]) return;
    playLikeSound();
    await submitReply('\u2764\uFE0F');
    setStoryLiked((previousValue) => ({ ...previousValue, [activeStory.id]: true }));
  };

  const closeViewer = () => {
    completeAccountIfFinished(activeUsername, stories);
    onClose();
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={closeViewer}
        withCloseButton={false}
        centered
        radius="md"
        size="auto"
        overlayProps={{ blur: 1, opacity: 0.88, color: '#000' }}
        styles={{
          body: { padding: 0, background: '#000' },
          content: { background: '#000', overflow: 'hidden', maxHeight: '96vh' },
        }}
      >
        <div
          className="relative flex flex-col overflow-hidden rounded-lg bg-black text-white"
          style={{
            height: 'min(94vh, 820px)',
            width: 'min(calc((94vh) * 0.5625), calc(100vw - 24px))',
          }}
        >
          <button type="button" className="absolute right-3 top-3 z-30 rounded-md p-1 hover:bg-white/10" onClick={closeViewer} aria-label="Close story viewer" title="Close story viewer">
            <IconX size={20} />
          </button>

          <div className="absolute left-2 right-2 top-2 z-20 flex gap-1">
            {progress.map((value, index) => (
              <div key={`${stories[index]?.id || index}`} className="h-[3px] flex-1 rounded bg-white/25">
                <div className="h-full rounded bg-white" style={{ width: `${value}%` }} />
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-white/75">Loading stories...</div>
          ) : !activeStory ? (
            <div className="flex h-full items-center justify-center text-sm text-white/75">No active stories.</div>
          ) : (
            <>
              <div className="absolute left-3 right-12 top-6 z-20">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap={8}>
                    <ProfileAvatar
                      size={34}
                      src={storyData?.profile.avatarUrl}
                      name={storyData?.profile.displayName || storyData?.profile.username}
                      ringTone={activeStory.viewed ? 'viewed' : 'story'}
                    />
                    <Stack gap={0}>
                      <Text size="sm" fw={700}>{storyData?.profile.username}</Text>
                      <Text size="xs" c="gray.4">{formatRelativeTime(activeStory.createdAt)}</Text>
                    </Stack>
                  </Group>

                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    className="text-white hover:bg-white/10"
                    onClick={() => setPaused((previousValue) => !previousValue)}
                    aria-label={paused ? 'Play story' : 'Pause story'}
                    title={paused ? 'Play story' : 'Pause story'}
                  >
                    {paused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
                  </ActionIcon>
                </Group>
              </div>

              <div className="flex-1">
                {activeStory.mediaType === 'video' ? (
                  <video
                    key={activeStory.id}
                    ref={videoRef}
                    src={activeStory.mediaUrl}
                    className="h-full w-full object-contain"
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={(event) => {
                      const duration = Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0
                        ? Math.max(3000, Math.min(event.currentTarget.duration * 1000, 15000))
                        : 8000;
                      setCurrentDurationMs(duration);
                      setProgressMs(event.currentTarget.currentTime * 1000);
                    }}
                    onTimeUpdate={(event) => setProgressMs(event.currentTarget.currentTime * 1000)}
                    onPause={() => setPaused(true)}
                    onPlay={() => setPaused(false)}
                    onEnded={next}
                  />
                ) : (
                  <img src={activeStory.mediaUrl} alt="Story" className="h-full w-full object-contain" />
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-3 pb-3 pt-20">
                <Stack gap="xs">
                  {!isOwnStory ? (
                    <Group gap={6}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="rounded-full bg-white/12 px-3 py-1 text-sm transition hover:bg-white/20"
                          onClick={() => void submitReply(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </Group>
                  ) : null}

                  <Group wrap="nowrap" align="center">
                    <TextInput
                      value={reply}
                      onChange={(event) => setReply(event.currentTarget.value)}
                      placeholder={isOwnStory ? 'Add a comment...' : 'Reply to story'}
                      className="flex-1"
                      styles={{
                        input: {
                          background: 'rgba(0,0,0,0.45)',
                          borderColor: 'rgba(255,255,255,0.25)',
                          color: '#fff',
                        },
                      }}
                      onFocus={() => {
                        if (!paused) {
                          pausedByInputRef.current = true;
                          setPaused(true);
                        }
                      }}
                      onBlur={() => {
                        if (pausedByInputRef.current) {
                          pausedByInputRef.current = false;
                          setPaused(false);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        void submitReply(reply);
                      }}
                    />

                    {!isOwnStory ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        className="text-white hover:bg-white/10"
                        onClick={() => void likeStory()}
                        aria-label="Like story"
                        title="Like story"
                      >
                        {storyLiked[activeStory.id] ? <IconHeartFilled size={22} color="#ef4444" /> : <IconHeart size={22} />}
                      </ActionIcon>
                    ) : null}

                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      className="text-white hover:bg-white/10"
                      onClick={() => setShareOpen(true)}
                      aria-label="Share story"
                      title="Share story"
                    >
                      <IconSend size={20} />
                    </ActionIcon>
                  </Group>
                </Stack>
              </div>
            </>
          )}

          <button type="button" className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/15 p-1 hover:bg-white/25" onClick={previous} aria-label="Previous story" title="Previous story">
            <IconChevronLeft size={18} />
          </button>
          <button type="button" className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/15 p-1 hover:bg-white/25" onClick={next} aria-label="Next story" title="Next story">
            <IconChevronRight size={18} />
          </button>
        </div>
      </Modal>

      <ShareDialog
        opened={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={storyShareUrl}
        title="story"
        shareText={activeStory?.caption || `View ${storyData?.profile.username}'s story on Sprysnap.`}
      />
    </>
  );
}
