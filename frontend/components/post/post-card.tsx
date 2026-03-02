'use client';

import {
  ActionIcon,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
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
  IconUserMinus,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { SprygramPost, SprygramProfile } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { formatRelativeTime, formatRelativeTimeWithSuffix } from '@/lib/time';
import { playLikeSound } from '@/lib/sounds';
import { FAVORITE_ACCOUNTS_KEY, SAVED_POSTS_KEY, hasStoredId, toggleStoredId } from '@/lib/client-storage';
import { CommentsModal } from './comments-modal';
import { MediaView } from './media-view';
import { FollowButton } from '@/components/profile/follow-button';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { ShareDialog } from '@/components/ui/share-dialog';

type Props = {
  post: SprygramPost;
  viewer?: SprygramProfile | null;
  onPostChange?: (post: SprygramPost) => void;
  onOpenStory?: (username: string) => void;
  storyRingTone?: 'story' | 'viewed' | 'none';
};

export function PostCard({
  post,
  viewer = null,
  onPostChange,
  onOpenStory,
  storyRingTone = 'none',
}: Props) {
  const auth = useApiAuth();
  const router = useRouter();
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [favoritedAuthor, setFavoritedAuthor] = useState(false);
  const [liking, setLiking] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutProfile, setAboutProfile] = useState<SprygramProfile | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const media = post.media[activeMediaIndex] || null;
  const canSlide = post.media.length > 1;
  const isOwnPost = viewer?.userId === post.author.userId;

  useEffect(() => {
    setSaved(hasStoredId(SAVED_POSTS_KEY, post.id));
    setFavoritedAuthor(hasStoredId(FAVORITE_ACCOUNTS_KEY, post.author.userId));
  }, [post.id, post.author.userId]);

  const likeLabel = useMemo(() => {
    if (post.likeCount === 1) return '1 like';
    return `${post.likeCount} likes`;
  }, [post.likeCount]);

  const update = (next: SprygramPost) => {
    onPostChange?.(next);
  };

  const patch = (next: Partial<SprygramPost>) => {
    update({ ...post, ...next });
  };

  const patchAuthorFollowStatus = (followStatus: SprygramPost['author']['followStatus']) => {
    patch({
      author: {
        ...post.author,
        followStatus,
      },
    });
  };

  const postUrl = typeof window === 'undefined'
    ? `/p/${post.id}`
    : new URL(`/p/${post.id}`, window.location.origin).toString();

  const toggleLike = async () => {
    if (liking) return;
    setLiking(true);
    setLikePulse(true);

    const optimisticLiked = !post.isLiked;
    const optimisticCount = optimisticLiked ? post.likeCount + 1 : Math.max(0, post.likeCount - 1);
    patch({ isLiked: optimisticLiked, likeCount: optimisticCount });
    if (optimisticLiked) playLikeSound();

    try {
      const res = optimisticLiked
        ? await sprygramApi.likePost(post.id, auth)
        : await sprygramApi.unlikePost(post.id, auth);

      patch({
        isLiked: res.liked,
        likeCount: res.likeCount,
      });
    } catch (error: any) {
      patch({ isLiked: post.isLiked, likeCount: post.likeCount });
      notifications.show({ color: 'red', title: 'Like failed', message: error.message });
    } finally {
      setLiking(false);
    }
  };

  useEffect(() => {
    if (!likePulse) return;
    const timer = window.setTimeout(() => setLikePulse(false), 220);
    return () => window.clearTimeout(timer);
  }, [likePulse]);

  const toggleSaved = () => {
    const next = toggleStoredId(SAVED_POSTS_KEY, post.id);
    setSaved(next);
    notifications.show({
      color: 'dark',
      title: next ? 'Saved' : 'Removed',
      message: next ? 'Post added to your saved collection.' : 'Post removed from your saved collection.',
    });
  };

  const toggleFavorites = () => {
    const next = toggleStoredId(FAVORITE_ACCOUNTS_KEY, post.author.userId);
    setFavoritedAuthor(next);
    notifications.show({
      color: 'dark',
      title: next ? 'Added to favourites' : 'Removed from favourites',
      message: `@${post.author.username} ${next ? 'was added to' : 'was removed from'} favourites.`,
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(postUrl);
    notifications.show({ color: 'teal', title: 'Link copied', message: 'Post link copied to clipboard.' });
  };

  const sharePost = async () => {
    setShareOpen(true);
  };

  const openAboutAccount = async () => {
    setAboutOpen(true);
    if (aboutProfile) return;

    setAboutLoading(true);
    try {
      const profile = await sprygramApi.getProfileByUsername(post.author.username, auth);
      setAboutProfile(profile);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Profile unavailable', message: error.message || 'Unable to load account details.' });
    } finally {
      setAboutLoading(false);
    }
  };

  const unfollowFromMenu = async () => {
    try {
      await sprygramApi.unfollowUser(post.author.userId, auth);
      patchAuthorFollowStatus('none');
      notifications.show({ color: 'dark', title: 'Updated', message: `You no longer follow @${post.author.username}.` });
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Action failed', message: error.message || 'Unable to update follow status.' });
    }
  };

  const avatarNode = (
    <ProfileAvatar
      size={36}
      src={post.author.avatarUrl}
      name={post.author.displayName || post.author.username}
      ringTone={storyRingTone}
      alt={post.author.username}
    />
  );

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-border bg-panel shadow-card">
        <header className="flex items-center justify-between px-4 py-3">
          <Group gap={10} wrap="nowrap">
            {storyRingTone !== 'none' && onOpenStory ? (
              <button
                type="button"
                className="rounded-full"
                onClick={() => onOpenStory(post.author.username)}
                aria-label={`Open ${post.author.username}'s story`}
              >
                {avatarNode}
              </button>
            ) : (
              <Link href={`/u/${post.author.username}`} className="rounded-full">
                {avatarNode}
              </Link>
            )}

            <Stack gap={0}>
              <Link href={`/u/${post.author.username}`}>
                <Text size="sm" fw={700}>@{post.author.username}</Text>
              </Link>
              <Text size="xs" c="dimmed">{formatRelativeTime(post.createdAt)}</Text>
            </Stack>
          </Group>

          <Group gap={8} wrap="nowrap">
            {!isOwnPost ? (
              <FollowButton
                targetUserId={post.author.userId}
                initialStatus={post.author.followStatus}
                onStatusChange={patchAuthorFollowStatus}
              />
            ) : null}

            <Menu width={220} shadow="md" position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Post options" title="Post options">
                  <IconDots size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconFlag3 size={15} />} onClick={() => notifications.show({ color: 'orange', title: 'Reported', message: 'Thanks. We will review this account.' })}>
                  Report
                </Menu.Item>
                {!isOwnPost && post.author.followStatus !== 'none' ? (
                  <Menu.Item leftSection={<IconUserMinus size={15} />} onClick={() => void unfollowFromMenu()}>
                    Unfollow
                  </Menu.Item>
                ) : null}
                <Menu.Item
                  leftSection={favoritedAuthor ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                  onClick={toggleFavorites}
                >
                  {favoritedAuthor ? 'Remove from Favourites' : 'Add to Favourites'}
                </Menu.Item>
                <Menu.Item leftSection={<IconLink size={15} />} onClick={() => router.push(`/p/${post.id}`)}>
                  Go to Post
                </Menu.Item>
                <Menu.Item leftSection={<IconSend size={15} />} onClick={() => void sharePost()}>
                  Share
                </Menu.Item>

                <Menu.Item leftSection={<IconLink size={15} />} onClick={() => void copyLink()}>
                  Copy Link
                </Menu.Item>
                <Menu.Item leftSection={<IconInfoCircle size={15} />} onClick={() => void openAboutAccount()}>
                  About this Account
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => undefined}>
                  Cancel
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </header>

        <div className="relative">
          {media ? <MediaView media={media} /> : null}

          {canSlide ? (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-xs"
                onClick={() => setActiveMediaIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeMediaIndex === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-xs"
                onClick={() => setActiveMediaIndex((prev) => Math.min(post.media.length - 1, prev + 1))}
                disabled={activeMediaIndex === post.media.length - 1}
              >
                Next
              </button>

              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {post.media.map((entry, index) => (
                  <span
                    key={entry.id}
                    className={`h-1.5 w-1.5 rounded-full ${index === activeMediaIndex ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          ) : null}

          <CommentsModal
            opened={commentsOpen}
            postId={post.id}
            onClose={() => setCommentsOpen(false)}
            viewer={viewer}
            onCommentCountIncrement={() => patch({ commentCount: post.commentCount + 1 })}
          />
        </div>

        <section className="px-4 py-3">
          <Group justify="space-between">
            <Group gap={4}>
            <ActionIcon variant="subtle" color="gray" onClick={() => void toggleLike()} loading={liking} aria-label={post.isLiked ? 'Unlike post' : 'Like post'} title={post.isLiked ? 'Unlike post' : 'Like post'}>
              {post.isLiked ? <IconHeartFilled size={22} color="#ed4956" className={likePulse ? 'animate-interact-pop' : ''} /> : <IconHeart size={22} className={likePulse ? 'animate-interact-pop' : ''} />}
            </ActionIcon>
              <ActionIcon variant="subtle" color="gray" onClick={() => setCommentsOpen((prev) => !prev)} aria-label={commentsOpen ? 'Hide comments' : 'Show comments'} title={commentsOpen ? 'Hide comments' : 'Show comments'}>
                <IconMessageCircle size={22} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" onClick={() => void sharePost()} aria-label="Share post" title="Share post">
                <IconSend size={22} />
              </ActionIcon>
            </Group>

            <ActionIcon variant="subtle" color="gray" onClick={toggleSaved} aria-label={saved ? 'Remove from saved posts' : 'Save post'} title={saved ? 'Remove from saved posts' : 'Save post'}>
              {saved ? <IconBookmarkFilled size={21} /> : <IconBookmark size={21} />}
            </ActionIcon>
          </Group>

          <Stack gap={2} mt={6}>
            <Text size="sm" fw={700}>{likeLabel}</Text>
            {post.caption ? (
              <Text size="sm">
                <Link href={`/u/${post.author.username}`} className="font-semibold">@{post.author.username}</Link>{' '}
                {post.caption}
              </Text>
            ) : null}
            <button type="button" className="w-fit text-xs text-muted" onClick={() => setCommentsOpen((prev) => !prev)}>
              {commentsOpen ? 'Hide comments' : `View all ${post.commentCount} comments`}
            </button>
            <Text size="xs" c="dimmed">{formatRelativeTimeWithSuffix(post.createdAt)}</Text>
          </Stack>
        </section>
      </article>

      <Modal opened={aboutOpen} onClose={() => setAboutOpen(false)} centered title="About this account">
        <Stack gap="sm">
          <Group wrap="nowrap">
            <ProfileAvatar
              size={56}
              src={aboutProfile?.avatarUrl || post.author.avatarUrl}
              name={aboutProfile?.displayName || aboutProfile?.username || post.author.displayName || post.author.username}
            />
            <Stack gap={1}>
              <Text fw={700}>{aboutProfile?.username || post.author.username}</Text>
              <Text size="sm" c="dimmed">{aboutProfile?.displayName || post.author.displayName || 'Sprygram creator'}</Text>
            </Stack>
          </Group>
          {aboutLoading ? <Text size="sm" c="dimmed">Loading account details...</Text> : null}
          {!aboutLoading ? (
            <>
              <Text size="sm">{aboutProfile?.bio || 'No bio provided.'}</Text>
              <Text size="sm"><b>{aboutProfile?.stats.posts ?? 0}</b> posts</Text>
              <Text size="sm"><b>{aboutProfile?.stats.followers ?? 0}</b> followers</Text>
              <Text size="sm"><b>{aboutProfile?.stats.following ?? 0}</b> following</Text>
              <Text size="sm">Account type: {aboutProfile?.isPrivate ? 'Private' : 'Public'}</Text>
            </>
          ) : null}
        </Stack>
      </Modal>

      <ShareDialog
        opened={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={postUrl}
        title="post"
        shareText={post.caption || `View @${post.author.username}'s post on Sprygram.`}
        storyDriveFileId={!isOwnPost && post.media.length > 0 ? post.media[0].driveFileId : undefined}
        storyPreviewUrl={!isOwnPost && media ? (media as any).url ?? null : null}
        storyAuthorUsername={!isOwnPost ? post.author.username : undefined}
      />
    </>
  );
}
