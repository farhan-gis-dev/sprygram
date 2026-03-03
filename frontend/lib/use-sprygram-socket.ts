'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type SprygramMessageEvent = {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  content: string | null;
  mediaDriveFileId: string | null;
  storyId: string | null;
  createdAt: string;
  mine: boolean;
  [key: string]: unknown;
};

export type SprygramTypingEvent = {
  senderId: string;
  receiverId: string;
};

export type SprygramReadEvent = {
  senderId: string;
  receiverId: string;
  readAt: string;
};

type Options = {
  token: string | null | undefined;
  workspaceId: string | null | undefined;
  onMessage: (msg: SprygramMessageEvent) => void;
  onTyping?: (event: SprygramTypingEvent) => void;
  onRead?: (event: SprygramReadEvent) => void;
};

/**
 * Connects to the backend socket.io server and listens for real-time
 * sprygram:message and sprygram:typing events.
 * Exposes the socket ref so callers can emit events (e.g. typing indicators).
 * Cleans up on unmount / token change.
 */
export function useSprygramSocket({ token, workspaceId, onMessage, onTyping, onRead }: Options): RefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null);
  // Keep stable refs to callbacks so we don't need to re-subscribe
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;
  const typingRef = useRef(onTyping);
  typingRef.current = onTyping;
  const readRef = useRef(onRead);
  readRef.current = onRead;

  useEffect(() => {
    if (!token || !workspaceId) return;

    const socket = io(SOCKET_URL, {
      auth: { token, workspaceId },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('sprygram:message', (msg: SprygramMessageEvent) => {
      callbackRef.current(msg);
    });

    socket.on('sprygram:typing', (event: SprygramTypingEvent) => {
      typingRef.current?.(event);
    });

    socket.on('sprygram:read', (event: SprygramReadEvent) => {
      readRef.current?.(event);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, workspaceId]);

  return socketRef;
}
