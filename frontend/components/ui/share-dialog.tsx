'use client';

import { Button, Group, Modal, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandTelegram, IconBrandWhatsapp, IconLink, IconMail, IconPlus, IconSearch, IconSend2, IconShare3 } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { Conversation, SearchAccountResult } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { ProfileAvatar } from './profile-avatar';

type ShareTarget = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type Props = {
  opened: boolean;
  onClose: () => void;
  shareUrl: string;
  title: string;
  shareText?: string | null;
  /** Drive file ID of the first media item — enables the "Add to your story" option */
  storyDriveFileId?: string;
  /** Preview thumbnail URL to show on the story card */
  storyPreviewUrl?: string | null;
  /** Original creator username shown on the story attribution */
  storyAuthorUsername?: string;
};

export function ShareDialog({ opened, onClose, shareUrl, title, shareText, storyDriveFileId, storyPreviewUrl, storyAuthorUsername }: Props) {
  const auth = useApiAuth();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [addingToStory, setAddingToStory] = useState(false);
  const [addedToStory, setAddedToStory] = useState(false);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [results, setResults] = useState<SearchAccountResult[]>([]);
  const [selected, setSelected] = useState<Record<string, ShareTarget>>({});

  useEffect(() => {
    if (!opened || !auth.token) return;

    setLoading(true);
    Promise.all([
      sprygramApi.getConversations(20, auth).catch(() => ({ items: [] })),
      sprygramApi.searchAccounts('', 8, auth).catch(() => ({ items: [] })),
    ])
      .then(([conversationResponse, searchResponse]) => {
        setConversations(conversationResponse.items || []);
        setResults(searchResponse.items || []);
      })
      .finally(() => setLoading(false));
  }, [opened, auth.token, auth.workspaceId]);

  useEffect(() => {
    if (!opened || !auth.token) return;

    const trimmed = query.trim();
    if (!trimmed) {
      void sprygramApi.searchAccounts('', 8, auth)
        .then((response) => setResults(response.items || []))
        .catch(() => setResults([]));
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await sprygramApi.searchAccounts(trimmed, 15, auth);
        setResults(response.items || []);
      } catch {
        setResults([]);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [opened, query, auth.token, auth.workspaceId]);

  const frequentTargets = useMemo<ShareTarget[]>(
    () => conversations.map((entry) => ({
      userId: entry.peer.userId,
      username: entry.peer.username,
      displayName: entry.peer.displayName,
      avatarUrl: entry.peer.avatarUrl,
    })),
    [conversations],
  );

  const searchTargets = useMemo<ShareTarget[]>(
    () => results.map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
    })),
    [results],
  );

  const toggleSelection = (target: ShareTarget) => {
    setSelected((previous) => {
      const next = { ...previous };
      if (next[target.userId]) {
        delete next[target.userId];
      } else {
        next[target.userId] = target;
      }
      return next;
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    notifications.show({ color: 'teal', title: 'Link copied', message: 'Share link copied to clipboard.' });
  };

  const openExternalShare = (platform: 'whatsapp' | 'telegram' | 'email' | 'native') => {
    const payload = [shareText?.trim(), shareUrl].filter(Boolean).join(' ');

    if (platform === 'native') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        void navigator.share({
          title: `Sprygram ${title}`,
          text: shareText || undefined,
          url: shareUrl,
        }).catch(() => undefined);
        return;
      }
      void copyLink();
      return;
    }

    const encoded = encodeURIComponent(payload);
    const href = platform === 'whatsapp'
      ? `https://wa.me/?text=${encoded}`
      : platform === 'telegram'
        ? `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText || '')}`
        : `mailto:?subject=${encodeURIComponent(`Sprygram ${title}`)}&body=${encoded}`;

    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const addToStory = async () => {
    if (!storyDriveFileId || addingToStory) return;
    setAddingToStory(true);
    try {
      const caption = storyAuthorUsername
        ? `Originally shared from @${storyAuthorUsername} \u2014 ${shareUrl}`
        : shareUrl;
      await sprygramApi.createStory({ driveFileId: storyDriveFileId, caption }, auth);
      setAddedToStory(true);
      notifications.show({ color: 'teal', title: 'Added to your story', message: 'This post has been added to your story!' });
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Failed', message: error.message || 'Could not add to story.' });
    } finally {
      setAddingToStory(false);
    }
  };

  const send = async () => {
    const targets = Object.values(selected);
    if (!targets.length) return;

    setSending(true);
    try {
      const content = [note.trim(), shareText?.trim(), shareUrl].filter(Boolean).join('\n');
      await Promise.all(targets.map((target) => (
        sprygramApi.sendMessage({
          receiverId: target.userId,
          content,
        }, auth)
      )));

      notifications.show({
        color: 'teal',
        title: 'Shared',
        message: `${title} sent to ${targets.length} ${targets.length === 1 ? 'friend' : 'friends'}.`,
      });
      setSelected({});
      setNote('');
      onClose();
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Share failed', message: error.message || 'Unable to send right now.' });
    } finally {
      setSending(false);
    }
  };

  const renderRow = (target: ShareTarget) => {
    const active = Boolean(selected[target.userId]);
    return (
      <button
        key={target.userId}
        type="button"
        className={`w-full rounded-xl border px-3 py-2 text-left transition ${active ? 'border-[var(--spry-accent)] bg-[var(--spry-accent-soft)]' : 'border-transparent hover:bg-gray-50'}`}
        onClick={() => toggleSelection(target)}
      >
        <Group wrap="nowrap" justify="space-between">
          <Group gap={10} wrap="nowrap">
            <ProfileAvatar size={40} src={target.avatarUrl} name={target.displayName || target.username} />
            <Stack gap={0} className="min-w-0">
              <Text size="sm" fw={700} lineClamp={1}>{target.username}</Text>
              <Text size="xs" c="dimmed" lineClamp={1}>{target.displayName || 'Sprygram friend'}</Text>
            </Stack>
          </Group>
          <div className={`h-5 w-5 rounded-full border ${active ? 'border-[var(--spry-accent)] bg-[var(--spry-accent)]' : 'border-[#d1d5db]'}`} />
        </Group>
      </button>
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} centered title={`Share ${title}`} size="md">
      <Stack gap="md">
        {/* Instagram-style "Add to your story" card */}
        {storyDriveFileId && (
          <button
            type="button"
            onClick={addToStory}
            disabled={addingToStory || addedToStory}
            className="group relative w-full overflow-hidden rounded-2xl border border-border text-left transition hover:opacity-90 disabled:cursor-default"
            style={{ height: 120 }}
          >
            {/* Thumbnail */}
            {storyPreviewUrl ? (
              <img src={storyPreviewUrl} alt="Story preview" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            {/* Attribution */}
            {storyAuthorUsername && (
              <span className="absolute left-3 top-3 text-xs font-semibold text-white drop-shadow">
                @{storyAuthorUsername}
              </span>
            )}
            {/* Action label */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--spry-accent)]">
                {addedToStory ? (
                  <span className="text-xs text-white">✓</span>
                ) : (
                  <IconPlus size={14} color="white" />
                )}
              </span>
              <span className="text-sm font-semibold text-white drop-shadow">
                {addedToStory ? 'Added to your story!' : addingToStory ? 'Adding…' : 'Add to your story'}
              </span>
            </div>
          </button>
        )}

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search friends"
          leftSection={<IconSearch size={16} />}
        />

        <div className="rounded-2xl border border-border p-3">
          <Text size="xs" fw={700} c="dimmed" mb={8}>Most frequently sent</Text>
          {loading ? (
            <Text size="sm" c="dimmed">Loading friends...</Text>
          ) : frequentTargets.length === 0 ? (
            <Text size="sm" c="dimmed">No recent conversations yet.</Text>
          ) : (
            <ScrollArea.Autosize mah={180}>
              <Stack gap={6}>{frequentTargets.map(renderRow)}</Stack>
            </ScrollArea.Autosize>
          )}
        </div>

        <div className="rounded-2xl border border-border p-3">
          <Text size="xs" fw={700} c="dimmed" mb={8}>Find more people</Text>
          {searchTargets.length === 0 ? (
            <Text size="sm" c="dimmed">No matching accounts.</Text>
          ) : (
            <ScrollArea.Autosize mah={220}>
              <Stack gap={6}>{searchTargets.map(renderRow)}</Stack>
            </ScrollArea.Autosize>
          )}
        </div>

        <TextInput
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="Add a message"
        />

        <div className="rounded-2xl border border-border p-3">
          <Text size="xs" fw={700} c="dimmed" mb={8}>Share elsewhere</Text>
          <Group gap="xs">
            <Button variant="default" leftSection={<IconBrandWhatsapp size={15} />} onClick={() => openExternalShare('whatsapp')}>
              WhatsApp
            </Button>
            <Button variant="default" leftSection={<IconBrandTelegram size={15} />} onClick={() => openExternalShare('telegram')}>
              Telegram
            </Button>
            <Button variant="default" leftSection={<IconMail size={15} />} onClick={() => openExternalShare('email')}>
              Email
            </Button>
            <Button variant="default" leftSection={<IconShare3 size={15} />} onClick={() => openExternalShare('native')}>
              More
            </Button>
          </Group>
        </div>

        <Group justify="space-between">
          <Button variant="default" leftSection={<IconLink size={15} />} onClick={() => void copyLink()}>
            Copy link
          </Button>
          <Button
            leftSection={<IconSend2 size={15} />}
            disabled={!Object.keys(selected).length}
            loading={sending}
            onClick={() => void send()}
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
