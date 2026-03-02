'use client';

import {
  ActionIcon,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Transition,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSend2, IconTrash, IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';
import type { Comment, SprygramProfile } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/time';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { LoadingState } from '@/components/ui/loading-state';

type Props = {
  opened: boolean;
  postId: string | null;
  onClose: () => void;
  viewer: SprygramProfile | null;
  onCommentCountIncrement?: () => void;
  className?: string;
};

export function CommentsModal({
  opened,
  postId,
  onClose,
  viewer,
  onCommentCountIncrement,
  className = '',
}: Props) {
  const auth = useApiAuth();
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');

  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  useEffect(() => {
    if (!opened || !postId || !auth.token) return;

    setLoading(true);
    sprygramApi.getComments(postId, { limit: 50 }, auth)
      .then((res) => setComments(res.items || []))
      .catch((error: Error) => {
        notifications.show({ color: 'red', title: 'Failed to load comments', message: error.message });
      })
      .finally(() => setLoading(false));
  }, [opened, postId, auth.token, auth.workspaceId]);

  const submit = async () => {
    if (!postId || !canSubmit) return;

    try {
      const created = await sprygramApi.addComment(postId, { content: content.trim() }, auth) as Comment;
      setComments((prev) => [...prev, created]);
      setContent('');
      onCommentCountIncrement?.();
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Failed to comment', message: error.message });
    }
  };

  return (
    <Transition mounted={opened && Boolean(postId)} transition="slide-up" duration={220} timingFunction="ease">
      {(styles) => (
        <div
          style={styles}
          className={`absolute inset-x-0 bottom-0 top-1/2 z-20 overflow-hidden rounded-t-[22px] border-t border-[#efefef] bg-white shadow-[0_-20px_40px_rgba(15,23,42,0.18)] ${className}`.trim()}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-[#efefef] px-4 py-3">
              <Group justify="space-between">
                <Text size="sm" fw={700}>Comments</Text>
                <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close comments" title="Close comments">
                  <IconX size={18} />
                </ActionIcon>
              </Group>
            </div>

            <div className="min-h-0 flex-1">
              {loading ? (
                <div className="px-4 py-6">
                  <LoadingState message="Loading comments..." />
                </div>
              ) : (
                <ScrollArea h="100%" offsetScrollbars>
                  <Stack gap="sm" px="md" py="sm">
                    {comments.length === 0 ? (
                      <Text size="sm" c="dimmed">No comments yet.</Text>
                    ) : comments.map((comment) => {
                      const own = viewer?.userId === comment.author.userId;
                      return (
                        <Group key={comment.id} align="flex-start" justify="space-between" wrap="nowrap">
                          <Group align="flex-start" gap={10} wrap="nowrap">
                            <ProfileAvatar
                              size={32}
                              src={comment.author.avatarUrl}
                              name={comment.author.displayName || comment.author.username}
                            />
                            <Stack gap={1}>
                              <Group gap={6}>
                                <Text size="sm" fw={700}>@{comment.author.username}</Text>
                                <Text size="xs" c="dimmed">{formatRelativeTime(comment.createdAt)}</Text>
                              </Group>
                              <Text size="sm">{comment.content}</Text>
                            </Stack>
                          </Group>

                          {own ? (
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label="Delete comment"
                              title="Delete comment"
                              onClick={async () => {
                                try {
                                  await sprygramApi.deleteComment(comment.id, auth);
                                  setComments((prev) => prev.filter((entry) => entry.id !== comment.id));
                                } catch (error: any) {
                                  notifications.show({ color: 'red', title: 'Delete failed', message: error.message });
                                }
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          ) : null}
                        </Group>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              )}
            </div>

            <div className="border-t border-[#efefef] px-4 py-3">
              <Group align="flex-end" wrap="nowrap">
                <TextInput
                  value={content}
                  onChange={(e) => setContent(e.currentTarget.value)}
                  placeholder="Add a comment..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
                <Button size="xs" disabled={!canSubmit} onClick={() => void submit()} leftSection={<IconSend2 size={14} />}>
                  Post
                </Button>
              </Group>
            </div>
          </div>
        </div>
      )}
    </Transition>
  );
}
