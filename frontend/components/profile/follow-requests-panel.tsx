'use client';

import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';
import type { FollowRequestItem } from '@/lib/api-types';

export function FollowRequestsPanel() {
  const auth = useApiAuth();
  const [items, setItems] = useState<FollowRequestItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.token) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    sprygramApi.getIncomingFollowRequests(10, auth)
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [auth.token, auth.workspaceId]);

  if (loading) return <Alert color="gray">Loading follow requests...</Alert>;
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <Stack gap="sm">
        <Text fw={700} size="sm">Follow Requests</Text>
        {items.map((item) => (
          <Group key={item.id} justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="sm" fw={600}>@{item.follower.username}</Text>
              <Text size="xs" c="dimmed">{item.follower.displayName || 'No display name'}</Text>
            </Stack>
            <Group gap={6}>
              <Button
                size="xs"
                variant="light"
                onClick={async () => {
                  try {
                    await sprygramApi.approveFollowRequest(item.id, auth);
                    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
                  } catch (error: any) {
                    notifications.show({ color: 'red', title: 'Approve failed', message: error.message });
                  }
                }}
              >
                Approve
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={async () => {
                  try {
                    await sprygramApi.rejectFollowRequest(item.id, auth);
                    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
                  } catch (error: any) {
                    notifications.show({ color: 'red', title: 'Reject failed', message: error.message });
                  }
                }}
              >
                Reject
              </Button>
            </Group>
          </Group>
        ))}
      </Stack>
    </div>
  );
}
