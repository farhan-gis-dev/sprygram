'use client';

import { AspectRatio } from '@mantine/core';
import { useState } from 'react';
import type { SprygramMedia } from '@/lib/api-types';

type Props = {
  media: SprygramMedia;
};

export function MediaView({ media }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);

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
    <AspectRatio ratio={1} className="post-media-frame relative overflow-hidden">
      {!imgLoaded ? (
        <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-zinc-800" />
      ) : null}
      <img
        src={media.url}
        alt="post media"
        className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setImgLoaded(true)}
      />
    </AspectRatio>
  );
}
