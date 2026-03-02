export const formatRelativeTime = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';

  const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
  if (seconds < 60) return '1m';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${years}y`;
};

export const formatRelativeTimeWithSuffix = (isoDate: string): string => {
  const short = formatRelativeTime(isoDate);
  return short ? `${short} ago` : '';
};
