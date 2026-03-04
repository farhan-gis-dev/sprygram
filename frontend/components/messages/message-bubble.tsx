'use client';

import { Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { DirectMessage } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/time';
import { getRichLibraryItem, parseRichMessageToken } from '@/lib/message-rich-content';

type Props = {
  message: DirectMessage;
};

const REACTION_EMOJIS = ['\u2764\ufe0f', '\u{1F602}', '\u{1F62E}', '\u{1F625}', '\u{1F44F}', '\u{1F525}'];

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

  // Giphy / external URL GIF
  if (token.kind === 'gif' && token.key.startsWith('http')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={token.key}
        alt="GIF"
        className="max-h-[220px] min-w-[160px] max-w-[260px] rounded-[18px] object-cover"
        loading="lazy"
      />
    );
  }

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
  const media = renderMedia(message);
  const [reaction, setReaction] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const rich = !media ? renderRichContent(message) : null;
  const plainText = !media && !rich && message.content ? message.content.trim() : '';
  const fallbackText = !media && !rich && !plainText
    ? (message.storyId ? 'Replied to story' : 'Sent media')
    : '';
  const surfaceClass = media || rich
    ? message.mine
      ? 'rounded-[24px] bg-[#1f7ae0] px-2 py-2 text-white'
      : 'rounded-[24px] bg-[var(--color-hover)] border border-border px-2 py-2'
    : message.mine
      ? 'rounded-[22px] bg-[#1f7ae0] px-4 py-3 text-white'
      : 'rounded-[22px] bg-[var(--color-hover)] border border-border px-4 py-3';

  return (
    <Group justify={message.mine ? 'flex-end' : 'flex-start'}>
      <div
        className="group relative max-w-[72%]"
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
      >
        {/* Reaction picker — appears on hover */}
        {showPicker ? (
          <div
            className={`absolute -top-9 z-10 flex items-center gap-1 rounded-full border border-border bg-panel px-2 py-1 shadow-lg ${message.mine ? 'right-0' : 'left-0'}`}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="cursor-pointer rounded-full px-0.5 text-lg transition-transform hover:scale-125"
                onClick={() => { setReaction((prev) => prev === emoji ? null : emoji); setShowPicker(false); }}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div className={`${surfaceClass}`}>
          {media ? (
            <div className={`overflow-hidden rounded-[22px] border p-1 ${message.mine ? 'border-black/5 bg-black/5' : 'border-border bg-[var(--color-input-bg)]'}`}>
              {media}
            </div>
          ) : null}

          {rich ? <div>{rich}</div> : null}

          {plainText ? (
            <Text size="sm" className="whitespace-pre-wrap leading-6">
              {plainText}
            </Text>
          ) : null}

          {fallbackText ? (
            <Text size="sm" className="leading-6">
              {fallbackText}
            </Text>
          ) : null}

          <Text size="10px" mt={media || rich || plainText || fallbackText ? 6 : 0} c={message.mine ? 'rgba(255,255,255,0.75)' : 'dimmed'}>
            {formatRelativeTime(message.createdAt)}
            {message.mine && message.readAt ? (
              <span className="ml-1.5 font-medium" title={`Seen at ${new Date(message.readAt).toLocaleTimeString()}`}>· Seen</span>
            ) : null}
          </Text>
        </div>

        {/* Reaction badge below bubble */}
        {reaction ? (
          <button
            type="button"
            className={`absolute -bottom-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-panel text-sm shadow ${message.mine ? 'right-1' : 'left-1'}`}
            onClick={() => setReaction(null)}
            title="Remove reaction"
          >
            {reaction}
          </button>
        ) : null}
      </div>
    </Group>
  );
}
