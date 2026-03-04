# Feature Specification — sprygram

## 1. User Profiles

- Profile picture
- Bio
- Followers / Following
- Public/private toggle
- Profile editing (excluding auth fields)
- Grid view of posts
- All authenticated actions use `react-oidc-context` to get user info

## 2. Posts

- Upload image/video to **sprydrive**
- Caption
- Location
- User tagging
- Like / Comment / Save
- Delete own post
- Share link
- Frontend must read `userId` via `react-oidc-context` for post ownership and actions

## 3. Follow System

- Follow / Unfollow
- Follow request for private accounts
- Followers list / Following list
- Use `react-oidc-context` for authenticated actions

## 4. Stories

- 24-hour expiry
- Viewer tracking
- Story highlights
- Stored in sprydrive

## 5. Reels

- Vertical video feed
- Like / Comment / Share
- Infinite scroll
- Stored in sprydrive

## 6. Messaging

- 1-to-1 conversations
- Real-time delivery
- Seen indicator
- Image sharing (sprydrive)
- Authenticated sender/receiver determined via `react-oidc-context`

## 7. Notifications

- Like
- Comment
- Follow
- Message
- Follow request

## 8. Explore & Search

- User search
- Hashtag search
- Trending content
- Suggested users