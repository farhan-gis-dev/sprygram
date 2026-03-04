'use client';

import { ActionIcon, AspectRatio, Modal } from '@mantine/core';
import { IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { SprygramMedia } from '@/lib/api-types';

type Props = {
  media: SprygramMedia;
  /** When provided, clicking the video area routes to reels; video autoplays in viewport */
  onVideoClick?: () => void;
  /** When true, the video is force-paused (e.g. when comments/share panel open) */
  forcePaused?: boolean;
};

/** Progressive image: lazy-loads with a blur-up fade, click opens full-size lightbox */
function ProgressiveImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onClick={() => setLightboxOpen(true)}
        className={`${className ?? ''} cursor-zoom-in transition-[filter,opacity] duration-300 ${
          loaded ? 'opacity-100 blur-0' : 'opacity-50 blur-[6px]'
        }`}
      />
      <Modal
        opened={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        centered
        size="xl"
        padding={0}
        withCloseButton
        styles={{
          body: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
          content: { background: '#000' },
          header: { background: 'transparent', position: 'absolute', top: 0, right: 0, zIndex: 10 },
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-full object-contain"
        />
      </Modal>
    </>
  );
}

export function MediaView({ media, onVideoClick, forcePaused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Default: attempt unmuted playback; browser may force muted — user can toggle
  const [videoMuted, setVideoMuted] = useState(false);

  // Try to play unmuted; fall back to muted if browser blocks autoplay with sound
  const tryPlay = (vid: HTMLVideoElement) => {
    if (forcePaused) return;
    vid.muted = false;
    vid.play().catch(() => {
      vid.muted = true;
      setVideoMuted(true);
      vid.play().catch(() => undefined);
    });
  };

  // Auto-play when ≥60% visible; pause when scrolled away
  useEffect(() => {
    if (media.mediaType !== 'video' || !onVideoClick) return;
    const vid = videoRef.current;
    if (!vid) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) tryPlay(vid);
        else vid.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(vid);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.mediaType, onVideoClick, forcePaused]);

  // Force-pause when panel opens
  useEffect(() => {
    if (media.mediaType !== 'video' || !onVideoClick) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (forcePaused) {
      vid.pause();
    } else {
      tryPlay(vid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcePaused, media.mediaType, onVideoClick]);

  if (media.mediaType === 'video') {
    if (onVideoClick) {
      return (
        <AspectRatio ratio={4 / 5} className="post-media-frame">
          <div className="relative h-full w-full cursor-pointer bg-black" onClick={onVideoClick}>
            <video
              ref={videoRef}
              src={media.url}
              className="h-full w-full object-cover"
              preload="metadata"
              playsInline
              muted={videoMuted}
              loop
            />
            {/* Mute / unmute overlay */}
            <div
              className="absolute bottom-3 right-3 z-10"
              onClick={(e) => {
                e.stopPropagation();
                const next = !videoMuted;
                setVideoMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
            >
              <ActionIcon variant="filled" color="dark" radius="xl" size="sm" aria-label={videoMuted ? 'Unmute' : 'Mute'}>
                {videoMuted ? <IconVolumeOff size={13} /> : <IconVolume size={13} />}
              </ActionIcon>
            </div>
          </div>
        </AspectRatio>
      );
    }
    return (
      <AspectRatio ratio={4 / 5} className="post-media-frame">
        <video
          src={media.url}
          controls
          className="h-full w-full object-contain"
          preload="metadata"
          playsInline
        />
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={4 / 5} className="post-media-frame">
      <ProgressiveImage src={media.url} alt="post media" className="h-full w-full object-cover" />
    </AspectRatio>
  );
}
