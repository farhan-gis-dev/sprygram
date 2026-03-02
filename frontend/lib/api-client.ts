import type {
  ActivityResponse,
  AuthLoginResponse,
  ApiEnvelope,
  CommentsResponse,
  ConversationsResponse,
  DirectMessage,
  FeedResponse,
  FollowRequestsResponse,
  FollowStatus,
  MessageAttachmentUploadResponse,
  MessageUnreadCount,
  NotificationsResponse,
  ProfilePostsResponse,
  ReelsResponse,
  SearchAccountsResponse,
  SprygramPost,
  SprygramProfile,
  StoryItem,
  StoryTrayResponse,
  ThreadMessagesResponse,
  UploadMediaResponse,
  UserStoriesResponse,
} from './api-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const AUTH_MODE = (process.env.NEXT_PUBLIC_AUTH_MODE || 'dev').trim().toLowerCase();

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export type ApiAuth = {
  token?: string;
  workspaceId?: string;
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
  auth?: ApiAuth,
): Promise<T> => {
  const headers = new Headers(options.headers || {});
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isForm && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (auth?.token) {
    headers.set('Authorization', `Bearer ${auth.token}`);
  }

  if (auth?.workspaceId) {
    headers.set('x-workspace-id', auth.workspaceId);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && AUTH_MODE !== 'oidc') {
      document.cookie = 'access-token=; Max-Age=0; path=/; SameSite=Lax';
      window.dispatchEvent(new Event('sprysnap:auth-invalid'));
    }

    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error?: string }).error || 'Request failed')
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  if (typeof payload === 'object' && payload !== null && 'success' in payload) {
    const envelope = payload as ApiEnvelope<T>;
    if ('data' in envelope) {
      return envelope.data;
    }
    return payload as T;
  }

  return payload as T;
};

export const sprygramApi = {
  loginWithPassword: (email: string, password: string) =>
    request<AuthLoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMyProfile: (auth?: ApiAuth) => request<SprygramProfile>('/api/sprygram/profile/me', {}, auth),

  updateMyProfile: (
    body: {
      username?: string;
      displayName?: string;
      bio?: string;
      isPrivate?: boolean;
    },
    auth?: ApiAuth,
  ) => request<SprygramProfile>('/api/sprygram/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, auth),

  uploadAvatar: (file: File, auth?: ApiAuth) => {
    const form = new FormData();
    form.append('avatar', file);
    return request<{ profile: SprygramProfile }>('/api/sprygram/profile/me/avatar', {
      method: 'POST',
      body: form,
    }, auth);
  },

  getProfileByUsername: (username: string, auth?: ApiAuth) =>
    request<SprygramProfile>(`/api/sprygram/profiles/${encodeURIComponent(username)}`, {}, auth),

  getProfilePosts: (
    username: string,
    params: { limit?: number; cursor?: string | null } = {},
    auth?: ApiAuth,
  ) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);

    return request<ProfilePostsResponse>(
      `/api/sprygram/profiles/${encodeURIComponent(username)}/posts${query.toString() ? `?${query.toString()}` : ''}`,
      {},
      auth,
    );
  },

  getFeed: (params: { limit?: number; cursor?: string | null } = {}, auth?: ApiAuth) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    return request<FeedResponse>(`/api/sprygram/feed${query.toString() ? `?${query.toString()}` : ''}`, {}, auth);
  },

  uploadMedia: (files: File[], auth?: ApiAuth) => {
    const form = new FormData();
    files.forEach((file) => form.append('media', file));
    return request<UploadMediaResponse>('/api/sprygram/media/upload', {
      method: 'POST',
      body: form,
    }, auth);
  },

  uploadMessageAttachments: (files: File[], auth?: ApiAuth) => {
    const form = new FormData();
    files.forEach((file) => form.append('media', file));
    return request<MessageAttachmentUploadResponse>('/api/sprygram/messages/attachments', {
      method: 'POST',
      body: form,
    }, auth);
  },

  createPost: (
    body: { caption?: string; location?: string; mediaFileIds: string[] },
    auth?: ApiAuth,
  ) => request<SprygramPost>('/api/sprygram/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  }, auth),

  getPost: (postId: string, auth?: ApiAuth) =>
    request<SprygramPost>(`/api/sprygram/posts/${postId}`, {}, auth),

  deletePost: (postId: string, auth?: ApiAuth) =>
    request<{ id: string; trashedMedia: string[] }>(`/api/sprygram/posts/${postId}`, {
      method: 'DELETE',
    }, auth),

  likePost: (postId: string, auth?: ApiAuth) =>
    request<{ liked: boolean; likeCount: number }>(`/api/sprygram/posts/${postId}/likes`, {
      method: 'POST',
    }, auth),

  unlikePost: (postId: string, auth?: ApiAuth) =>
    request<{ liked: boolean; likeCount: number }>(`/api/sprygram/posts/${postId}/likes`, {
      method: 'DELETE',
    }, auth),

  getComments: (
    postId: string,
    params: { limit?: number; cursor?: string | null } = {},
    auth?: ApiAuth,
  ) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);

    return request<CommentsResponse>(`/api/sprygram/posts/${postId}/comments${query.toString() ? `?${query.toString()}` : ''}`, {}, auth);
  },

  addComment: (
    postId: string,
    body: { content: string; parentCommentId?: string },
    auth?: ApiAuth,
  ) => request(`/api/sprygram/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, auth),

  deleteComment: (commentId: string, auth?: ApiAuth) =>
    request<{ deleted: boolean }>(`/api/sprygram/posts/comments/${commentId}`, {
      method: 'DELETE',
    }, auth),

  followUser: (userId: string, auth?: ApiAuth) =>
    request<{ followId: string; status: Exclude<FollowStatus, 'none'> }>(`/api/sprygram/users/${userId}/follow`, {
      method: 'POST',
    }, auth),

  unfollowUser: (userId: string, auth?: ApiAuth) =>
    request<{ removed: boolean }>(`/api/sprygram/users/${userId}/follow`, {
      method: 'DELETE',
    }, auth),

  getFollowStatus: (userId: string, auth?: ApiAuth) =>
    request<{ status: FollowStatus }>(`/api/sprygram/users/${userId}/follow-status`, {}, auth),

  getIncomingFollowRequests: (limit = 20, auth?: ApiAuth) =>
    request<FollowRequestsResponse>(`/api/sprygram/follow-requests/incoming?limit=${limit}`, {}, auth),

  approveFollowRequest: (followId: string, auth?: ApiAuth) =>
    request<{ id: string; status: 'accepted' }>(`/api/sprygram/follow-requests/${followId}/approve`, {
      method: 'POST',
    }, auth),

  rejectFollowRequest: (followId: string, auth?: ApiAuth) =>
    request<{ removed: boolean }>(`/api/sprygram/follow-requests/${followId}/reject`, {
      method: 'POST',
    }, auth),

  searchAccounts: (q: string, limit = 20, auth?: ApiAuth) => {
    const query = new URLSearchParams();
    if (q.trim()) query.set('q', q.trim());
    if (limit) query.set('limit', String(limit));
    return request<SearchAccountsResponse>(`/api/sprygram/search/accounts?${query.toString()}`, {}, auth);
  },

  getConversations: (limit = 20, auth?: ApiAuth) => {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    return request<ConversationsResponse>(`/api/sprygram/messages/conversations?${query.toString()}`, {}, auth);
  },

  getThreadMessages: (
    peerUserId: string,
    params: { limit?: number; cursor?: string | null } = {},
    auth?: ApiAuth,
  ) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    return request<ThreadMessagesResponse>(
      `/api/sprygram/messages/thread/${encodeURIComponent(peerUserId)}${query.toString() ? `?${query.toString()}` : ''}`,
      {},
      auth,
    );
  },

  sendMessage: (
    body: {
      receiverId: string;
      content?: string;
      mediaDriveFileId?: string;
      storyId?: string;
    },
    auth?: ApiAuth,
  ) => request<DirectMessage>('/api/sprygram/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  }, auth),

  markThreadRead: (peerUserId: string, auth?: ApiAuth) =>
    request<{ updatedCount: number }>(`/api/sprygram/messages/thread/${encodeURIComponent(peerUserId)}/read`, {
      method: 'PATCH',
    }, auth),

  getUnreadMessageCount: (auth?: ApiAuth) =>
    request<MessageUnreadCount>('/api/sprygram/messages/unread-count', {}, auth),

  createStory: (
    body: {
      driveFileId: string;
      caption?: string;
      isHighlight?: boolean;
      highlightLabel?: string;
      expiresAt?: string;
    },
    auth?: ApiAuth,
  ) => request<StoryItem>('/api/sprygram/stories', {
    method: 'POST',
    body: JSON.stringify(body),
  }, auth),

  getStoryTray: (limit = 20, auth?: ApiAuth) =>
    request<StoryTrayResponse>(`/api/sprygram/stories/tray?limit=${limit}`, {}, auth),

  getStoriesByUsername: (username: string, auth?: ApiAuth) =>
    request<UserStoriesResponse>(`/api/sprygram/stories/users/${encodeURIComponent(username)}`, {}, auth),

  markStoryViewed: (storyId: string, auth?: ApiAuth) =>
    request<{ viewed: boolean }>(`/api/sprygram/stories/${storyId}/view`, {
      method: 'POST',
    }, auth),

  replyToStory: (
    storyId: string,
    body: { content?: string; mediaDriveFileId?: string },
    auth?: ApiAuth,
  ) => request<DirectMessage>(`/api/sprygram/stories/${storyId}/reply`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, auth),

  deleteStory: (storyId: string, auth?: ApiAuth) =>
    request<{ deleted: boolean }>(`/api/sprygram/stories/${storyId}`, {
      method: 'DELETE',
    }, auth),

  createReel: (postId: string, auth?: ApiAuth) =>
    request<{ id: string; createdAt: string; post: SprygramPost }>('/api/sprygram/reels', {
      method: 'POST',
      body: JSON.stringify({ postId }),
    }, auth),

  getReels: (params: { limit?: number; cursor?: string | null } = {}, auth?: ApiAuth) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    return request<ReelsResponse>(`/api/sprygram/reels${query.toString() ? `?${query.toString()}` : ''}`, {}, auth);
  },

  getReel: (reelId: string, auth?: ApiAuth) =>
    request<{ id: string; createdAt: string; post: SprygramPost }>(`/api/sprygram/reels/${reelId}`, {}, auth),

  deleteReel: (reelId: string, auth?: ApiAuth) =>
    request<{ deleted: boolean }>(`/api/sprygram/reels/${reelId}`, {
      method: 'DELETE',
    }, auth),

  getNotifications: (params: { limit?: number; cursor?: string | null } = {}, auth?: ApiAuth) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    return request<NotificationsResponse>(
      `/api/sprygram/notifications${query.toString() ? `?${query.toString()}` : ''}`,
      {},
      auth,
    );
  },

  markNotificationsReadAll: (auth?: ApiAuth) =>
    request<{ updatedCount: number }>('/api/sprygram/notifications/read-all', {
      method: 'PATCH',
    }, auth),

  getActivity: (
    tab: 'likes' | 'comments' | 'story_replies' | 'reviews',
    params: { limit?: number; cursor?: string | null } = {},
    auth?: ApiAuth,
  ) => {
    const query = new URLSearchParams();
    query.set('tab', tab);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    return request<ActivityResponse>(`/api/sprygram/activity?${query.toString()}`, {}, auth);
  },
};
