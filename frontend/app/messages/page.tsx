'use client';

import { Group, Modal, Stack, Text, TextInput, Button, Badge, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconSearch, IconUsersGroup, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { Conversation, DirectMessage, SearchAccountResult, SprygramProfile } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { summarizeRichMessageContent } from '@/lib/message-rich-content';
import { useSprygramSocket, type SprygramMessageEvent, type SprygramReadEvent } from '@/lib/use-sprygram-socket';
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
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [newMsgSearch, setNewMsgSearch] = useState('');
  const [newMsgResults, setNewMsgResults] = useState<SearchAccountResult[]>([]);
  const [newMsgLoading, setNewMsgLoading] = useState(false);

  // Group conversation state
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<SearchAccountResult[]>([]);
  const [newGroupSearch, setNewGroupSearch] = useState('');
  const [newGroupResults, setNewGroupResults] = useState<SearchAccountResult[]>([]);
  const [newGroupSearchLoading, setNewGroupSearchLoading] = useState(false);
  const [newGroupCreating, setNewGroupCreating] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [thread, setThread] = useState<DirectMessage[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Typing indicator state
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold selectedPeerId in a ref so the socket handler can read the current value
  const selectedPeerIdRef = useRef<string | null>(null);
  selectedPeerIdRef.current = selectedPeerId;

  // Real-time message handler
  const handleSocketMessage = useCallback((msg: SprygramMessageEvent) => {
    const peerId = msg.mine ? msg.receiverId : msg.senderId;
    const dm: DirectMessage = {
      id: msg.id,
      threadId: msg.threadId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      content: msg.content ?? null,
      mediaDriveFileId: msg.mediaDriveFileId ?? null,
      storyId: msg.storyId ?? null,
      createdAt: msg.createdAt,
    } as DirectMessage;

    // Append to active thread if it matches the open conversation
    if (peerId === selectedPeerIdRef.current) {
      setThread((prev) => {
        // Deduplicate — composer also calls pushCreatedMessages for outgoing
        if (prev.some((m) => m.id === dm.id)) return prev;
        return [...prev, dm];
      });
    }

    // Update conversation list preview + unread badge
    const preview = summarizeRichMessageContent(dm.content)
      || (dm.mediaDriveFileId ? 'Sent media' : dm.storyId ? 'Replied to story' : 'Sent a message');

    setConversations((prev) => {
      const existing = prev.find((c) => c.peer.userId === peerId);
      if (!existing) return prev; // unknown peer — will appear on next refresh
      const isActive = peerId === selectedPeerIdRef.current;
      return [
        {
          ...existing,
          lastMessage: { id: dm.id, content: preview, senderId: dm.senderId, createdAt: dm.createdAt },
          unreadCount: isActive ? 0 : (existing.unreadCount || 0) + (msg.mine ? 0 : 1),
        },
        ...prev.filter((c) => c.peer.userId !== peerId),
      ];
    });
  }, []);

  // Handle incoming typing events from peer
  const handleSocketTyping = useCallback(({ senderId }: { senderId: string }) => {
    if (senderId !== selectedPeerIdRef.current) return;
    setPeerIsTyping(true);
    if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
    peerTypingTimerRef.current = setTimeout(() => setPeerIsTyping(false), 3000);
  }, []);

  // Handle real-time "seen" receipts — peer read our messages
  const handleSocketRead = useCallback(({ receiverId, readAt }: SprygramReadEvent) => {
    // Update readAt on all messages we sent to this peer
    setThread((prev) =>
      prev.map((m) =>
        m.mine && m.receiverId === receiverId && !m.readAt
          ? { ...m, readAt }
          : m,
      ),
    );
  }, []);

  const socketRef = useSprygramSocket({
    token: auth.token,
    workspaceId: auth.workspaceId,
    onMessage: handleSocketMessage,
    onTyping: handleSocketTyping,
    onRead: handleSocketRead,
  });

  // Emit typing event to backend (debounced — send once per 2s while typing)
  const emitTyping = useCallback(() => {
    if (!selectedPeerIdRef.current) return;
    if (emitTypingTimerRef.current) return; // already emitting, debounce
    socketRef.current?.emit('sprygram:typing', { receiverId: selectedPeerIdRef.current });
    emitTypingTimerRef.current = setTimeout(() => {
      emitTypingTimerRef.current = null;
    }, 2000);
  }, [socketRef]);

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
    setPeerIsTyping(false);
    if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
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

  const handleNewMsgSearch = async (q: string) => {
    setNewMsgSearch(q);
    if (!q.trim()) { setNewMsgResults([]); return; }
    setNewMsgLoading(true);
    try {
      const res = await sprygramApi.searchAccounts(q.trim(), 20, auth);
      setNewMsgResults(res.items || []);
    } catch { setNewMsgResults([]); }
    finally { setNewMsgLoading(false); }
  };

  const startConversation = (userId: string) => {
    setSelectedPeerId(userId);
    setNewMsgOpen(false);
  };

  const handleGroupSearch = async (q: string) => {
    setNewGroupSearch(q);
    if (!q.trim()) { setNewGroupResults([]); return; }
    setNewGroupSearchLoading(true);
    try {
      const res = await sprygramApi.searchAccounts(q.trim(), 20, auth);
      setNewGroupResults(res.items.filter((u) => !newGroupMembers.some((m) => m.userId === u.userId)) || []);
    } catch { setNewGroupResults([]); }
    finally { setNewGroupSearchLoading(false); }
  };

  const addGroupMember = (user: SearchAccountResult) => {
    setNewGroupMembers((prev) => [...prev, user]);
    setNewGroupResults((prev) => prev.filter((u) => u.userId !== user.userId));
    setNewGroupSearch('');
  };

  const removeGroupMember = (userId: string) => {
    setNewGroupMembers((prev) => prev.filter((u) => u.userId !== userId));
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.length < 2) return;
    setNewGroupCreating(true);
    try {
      await sprygramApi.createGroupConversation(
        { name: newGroupName.trim(), memberUserIds: newGroupMembers.map((m) => m.userId) },
        auth,
      );
      setNewGroupOpen(false);
      setNewGroupName('');
      setNewGroupMembers([]);
      setNewGroupSearch('');
      notifications.show({ color: 'teal', title: 'Group created', message: `"${newGroupName}" group conversation started.` });
    } catch {
      notifications.show({ color: 'orange', title: 'Group not available', message: 'Group messaging requires a backend update. Stay tuned!' });
      setNewGroupOpen(false);
    } finally {
      setNewGroupCreating(false);
    }
  };

  return (
    <>
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
              <button type="button" className="rounded-md p-1 hover:bg-gray-100" aria-label="New group conversation" title="New group conversation" onClick={() => { setNewGroupName(''); setNewGroupMembers([]); setNewGroupSearch(''); setNewGroupResults([]); setNewGroupOpen(true); }}>
                <IconUsersGroup size={18} />
              </button>
              <button type="button" className="rounded-md p-1 hover:bg-gray-100" aria-label="Start a new message" title="Start a new message" onClick={() => { setNewMsgSearch(''); setNewMsgResults([]); setNewMsgOpen(true); }}>
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
              {peerIsTyping ? (
                <div className="flex items-center gap-1 px-1 pb-2 text-xs text-muted">
                  <span className="flex gap-0.5">
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                  <span>{selectedConversation.peer.username} is typing…</span>
                </div>
              ) : null}
              <MessageComposer
                peerUserId={selectedPeerId}
                placeholder="Message..."
                onMessagesCreated={pushCreatedMessages}
                onTyping={emitTyping}
              />
            </div>
          </>
        )}
      </section>
    </div>

      <Modal
        opened={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        title="New Message"
        centered
        size="sm"
      >
        <TextInput
          placeholder="Search people…"
          leftSection={<IconSearch size={14} />}
          value={newMsgSearch}
          onChange={(e) => void handleNewMsgSearch(e.currentTarget.value)}
          autoFocus
        />
        <Stack gap={0} mt="sm">
          {newMsgLoading ? (
            <Text size="sm" c="dimmed" px={4} py={6}>Searching…</Text>
          ) : newMsgResults.length === 0 && newMsgSearch ? (
            <Text size="sm" c="dimmed" px={4} py={6}>No users found.</Text>
          ) : (
            newMsgResults.map((user) => (
              <button
                key={user.userId}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                onClick={() => startConversation(user.userId)}
              >
                <ProfileAvatar size={36} src={user.avatarUrl} name={user.displayName || user.username} />
                <Stack gap={0}>
                  <Text size="sm" fw={700}>{user.username}</Text>
                  {user.displayName ? <Text size="xs" c="dimmed">{user.displayName}</Text> : null}
                </Stack>
              </button>
            ))
          )}
        </Stack>
      </Modal>

      {/* New Group Conversation Modal */}
      <Modal
        opened={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        title="New Group Conversation"
        centered
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Group name"
            placeholder="e.g. Team, Friends, Project…"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.currentTarget.value)}
            maxLength={64}
          />

          <div>
            <Text size="xs" fw={600} c="dimmed" mb="xs">Add members (at least 2)</Text>
            {newGroupMembers.length > 0 && (
              <Group gap="xs" mb="xs" wrap="wrap">
                {newGroupMembers.map((member) => (
                  <Badge
                    key={member.userId}
                    variant="light"
                    rightSection={
                      <ActionIcon size="xs" variant="transparent" onClick={() => removeGroupMember(member.userId)} aria-label={`Remove ${member.username}`}>
                        <IconX size={10} />
                      </ActionIcon>
                    }
                  >
                    @{member.username}
                  </Badge>
                ))}
              </Group>
            )}
            <TextInput
              placeholder="Search people to add…"
              leftSection={<IconSearch size={14} />}
              value={newGroupSearch}
              onChange={(e) => void handleGroupSearch(e.currentTarget.value)}
            />
            <Stack gap={0} mt="xs">
              {newGroupSearchLoading ? (
                <Text size="xs" c="dimmed" px={4} py={4}>Searching…</Text>
              ) : newGroupResults.length === 0 && newGroupSearch ? (
                <Text size="xs" c="dimmed" px={4} py={4}>No users found.</Text>
              ) : (
                newGroupResults.map((user) => (
                  <button
                    key={user.userId}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                    onClick={() => addGroupMember(user)}
                  >
                    <ProfileAvatar size={32} src={user.avatarUrl} name={user.displayName || user.username} />
                    <Stack gap={0}>
                      <Text size="sm" fw={700}>{user.username}</Text>
                      {user.displayName ? <Text size="xs" c="dimmed">{user.displayName}</Text> : null}
                    </Stack>
                  </button>
                ))
              )}
            </Stack>
          </div>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNewGroupOpen(false)}>Cancel</Button>
            <Button
              loading={newGroupCreating}
              disabled={!newGroupName.trim() || newGroupMembers.length < 2}
              onClick={() => void handleCreateGroup()}
              leftSection={<IconUsersGroup size={15} />}
            >
              Create Group
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
