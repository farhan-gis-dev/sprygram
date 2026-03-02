'use client';

import {
  Badge,
  Button,
  Group,
  Modal,
  Popover,
  RangeSlider,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCrop,
  IconMapPin,
  IconMoodSmile,
  IconRotateClockwise2,
  IconScissors,
  IconTag,
  IconUpload,
  IconUserPlus,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sprygramApi } from '@/lib/api-client';
import { useApiAuth } from '@/lib/use-api-auth';
import type { SearchAccountResult, SprygramPost, SprygramProfile } from '@/lib/api-types';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

type Props = {
  mode?: 'post' | 'reel';
  onCreated?: (post: SprygramPost) => void;
};

type ComposeStep = 'idle' | 'adjust' | 'enhance' | 'cover' | 'details';
type AspectPreset = 'original' | 'square' | 'portrait' | 'landscape';
type AdjustMode = 'crop' | 'rotate';
type FilterPreset = 'none' | 'drift' | 'mono' | 'glow' | 'dune';

type MediaAdjustment = { rotation: number; aspect: AspectPreset; cropX: number; cropY: number; zoom: number };
type ImageEnhancement = {
  preset: FilterPreset;
  brightness: number;
  contrast: number;
  fade: number;
  saturation: number;
  temperature: number;
  vignette: number;
};
type VideoEnhancement = { trim: [number, number]; soundOn: boolean };
type PreviewItem = { key: string; file: File; url: string; sourceIndex: number };

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
const VIDEO_ALLOWED = ['video/mp4', 'video/webm', 'video/quicktime'];
const EMOJIS = ['\u{1F600}', '\u{1F60D}', '\u2728', '\u{1F4CD}', '\u{1F3AC}', '\u{1F4F8}', '\u{1F44D}', '\u{1F525}'];
const COMMON_LOCATIONS = [
  'Islamabad, Pakistan',
  'Rawalpindi, Pakistan',
  'Lahore, Pakistan',
  'Karachi, Pakistan',
  'Peshawar, Pakistan',
  'Murree, Pakistan',
  'Dubai, UAE',
  'Istanbul, Turkey',
  'Doha, Qatar',
  'London, United Kingdom',
  'New York, United States',
  'Toronto, Canada',
];

const previewAspectClass: Record<AspectPreset, string> = {
  original: 'aspect-[4/5]',
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[16/9]',
};

const FILTER_PRESETS: Record<FilterPreset, Partial<ImageEnhancement>> = {
  none: {},
  drift: { saturation: 14, temperature: -8, fade: 6 },
  mono: { saturation: -100, contrast: 12 },
  glow: { brightness: 10, saturation: 18, fade: 8, vignette: 12 },
  dune: { brightness: 8, contrast: 10, temperature: 18, fade: 6 },
};

const defaultImageEnhancement = (): ImageEnhancement => ({
  preset: 'none',
  brightness: 0,
  contrast: 0,
  fade: 0,
  saturation: 0,
  temperature: 0,
  vignette: 0,
});

const defaultVideoEnhancement = (): VideoEnhancement => ({
  trim: [0, 100],
  soundOn: false,
});

const createPreviewKey = (file: File, index: number) => `${file.name}-${file.lastModified}-${index}`;
const defaultMediaAdjustment = (): MediaAdjustment => ({ rotation: 0, aspect: 'original', cropX: 0, cropY: 0, zoom: 1.08 });
const clampCropOffset = (value: number) => Math.max(-24, Math.min(24, value));

const rankSearchResults = (items: SearchAccountResult[]) => [...items].sort((left, right) => {
  const leftRank = left.followStatus === 'accepted' ? 0 : left.followStatus === 'pending' ? 1 : 2;
  const rightRank = right.followStatus === 'accepted' ? 0 : right.followStatus === 'pending' ? 1 : 2;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return right.stats.followers - left.stats.followers;
});

const buildImageFilter = (settings: ImageEnhancement): string => {
  const preset = FILTER_PRESETS[settings.preset];
  const brightness = settings.brightness + (preset.brightness || 0);
  const contrast = settings.contrast + (preset.contrast || 0);
  const fade = settings.fade + (preset.fade || 0);
  const saturation = settings.saturation + (preset.saturation || 0);
  const temperature = settings.temperature + (preset.temperature || 0);
  const sepia = temperature > 0 ? temperature / 140 : 0;
  const hueRotate = temperature < 0 ? `${Math.abs(temperature) / 2}deg` : '0deg';

  return [
    `brightness(${1 + (brightness / 100)})`,
    `contrast(${1 + (contrast / 100)})`,
    `saturate(${1 + (saturation / 100)})`,
    `opacity(${1 - (Math.max(0, fade) / 220)})`,
    `sepia(${sepia})`,
    `hue-rotate(${hueRotate})`,
  ].join(' ');
};

const buildImageVignetteOpacity = (settings: ImageEnhancement): number => {
  const preset = FILTER_PRESETS[settings.preset];
  return Math.max(0, Math.min(0.7, (settings.vignette + (preset.vignette || 0)) / 120));
};

export function PostComposer({ mode = 'post', onCreated }: Props) {
  const auth = useApiAuth();
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const cropDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [me, setMe] = useState<SprygramProfile | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<ComposeStep>('idle');
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('crop');
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [adjustments, setAdjustments] = useState<Record<string, MediaAdjustment>>({});
  const [imageEnhancements, setImageEnhancements] = useState<Record<string, ImageEnhancement>>({});
  const [videoEnhancements, setVideoEnhancements] = useState<Record<string, VideoEnhancement>>({});
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [taggedPeople, setTaggedPeople] = useState<SearchAccountResult[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<SearchAccountResult[]>([]);
  const [collaboratorDraft, setCollaboratorDraft] = useState('');
  const [collaborators, setCollaborators] = useState<SearchAccountResult[]>([]);
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<SearchAccountResult[]>([]);
  const [altText, setAltText] = useState('');
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [shareAsStory, setShareAsStory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);

  useEffect(() => {
    if (!auth.token) return;
    sprygramApi.getMyProfile(auth).then(setMe).catch(() => setMe(null));
  }, [auth.token, auth.workspaceId]);

  const previews = useMemo<PreviewItem[]>(
    () => files.map((file, index) => ({
      key: createPreviewKey(file, index),
      file,
      url: URL.createObjectURL(file),
      sourceIndex: index,
    })),
    [files],
  );

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const orderedPreviews = useMemo(() => {
    if (!previews.length) return [];
    const next = [...previews];
    const safeCoverIndex = Math.min(coverIndex, Math.max(0, next.length - 1));
    const [cover] = next.splice(safeCoverIndex, 1);
    next.unshift(cover);
    return next;
  }, [previews, coverIndex]);

  useEffect(() => {
    if (activePreviewIndex > Math.max(0, orderedPreviews.length - 1)) setActivePreviewIndex(0);
  }, [orderedPreviews.length, activePreviewIndex]);

  const activePreview = orderedPreviews[activePreviewIndex] || null;

  useEffect(() => {
    setVideoDurationSec(null);
  }, [activePreview?.key]);
  const activeAdjustment = activePreview ? adjustments[activePreview.key] || defaultMediaAdjustment() : null;
  const activeImageEnhancement = activePreview ? imageEnhancements[activePreview.key] || defaultImageEnhancement() : defaultImageEnhancement();
  const activeVideoEnhancement = activePreview ? videoEnhancements[activePreview.key] || defaultVideoEnhancement() : defaultVideoEnhancement();
  const isReelMode = mode === 'reel';
  const reelEligible = orderedPreviews.length === 1 && orderedPreviews[0]?.file.type.startsWith('video/');
  const canSubmit = orderedPreviews.length > 0 && !submitting && (!isReelMode || reelEligible);
  const locationSuggestions = useMemo(() => {
    const query = location.trim().toLowerCase();
    if (!query) return COMMON_LOCATIONS.slice(0, 6);
    return COMMON_LOCATIONS.filter((entry) => entry.toLowerCase().includes(query)).slice(0, 6);
  }, [location]);

  useEffect(() => {
    if (!auth.token) return;

    const fetchSuggestions = (
      draft: string,
      currentSelection: SearchAccountResult[],
      setter: (items: SearchAccountResult[]) => void,
    ) => {
      const normalized = draft.trim().replace(/^@/, '');
      if (!normalized) {
        setter([]);
        return;
      }

      const timer = window.setTimeout(async () => {
        try {
          const response = await sprygramApi.searchAccounts(normalized, 8, auth);
          const selectedIds = new Set(currentSelection.map((entry) => entry.userId));
          setter(rankSearchResults(response.items || []).filter((entry) => !selectedIds.has(entry.userId)));
        } catch {
          setter([]);
        }
      }, 180);

      return () => window.clearTimeout(timer);
    };

    const tagCleanup = fetchSuggestions(tagDraft, taggedPeople, setTagSuggestions);
    const collaboratorCleanup = fetchSuggestions(collaboratorDraft, collaborators, setCollaboratorSuggestions);

    return () => {
      if (tagCleanup) tagCleanup();
      if (collaboratorCleanup) collaboratorCleanup();
    };
  }, [tagDraft, collaboratorDraft, taggedPeople, collaborators, auth.token, auth.workspaceId]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !activePreview?.file.type.startsWith('video/')) return;

    const [startPercent, endPercent] = activeVideoEnhancement.trim;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) return;
    const startSeconds = (duration * startPercent) / 100;
    const endSeconds = (duration * endPercent) / 100;
    if (video.currentTime < startSeconds || video.currentTime > endSeconds) video.currentTime = startSeconds;
    if (video.paused) void video.play().catch(() => undefined);
  }, [activePreview?.key, activeVideoEnhancement.trim, activeVideoEnhancement.soundOn]);

  const resetComposer = () => {
    setCaption('');
    setLocation('');
    setLocationOpen(false);
    setFiles([]);
    setStep('idle');
    setAdjustMode('crop');
    setActivePreviewIndex(0);
    setCoverIndex(0);
    setAdjustments({});
    setImageEnhancements({});
    setVideoEnhancements({});
    setCollaborators([]);
    setTaggedPeople([]);
    setCollaboratorDraft('');
    setTagDraft('');
    setTagSuggestions([]);
    setCollaboratorSuggestions([]);
    setAltText('');
    setHideLikeCount(false);
    setAllowComments(true);
    setShareAsStory(false);
  };

  const onSelectFiles = (nextFiles: FileList | null) => {
    if (!nextFiles) return;
    const candidate = Array.from(nextFiles).slice(0, isReelMode ? 1 : 10);
    const invalid = candidate.find((file) => !(isReelMode ? VIDEO_ALLOWED : ALLOWED).includes(file.type));
    if (invalid) {
      notifications.show({
        color: 'red',
        title: 'Unsupported type',
        message: isReelMode ? `${invalid.name} is not a supported reel video.` : `${invalid.name} is not allowed.`,
      });
      return;
    }

    if (isReelMode && candidate.length !== 1) {
      notifications.show({ color: 'red', title: 'One reel video only', message: 'Choose a single video file for a reel.' });
      return;
    }

    const nextAdjustments: Record<string, MediaAdjustment> = {};
    const nextImageEnhancements: Record<string, ImageEnhancement> = {};
    const nextVideoEnhancements: Record<string, VideoEnhancement> = {};

    candidate.forEach((file, index) => {
      const key = createPreviewKey(file, index);
      nextAdjustments[key] = defaultMediaAdjustment();
      if (file.type.startsWith('video/')) nextVideoEnhancements[key] = defaultVideoEnhancement();
      else nextImageEnhancements[key] = defaultImageEnhancement();
    });

    setFiles(candidate);
    setAdjustments(nextAdjustments);
    setImageEnhancements(nextImageEnhancements);
    setVideoEnhancements(nextVideoEnhancements);
    setActivePreviewIndex(0);
    setCoverIndex(0);
    setAdjustMode('crop');
    setStep('adjust');
  };

  const updateAdjustment = (patch: Partial<MediaAdjustment>) => {
    if (!activePreview) return;
    setAdjustments((previous) => ({
      ...previous,
      [activePreview.key]: { ...(previous[activePreview.key] || defaultMediaAdjustment()), ...patch },
    }));
  };

  const updateImageEnhancement = (patch: Partial<ImageEnhancement>) => {
    if (!activePreview) return;
    setImageEnhancements((previous) => ({
      ...previous,
      [activePreview.key]: { ...(previous[activePreview.key] || defaultImageEnhancement()), ...patch },
    }));
  };

  const updateVideoEnhancement = (patch: Partial<VideoEnhancement>) => {
    if (!activePreview) return;
    setVideoEnhancements((previous) => ({
      ...previous,
      [activePreview.key]: { ...(previous[activePreview.key] || defaultVideoEnhancement()), ...patch },
    }));
  };

  const applyFilterPreset = (preset: FilterPreset) => {
    const base = defaultImageEnhancement();
    updateImageEnhancement({ ...base, ...FILTER_PRESETS[preset], preset });
  };

  const selectCover = (sourceIndex: number) => {
    setCoverIndex(sourceIndex);
    setActivePreviewIndex(0);
  };

  const addAccount = (
    entry: SearchAccountResult,
    current: SearchAccountResult[],
    setter: (items: SearchAccountResult[]) => void,
    reset: () => void,
  ) => {
    if (current.some((item) => item.userId === entry.userId)) return;
    setter([...current, entry]);
    reset();
  };

  useEffect(() => {
    if (!isDraggingCrop) return undefined;

    const handleMove = (event: MouseEvent) => {
      const drag = cropDragRef.current;
      if (!drag || !activePreview || activePreview.file.type.startsWith('video/')) return;

      const deltaX = ((event.clientX - drag.startX) / 220) * 100;
      const deltaY = ((event.clientY - drag.startY) / 220) * 100;

      setAdjustments((previous) => ({
        ...previous,
        [activePreview.key]: {
          ...(previous[activePreview.key] || defaultMediaAdjustment()),
          cropX: clampCropOffset(drag.originX + deltaX),
          cropY: clampCropOffset(drag.originY + deltaY),
        },
      }));
    };

    const handleUp = () => {
      cropDragRef.current = null;
      setIsDraggingCrop(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingCrop, activePreview]);

  const renderActivePreview = (options?: { interactiveCrop?: boolean }) => {
    if (!activePreview || !activeAdjustment) return null;
    const interactiveCrop = Boolean(options?.interactiveCrop) && !activePreview.file.type.startsWith('video/');
    const imageStyle = {
      transform: `translate(${activeAdjustment.cropX}%, ${activeAdjustment.cropY}%) scale(${activeAdjustment.zoom}) rotate(${activeAdjustment.rotation}deg)`,
      transformOrigin: 'center center',
      filter: buildImageFilter(activeImageEnhancement),
    };
    const vignetteOpacity = buildImageVignetteOpacity(activeImageEnhancement);

    return (
      <div
        className={`relative overflow-hidden rounded-[24px] bg-black ${previewAspectClass[activeAdjustment.aspect]} ${interactiveCrop ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={(event) => {
          if (!interactiveCrop) return;
          cropDragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: activeAdjustment.cropX,
            originY: activeAdjustment.cropY,
          };
          setIsDraggingCrop(true);
        }}
      >
        {activePreview.file.type.startsWith('video/') ? (
          <video
            key={activePreview.key}
            ref={previewVideoRef}
            src={activePreview.url}
            className="h-full w-full object-cover"
            style={{ transform: `rotate(${activeAdjustment.rotation}deg)` }}
            autoPlay
            muted={!activeVideoEnhancement.soundOn}
            loop
            playsInline
            controls
            onLoadedMetadata={(event) => {
              const [startPercent] = activeVideoEnhancement.trim;
              if (Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0) {
                event.currentTarget.currentTime = (event.currentTarget.duration * startPercent) / 100;
                setVideoDurationSec(event.currentTarget.duration);
              }
            }}
            onTimeUpdate={(event) => {
              const duration = event.currentTarget.duration;
              if (!Number.isFinite(duration) || duration <= 0) return;
              const [startPercent, endPercent] = activeVideoEnhancement.trim;
              const startSeconds = (duration * startPercent) / 100;
              const endSeconds = (duration * endPercent) / 100;
              if (event.currentTarget.currentTime > endSeconds) event.currentTarget.currentTime = startSeconds;
            }}
          />
        ) : (
          <>
            <img src={activePreview.url} alt={activePreview.file.name} className="h-full w-full object-cover" style={imageStyle} />
            {interactiveCrop ? (
              <>
                <div className="pointer-events-none absolute inset-[10%] rounded-[22px] border border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.34)]" />
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white">
                  Crop: {Math.round(Math.abs(activeAdjustment.cropX))}% x {Math.round(Math.abs(activeAdjustment.cropY))}% y
                </div>
              </>
            ) : null}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'radial-gradient(circle at center, rgba(0,0,0,0) 52%, rgba(0,0,0,0.82) 100%)',
                opacity: vignetteOpacity,
              }}
            />
          </>
        )}
      </div>
    );
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const orderedFiles = orderedPreviews.map((preview) => preview.file);
      const uploaded = await sprygramApi.uploadMedia(orderedFiles, auth);
      const mediaFileIds = uploaded.items.map((item) => item.driveFileId);
      const created = await sprygramApi.createPost({
        caption: caption.trim() || undefined,
        location: location.trim() || undefined,
        mediaFileIds,
      }, auth);

      if (!isReelMode && shareAsStory && uploaded.items.length > 0) {
        await sprygramApi.createStory({ driveFileId: uploaded.items[0].driveFileId, caption: caption.trim() || undefined }, auth);
      }
      if (isReelMode) await sprygramApi.createReel(created.id, auth);

      resetComposer();
      onCreated?.(created);
      notifications.show({
        color: 'teal',
        title: isReelMode ? 'Reel shared' : 'Posted',
        message: isReelMode ? 'Your reel is live.' : 'Your post is live.',
      });
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: isReelMode ? 'Reel failed' : 'Post failed',
        message: error.message || (isReelMode ? 'Unable to publish reel.' : 'Unable to publish post.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-border bg-panel p-5 shadow-card">
      <Stack gap="lg">
        <Stack gap={2}>
          <Text fw={700} size="lg">{isReelMode ? 'Create reel' : 'Create new post'}</Text>
          <Text size="sm" c="dimmed">
            {isReelMode
              ? 'Choose one video, set the cover, then finish the details before publishing your reel.'
              : 'Select media, fine tune the visuals, choose the cover, then finish the details before publishing.'}
          </Text>
        </Stack>

        {step === 'idle' ? (
          <label className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-[#fafafa] text-center transition hover:bg-[#f5f7fa]">
            <IconUpload size={36} />
            <Text fw={700} mt={16}>{isReelMode ? 'Drag one video here' : 'Drag photos and videos here'}</Text>
            <Text size="sm" c="dimmed" mt={6}>{isReelMode ? 'One video per reel (MP4, WebM, MOV). You can trim the duration after selecting.' : 'Or browse your device. Up to 10 files.'}</Text>
            <span className="mt-6 rounded-full bg-[var(--spry-accent)] px-4 py-2 text-sm font-semibold text-white">Select from computer</span>
            <input
              type="file"
              multiple={!isReelMode}
              className="hidden"
              accept={(isReelMode ? VIDEO_ALLOWED : ALLOWED).join(',')}
              onChange={(event) => onSelectFiles(event.currentTarget.files)}
            />
          </label>
        ) : (
          <Stack gap="lg">
            <div className="rounded-[24px] border border-border bg-[#101418] p-4">
              <div className="mx-auto max-w-[520px]">
                {renderActivePreview()}

                <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
                  {orderedPreviews.map((preview, index) => (
                    <button
                      key={preview.key}
                      type="button"
                      className={`relative h-16 w-16 overflow-hidden rounded-xl border transition ${index === activePreviewIndex ? 'border-[var(--spry-accent)] shadow-[0_0_0_3px_rgba(31,122,224,0.12)]' : 'border-border hover:border-[#a6c9f6]'}`}
                      onClick={() => setActivePreviewIndex(index)}
                    >
                      {preview.file.type.startsWith('video/') ? (
                        <video src={preview.url} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                      )}
                      {preview.sourceIndex === coverIndex ? (
                        <span className="absolute bottom-1 left-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                          Cover
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-white px-4 py-3">
              <Group justify="space-between">              <Group gap={10}>
                <Button
                  variant="default"
                  leftSection={<IconRotateClockwise2 size={16} />}
                  onClick={() => updateAdjustment({ rotation: ((activeAdjustment?.rotation || 0) + 90) % 360 })}
                >
                  Rotate 90°
                </Button>
                <Badge variant="light" color="gray">
                  Current rotation: {activeAdjustment?.rotation || 0}°
                </Badge>
              </Group>
                <Group gap={8}>
                  <Badge variant={step === 'adjust' ? 'filled' : 'light'} color="blue">Crop & Rotate</Badge>
                  <Badge variant={step === 'enhance' ? 'filled' : 'light'} color="blue">Filters & Adjustments</Badge>
                  <Badge variant={step === 'cover' ? 'filled' : 'light'} color="blue">Cover</Badge>
                  <Badge variant={step === 'details' ? 'filled' : 'light'} color="blue">Details</Badge>
                </Group>
              </Group>
            </div>

            {step === 'details' ? (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <div className="rounded-[24px] border border-border bg-white p-4">
                    <Stack gap="md">
                      <Textarea
                        label="Caption"
                        minRows={5}
                        maxLength={2200}
                        value={caption}
                        onChange={(event) => setCaption(event.currentTarget.value)}
                        placeholder="Write a caption..."
                        rightSection={
                          <Popover position="bottom-end" withArrow shadow="md">
                            <Popover.Target>
                              <button type="button" className="rounded-md p-1 text-[#6b7280] hover:bg-gray-100" aria-label="Open caption emoji picker" title="Open caption emoji picker">
                                <IconMoodSmile size={18} />
                              </button>
                            </Popover.Target>
                            <Popover.Dropdown>
                              <Group gap={6}>
                                {EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded-md px-1 py-1 text-lg hover:bg-gray-100"
                                    onClick={() => setCaption((previous) => `${previous}${emoji}`)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </Group>
                            </Popover.Dropdown>
                          </Popover>
                        }
                      />

                      <Popover opened={locationOpen && locationSuggestions.length > 0} onChange={setLocationOpen} position="bottom-start" width="target" shadow="md">
                        <Popover.Target>
                          <TextInput
                            label="Location"
                            value={location}
                            onChange={(event) => {
                              setLocation(event.currentTarget.value);
                              setLocationOpen(true);
                            }}
                            onFocus={() => setLocationOpen(true)}
                            placeholder="Add location"
                            maxLength={120}
                            leftSection={<IconMapPin size={16} />}
                          />
                        </Popover.Target>
                        <Popover.Dropdown p={6}>
                          <Stack gap={4}>
                            {locationSuggestions.map((entry) => (
                              <button
                                key={entry}
                                type="button"
                                className="rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
                                onClick={() => {
                                  setLocation(entry);
                                  setLocationOpen(false);
                                }}
                              >
                                {entry}
                              </button>
                            ))}
                          </Stack>
                        </Popover.Dropdown>
                      </Popover>

                      <TextInput
                        label="Alt text"
                        value={altText}
                        onChange={(event) => setAltText(event.currentTarget.value)}
                        placeholder="Describe your media for accessibility"
                      />
                    </Stack>
                  </div>

                  <div className="rounded-[24px] border border-border bg-white p-4">
                    <Stack gap="md">
                      <Stack gap={6}>
                        <Text size="sm" fw={700}>Tag people</Text>
                        <TextInput
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.currentTarget.value)}
                          placeholder="Search friends and people you follow"
                          leftSection={<IconTag size={16} />}
                        />
                        {tagSuggestions.length > 0 ? (
                          <div className="rounded-2xl border border-border p-2">
                            <Stack gap={4}>
                              {tagSuggestions.map((entry) => (
                                <button
                                  key={entry.userId}
                                  type="button"
                                  className="rounded-xl px-2 py-2 text-left hover:bg-gray-50"
                                  onClick={() => addAccount(entry, taggedPeople, setTaggedPeople, () => {
                                    setTagDraft('');
                                    setTagSuggestions([]);
                                  })}
                                >
                                  <Group wrap="nowrap">
                                    <ProfileAvatar size={34} src={entry.avatarUrl} name={entry.displayName || entry.username} />
                                    <Stack gap={0} className="min-w-0">
                                      <Text size="sm" fw={700} lineClamp={1}>{entry.username}</Text>
                                      <Text size="xs" c="dimmed" lineClamp={1}>
                                        {entry.followStatus === 'accepted' ? 'Friend / following' : 'Suggested account'}
                                      </Text>
                                    </Stack>
                                  </Group>
                                </button>
                              ))}
                            </Stack>
                          </div>
                        ) : null}
                        <Group gap={6}>
                          {taggedPeople.map((entry) => (
                            <Badge key={entry.userId} variant="light" radius="xl" size="lg">
                              @{entry.username}
                            </Badge>
                          ))}
                        </Group>
                      </Stack>

                      <Stack gap={6}>
                        <Text size="sm" fw={700}>Add collaborators</Text>
                        <TextInput
                          value={collaboratorDraft}
                          onChange={(event) => setCollaboratorDraft(event.currentTarget.value)}
                          placeholder="Invite collaborators"
                          leftSection={<IconUserPlus size={16} />}
                        />
                        {collaboratorSuggestions.length > 0 ? (
                          <div className="rounded-2xl border border-border p-2">
                            <Stack gap={4}>
                              {collaboratorSuggestions.map((entry) => (
                                <button
                                  key={entry.userId}
                                  type="button"
                                  className="rounded-xl px-2 py-2 text-left hover:bg-gray-50"
                                  onClick={() => addAccount(entry, collaborators, setCollaborators, () => {
                                    setCollaboratorDraft('');
                                    setCollaboratorSuggestions([]);
                                  })}
                                >
                                  <Group wrap="nowrap">
                                    <ProfileAvatar size={34} src={entry.avatarUrl} name={entry.displayName || entry.username} />
                                    <Stack gap={0} className="min-w-0">
                                      <Text size="sm" fw={700} lineClamp={1}>{entry.username}</Text>
                                      <Text size="xs" c="dimmed" lineClamp={1}>
                                        {entry.followStatus === 'accepted' ? 'Friend / following' : 'Suggested account'}
                                      </Text>
                                    </Stack>
                                  </Group>
                                </button>
                              ))}
                            </Stack>
                          </div>
                        ) : null}
                        <Group gap={6}>
                          {collaborators.map((entry) => (
                            <Badge key={entry.userId} variant="light" radius="xl" size="lg">
                              @{entry.username}
                            </Badge>
                          ))}
                        </Group>
                      </Stack>
                    </Stack>
                  </div>
                </SimpleGrid>
                
                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <div className="rounded-[24px] border border-border bg-white p-4">
                    <Stack gap="sm">
                      <Text size="sm" fw={700}>Publishing controls</Text>
                      <Switch checked={allowComments} onChange={(event) => setAllowComments(event.currentTarget.checked)} label={`Allow comments on this ${isReelMode ? 'reel' : 'post'}`} />
                      <Switch checked={hideLikeCount} onChange={(event) => setHideLikeCount(event.currentTarget.checked)} label="Hide like count in your own view" />
                    </Stack>
                  </div>

                  {!isReelMode ? (
                    <div className="rounded-[24px] border border-border bg-white p-4">
                      <Stack gap="sm">
                        <Text size="sm" fw={700}>Also share as</Text>
                        <Switch checked={shareAsStory} onChange={(event) => setShareAsStory(event.currentTarget.checked)} label="Story using the first uploaded item" />
                        <Text size="sm" c="dimmed">Post and story are separate here. Reels only publish from reel mode.</Text>
                      </Stack>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-border bg-white p-4">
                      <Stack gap="sm">
                        <Text size="sm" fw={700}>Reel publishing</Text>
                        <Text size="sm" c="dimmed">This upload stays in Reels. Stories and feed posts are separate flows.</Text>
                      </Stack>
                    </div>
                  )}
                </SimpleGrid>

                <Group justify="space-between">
                  <Group gap={8}>
                    <Button variant="default" onClick={() => setStep('adjust')}>Reopen crop</Button>
                    <Button variant="default" onClick={() => setStep('enhance')}>Reopen filters</Button>
                    <Button variant="default" onClick={() => setStep('cover')}>Change cover</Button>
                  </Group>
                  <Button disabled={!canSubmit} loading={submitting} onClick={() => void submit()}>
                    {isReelMode ? 'Share reel' : 'Share'}
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Group justify="space-between" className="rounded-[24px] border border-border bg-white px-4 py-3">
                <Text size="sm" c="dimmed">
                  {step === 'adjust'
                    ? 'Finish live crop and rotate first.'
                    : step === 'enhance'
                      ? 'Use filter presets, manual adjustments, or video trim before moving on.'
                      : 'Choose which selected item should appear first in your preview and upload order.'}
                </Text>
                <Button onClick={() => setStep(step === 'adjust' ? 'enhance' : step === 'enhance' ? 'cover' : 'details')}>
                  {step === 'cover' ? 'Continue' : 'Next'}
                </Button>
              </Group>
            )}
          </Stack>
        )}

        <Modal
          opened={step === 'adjust'}
          onClose={() => setStep(orderedPreviews.length ? 'enhance' : 'idle')}
          title="Crop and rotate"
          centered
          size="lg"
        >
          <Stack gap="md">
            <SegmentedControl
              value={adjustMode}
              onChange={(value) => setAdjustMode(value as AdjustMode)}
              data={[
                { label: 'Crop', value: 'crop' },
                { label: 'Rotate', value: 'rotate' },
              ]}
            />

            <div className="rounded-[24px] border border-border bg-[#101418] p-4">
              <div className="mx-auto max-w-[380px]">
                {renderActivePreview({ interactiveCrop: adjustMode === 'crop' })}
              </div>
            </div>

            {adjustMode === 'crop' ? (
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Drag the image inside the frame to choose the crop. The label updates to show how much you have shifted the crop horizontally and vertically.</Text>
                <Group gap={8}>
                  <Button size="xs" variant="default" leftSection={<IconCrop size={14} />} onClick={() => updateAdjustment({ cropX: 0, cropY: 0, zoom: 1.08 })}>
                    Reset crop
                  </Button>
                  <Badge variant="light" color="gray">Horizontal {Math.round(Math.abs(activeAdjustment?.cropX || 0))}%</Badge>
                  <Badge variant="light" color="gray">Vertical {Math.round(Math.abs(activeAdjustment?.cropY || 0))}%</Badge>
                </Group>
              </Stack>
            ) : (
              <Group gap={10}>
                <Button
                  variant="default"
                  leftSection={<IconRotateClockwise2 size={16} />}
                  onClick={() => updateAdjustment({ rotation: ((activeAdjustment?.rotation || 0) + 90) % 360 })}
                >
                  Rotate 90°
                </Button>
                <Badge variant="light" color="gray">
                  Current rotation: {activeAdjustment?.rotation || 0}°
                </Badge>
              </Group>
            )}

            <Group justify="space-between">
              <Button variant="default" onClick={resetComposer}>Cancel</Button>
              <Button onClick={() => setStep('enhance')}>Next</Button>
            </Group>
          </Stack>
        </Modal>

        <Modal
          opened={step === 'enhance'}
          onClose={() => setStep(orderedPreviews.length ? 'cover' : 'idle')}
          title="Filters and adjustments"
          centered
          size="xl"
        >
          <Stack gap="md">
            <div className="rounded-[24px] border border-border bg-[#101418] p-4">
              <div className="mx-auto max-w-[420px]">
                {renderActivePreview()}
              </div>
            </div>

            {activePreview?.file.type.startsWith('video/') ? (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <div className="rounded-[20px] border border-border p-4">
                  <Stack gap="sm">
                    <Text fw={700}>Cover, trim and sound</Text>
                    <Text size="sm" c="dimmed">
                      {isReelMode
                        ? 'Set the trim range to control exactly how long your reel will be before publishing.'
                        : 'Adjust the video trim and sound now. You can pick the post cover on the next step.'}
                    </Text>
                    {videoDurationSec ? (
                      <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                        🎬 Total: {videoDurationSec.toFixed(1)}s — selected clip: {((videoDurationSec * (activeVideoEnhancement.trim[1] - activeVideoEnhancement.trim[0])) / 100).toFixed(1)}s
                      </div>
                    ) : null}
                    <RangeSlider
                      label={(value) => videoDurationSec ? `${((videoDurationSec * value) / 100).toFixed(1)}s` : `${value}%`}
                      minRange={5}
                      value={activeVideoEnhancement.trim}
                      onChange={(value) => updateVideoEnhancement({ trim: value as [number, number] })}
                      min={0}
                      max={100}
                    />
                    <Switch
                      checked={activeVideoEnhancement.soundOn}
                      onChange={(event) => updateVideoEnhancement({ soundOn: event.currentTarget.checked })}
                      label={activeVideoEnhancement.soundOn ? 'Sound on' : 'Sound off'}
                      thumbIcon={activeVideoEnhancement.soundOn ? <IconVolume size={12} /> : <IconVolumeOff size={12} />}
                    />
                  </Stack>
                </div>

                <div className="rounded-[20px] border border-border p-4">
                  <Stack gap="sm">
                    <Text fw={700}>Preview tools</Text>
                    <Group gap={8}>
                      <Badge variant="light" leftSection={<IconScissors size={12} />}>
                        {videoDurationSec
                          ? `${((videoDurationSec * activeVideoEnhancement.trim[0]) / 100).toFixed(1)}s – ${((videoDurationSec * activeVideoEnhancement.trim[1]) / 100).toFixed(1)}s of ${videoDurationSec.toFixed(1)}s`
                          : `Trim ${activeVideoEnhancement.trim[0]}% – ${activeVideoEnhancement.trim[1]}%`}
                      </Badge>
                      <Badge variant="light" leftSection={<IconCheck size={12} />}>
                        {activeVideoEnhancement.soundOn ? 'Sound on' : 'Muted'}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">These controls update the live preview now. Cover selection comes next.</Text>
                  </Stack>
                </div>
              </SimpleGrid>
            ) : (
              <Tabs defaultValue="filters">
                <Tabs.List>
                  <Tabs.Tab value="filters">Filters</Tabs.Tab>
                  <Tabs.Tab value="adjustments">Adjustments</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="filters" pt="md">
                  <div className="grid gap-3 sm:grid-cols-5">
                    {(['none', 'drift', 'mono', 'glow', 'dune'] as FilterPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`rounded-2xl border px-3 py-4 text-left transition ${activeImageEnhancement.preset === preset ? 'border-[var(--spry-accent)] bg-[var(--spry-accent-soft)]' : 'border-border hover:bg-gray-50'}`}
                        onClick={() => applyFilterPreset(preset)}
                      >
                        <Text size="sm" fw={700} tt="capitalize">{preset}</Text>
                        <Text size="xs" c="dimmed">Preview preset</Text>
                      </button>
                    ))}
                  </div>
                </Tabs.Panel>

                <Tabs.Panel value="adjustments" pt="md">
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <div className="rounded-[20px] border border-border p-4">
                      <Stack gap="md">
                        <Text size="sm" fw={700}>Manual adjustments</Text>
                        <div>
                          <Text size="xs" mb={4}>Brightness</Text>
                          <Slider min={-100} max={100} value={activeImageEnhancement.brightness} onChange={(value) => updateImageEnhancement({ brightness: value })} />
                        </div>
                        <div>
                          <Text size="xs" mb={4}>Contrast</Text>
                          <Slider min={-100} max={100} value={activeImageEnhancement.contrast} onChange={(value) => updateImageEnhancement({ contrast: value })} />
                        </div>
                        <div>
                          <Text size="xs" mb={4}>Fade</Text>
                          <Slider min={-100} max={100} value={activeImageEnhancement.fade} onChange={(value) => updateImageEnhancement({ fade: value })} />
                        </div>
                      </Stack>
                    </div>

                    <div className="rounded-[20px] border border-border p-4">
                      <Stack gap="md">
                        <Text size="sm" fw={700}>Color adjustments</Text>
                        <div>
                          <Text size="xs" mb={4}>Saturation</Text>
                          <Slider min={-100} max={100} value={activeImageEnhancement.saturation} onChange={(value) => updateImageEnhancement({ saturation: value })} />
                        </div>
                        <div>
                          <Text size="xs" mb={4}>Temperature</Text>
                          <Slider min={-100} max={100} value={activeImageEnhancement.temperature} onChange={(value) => updateImageEnhancement({ temperature: value })} />
                        </div>
                        <div>
                          <Text size="xs" mb={4}>Vignette</Text>
                          <Slider min={-100} max={100} value={activeImageEnhancement.vignette} onChange={(value) => updateImageEnhancement({ vignette: value })} />
                        </div>
                      </Stack>
                    </div>
                  </SimpleGrid>
                </Tabs.Panel>
              </Tabs>
            )}

            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep('adjust')}>Back</Button>
              <Button onClick={() => setStep('cover')}>Next</Button>
            </Group>
          </Stack>
        </Modal>

        <Modal
          opened={step === 'cover'}
          onClose={() => setStep(orderedPreviews.length ? 'details' : 'idle')}
          title="Choose cover"
          centered
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">The selected cover becomes the first item in the preview and upload order.</Text>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {previews.map((preview) => {
                const selected = preview.sourceIndex === coverIndex;
                return (
                  <button
                    key={`cover-${preview.key}`}
                    type="button"
                    className={`relative overflow-hidden rounded-2xl border transition ${selected ? 'border-[var(--spry-accent)] shadow-[0_0_0_3px_rgba(31,122,224,0.12)]' : 'border-border hover:border-[#a6c9f6]'}`}
                    onClick={() => selectCover(preview.sourceIndex)}
                  >
                    <div className="aspect-square bg-black">
                      {preview.file.type.startsWith('video/') ? (
                        <video src={preview.url} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    {selected ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-black">
                        <IconCheck size={11} />
                        Cover
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep('enhance')}>Back</Button>
              <Button onClick={() => setStep('details')}>Continue</Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </div>
  );
}
