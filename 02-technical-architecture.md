# Technical Architecture — sprygram Module

## 1. Tech Stack

**Frontend:**

- Next.js (App Router)
- TailwindCSS
- Mantine
- React Icons
- TypeScript
- **react-oidc-context** (for reading Spry JWT/session)

**Backend:**

- spryworkspace-backend (existing workspace backend)
- Next.js API routes / Server Actions
- Prisma ORM (or workspace-supported ORM)

**Database:**

- PostgreSQL (shared workspace database)

**Media Storage:**

- sprydrive (primary)
- Cloudinary (fallback if allowed)

**Real-Time:**

- Socket.io (if permitted by workspace)

**Caching (optional):**

- Redis (if allowed)

---

## 2. Authentication Integration

- Frontend will use **react-oidc-context** to access Spry JWT/session.
- Extract `userId` from workspace context via the library.
- Validate access via backend middleware.
- Reject unauthenticated requests.
- Do NOT store passwords or implement local auth.

---

## 3. Authorization Flow

1. User logs into Spry
2. Spry issues session/token
3. sprygram frontend reads session using `react-oidc-context`
4. Backend API validates token
5. Requests proceed using authenticated `userId`

---

## 4. Application Layers

- UI Layer
- API Layer
- Database Layer
- External Media Layer (sprydrive)
- Strict separation of concerns