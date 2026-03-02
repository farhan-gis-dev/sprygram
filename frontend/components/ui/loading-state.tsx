'use client';

import { Text } from '@mantine/core';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <img
          src="/logo.png"
          alt="Sprygram"
          className="h-24 w-24 rounded-[28px] object-cover shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
        />
        <span className="text-2xl font-extrabold tracking-tight text-[#1a1a1a] dark:text-white">Sprygram</span>
      </div>

      {/* Progress bar loader */}
      <div className="w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800" style={{ height: 3 }}>
        <div
          className="h-full rounded-full bg-[#0095f6]"
          style={{
            animation: 'sprygram-loading-bar 1.4s ease-in-out infinite',
            width: '40%',
          }}
        />
      </div>

      {message && message !== 'Loading...' ? (
        <Text size="xs" c="dimmed" mt={16}>{message}</Text>
      ) : null}

      <style>{`
        @keyframes sprygram-loading-bar {
          0%   { transform: translateX(-150%); }
          50%  { transform: translateX(100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}