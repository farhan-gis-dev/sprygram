'use client';

const readList = (key: string): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeList = (key: string, items: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(items));
};

export const SAVED_POSTS_KEY = 'sprygram.saved.posts';
export const FAVORITE_ACCOUNTS_KEY = 'sprygram.favorite.accounts';

export const hasStoredId = (key: string, id: string): boolean => readList(key).includes(id);

export const toggleStoredId = (key: string, id: string): boolean => {
  const items = readList(key);
  const exists = items.includes(id);
  const next = exists ? items.filter((item) => item !== id) : [id, ...items];
  writeList(key, next);
  return !exists;
};

export const getStoredIds = (key: string): string[] => readList(key);
