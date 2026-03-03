'use client';

import { Text } from '@mantine/core';

/**
 * SpryAds placeholder card — renders an ad slot in feed/reels.
 *
 * This is the base integration point.  When SpryAds is ready, replace
 * the static placeholder with a server-side or client-side ad unit from
 * the SpryAds delivery API.
 *
 * Ad format follows Instagram's pattern:
 * - Looks like a regular post card (same width/radius)
 * - Small "Sponsored" label in place of timestamp
 * - Optional "Learn More" CTA button
 */

type AdSlot = {
  id: string;
  imageUrl: string;
  headline: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  advertiserName: string;
  advertiserAvatarUrl?: string;
};

// Placeholder ad data until SpryAds API is wired up
const PLACEHOLDER_ADS: AdSlot[] = [
  {
    id: 'ad-placeholder-1',
    imageUrl: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=640&h=640&fit=crop',
    headline: 'Grow your audience with SpryAds',
    body: 'Reach millions of Sprygram users. Start your campaign today.',
    ctaLabel: 'Learn More',
    ctaUrl: '#',
    advertiserName: 'SpryAds',
  },
  {
    id: 'ad-placeholder-2',
    imageUrl: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=640&h=640&fit=crop',
    headline: 'Advertise smarter',
    body: 'Targeted, performance-based advertising for modern brands.',
    ctaLabel: 'Get Started',
    ctaUrl: '#',
    advertiserName: 'SpryAds',
  },
];

let adIndex = 0;

export function AdCard() {
  const ad = PLACEHOLDER_ADS[adIndex % PLACEHOLDER_ADS.length];
  adIndex = (adIndex + 1) % PLACEHOLDER_ADS.length;

  return (
    <div className="w-full overflow-hidden rounded-[24px] border border-border bg-panel shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 overflow-hidden rounded-full bg-gray-200">
          {ad.advertiserAvatarUrl ? (
            <img src={ad.advertiserAvatarUrl} alt={ad.advertiserName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-xs font-bold text-white">
              {ad.advertiserName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1">
          <Text size="sm" fw={700}>{ad.advertiserName}</Text>
          <Text size="xs" c="dimmed">Sponsored</Text>
        </div>
        <button
          type="button"
          className="rounded-full p-1 text-xs text-muted hover:bg-hover"
          title="Why am I seeing this ad?"
          aria-label="Ad info"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>

      {/* Ad image */}
      <div className="aspect-square w-full overflow-hidden">
        <img
          src={ad.imageUrl}
          alt={ad.headline}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3">
        <Text size="sm" fw={700}>{ad.headline}</Text>
        {ad.body ? <Text size="sm" c="dimmed" mt={2}>{ad.body}</Text> : null}
        {ad.ctaUrl && ad.ctaLabel ? (
          <a
            href={ad.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg bg-[var(--spry-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {ad.ctaLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** How many real posts appear between each ad (Instagram uses ~5). */
export const AD_INJECTION_INTERVAL = 5;
