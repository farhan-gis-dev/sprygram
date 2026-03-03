export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

export type AuthLoginResponse = {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    displayName?: string | null;
    lastActiveWorkspaceId?: string | null;
  };
  accessToken: string;
};

export type FollowStatus = 'none' | 'pending' | 'accepted';

export type ProfileStats = {
  posts: number;
  followers: number;
  following: number;
  totalLikesReceived: number;
};

export type SprygramProfile = {
  id: string;
  userId: string;
  workspaceId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  isPrivate: boolean;
  avatarDriveFileId: string | null;
  avatarUrl: string | null;
  stats: ProfileStats;
  followStatus: FollowStatus;
  canViewPosts: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SprygramMedia = {
  id: string;
  driveFileId: string;
  mediaType: 'image' | 'video';
  sortOrder: number;
  url: string;
};

export type SprygramPost = {
  id: string;
  authorId: string;
  caption: string | null;
  location: string | null;
  likeCount: number;
  commentCount: number;
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isPrivate: boolean;
    followStatus: FollowStatus;
  };
  media: SprygramMedia[];
  isLiked: boolean;
};

// Backwards-compat aliases used in some pages
export type SprySnapPost = SprygramPost;
export type SprySnapProfile = SprygramProfile;

export type FeedResponse = {
  items: SprygramPost[];
  nextCursor: string | null;
};

export type ProfilePostsResponse = {
  profile: SprygramProfile;
  items: SprygramPost[];
  nextCursor: string | null;
};

export type UploadMediaItem = {
  driveFileId: string;
  filename: string;
  size: number;
  mimeType: string;
  mediaType: 'image' | 'video';
  streamUrl: string;
};

export type UploadMediaResponse = {
  items: UploadMediaItem[];
};

export type MessageAttachmentUploadItem = {
  driveFileId: string;
  filename: string;
  size: number;
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio';
  streamUrl: string;
};

export type MessageAttachmentUploadResponse = {
  items: MessageAttachmentUploadItem[];
};

export type Comment = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export type CommentsResponse = {
  items: Comment[];
  nextCursor: string | null;
};

export type FollowRequestItem = {
  id: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  follower: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export type FollowRequestsResponse = {
  items: FollowRequestItem[];
};

export type SearchAccountResult = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isPrivate: boolean;
  followStatus: FollowStatus;
  stats: {
    posts: number;
    followers: number;
  };
};

export type SearchAccountsResponse = {
  items: SearchAccountResult[];
};

export type Conversation = {
  threadId: string;
  peer: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    followStatus: FollowStatus;
  };
  lastMessage: {
    id: string;
    content: string | null;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
};

export type ConversationsResponse = {
  items: Conversation[];
};

export type DirectMessage = {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  content: string | null;
  mediaDriveFileId: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  storyId: string | null;
  createdAt: string;
  readAt: string | null;
  mine: boolean;
};

export type ThreadMessagesResponse = {
  threadId: string | null;
  peerUserId: string;
  items: DirectMessage[];
  nextCursor: string | null;
};

export type MessageUnreadCount = {
  unreadCount: number;
};

export type StoryItem = {
  id: string;
  authorId: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  caption: string | null;
  isHighlight: boolean;
  highlightLabel: string | null;
  expiresAt: string;
  createdAt: string;
  viewed: boolean;
  viewCount: number;
};

export type StoryTrayItem = {
  author: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  latestStoryAt: string;
  unviewedCount: number;
  totalCount: number;
  stories: StoryItem[];
};

export type StoryTrayResponse = {
  items: StoryTrayItem[];
};

export type UserStoriesResponse = {
  profile: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  items: StoryItem[];
};

export type ReelItem = {
  id: string;
  createdAt: string;
  post: SprygramPost;
};

export type ReelsResponse = {
  items: ReelItem[];
  nextCursor: string | null;
};

export type NotificationItem = {
  id: string;
  type: 'follow' | 'follow_accept' | 'like' | 'comment' | 'direct_message' | 'story_reply';
  entityType: string;
  entityId: string;
  previewText: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  nextCursor: string | null;
};

export type ActivityItem = {
  id: string;
  tab: 'likes' | 'comments' | 'story_replies' | 'reviews';
  createdAt: string;
  payload: Record<string, unknown>;
};

export type ActivityResponse = {
  tab: 'likes' | 'comments' | 'story_replies' | 'reviews';
  items: ActivityItem[];
  nextCursor: string | null;
};

export type LiveRoomView = {
  id: string;
  workspaceId: string;
  hostUserId: string;
  hostUsername: string;
  hostAvatarUrl: string | null;
  title: string;
  status: 'live' | 'ended';
  viewerCount: number;
  startedAt: string;
};
