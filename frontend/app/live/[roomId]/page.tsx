'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Text, Group, Stack } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { io, Socket } from 'socket.io-client';
import { sprygramApi } from '@/lib/api-client';
import type { LiveRoomView } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function LiveViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { isReady } = useDevAuth();
  const auth = useApiAuth();

  const roomId = params?.roomId as string;

  const [room, setRoom] = useState<LiveRoomView | null>(null);
  const [ended, setEnded] = useState(false);
  const [connected, setConnected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!isReady || !auth.token || !roomId) return;

    // Load room info
    sprygramApi.getLiveRoom(roomId, auth).then(setRoom).catch(() => setEnded(true));

    const socket = io(SOCKET_URL, {
      auth: { token: auth.token, workspaceId: auth.workspaceId },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setConnected(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        // We need the host's userId — comes from room
        setRoom((current) => {
          if (current) {
            socketRef.current?.emit('sprygram:live:ice-candidate', {
              roomId,
              targetUserId: current.hostUserId,
              candidate: event.candidate,
            });
          }
          return current;
        });
      }
    };

    // Tell server we joined
    socket.emit('sprygram:live:join', { roomId, workspaceId: auth.workspaceId });

    // Receive offer from host
    socket.on('sprygram:live:offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit; roomId: string; hostUserId: string }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Fetch current room to get hostUserId
      const currentRoom = await sprygramApi.getLiveRoom(roomId, auth).catch(() => null);
      if (currentRoom) {
        socket.emit('sprygram:live:answer', {
          roomId,
          hostUserId: currentRoom.hostUserId,
          sdp: answer,
        });
      }
    });

    // Receive ICE candidates from host
    socket.on('sprygram:live:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit; roomId: string }) => {
      if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    });

    // Host ended the stream
    socket.on('sprygram:live:end', () => {
      setEnded(true);
      setConnected(false);
    });

    return () => {
      socket.emit('sprygram:live:leave', { roomId, workspaceId: auth.workspaceId });
      socket.disconnect();
      pc.close();
    };
  }, [isReady, auth.token, roomId]);

  if (!isReady) return null;

  if (ended || (room && room.status === 'ended')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <Text fw={700} size="xl">Live stream ended</Text>
        <Text size="sm" c="dimmed">This stream has ended.</Text>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-full bg-panel px-4 py-2 text-sm font-semibold shadow hover:bg-hover"
        >
          <IconArrowLeft size={16} /> Go back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Group>
        <button
          type="button"
          onClick={() => {
            socketRef.current?.emit('sprygram:live:leave', { roomId, workspaceId: auth.workspaceId });
            router.back();
          }}
          className="rounded-full p-1.5 hover:bg-hover"
          aria-label="Go back"
        >
          <IconArrowLeft size={20} />
        </button>
        {room && (
          <Group gap={8}>
            <ProfileAvatar size={32} src={room.hostAvatarUrl} name={room.hostUsername} />
            <Stack gap={0}>
              <Text fw={700} size="sm">{room.hostUsername}</Text>
              <Text size="xs" c="dimmed">{room.title}</Text>
            </Stack>
            <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
            <span className="text-xs text-muted">{room.viewerCount} watching</span>
          </Group>
        )}
      </Group>

      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16/9' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Text size="sm" c="dimmed">Connecting to stream...</Text>
          </div>
        )}
      </div>
    </div>
  );
}
