'use client';

import { ActionIcon, Button, Group, Popover, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
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
  // Smileys & emotions
  '\u{1F600}', '\u{1F602}', '\u{1F603}', '\u{1F604}', '\u{1F60D}', '\u{1F617}',
  '\u{1F618}', '\u{1F923}', '\u{1F973}', '\u{1F970}', '\u{1F607}', '\u{1F911}',
  '\u{1F929}', '\u{1F621}', '\u{1F622}', '\u{1F62D}', '\u{1F62A}', '\u{1F614}',
  '\u{1F644}', '\u{1F60F}', '\u{1F61C}', '\u{1F92A}', '\u{1F975}', '\u{1F976}',
  // Gestures & hands
  '\u{1F44D}', '\u{1F44E}', '\u{1F44F}', '\u{1F64C}', '\u{1F64F}', '\u{270C}\uFE0F',
  '\u{1F91E}', '\u{1F91F}', '\u{1F4AA}', '\u{1F91D}', '\u{1F44B}', '\u{1F596}',
  // Symbols & objects
  '\u2764\uFE0F', '\u{1F9E1}', '\u{1F499}', '\u{1F49A}', '\u{1F49B}', '\u{1F5A4}',
  '\u{1F525}', '\u2728', '\u{1F4AB}', '\u{1F4AF}', '\u{1F389}', '\u{1F38A}',
  '\u{1F3AF}', '\u{1F680}', '\u{1F31F}', '\u{1F4A5}', '\u{1F4A1}', '\u{1F3FC}',
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
          <Popover width={300} position="top-start" withArrow shadow="md">
            <Popover.Target>
              <ActionIcon variant="subtle" color="gray" disabled={disabled || sending || !peerUserId} aria-label="Open emoji picker" title="Open emoji picker">
                <IconMoodSmile size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex items-center justify-center rounded-md p-1 text-xl hover:bg-gray-100"
                    onClick={() => setValue((previous) => `${previous}${emoji}`)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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
