'use client';

import { Menu, Stack, Text } from '@mantine/core';
import { IconDots, IconPlus } from '@tabler/icons-react';
import type { StoryItem, StoryTrayItem } from '@/lib/api-types';
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
  myStoryItems?: StoryItem[];
  onDeleteStory?: (storyId: string) => void;
};

export function StoryTray({ items, onOpen, currentUser, onCreateStory, myStoryItems, onDeleteStory }: Props) {
  const visibleItems = currentUser
    ? items.filter((item) => item.author.username.toLowerCase() !== currentUser.username.toLowerCase())
    : items;

  if (!visibleItems.length && !currentUser) return null;

  return (
    <div className="hide-scrollbar overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-4">
        {currentUser ? (
          currentUser.hasStories ? (
            /* Has stories: clicking avatar opens the story; 3-dot button opens management menu */
            <div className="relative flex w-[88px] flex-col items-center gap-2 text-center">
              <div className="relative">
                {/* Main avatar — opens story viewer */}
                <button
                  type="button"
                  className="block"
                  onClick={() => onOpen(currentUser.username)}
                  aria-label="View my story"
                >
                  <ProfileAvatar
                    size={80}
                    src={currentUser.avatarUrl}
                    name={currentUser.displayName || currentUser.username}
                    ringTone={currentUser.ringTone}
                    alt={currentUser.username}
                  />
                </button>

                {/* + button — add to story */}
                <button
                  type="button"
                  className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#0095f6] text-white shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onCreateStory?.(); }}
                  aria-label="Add to story"
                >
                  <IconPlus size={12} stroke={2.2} />
                </button>

                {/* 3-dot management button */}
                <Menu position="bottom-start" shadow="md" width={200} withinPortal>
                  <Menu.Target>
                    <button
                      type="button"
                      className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-black/55 text-white shadow-sm backdrop-blur-sm"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Story options"
                    >
                      <IconDots size={11} stroke={2.5} />
                    </button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => onOpen(currentUser.username)}>View my story</Menu.Item>
                    <Menu.Item onClick={() => onCreateStory?.()}>Add to story</Menu.Item>
                    {myStoryItems && myStoryItems.length > 0 ? <Menu.Divider /> : null}
                    {myStoryItems?.map((s, idx) => (
                      <Menu.Item key={s.id} color="red" onClick={() => onDeleteStory?.(s.id)}>
                        Delete Story {idx + 1}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </div>
              <Stack gap={0} align="center">
                <Text size="xs" lineClamp={1}>Your story</Text>
              </Stack>
            </div>
          ) : (
            <button
              type="button"
              className="relative flex w-[88px] flex-col items-center gap-2 text-center"
              onClick={() => onCreateStory?.()}
            >
              <div className="relative">
                <ProfileAvatar
                  size={80}
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName || currentUser.username}
                  ringTone="none"
                  alt={currentUser.username}
                />
                <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#0095f6] text-white shadow-sm">
                  <IconPlus size={12} stroke={2.2} />
                </span>
              </div>
              <Stack gap={0} align="center">
                <Text size="xs" lineClamp={1}>Your story</Text>
              </Stack>
            </button>
          )
        ) : null}

        {visibleItems.map((item) => (
          <button
            key={item.author.userId}
            type="button"
            className="flex w-[88px] flex-col items-center gap-2 text-center"
            onClick={() => onOpen(item.author.username)}
          >
            <ProfileAvatar
              size={80}
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
