'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionIcon, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { PostCard } from '@/components/post/post-card';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { sprygramApi } from '@/lib/api-client';
import type { SprygramPost, SprygramProfile } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';

export default function PostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const auth = useApiAuth();
  const router = useRouter();
  const { isReady, activeIdentity } = useDevAuth();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<SprygramPost | null>(null);
  const [viewer, setViewer] = useState<SprygramProfile | null>(null);

  useEffect(() => {
    if (!isReady || !auth.token) return;
    setLoading(true);
    Promise.all([
      sprygramApi.getPost(postId, auth).catch(() => null),
      sprygramApi.getMyProfile(auth).catch(() => null),
    ]).then(([fetchedPost, me]) => {
      setPost(fetchedPost);
      setViewer(me);
    }).catch((err: any) => {
      notifications.show({ color: 'red', title: 'Error', message: err.message });
    }).finally(() => setLoading(false));
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId, postId]);

  if (!isReady || loading) return <LoadingState message="Loading post..." />;

  if (!post) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[640px] items-center justify-center px-4">
        <EmptyState title="Post not found" description="This post may have been removed or doesn't exist." />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6">
      <Group mb="md" gap="xs">
        <ActionIcon variant="subtle" color="dark" radius="xl" onClick={() => router.back()} aria-label="Go back">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Text fw={700} size="lg">Post</Text>
      </Group>

      <PostCard
        post={post}
        viewer={viewer}
        onPostChange={(updated) => setPost(updated)}
      />
    </div>
  );
}
