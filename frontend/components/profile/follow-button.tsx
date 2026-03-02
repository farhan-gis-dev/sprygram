'use client';

import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconClockHour4, IconPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { FollowStatus } from '@/lib/api-types';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';
import { playFollowSound } from '@/lib/sounds';

type Props = {
  targetUserId: string;
  initialStatus: FollowStatus;
  onStatusChange?: (status: FollowStatus) => void;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
};

export function FollowButton({
  targetUserId,
  initialStatus,
  onStatusChange,
  size = 'xs',
  fullWidth = false,
  className,
}: Props) {
  const auth = useApiAuth();
  const [status, setStatus] = useState<FollowStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus, targetUserId]);

  const emit = (next: FollowStatus) => {
    setStatus(next);
    setPulse(true);
    onStatusChange?.(next);
  };

  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(false), 260);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const follow = async () => {
    setLoading(true);
    try {
      const res = await sprygramApi.followUser(targetUserId, auth);
      if (res.status === 'accepted') playFollowSound();
      emit(res.status);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Follow failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const unfollow = async () => {
    setLoading(true);
    try {
      await sprygramApi.unfollowUser(targetUserId, auth);
      emit('none');
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Action failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'accepted') {
    return (
      <Button
        variant="light"
        color="dark"
        size={size}
        fullWidth={fullWidth}
        loading={loading}
        onClick={unfollow}
        className={`${pulse ? 'animate-follow-flash ' : ''}${className || ''}`.trim()}
        leftSection={<IconCheck size={15} />}
        styles={{
          root: {
            background: '#eef8f1',
            color: '#166534',
            border: '1px solid #b7e0c3',
          },
        }}
      >
        Following
      </Button>
    );
  }

  if (status === 'pending') {
    return (
      <Button
        variant="light"
        color="yellow"
        size={size}
        fullWidth={fullWidth}
        loading={loading}
        onClick={unfollow}
        className={`${pulse ? 'animate-follow-flash ' : ''}${className || ''}`.trim()}
        leftSection={<IconClockHour4 size={15} />}
        styles={{
          root: {
            background: '#fff7e8',
            color: '#a16207',
            border: '1px solid #f3d18a',
          },
        }}
      >
        Requested
      </Button>
    );
  }

  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      loading={loading}
      onClick={follow}
      className={`${pulse ? 'animate-follow-flash ' : ''}${className || ''}`.trim()}
      leftSection={<IconPlus size={15} />}
      styles={{
        root: {
          background: 'linear-gradient(135deg, #1f7ae0, #4f46e5)',
          borderColor: '#1f7ae0',
          color: '#fff',
        },
      }}
    >
      Follow
    </Button>
  );
}
