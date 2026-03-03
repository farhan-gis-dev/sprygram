'use client';

import { useEffect, useRef, useState } from 'react';
import { Text, Group, Stack, TextInput, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconVideo,
  IconVideoOff,
  IconMicrophone,
  IconMicrophoneOff,
  IconX,
  IconUsers,
  IconBroadcast,
  IconChevronRight,
} from '@tabler/icons-react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { sprygramApi } from '@/lib/api-client';
import type { LiveRoomView } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type PeerMap = Map<string, RTCPeerConnection>;
type PageMode = 'home' | 'setup' | 'live';

function LiveCard({ room, onJoin }: { room: LiveRoomView; onJoin: () => void }) {
  const elapsed = Math.round((Date.now() - new Date(room.startedAt).getTime()) / 60000);
  const durationLabel = elapsed < 1 ? 'Just started' : elapsed === 1 ? '1 min ago' : `${elapsed} min`;
  return (
    <button
      type="button"
      onClick={onJoin}
      className="group relative flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-sm transition-all hover:scale-[1.02] hover:shadow-md"
    >
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-[var(--spry-accent-soft)] to-[#e8d5fb]">
        <ProfileAvatar size={60} src={room.hostAvatarUrl} name={room.hostUsername} />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">LIVE</span>
        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
          <IconUsers size={10} />
          {room.viewerCount}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2.5 text-left">
        <Text size="xs" fw={700} lineClamp={1}>@{room.hostUsername}</Text>
        <Text size="10px" c="dimmed" lineClamp={1}>{room.title || 'Live'}</Text>
        <Text size="10px" c="dimmed">{durationLabel}</Text>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[var(--spry-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export default function GoLivePage() {
  const { isReady } = useDevAuth();
  const auth = useApiAuth();
  const router = useRouter();

  const [mode, setMode] = useState<PageMode>('home');
  const [title, setTitle] = useState('');
  const [room, setRoom] = useState<LiveRoomView | null>(null);
  const [starting, setStarting] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [liveRooms, setLiveRooms] = useState<LiveRoomView[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [cameraPreviewError, setCameraPreviewError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<PeerMap>(new Map());

  useEffect(() => {
    if (!isReady || !auth.token || mode !== 'home') return;
    setRoomsLoading(true);
    sprygramApi.getLiveRooms(auth)
      .then((res) => setLiveRooms((res.items || []).filter((r) => r.status === 'live')))
      .catch(() => setLiveRooms([]))
      .finally(() => setRoomsLoading(false));
  }, [isReady, auth.token, mode]);

  useEffect(() => {
    if (mode !== 'setup') return;
    let active = true;
    setCameraPreviewError(false);
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
      })
      .catch(() => { if (active) setCameraPreviewError(true); });
    return () => { active = false; };
  }, [mode]);

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  const handleViewerJoined = async (viewerUserId: string) => {
    if (!streamRef.current || !room || !socketRef.current) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current!));
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('sprygram:live:ice-candidate', { roomId: room.id, targetUserId: viewerUserId, candidate: event.candidate });
      }
    };
    peersRef.current.set(viewerUserId, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit('sprygram:live:offer', { roomId: room.id, viewerUserId, sdp: offer });
  };

  const startLive = async () => {
    if (!auth.token) return;
    setStarting(true);
    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
      }
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      const newRoom = await sprygramApi.startLive(title || 'Live', auth);
      setRoom(newRoom);
      setMode('live');
      const socket = io(SOCKET_URL, { auth: { token: auth.token, workspaceId: auth.workspaceId }, transports: ['websocket'] });
      socketRef.current = socket;
      socket.on('sprygram:live:viewer-joined', ({ viewerUserId }: { viewerUserId: string }) => { void handleViewerJoined(viewerUserId); });
      socket.on('sprygram:live:answer', async ({ viewerUserId, sdp }: { viewerUserId: string; sdp: RTCSessionDescriptionInit }) => {
        const pc = peersRef.current.get(viewerUserId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      });
      socket.on('sprygram:live:ice-candidate', async ({ fromUserId, candidate }: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peersRef.current.get(fromUserId);
        if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      socket.on('sprygram:live:end', () => { void endLive(); });
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Could not go live', message: err.message });
    } finally {
      setStarting(false);
    }
  };

  const endLive = async () => {
    if (room) await sprygramApi.endLive(room.id, auth).catch(() => undefined);
    setRoom(null);
    cleanup();
    setTitle('');
    setMode('home');
  };

  const toggleVideo = () => {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !videoEnabled; });
    setVideoEnabled((v) => !v);
  };

  const toggleAudio = () => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !audioEnabled; });
    setAudioEnabled((a) => !a);
  };

  useEffect(() => () => cleanup(), []);

  if (!isReady) return null;

  // ── Home ──────────────────────────────────────────────────────
  if (mode === 'home') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        {/* Hero CTA */}
        <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--spry-accent)] to-[#7c3aed] p-8 text-white shadow-lg">
          <Stack gap="md" align="center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <IconBroadcast size={34} stroke={1.6} />
            </div>
            <div className="text-center">
              <Text fw={800} size="xl" className="text-white">Go Live</Text>
              <Text size="sm" className="mt-1 text-white/80">Share a live video with your followers in real time.</Text>
            </div>
            <button
              type="button"
              onClick={() => setMode('setup')}
              disabled={!auth.token}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[var(--spry-accent)] shadow transition hover:scale-105 hover:shadow-md disabled:opacity-50"
            >
              <IconVideo size={16} />
              Start Live Video
            </button>
          </Stack>
        </div>

        {/* Active live sessions */}
        <div>
          <Group justify="space-between" mb={12}>
            <Text fw={700} size="md">Live Now</Text>
            <Text size="xs" c="dimmed">{roomsLoading ? 'Loading…' : `${liveRooms.length} live`}</Text>
          </Group>
          {liveRooms.length === 0 && !roomsLoading ? (
            <div className="rounded-2xl border border-border bg-panel p-8 text-center">
              <Text size="sm" c="dimmed">No one is live right now.</Text>
              <Text size="xs" c="dimmed" mt={4}>Be the first to go live today!</Text>
            </div>
          ) : (
            <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
              {liveRooms.map((r) => <LiveCard key={r.id} room={r} onJoin={() => router.push(`/live/${r.id}`)} />)}
              {roomsLoading && (
                <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-2xl border border-border bg-panel">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-[var(--spry-accent)]" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-8 rounded-2xl border border-border bg-panel p-5">
          <Text fw={700} size="sm" mb={12}>Tips for a great live</Text>
          <Stack gap="xs">
            {['Make sure you have a stable internet connection.', 'Good lighting helps viewers see you clearly.', 'Interact with your viewers by reading comments.', 'Promote in advance so followers know when to tune in.'].map((tip) => (
              <Group key={tip} gap={8} wrap="nowrap" align="flex-start">
                <IconChevronRight size={14} className="mt-0.5 shrink-0 text-[var(--spry-accent)]" />
                <Text size="xs" c="dimmed">{tip}</Text>
              </Group>
            ))}
          </Stack>
        </div>
      </div>
    );
  }

  // ── Setup ─────────────────────────────────────────────────────
  if (mode === 'setup') {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <Group mb={20}>
          <button type="button" onClick={() => { cleanup(); setMode('home'); }} className="rounded-full p-2 hover:bg-hover">
            <IconX size={18} />
          </button>
          <Text fw={700} size="lg">Set up your live</Text>
        </Group>
        <div className="relative mb-5 w-full overflow-hidden rounded-2xl bg-black shadow-lg" style={{ aspectRatio: '16/9' }}>
          {cameraPreviewError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
              <IconVideoOff size={36} />
              <Text size="sm">Camera not available</Text>
            </div>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={previewVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">PREVIEW</div>
        </div>
        <Stack gap="md">
          <TextInput
            label="Title (optional)"
            placeholder="What are you going live about?"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            maxLength={120}
          />
          <Button
            leftSection={<IconBroadcast size={16} />}
            loading={starting}
            onClick={() => void startLive()}
            disabled={!auth.token || cameraPreviewError}
            fullWidth
            size="md"
            style={{ background: 'linear-gradient(135deg, var(--spry-accent), #7c3aed)' }}
          >
            {starting ? 'Starting…' : 'Go Live'}
          </Button>
          {cameraPreviewError ? (
            <Text size="xs" c="red" ta="center">Camera or microphone permission is required to go live.</Text>
          ) : null}
        </Stack>
      </div>
    );
  }

  // ── Broadcasting ──────────────────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Group justify="space-between">
        <Text fw={700} size="lg">You are live</Text>
        <Group gap={6}>
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <Text size="sm" fw={600} c="red">LIVE</Text>
        </Group>
      </Group>

      <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-xl" style={{ aspectRatio: '16/9' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 shadow">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-bold text-white">LIVE</span>
        </div>
        {room && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
            <IconUsers size={13} className="text-white" />
            <span className="text-xs font-semibold text-white">{room.viewerCount}</span>
          </div>
        )}
        {room?.title ? (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent p-4">
            <Text size="sm" fw={600} className="text-white">{room.title}</Text>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={toggleVideo}
          className={`flex h-12 w-12 items-center justify-center rounded-full shadow transition hover:scale-105 ${videoEnabled ? 'bg-panel' : 'bg-gray-700'}`}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {videoEnabled ? <IconVideo size={20} /> : <IconVideoOff size={20} className="text-white" />}
        </button>
        <button
          type="button"
          onClick={toggleAudio}
          className={`flex h-12 w-12 items-center justify-center rounded-full shadow transition hover:scale-105 ${audioEnabled ? 'bg-panel' : 'bg-gray-700'}`}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? <IconMicrophone size={20} /> : <IconMicrophoneOff size={20} className="text-white" />}
        </button>
        <button
          type="button"
          onClick={() => void endLive()}
          className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-red-700 hover:scale-105"
        >
          <IconX size={16} />
          End Live
        </button>
      </div>

      {room && (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <Group justify="space-around">
            <Stack gap={2} align="center">
              <Text size="xl" fw={800}>{room.viewerCount}</Text>
              <Text size="xs" c="dimmed">Watching</Text>
            </Stack>
            <div className="h-8 w-px bg-border" />
            <Stack gap={2} align="center">
              <Text size="xl" fw={800}>{Math.round((Date.now() - new Date(room.startedAt).getTime()) / 60000)}m</Text>
              <Text size="xs" c="dimmed">Duration</Text>
            </Stack>
            <div className="h-8 w-px bg-border" />
            <Stack gap={2} align="center">
              <Text size="xl" fw={800}>—</Text>
              <Text size="xs" c="dimmed">Reactions</Text>
            </Stack>
          </Group>
        </div>
      )}
    </div>
  );
}
