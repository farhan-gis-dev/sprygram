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
  /** Compact transparent white variant for use inside dark video overlays (Reels). */
  reelsVariant?: boolean;
};

export function FollowButton({
  targetUserId,
  initialStatus,
  onStatusChange,
  size = 'xs',
  fullWidth = false,
  className,
  reelsVariant = false,
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
    if (next !== 'none') playFollowSound();
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

  // ── Compact transparent overlay style for Reels ──────────────
  if (reelsVariant) {
    if (status === 'accepted') {
      return (
        <button
          type="button"
          disabled={loading}
          onClick={unfollow}
          className={`flex h-7 items-center gap-1.5 rounded-full border border-white/60 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:border-white hover:bg-white/10 active:scale-95 ${pulse ? 'animate-follow-flash' : ''} ${className || ''}`}
        >
          <IconCheck size={13} stroke={2.2} />
          Following
        </button>
      );
    }
    if (status === 'pending') {
      return (
        <button
          type="button"
          disabled={loading}
          onClick={unfollow}
          className={`flex h-7 items-center gap-1.5 rounded-full border border-yellow-300/70 px-3 text-xs font-semibold text-yellow-200 backdrop-blur-sm transition-all hover:bg-white/10 active:scale-95 ${className || ''}`}
        >
          <IconClockHour4 size={13} />
          Requested
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={loading}
        onClick={follow}
        className={`flex h-7 items-center gap-1.5 rounded-full bg-[var(--spry-accent)] px-3 text-xs font-semibold text-white shadow transition-all hover:brightness-110 active:scale-95 ${pulse ? 'animate-follow-flash' : ''} ${className || ''}`}
      >
        {loading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-transparent border-t-white" />
        ) : (
          <IconPlus size={13} stroke={2.2} />
        )}
        Follow
      </button>
    );
  }

  // ── Default Mantine Button style ──────────────────────────────
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
