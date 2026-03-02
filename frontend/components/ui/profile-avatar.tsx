'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';

type RingTone = 'story' | 'viewed' | 'none';

type Props = {
  src?: string | null;
  name?: string | null;
  size?: number;
  ringTone?: RingTone;
  alt?: string;
  className?: string;
  innerClassName?: string;
};

export function ProfileAvatar({
  src,
  name,
  size = 40,
  ringTone = 'none',
  alt,
  className = '',
  innerClassName = '',
}: Props) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = src?.trim() ? src : null;
  const letter = useMemo(
    () => ((name || 'S').trim().charAt(0).toUpperCase() || 'S'),
    [name],
  );

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  const outerPadding = ringTone === 'story'
    ? Math.max(3, Math.round(size * 0.05))
    : ringTone === 'viewed'
      ? Math.max(2, Math.round(size * 0.04))
      : 0;
  const gapPadding = ringTone === 'none' ? 0 : Math.max(2, Math.round(size * 0.028));
  const ringStyle: CSSProperties = ringTone === 'story'
    ? { backgroundImage: 'var(--spry-story-ring)' }
    : ringTone === 'viewed'
      ? { backgroundColor: '#cfd5db' }
      : {};

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${className}`.trim()}
      style={{ width: size, height: size, padding: outerPadding, ...ringStyle }}
    >
      <div
        className={`h-full w-full rounded-full ${ringTone === 'none' ? '' : 'bg-white'}`}
        style={{ padding: gapPadding }}
      >
        <div
          className={`overflow-hidden rounded-full border border-[#dde2e8] bg-[#eef1f4] text-[#6b7280] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.78)] ${innerClassName}`.trim()}
          style={{ width: '100%', height: '100%' }}
        >
          {!normalizedSrc || failed ? (
            <div
              className="flex h-full w-full items-center justify-center font-semibold"
              style={{ fontSize: Math.max(12, Math.round((size - ((outerPadding + gapPadding) * 2)) * 0.42)) }}
            >
              {letter}
            </div>
          ) : (
            <img
              src={normalizedSrc}
              alt={alt || name || 'Profile photo'}
              className="h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
