# sprygram — Instagram Replica Module in Spry Workspace

## 1. Overview
This project is a full-feature Instagram-like social media module called *sprygram, built inside the **Spry Workspace* ecosystem.  
The module will *use Spry authentication* — no login or signup system is required.  
Users logged into Spry can access sprygram automatically.

## 2. Scope
sprygram will provide:

- Content sharing (images & videos)
- Follow system
- Likes & comments
- Stories & reels
- Direct messaging
- Notifications
- Explore & search

*Note:* Authentication, session management, and deployment are handled by *spryworkspace-backend*.

## 3. Integration Requirements

- Must consume Spry user session (JWT / session cookie)
- Must use Spry user ID as primary identity reference
- Must not store passwords
- Must respect workspace-level permissions

## 4. Non-Functional Requirements

- High performance feed rendering
- Optimized media loading via *sprydrive*
- Clean modular code
- Secure API authorization
- Horizontal scalability readiness