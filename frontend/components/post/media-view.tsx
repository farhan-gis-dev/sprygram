'use client';

import { AspectRatio } from '@mantine/core';
import type { SprygramMedia } from '@/lib/api-types';

type Props = {
  media: SprygramMedia;
};

export function MediaView({ media }: Props) {
  if (media.mediaType === 'video') {
    return (
      <AspectRatio ratio={1} className="post-media-frame">
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
    <AspectRatio ratio={1} className="post-media-frame">
      <img src={media.url} alt="post media" className="h-full w-full object-cover" />
    </AspectRatio>
  );
}
