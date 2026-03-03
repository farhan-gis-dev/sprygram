'use client';

import { ActionIcon, Button, Group, Popover, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconGif,
  IconMicrophone,
  IconMoodSmile,
  IconPhotoPlus,
  IconSend2,
  IconSparkles,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { DirectMessage } from '@/lib/api-types';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';
import {
  encodeRichMessageToken,
  GIF_LIBRARY,
  STICKER_LIBRARY,
  type RichMessageKind,
  type RichMessageLibraryItem,
} from '@/lib/message-rich-content';

type Props = {
  peerUserId: string | null;
  placeholder?: string;
  disabled?: boolean;
  onMessagesCreated: (messages: DirectMessage[]) => void;
  onTyping?: () => void;
};

const EMOJIS = [
  '\u{1F600}',
  '\u{1F60D}',
  '\u{1F44D}',
  '\u{1F389}',
  '\u{1F525}',
  '\u2728',
  '\u{1F680}',
  '\u{1F3A7}',
  '\u{1F4AF}',
  '\u{1F44C}',
];

const mediaAccept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const preferredAudioMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];

const getRecorderMimeType = (): string | undefined => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined;
  return preferredAudioMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
};

export function MessageComposer({
  peerUserId,
  placeholder = 'Message...',
  disabled = false,
  onMessagesCreated,
  onTyping,
}: Props) {
  const auth = useApiAuth();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // GIF search via Giphy
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; previewUrl: string }>>([]);
  const [gifLoading, setGifLoading] = useState(false);

  useEffect(() => {
    if (!recordingStartedAt) {
      setRecordingSeconds(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.max(0, Math.round((Date.now() - recordingStartedAt) / 1000)));
    }, 200);

    return () => window.clearInterval(timer);
  }, [recordingStartedAt]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const query = gifSearch.trim();
    if (!query) {
      setGifResults([]);
      return;
    }
    setGifLoading(true);
    const controller = new AbortController();
    const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'dc6zaTOxFJmzC';
    const timer = window.setTimeout(() => {
      fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=12&rating=g`,
        { signal: controller.signal },
      )
        .then((res) => res.json())
        .then((body: { data: Array<{ id: string; images: { fixed_height_small: { url: string }; fixed_height_small_still: { url: string } } }> }) => {
          setGifResults(
            (body.data || []).map((gif) => ({
              id: gif.id,
              url: gif.images.fixed_height_small.url,
              previewUrl: gif.images.fixed_height_small_still.url,
            })),
          );
        })
        .catch(() => { /* ignore aborted */ })
        .finally(() => setGifLoading(false));
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      setGifLoading(false);
    };
  }, [gifSearch]);

  const canSendText = useMemo(
    () => Boolean(peerUserId && auth.token && value.trim().length > 0 && !sending && !disabled),
    [peerUserId, auth.token, value, sending, disabled],
  );

  const emitMessages = (messages: DirectMessage[]) => {
    if (!messages.length) return;
    onMessagesCreated(messages);
  };

  const sendText = async () => {
    if (!peerUserId || !auth.token) return;
    const content = value.trim();
    if (!content) return;

    setSending(true);
    try {
      const created = await sprygramApi.sendMessage({ receiverId: peerUserId, content }, auth);
      setValue('');
      emitMessages([created]);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Send failed', message: error.message || 'Unable to send message.' });
    } finally {
      setSending(false);
    }
  };

  const sendGifUrl = async (gifUrl: string) => {
    if (!peerUserId || !auth.token || sending || disabled) return;
    setSending(true);
    try {
      const created = await sprygramApi.sendMessage({
        receiverId: peerUserId,
        content: encodeRichMessageToken('gif', gifUrl),
      }, auth);
      emitMessages([created]);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Send failed', message: error.message || 'Unable to send GIF.' });
    } finally {
      setSending(false);
    }
  };

  const sendRichMessage = async (kind: RichMessageKind, item: RichMessageLibraryItem) => {
    if (!peerUserId || !auth.token || sending || disabled) return;

    setSending(true);
    try {
      const created = await sprygramApi.sendMessage({
        receiverId: peerUserId,
        content: encodeRichMessageToken(kind, item.key),
      }, auth);
      emitMessages([created]);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Send failed', message: error.message || `Unable to send ${kind}.` });
    } finally {
      setSending(false);
    }
  };

  const sendAttachments = async (files: File[]) => {
    if (!peerUserId || !auth.token || !files.length || disabled) return;

    setSending(true);
    try {
      const uploaded = await sprygramApi.uploadMessageAttachments(files, auth);
      const createdMessages: DirectMessage[] = [];

      for (const item of uploaded.items) {
        const created = await sprygramApi.sendMessage({
          receiverId: peerUserId,
          mediaDriveFileId: item.driveFileId,
        }, auth);
        createdMessages.push(created);
      }

      emitMessages(createdMessages);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Upload failed', message: error.message || 'Unable to share media right now.' });
    } finally {
      setSending(false);
    }
  };

  const onMediaInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (!files.length) return;
    await sendAttachments(files);
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.stop();
    setRecording(false);
    setRecordingStartedAt(null);
  };

  const startRecording = async () => {
    if (!peerUserId || !auth.token || disabled || sending) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      notifications.show({ color: 'red', title: 'Microphone unavailable', message: 'This browser does not support voice recording.' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, getRecorderMimeType() ? { mimeType: getRecorderMimeType() } : undefined);
      recorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;

        if (!blob.size) return;

        const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' });
        await sendAttachments([file]);
      });

      recorder.start();
      setRecording(true);
      setRecordingStartedAt(Date.now());
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Microphone blocked', message: error.message || 'Allow microphone access and try again.' });
    }
  };

  return (
    <div className="rounded-[22px] border border-border bg-white px-3 py-2">
      <input
        ref={mediaInputRef}
        type="file"
        className="hidden"
        accept={mediaAccept}
        multiple
        onChange={(event) => void onMediaInputChange(event)}
      />

      <Group wrap="nowrap" align="flex-end">
        <Group gap={4} wrap="nowrap">
          <Popover width={220} position="top-start" withArrow shadow="md">
            <Popover.Target>
              <ActionIcon variant="subtle" color="gray" disabled={disabled || sending || !peerUserId} aria-label="Open emoji picker" title="Open emoji picker">
                <IconMoodSmile size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Group gap={6}>
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-md px-1 py-1 text-xl hover:bg-gray-100"
                    onClick={() => setValue((previous) => `${previous}${emoji}`)}
                  >
                    {emoji}
                  </button>
                ))}
              </Group>
            </Popover.Dropdown>
          </Popover>

          <ActionIcon
            variant="subtle"
            color="gray"
            disabled={disabled || sending || !peerUserId}
            onClick={() => mediaInputRef.current?.click()}
            aria-label="Attach photo or video"
            title="Attach photo or video"
          >
            <IconPhotoPlus size={18} />
          </ActionIcon>

          <Popover width={300} position="top-start" withArrow shadow="md" onClose={() => setGifSearch('')}>
            <Popover.Target>
              <ActionIcon variant="subtle" color="gray" disabled={disabled || sending || !peerUserId} aria-label="Open GIF picker" title="Open GIF picker">
                <IconGif size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap={8}>
                <TextInput
                  placeholder="Search GIFs..."
                  value={gifSearch}
                  onChange={(event) => setGifSearch(event.currentTarget.value)}
                  size="xs"
                  autoFocus
                />
                {gifLoading && <Text size="xs" c="dimmed" ta="center">Searching...</Text>}
                {!gifLoading && gifSearch.trim() && gifResults.length === 0 && (
                  <Text size="xs" c="dimmed" ta="center">No GIFs found</Text>
                )}
                <div className="grid grid-cols-3 gap-1 max-h-52 overflow-y-auto">
                  {gifSearch.trim() ? (
                    gifResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        className="overflow-hidden rounded-lg focus:outline-none hover:opacity-80 transition-opacity"
                        onClick={() => void sendGifUrl(gif.url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={gif.url} alt="GIF" className="h-20 w-full object-cover" loading="lazy" />
                      </button>
                    ))
                  ) : (
                    GIF_LIBRARY.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="message-rich-gif rounded-lg px-2 py-3 text-center text-white"
                        style={{ background: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentTo})` }}
                        onClick={() => void sendRichMessage('gif', item)}
                      >
                        <div className="text-xl">{item.emoji}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</div>
                      </button>
                    ))
                  )}
                </div>
                {!gifSearch.trim() && (
                  <Text size="[10px]" c="dimmed" ta="center">Powered by Giphy — type to search</Text>
                )}
              </Stack>
            </Popover.Dropdown>
          </Popover>

          <Popover width={280} position="top-start" withArrow shadow="md">
            <Popover.Target>
              <ActionIcon variant="subtle" color="gray" disabled={disabled || sending || !peerUserId} aria-label="Open sticker picker" title="Open sticker picker">
                <IconSparkles size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap={8}>
                <Text size="xs" fw={700} c="dimmed">Choose a Sticker</Text>
                <div className="grid grid-cols-2 gap-2">
                  {STICKER_LIBRARY.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="message-rich-sticker flex items-center justify-center gap-2 rounded-full px-3 py-3 text-white"
                      style={{ background: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentTo})` }}
                      onClick={() => void sendRichMessage('sticker', item)}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{item.label}</span>
                    </button>
                  ))}
                </div>
              </Stack>
            </Popover.Dropdown>
          </Popover>

          <Button
            variant={recording ? 'filled' : 'subtle'}
            color={recording ? 'red' : 'gray'}
            size="xs"
            leftSection={<IconMicrophone size={16} />}
            disabled={disabled || sending || !peerUserId}
            onClick={() => void (recording ? stopRecording() : startRecording())}
          >
            {recording ? `${recordingSeconds}s` : 'Voice'}
          </Button>
        </Group>

        <TextInput
          value={value}
          onChange={(event) => { setValue(event.currentTarget.value); onTyping?.(); }}
          className="flex-1"
          placeholder={placeholder}
          disabled={disabled || sending || !peerUserId}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendText();
            }
          }}
        />

        <ActionIcon
          variant="filled"
          color="dark"
          radius="xl"
          size={40}
          disabled={!canSendText}
          loading={sending}
          onClick={() => void sendText()}
          aria-label="Send message"
          title="Send message"
        >
          <IconSend2 size={17} />
        </ActionIcon>
      </Group>
    </div>
  );
}
