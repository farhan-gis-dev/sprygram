'use client';

import { Avatar, Button, Group, SimpleGrid, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCompass, IconPlayerPlay, IconSearch, IconGridDots, IconUserPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { SearchAccountResult, SprygramPost } from '@/lib/api-types';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { FollowButton } from '@/components/profile/follow-button';

function PostTile({ post }: { post: SprygramPost }) {
  const firstMedia = post.media?.[0];
  const isVideo = firstMedia?.mediaType === 'video';
  const hasMultiple = (post.media?.length ?? 0) > 1;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group relative aspect-square overflow-hidden rounded-lg bg-[#f0f2f5] block"
    >
      {firstMedia ? (
        isVideo ? (
          <video
            src={firstMedia.url}
            className="h-full w-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <img
            src={firstMedia.url}
            alt={post.caption || 'Post'}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#e5e7eb]">
          <IconGridDots size={28} color="#9ca3af" />
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="flex items-center gap-1 text-white text-sm font-bold">
          ❤ {post.likeCount}
        </span>
        <span className="flex items-center gap-1 text-white text-sm font-bold">
          💬 {post.commentCount}
        </span>
      </div>

      {isVideo && (
        <span className="absolute right-2 top-2 rounded-full bg-black/50 p-0.5">
          <IconPlayerPlay size={12} color="white" fill="white" />
        </span>
      )}
      {hasMultiple && !isVideo && (
        <span className="absolute right-2 top-2 rounded-full bg-black/50 p-0.5">
          <IconGridDots size={12} color="white" />
        </span>
      )}
    </Link>
  );
}

export default function ExplorePage() {
  const { isReady, activeIdentity } = useDevAuth();
  const auth = useApiAuth();

  const [posts, setPosts] = useState<SprygramPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchAccountResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [suggested, setSuggested] = useState<SearchAccountResult[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPosts = useCallback(async (cursor?: string | null) => {
    if (cursor) setLoadingMore(true);
    else setLoadingPosts(true);
    try {
      // Try explore endpoint first, fall back to feed
      let res;
      try {
        res = await sprygramApi.getExplorePosts({ limit: 30, cursor: cursor ?? undefined }, auth);
      } catch {
        res = await sprygramApi.getFeed({ limit: 30, cursor: cursor ?? undefined }, auth);
      }
      setPosts((prev) => (cursor ? [...prev, ...res.items] : res.items));
      setNextCursor(res.nextCursor);
    } catch {
      // noop
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  }, [auth.token, auth.workspaceId]);

  useEffect(() => {
    if (!isReady || !auth.token) return;
    void loadPosts(null);

    sprygramApi.getSuggestedAccounts({ limit: 8 }, auth)
      .then((r) => setSuggested(r.items))
      .catch(() => setSuggested([]))
      .finally(() => setLoadingSuggested(false));
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          void loadPosts(nextCursor);
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loadPosts]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await sprygramApi.searchAccounts(searchQuery.trim(), auth);
        setSearchResults(res.items ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, auth.token, auth.workspaceId]);

  if (!isReady) return <LoadingState message="Loading Explore…" />;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6">
      {/* Header */}
      <Group mb="lg" gap="sm">
        <IconCompass size={26} stroke={1.8} />
        <Text fw={800} size="xl">Explore</Text>
      </Group>

      {/* Search bar */}
      <div className="relative mb-6 max-w-[480px]">
        <TextInput
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Search accounts…"
          size="md"
          radius="xl"
        />
        {searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-panel shadow-lg overflow-hidden">
            {searchLoading ? (
              <div className="p-3 text-center">
                <Text size="sm" c="dimmed">Searching…</Text>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center">
                <Text size="sm" c="dimmed">No accounts found for "{searchQuery}"</Text>
              </div>
            ) : (
              <Stack gap={0}>
                {searchResults.slice(0, 8).map((account) => (
                  <Link
                    key={account.userId}
                    href={`/u/${account.username}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover transition-colors"
                    onClick={() => setSearchQuery('')}
                  >
                    <ProfileAvatar src={account.avatarUrl} name={account.displayName || account.username} size={36} />
                    <div className="min-w-0">
                      <Text size="sm" fw={600} truncate>@{account.username}</Text>
                      {account.displayName && (
                        <Text size="xs" c="dimmed" truncate>{account.displayName}</Text>
                      )}
                    </div>
                    <Text size="xs" c="dimmed" className="ml-auto shrink-0">
                      {account.stats.followers >= 1_000
                        ? `${(account.stats.followers / 1_000).toFixed(1)}K`
                        : account.stats.followers} followers
                    </Text>
                  </Link>
                ))}
              </Stack>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Discovery grid */}
        <div>
          <Text fw={700} size="sm" c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            Discover
          </Text>

          {loadingPosts ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} radius="lg" style={{ aspectRatio: '1' }} />
              ))}
            </SimpleGrid>
          ) : posts.length === 0 ? (
            <EmptyState title="Nothing to explore yet" description="Check back after more people post." />
          ) : (
            <>
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                {posts.map((post) => (
                  <PostTile key={post.id} post={post} />
                ))}
              </SimpleGrid>
              <div ref={sentinelRef} className="h-8" />
              {loadingMore && (
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs" mt="xs">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} radius="lg" style={{ aspectRatio: '1' }} />
                  ))}
                </SimpleGrid>
              )}
            </>
          )}
        </div>

        {/* Suggested Accounts sidebar */}
        <div>
          <Text fw={700} size="sm" c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            People to follow
          </Text>
          <div className="rounded-2xl border border-border bg-panel p-4">
            {loadingSuggested ? (
              <Stack gap="sm">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Group key={i} gap="sm">
                    <Skeleton circle height={40} />
                    <div className="flex-1">
                      <Skeleton height={10} width="60%" mb={4} radius="xl" />
                      <Skeleton height={8} width="40%" radius="xl" />
                    </div>
                  </Group>
                ))}
              </Stack>
            ) : suggested.length === 0 ? (
              <Text size="sm" c="dimmed">No suggestions right now.</Text>
            ) : (
              <Stack gap="xs">
                {suggested.map((account) => (
                  <Group key={account.userId} justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" className="min-w-0">
                      <Link href={`/u/${account.username}`} className="shrink-0">
                        <ProfileAvatar src={account.avatarUrl} name={account.displayName || account.username} size={40} />
                      </Link>
                      <div className="min-w-0">
                        <Link href={`/u/${account.username}`}>
                          <Text size="sm" fw={600} truncate>@{account.username}</Text>
                        </Link>
                        {account.displayName && (
                          <Text size="xs" c="dimmed" truncate>{account.displayName}</Text>
                        )}
                      </div>
                    </Group>
                    <FollowButton
                      targetUserId={account.userId}
                      initialStatus={account.followStatus}
                      size="xs"
                    />
                  </Group>
                ))}
              </Stack>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
