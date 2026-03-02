export type RichMessageKind = 'gif' | 'sticker';

export type RichMessageLibraryItem = {
  key: string;
  label: string;
  emoji: string;
  accentFrom: string;
  accentTo: string;
};

export const GIF_LIBRARY: RichMessageLibraryItem[] = [
  { key: 'spark-burst', label: 'Spark Burst', emoji: '\u2728', accentFrom: '#0f9bff', accentTo: '#9bffb8' },
  { key: 'night-drive', label: 'Night Drive', emoji: '\u{1F680}', accentFrom: '#4338ca', accentTo: '#0ea5e9' },
  { key: 'goal-mode', label: 'Goal Mode', emoji: '\u{1F3AF}', accentFrom: '#f97316', accentTo: '#facc15' },
  { key: 'cheer-up', label: 'Cheer Up', emoji: '\u{1F389}', accentFrom: '#ef4444', accentTo: '#ec4899' },
];

export const STICKER_LIBRARY: RichMessageLibraryItem[] = [
  { key: 'spry-heart', label: 'Spry Heart', emoji: '\u2665', accentFrom: '#f43f5e', accentTo: '#fb7185' },
  { key: 'made-it', label: 'Made It', emoji: '\u{1F525}', accentFrom: '#f97316', accentTo: '#fb7185' },
  { key: 'all-good', label: 'All Good', emoji: '\u{1F44C}', accentFrom: '#0ea5e9', accentTo: '#38bdf8' },
  { key: 'locked-in', label: 'Locked In', emoji: '\u{1F512}', accentFrom: '#475569', accentTo: '#1e293b' },
];

export const encodeRichMessageToken = (kind: RichMessageKind, key: string) => `[[sprysnap:${kind}:${key}]]`;

export const parseRichMessageToken = (content: string | null | undefined): { kind: RichMessageKind; key: string } | null => {
  if (!content) return null;
  const match = content.trim().match(/^\[\[sprygram:(gif|sticker):([a-z0-9-]+)\]\]$/i);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as RichMessageKind,
    key: match[2].toLowerCase(),
  };
};

export const getRichLibraryItem = (kind: RichMessageKind, key: string): RichMessageLibraryItem | null => {
  const source = kind === 'gif' ? GIF_LIBRARY : STICKER_LIBRARY;
  return source.find((entry) => entry.key === key) || null;
};

export const summarizeRichMessageContent = (content: string | null | undefined): string | null => {
  const token = parseRichMessageToken(content);
  if (!token) return content || null;
  return token.kind === 'gif' ? 'Sent a GIF' : 'Sent a sticker';
};
