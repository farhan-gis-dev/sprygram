'use client';

import { Group, Popover, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { DirectMessage } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/time';
import { getRichLibraryItem, parseRichMessageToken } from '@/lib/message-rich-content';
import { playClickSound } from '@/lib/sounds';

type Props = {
  message: DirectMessage;
};

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😠', '👍'];

const renderMedia = (message: DirectMessage) => {
  if (!message.mediaUrl || !message.mediaMimeType) return null;

  if (message.mediaMimeType.startsWith('audio/')) {
    return (
      <audio controls className="w-full min-w-[220px]">
        <source src={message.mediaUrl} type={message.mediaMimeType} />
      </audio>
    );
  }

  if (message.mediaMimeType.startsWith('video/')) {
    return (
      <video
        src={message.mediaUrl}
        className="max-h-[360px] w-full rounded-[18px] object-cover"
        controls
        playsInline
      />
    );
  }

  return (
    <img
      src={message.mediaUrl}
      alt="Shared media"
      className="max-h-[360px] w-full rounded-[18px] object-cover"
    />
  );
};

const renderRichContent = (message: DirectMessage) => {
  const token = parseRichMessageToken(message.content);
  if (!token) return null;

  const item = getRichLibraryItem(token.kind, token.key);
  if (!item) return null;

  if (token.kind === 'gif') {
    return (
      <div
        className="message-rich-gif min-w-[220px] rounded-[22px] px-5 py-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentTo})`,
        }}
      >
        <Stack gap={8} align="center">
          <div className="text-4xl">{item.emoji}</div>
          <Text size="sm" fw={700} className="tracking-[0.14em] uppercase">{item.label}</Text>
        </Stack>
      </div>
    );
  }

  return (
    <div
      className="message-rich-sticker inline-flex items-center gap-3 rounded-[999px] px-4 py-3"
      style={{
        background: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentTo})`,
      }}
    >
      <span className="text-2xl text-white">{item.emoji}</span>
      <Text size="sm" fw={700} c="white">{item.label}</Text>
    </div>
  );
};

export function MessageBubble({ message }: Props) {
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const media = renderMedia(message);
  const rich = !media ? renderRichContent(message) : null;
  const plainText = !media && !rich && message.content ? message.content.trim() : '';
  const fallbackText = !media && !rich && !plainText
    ? (message.storyId ? 'Replied to story' : 'Sent media')
    : '';
  const surfaceClass = media || rich
    ? message.mine
      ? 'rounded-[24px] bg-[#1f7ae0] px-2 py-2 text-white'
      : 'rounded-[24px] border border-[#dbdbdb] bg-[#efefef] px-2 py-2 text-[#262626]'
    : message.mine
      ? 'rounded-[22px] bg-[#1f7ae0] px-4 py-3 text-white'
      : 'rounded-[22px] border border-[#dbdbdb] bg-[#efefef] px-4 py-3 text-[#262626]';

  const addReaction = (emoji: string) => {
    playClickSound();
    setReactions((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
    setPickerOpen(false);
  };

  const reactionEntries = Object.entries(reactions).filter(([, count]) => count > 0);

  return (
    <Group justify={message.mine ? 'flex-end' : 'flex-start'}>
      <div className="max-w-[72%]">
        {/* Bubble row + reaction trigger */}
        <div className={`group flex items-end gap-1 ${message.mine ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Bubble */}
          <div className={surfaceClass}>
            {media ? (
              <div className={`overflow-hidden rounded-[22px] border p-1 ${message.mine ? 'border-black/5 bg-black/5' : 'border-[#cfd6de] bg-[#eef2f6]'}`}>
                {media}
              </div>
            ) : null}
            {rich ? <div>{rich}</div> : null}
            {plainText ? (
              <Text size="sm" className="whitespace-pre-wrap leading-6">{plainText}</Text>
            ) : null}
            {fallbackText ? (
              <Text size="sm" className="leading-6">{fallbackText}</Text>
            ) : null}
            <Text size="10px" mt={media || rich || plainText || fallbackText ? 6 : 0} c={message.mine ? 'rgba(255,255,255,0.75)' : 'dimmed'}>
              {formatRelativeTime(message.createdAt)}
            </Text>
          </div>

          {/* WhatsApp-style reaction trigger — visible on hover */}
          <Popover
            opened={pickerOpen}
            onChange={setPickerOpen}
            withArrow
            shadow="md"
            position={message.mine ? 'top-end' : 'top-start'}
          >
            <Popover.Target>
              <button
                type="button"
                className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                onClick={() => setPickerOpen((p) => !p)}
                aria-label="React to message"
                title="React"
              >
                😊
              </button>
            </Popover.Target>
            <Popover.Dropdown p={4}>
              <Group gap={2}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-full p-1 text-xl transition hover:scale-125"
                    onClick={() => addReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </Group>
            </Popover.Dropdown>
          </Popover>
        </div>

        {/* Reaction pills below bubble */}
        {reactionEntries.length > 0 ? (
          <div className={`mt-1 flex flex-wrap gap-1 ${message.mine ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                className="flex items-center gap-0.5 rounded-full border border-border bg-white px-2 py-0.5 text-xs shadow-sm hover:bg-gray-50"
                onClick={() => addReaction(emoji)}
              >
                <span>{emoji}</span>
                {count > 1 ? <span className="text-[11px] font-semibold text-gray-600">{count}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Group>
  );
}
