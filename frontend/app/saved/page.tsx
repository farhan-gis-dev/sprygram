'use client';

import { Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { sprygramApi } from '@/lib/api-client';
import type { SprygramPost } from '@/lib/api-types';
import { SAVED_POSTS_KEY, getStoredIds } from '@/lib/client-storage';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';

export default function SavedPage() {
  const auth = useApiAuth();
  const { isReady, activeIdentity } = useDevAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SprygramPost[]>([]);

  useEffect(() => {
    if (!isReady || !auth.token) return;

    const load = async () => {
      setLoading(true);
      try {
        const ids = getStoredIds(SAVED_POSTS_KEY);
        const posts = await Promise.all(ids.map((id) => sprygramApi.getPost(id, auth).catch(() => null)));
        setItems(posts.filter((item): item is SprygramPost => Boolean(item)));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  if (!isReady || loading) {
    return <LoadingState message="Loading saved posts..." />;
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 py-6">
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700} size="xl">Saved</Text>
          <Text size="sm" c="dimmed">Your private collection of bookmarked posts.</Text>
        </Stack>

        {items.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Bookmark posts from your feed and they will appear here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-[3px] md:grid-cols-3">
            {items.map((post) => {
              const media = post.media[0];
              return (
                <Link
                  key={post.id}
                  href={`/p/${post.id}`}
                  className="relative block aspect-square overflow-hidden rounded-md bg-black"
                >
                  {media?.mediaType === 'video' ? (
                    <video src={media.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : media ? (
                    <img src={media.url} alt={post.caption || post.author.username} className="h-full w-full object-cover" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </Stack>
    </div>
  );
}
