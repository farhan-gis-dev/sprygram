'use client';

import { Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { StoryTrayItem } from '@/lib/api-types';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

type CurrentUserStoryTile = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasStories: boolean;
  ringTone: 'story' | 'viewed' | 'none';
};

type Props = {
  items: StoryTrayItem[];
  onOpen: (username: string) => void;
  currentUser?: CurrentUserStoryTile | null;
  onCreateStory?: () => void;
};

export function StoryTray({ items, onOpen, currentUser, onCreateStory }: Props) {
  const visibleItems = currentUser
    ? items.filter((item) => item.author.username.toLowerCase() !== currentUser.username.toLowerCase())
    : items;

  if (!visibleItems.length && !currentUser) return null;

  return (
    <div className="hide-scrollbar overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-4">
        {currentUser ? (
          <div className="relative flex w-[76px] flex-col items-center gap-2 text-center">
            <button
              type="button"
              className="relative"
              onClick={() => currentUser.hasStories ? onOpen(currentUser.username) : onCreateStory?.()}
            >
              <ProfileAvatar
                size={68}
                src={currentUser.avatarUrl}
                name={currentUser.displayName || currentUser.username}
                ringTone={currentUser.ringTone}
                alt={currentUser.username}
              />
              {/* + button: always create a new story */}
              <span
                role="button"
                tabIndex={0}
                className="absolute bottom-0 right-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#0095f6] text-white shadow-sm hover:bg-[#0077cc]"
                onClick={(e) => { e.stopPropagation(); onCreateStory?.(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onCreateStory?.(); } }}
                aria-label="Add new story"
                title="Add story"
              >
                <IconPlus size={12} stroke={2.2} />
              </span>
            </button>
            <Stack gap={0} align="center">
              <Text size="xs" lineClamp={1}>Your story</Text>
            </Stack>
          </div>
        ) : null}

        {visibleItems.map((item) => (
          <button
            key={item.author.userId}
            type="button"
            className="flex w-[76px] flex-col items-center gap-2 text-center"
            onClick={() => onOpen(item.author.username)}
          >
            <ProfileAvatar
              size={68}
              src={item.author.avatarUrl}
              name={item.author.displayName || item.author.username}
              ringTone={item.unviewedCount > 0 ? 'story' : 'viewed'}
              alt={item.author.username}
            />
            <Stack gap={0} align="center">
              <Text size="xs" lineClamp={1}>{item.author.username}</Text>
            </Stack>
          </button>
        ))}
      </div>
    </div>
  );
}
