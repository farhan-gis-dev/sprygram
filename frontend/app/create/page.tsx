'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { IconMovie, IconPhotoPlus, IconPlus, IconSparkles } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostComposer } from '@/components/post/post-composer';
import { StoryComposer } from '@/components/story/story-composer';
import { LoadingState } from '@/components/ui/loading-state';
import { useDevAuth } from '@/lib/dev-auth-context';

type CreateMode = 'post' | 'reel' | 'story';

const createModes: Array<{
  mode: CreateMode;
  title: string;
  description: string;
  icon: typeof IconPlus;
}> = [
  { mode: 'post', title: 'Post', description: 'Share photos or a carousel in your feed.', icon: IconPhotoPlus },
  { mode: 'reel', title: 'Reel', description: 'Upload one vertical video and publish it to Reels.', icon: IconMovie },
  { mode: 'story', title: 'Story', description: 'Share a quick photo or video that appears in your story tray.', icon: IconSparkles },
];

export default function CreatePage() {
  const { isReady } = useDevAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const mode: CreateMode | null = requestedMode === 'post' || requestedMode === 'reel' || requestedMode === 'story'
    ? requestedMode
    : null;

  if (!isReady) return <LoadingState message="Preparing composer..." />;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700} size="xl">Create</Text>
          <Text size="sm" c="dimmed">
            {mode ? 'Finish the selected upload flow below.' : 'Choose what you want to publish before selecting media.'}
          </Text>
        </Stack>

        {!mode ? (
          <div className="grid gap-4 md:grid-cols-3">
            {createModes.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.mode}
                  type="button"
                  className="rounded-[28px] border border-border bg-panel p-6 text-left shadow-card transition hover:-translate-y-0.5 hover:border-[#b8d6fb] hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)]"
                  onClick={() => router.replace(`/create?mode=${entry.mode}`)}
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--spry-accent-soft)] text-[var(--spry-accent)]">
                    <Icon size={22} />
                  </div>
                  <Text fw={700} size="lg">{entry.title}</Text>
                  <Text size="sm" c="dimmed" mt={6}>{entry.description}</Text>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Upload type: <span className="font-semibold capitalize text-[var(--spry-text)]">{mode}</span>
              </Text>
              <Button variant="default" onClick={() => router.replace('/create')}>Choose another type</Button>
            </Group>

            {mode === 'story' ? (
              <StoryComposer
                onCreated={() => {
                  router.push('/feed');
                }}
              />
            ) : (
              <PostComposer
                mode={mode}
                onCreated={() => {
                  router.push(mode === 'reel' ? '/reels' : '/feed');
                }}
              />
            )}
          </>
        )}
      </Stack>
    </div>
  );
}
