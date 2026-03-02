'use client';

import { Group, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { Conversation, DirectMessage, SprygramProfile } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { summarizeRichMessageContent } from '@/lib/message-rich-content';
import { LoadingState } from '@/components/ui/loading-state';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { MessageBubble } from '@/components/messages/message-bubble';
import { MessageComposer } from '@/components/messages/message-composer';

export default function MessagesPage() {
  const { isReady, activeIdentity } = useDevAuth();
  const auth = useApiAuth();

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<SprygramProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [thread, setThread] = useState<DirectMessage[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isReady || !auth.token) return;
    setLoading(true);

    Promise.all([
      sprygramApi.getMyProfile(auth).catch(() => null),
      sprygramApi.getConversations(50, auth).catch(() => ({ items: [] })),
    ])
      .then(([meProfile, response]) => {
        setMe(meProfile);
        setConversations(response.items || []);
        const fromQuery = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('peer')
          : null;
        const initialPeer = fromQuery
          || response.items?.[0]?.peer.userId
          || null;
        setSelectedPeerId(initialPeer);
      })
      .finally(() => setLoading(false));
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.peer.userId === selectedPeerId) || null,
    [conversations, selectedPeerId],
  );

  const loadThread = async (peerUserId: string, cursor?: string | null) => {
    if (!cursor) {
      setThreadLoading(true);
    }

    try {
      const response = await sprygramApi.getThreadMessages(
        peerUserId,
        { limit: 30, cursor: cursor || undefined },
        auth,
      );

      setThread((previous) => (cursor ? [...response.items, ...previous] : response.items || []));
      setThreadCursor(response.nextCursor);

      if (!cursor) {
        await sprygramApi.markThreadRead(peerUserId, auth).catch(() => undefined);
        setConversations((previous) => previous.map((entry) => (
          entry.peer.userId === peerUserId ? { ...entry, unreadCount: 0 } : entry
        )));
      }
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Messages error', message: error.message });
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.token || !selectedPeerId) {
      setThread([]);
      return;
    }

    void loadThread(selectedPeerId);
  }, [selectedPeerId, auth.token, auth.workspaceId]);

  const visibleConversations = useMemo(() => {
    const inbox = conversations.filter((entry) => !(entry.unreadCount > 0 && entry.peer.followStatus !== 'accepted'));
    const normalized = search.trim().toLowerCase();
    if (!normalized) return inbox;
    return inbox.filter((entry) => (
      entry.peer.username.toLowerCase().includes(normalized)
      || (entry.peer.displayName || '').toLowerCase().includes(normalized)
    ));
  }, [conversations, search]);

  const requestCount = useMemo(
    () => conversations.filter((entry) => entry.unreadCount > 0 && entry.peer.followStatus !== 'accepted').length,
    [conversations],
  );

  const pushCreatedMessages = (messages: DirectMessage[]) => {
    if (!selectedPeerId || !messages.length) return;

    setThread((previous) => [...previous, ...messages]);
    const last = messages[messages.length - 1];
    const previewContent = summarizeRichMessageContent(last.content)
      || (last.mediaDriveFileId ? 'Sent media' : last.storyId ? 'Replied to story' : 'Sent a message');

    setConversations((previous) => {
      const existing = previous.find((entry) => entry.peer.userId === selectedPeerId);
      if (!existing) return previous;

      return [
        {
          ...existing,
          lastMessage: {
            id: last.id,
            content: previewContent,
            senderId: last.senderId,
            createdAt: last.createdAt,
          },
          unreadCount: 0,
        },
        ...previous.filter((entry) => entry.peer.userId !== selectedPeerId),
      ];
    });
  };

  if (!isReady || loading) {
    return <LoadingState message="Loading messages..." />;
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-24px)] max-w-[1200px] border border-border bg-panel">
      <aside className="w-[360px] border-r border-border">
        <div className="border-b border-border px-4 py-3">
          <Group justify="space-between">
            <Stack gap={0}>
              <Text fw={700}>{me?.username || 'Messages'}</Text>
              <Text size="xs" c="dimmed">Direct Messages</Text>
            </Stack>
            <Group gap={8}>
              <Link href="/messages/requests" className="rounded-full bg-[#f3f4f6] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-[#e5e7eb]">
                Requests {requestCount > 0 ? `(${requestCount})` : ''}
              </Link>
              <button type="button" className="rounded-md p-1 hover:bg-gray-100" aria-label="Start a new message" title="Start a new message">
                <IconEdit size={18} />
              </button>
            </Group>
          </Group>
          <TextInput
            mt="sm"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search"
            leftSection={<IconSearch size={14} />}
          />
        </div>

        <div className="hide-scrollbar h-[calc(100%-88px)] overflow-y-auto p-2">
          {visibleConversations.length === 0 ? (
            <Text size="sm" c="dimmed" px={8} py={8}>No conversations yet.</Text>
          ) : visibleConversations.map((conversation) => (
            <button
              key={conversation.threadId}
              type="button"
              className={`w-full rounded-lg px-2 py-2 text-left ${selectedPeerId === conversation.peer.userId ? 'bg-[#f4f4f5]' : 'hover:bg-gray-50'}`}
              onClick={() => setSelectedPeerId(conversation.peer.userId)}
            >
                <Group wrap="nowrap" justify="space-between">
                  <Group wrap="nowrap">
                    <ProfileAvatar size={42} src={conversation.peer.avatarUrl} name={conversation.peer.displayName || conversation.peer.username} />
                  <Stack gap={1} className="min-w-0">
                    <Text size="sm" fw={700} lineClamp={1}>{conversation.peer.username}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{summarizeRichMessageContent(conversation.lastMessage?.content) || 'Tap to chat'}</Text>
                  </Stack>
                </Group>
                {conversation.unreadCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </Group>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        {!selectedConversation ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Text fw={700} size="lg">Your messages</Text>
            <Text size="sm" c="dimmed">Send private photos and messages to a friend or creator.</Text>
          </div>
        ) : (
          <>
            <div className="border-b border-border px-4 py-3">
              <Group>
                <ProfileAvatar size={36} src={selectedConversation.peer.avatarUrl} name={selectedConversation.peer.displayName || selectedConversation.peer.username} />
                <Stack gap={0}>
                  <Text fw={700} size="sm">{selectedConversation.peer.username}</Text>
                  <Text size="xs" c="dimmed">{selectedConversation.peer.displayName || 'Sprygram account'}</Text>
                </Stack>
              </Group>
            </div>

            <div className="hide-scrollbar flex-1 overflow-y-auto p-4">
              {threadCursor ? (
                <Group justify="center" mb="sm">
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50"
                    onClick={() => selectedPeerId ? loadThread(selectedPeerId, threadCursor) : undefined}
                  >
                    Load older messages
                  </button>
                </Group>
              ) : null}

              {threadLoading ? <LoadingState message="Loading conversation..." /> : null}

              <Stack gap="xs">
                {thread.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </Stack>
            </div>

            <div className="border-t border-border p-3">
              <MessageComposer
                peerUserId={selectedPeerId}
                placeholder="Message..."
                onMessagesCreated={pushCreatedMessages}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
