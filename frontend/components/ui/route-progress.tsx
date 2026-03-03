'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Thin progress bar at the top of the screen that animates during
 * client-side route navigations.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRouteRef = useRef(`${pathname}?${searchParams?.toString()}`);

  useEffect(() => {
    const current = `${pathname}?${searchParams?.toString()}`;
    if (current === prevRouteRef.current) {
      // Route finished — complete the bar
      setProgress(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return;
    }

    // Route changed — start bar
    prevRouteRef.current = current;
    setVisible(true);
    setProgress(15);

    const advance = () => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 12 + 4;
      });
    };

    const intervals = [
      setTimeout(advance, 100),
      setTimeout(advance, 300),
      setTimeout(advance, 600),
      setTimeout(advance, 1000),
    ];

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, [pathname, searchParams]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] bg-[var(--spry-accent,#0095f6)] shadow-[0_0_8px_var(--spry-accent,#0095f6)]"
      style={{ width: `${Math.min(progress, 100)}%`, transition: 'width 0.22s ease, opacity 0.3s ease' }}
    />
  );
}
