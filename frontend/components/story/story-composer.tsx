'use client';

import { Button, Group, Stack, Switch, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconUpload, IconVideo } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import type { StoryItem } from '@/lib/api-types';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';

type Props = {
  onCreated?: (story: StoryItem) => void;
};

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

export function StoryComposer({ onCreated }: Props) {
  const auth = useApiAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [shareAsHighlight, setShareAsHighlight] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = (nextFiles: FileList | null) => {
    if (!nextFiles?.length) return;

    const nextFile = nextFiles[0];
    if (!ALLOWED.includes(nextFile.type)) {
      notifications.show({ color: 'red', title: 'Unsupported type', message: `${nextFile.name} cannot be used in stories.` });
      return;
    }

    setFile(nextFile);
  };

  const clearFile = () => {
    setFile(null);
    setCaption('');
    setShareAsHighlight(false);
  };

  const submit = async () => {
    if (!file || submitting) return;

    setSubmitting(true);
    try {
      const uploaded = await sprygramApi.uploadMedia([file], auth);
      const firstItem = uploaded.items[0];
      if (!firstItem) throw new Error('Upload finished without a media file.');

      const story = await sprygramApi.createStory({
        driveFileId: firstItem.driveFileId,
        caption: caption.trim() || undefined,
        isHighlight: shareAsHighlight,
        highlightLabel: shareAsHighlight ? 'New' : undefined,
      }, auth);

      notifications.show({ color: 'teal', title: 'Story shared', message: 'Your story is now live.' });
      clearFile();
      onCreated?.(story);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Story failed', message: error.message || 'Unable to share story.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-border bg-panel p-5 shadow-card">
      <Stack gap="lg">
        <Stack gap={2}>
          <Text fw={700} size="lg">Share story</Text>
          <Text size="sm" c="dimmed">Pick one photo or video and publish it to your story.</Text>
        </Stack>

        {!file ? (
          <label className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-[#fafafa] text-center transition hover:bg-[#f5f7fa]">
            <IconUpload size={36} />
            <Text fw={700} mt={16}>Add to your story</Text>
            <Text size="sm" c="dimmed" mt={6}>Choose one photo or video from your device.</Text>
            <span className="mt-6 rounded-full bg-[var(--spry-accent)] px-4 py-2 text-sm font-semibold text-white">Select from computer</span>
            <input
              type="file"
              className="hidden"
              accept={ALLOWED.join(',')}
              onChange={(event) => selectFile(event.currentTarget.files)}
            />
          </label>
        ) : (
          <>
            <div className="rounded-[24px] border border-border bg-[#101418] p-4">
              <div className="mx-auto max-w-[420px] overflow-hidden rounded-[24px] bg-black">
                {file.type.startsWith('video/') && previewUrl ? (
                  <video src={previewUrl} className="max-h-[70vh] w-full object-contain" controls autoPlay muted loop playsInline />
                ) : previewUrl ? (
                  <img src={previewUrl} alt={file.name} className="max-h-[70vh] w-full object-contain" />
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-white p-4">
              <Stack gap="md">
                <Group gap={8}>
                  {file.type.startsWith('video/') ? (
                    <Text size="sm" fw={700} className="inline-flex items-center gap-2"><IconVideo size={16} /> Video story</Text>
                  ) : (
                    <Text size="sm" fw={700} className="inline-flex items-center gap-2"><IconPhoto size={16} /> Photo story</Text>
                  )}
                </Group>

                <Textarea
                  label="Caption"
                  value={caption}
                  onChange={(event) => setCaption(event.currentTarget.value)}
                  minRows={3}
                  maxLength={500}
                  placeholder="Write something for your story"
                />

                <Switch
                  checked={shareAsHighlight}
                  onChange={(event) => setShareAsHighlight(event.currentTarget.checked)}
                  label="Keep this story as a highlight after it expires"
                />
              </Stack>
            </div>

            <Group justify="space-between">
              <Button variant="default" onClick={clearFile}>Choose another file</Button>
              <Button loading={submitting} onClick={() => void submit()}>Share story</Button>
            </Group>
          </>
        )}
      </Stack>
    </div>
  );
}
