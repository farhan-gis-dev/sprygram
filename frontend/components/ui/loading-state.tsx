"use client";

import Image from "next/image";

export function LoadingState({
  message = "Loading...",
  fullScreen = false,
}: {
  message?: string;
  fullScreen?: boolean;
}) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-5">
          <Image src="/logo.png" alt="Sprygram" width={64} height={64} priority className="rounded-2xl shadow-lg" />
          <div className="flex flex-col items-center gap-3">
            <div className="h-1 w-44 overflow-hidden rounded-full bg-border">
              <div
                className="h-full w-2/5 rounded-full bg-[var(--spry-accent)] origin-left animate-[loading-progress_1.6s_ease-in-out_infinite]"
              />
            </div>
            {message !== "Loading..." ? (
              <p className="text-xs text-muted">{message}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3">
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--spry-accent)]" />
      </div>
      {message !== "Loading..." ? (
        <p className="text-sm text-muted">{message}</p>
      ) : null}
    </div>
  );
}
