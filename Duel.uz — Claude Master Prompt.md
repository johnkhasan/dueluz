# DUEL.UZ — MASTER PRODUCT & ENGINEERING PROMPT

You are acting as a senior product manager, UX designer, software architect, security engineer, and senior full-stack developer.

We are building **Duel.uz**, a social voting platform where users compare two options and vote for their preferred choice.

Examples:

- iPhone vs Samsung
- Messi vs Ronaldo
- React vs Vue
- Coca-Cola vs Pepsi
- Nike vs Adidas
- Beach vs Mountains

The core product loop is:

Discover Duel → Vote → See Results → Share → Friend Votes → Friend Creates Duel → More Users

The product must be extremely simple, fast, mobile-first, visually polished, SEO-friendly, and highly shareable.

---

## PRIMARY OBJECTIVE

Build a production-quality MVP of Duel.uz.

The MVP must allow users to:

1. Browse duels
2. Search duels
3. Filter by category
4. Vote anonymously or as an authenticated user
5. Immediately see voting results
6. Create their own duel
7. Share a duel
8. Comment
9. Like
10. Report inappropriate content
11. Create an account
12. Manage their profile
13. Allow administrators to moderate the platform

Do not over-engineer the MVP.

The primary success metric is:

**Weekly Meaningful Voters**

Secondary metrics:

- DAU
- WAU
- MAU
- votes per user
- duel views
- vote conversion
- shares
- comments
- duel creation rate
- D1 retention
- D7 retention
- D30 retention

---

# TECH STACK

Preferred stack:

Frontend:
- Next.js
- TypeScript
- Tailwind CSS

Backend:
- NestJS
- TypeScript

Database:
- PostgreSQL
- Prisma ORM

Cache:
- Redis

Storage:
- S3-compatible object storage

Infrastructure:
- Docker
- Nginx
- GitHub Actions

The architecture must be modular and production-ready.

Use a monorepo:

apps/
  web/
  api/
  admin/

packages/
  ui/
  types/
  config/

docs/

---

# PRODUCT PRINCIPLES

1. Mobile-first
2. Extremely simple UX
3. Anonymous voting must work
4. Registration must not be required for basic voting
5. Every duel must have a unique shareable URL
6. Results must appear immediately after voting
7. Every duel must have SEO metadata
8. Every duel should generate a dynamic Open Graph image
9. User-generated content must be moderated
10. Security must be implemented from the beginning
11. Do not add unnecessary dependencies
12. Do not over-engineer
13. Prefer simple maintainable solutions
14. Do not duplicate business logic
15. Do not use `any` unless absolutely necessary

---

# MVP FEATURES

## Authentication

Implement:

- registration
- login
- logout
- current user
- profile
- secure password hashing
- session/authentication handling

Google OAuth and Telegram authentication can be considered if they materially simplify UX.

Anonymous users must still be able to vote.

---

# DUELS

A duel contains exactly two options in the MVP.

Example:

Title:

"Which phone is better?"

Option A:

"iPhone 17 Pro"

Option B:

"Samsung Galaxy S26 Ultra"

Each option may have an image.

Duel fields:

- id
- author
- category
- title
- slug
- description
- status
- visibility
- vote count
- like count
- comment count
- share count
- created_at
- updated_at
- published_at

Options:

- id
- duel_id
- name
- image_url
- vote_count
- position

---

# CATEGORIES

Initial categories:

- Technology
- Sports
- Food
- Movies
- Music
- Gaming
- Fashion
- Cars
- Travel
- Education
- Lifestyle
- Other

Administrators must be able to create/edit/delete categories.

---

# DISCOVERY

Homepage must contain:

- Trending
- New
- Popular

Implement pagination.

Prefer cursor-based pagination for feeds.

Search should search:

- duel title
- option names
- category

---

# TRENDING ALGORITHM

Do not rank only by total votes.

Use an engagement + recency model.

Consider:

- votes
- likes
- comments
- shares
- age of duel

A decay-based scoring algorithm should be used.

Example concept:

score =
engagement / pow(age + 2, decay)

However, you must evaluate and improve this formula before implementation.

Document the final formula in:

docs/TRENDING.md

---

# VOTING

Anonymous voting must be supported.

Authenticated users can vote.

A user/session should only be able to vote once per duel in the MVP.

Do not allow vote changes initially.

Vote model:

- id
- duel_id
- option_id
- user_id nullable
- anonymous_id nullable
- created_at

Protect voting against:

- bots
- spam
- repeated requests
- API abuse
- race conditions

Do not store raw IP addresses unnecessarily.

If IP-based protection is required, use privacy-conscious hashing.

Implement server-side validation.

Never trust client-side vote counts.

Voting must be transactional.

---

# RESULTS

After voting, show:

Option A percentage

Option B percentage

Total votes

Example:

iPhone — 67%

Samsung — 33%

The percentages must always be calculated from trusted server-side data.

---

# COMMENTS

Implement flat comments.

Each comment contains:

- id
- duel_id
- user_id
- content
- like_count
- created_at
- updated_at

Features:

- create
- delete own comment
- like
- report

Sanitize user-generated content.

---

# LIKES

Users can like/unlike duels.

Prevent duplicate likes.

Anonymous likes are optional for MVP.

---

# REPORTING

Users can report:

- duels
- comments

Reasons:

- Spam
- NSFW
- Hate
- Harassment
- Copyright
- Misinformation
- Other

Administrators can:

- review
- hide
- delete
- dismiss
- ban user if necessary

---

# SHARING

Every duel must have:

- copy link
- Telegram sharing
- WhatsApp sharing
- X sharing
- Web Share API on supported mobile browsers

After voting, encourage sharing.

Example UX:

"You voted for iPhone. Think your friends disagree?"

[Share Duel]

---

# OPEN GRAPH

This is a critical growth feature.

Every duel should have a dynamic OG image.

Example:

iPhone 17 Pro
VS
Samsung Galaxy S26 Ultra

DUEL.UZ

Implement dynamic OG metadata and image generation.

Make sure Telegram link previews work correctly.

---

# USER PROFILE

Profile URL:

/u/:username

Show:

- username
- avatar
- display name
- created duels
- basic voting statistics
- likes received

Do not implement followers in MVP.

---

# ADMIN DASHBOARD

Create a separate admin application.

Dashboard:

- total users
- total duels
- total votes
- total comments
- pending reports

Sections:

- Users
- Duels
- Comments
- Reports
- Categories
- Analytics

Admin actions:

- approve
- hide
- delete
- restore
- ban
- unban

Use role-based authorization.

---

# SEO

Duel pages must be server-rendered or statically optimized where appropriate.

Every duel should have:

- unique title
- meta description
- canonical URL
- Open Graph metadata
- Twitter/X metadata
- sitemap inclusion

Example title:

"iPhone 17 Pro vs Samsung Galaxy S26 Ultra — Which Is Better? | Duel.uz"

Create:

/sitemap.xml

/robots.txt

Use structured data where appropriate.

---

# UI / UX

Design language:

- modern
- playful
- minimal
- highly visual
- mobile-first

The experience should feel somewhere between:

- Product Hunt
- Reddit
- Instagram polls
- Tinder
- modern SaaS products

Do NOT copy their UI.

Create an original Duel.uz visual identity.

Core mobile navigation:

Home
Explore
Create
My Duels
Profile

Desktop navigation may use a sidebar/top navigation.

---

# DUEL CARD

Design a reusable DuelCard component.

It should show:

- category
- two options
- images
- vote result if user already voted
- vote count
- likes
- comments
- share button

Before voting:

[Option A] [Option B]

After voting:

Option A — 67%
Option B — 33%

---

# DUEL PAGE

URL:

/d/:slug

Page structure:

- breadcrumb
- category
- question/title
- two options
- voting UI
- result visualization
- total votes
- share controls
- comments
- related duels

The voting interaction must be extremely obvious.

---

# CREATE DUEL

Creation flow:

Step 1:

Question/title

Option A

Option B

Step 2:

Images

Step 3:

Category

Description

Step 4:

Preview

Step 5:

Publish

Validate everything server-side.

Validate uploaded images:

- MIME type
- file size
- dimensions
- extension

Do not trust file extensions.

---

# DATABASE

Create a normalized PostgreSQL schema.

Core entities:

User
Duel
DuelOption
Vote
Comment
CommentLike
DuelLike
Category
Report
Share
Notification

Notifications can be implemented later, but the architecture should not make future implementation difficult.

Add appropriate indexes.

Pay special attention to:

- slug
- status
- published_at
- category_id
- created_at
- duel_id
- user_id

Use foreign keys and appropriate constraints.

---

# API

REST API.

Auth:

POST /auth/register
POST /auth/login
POST /auth/logout
GET /auth/me

Duels:

GET /duels
GET /duels/trending
GET /duels/new
GET /duels/popular
GET /duels/:slug
POST /duels
PATCH /duels/:id
DELETE /duels/:id

Voting:

POST /duels/:id/vote

Comments:

GET /duels/:id/comments
POST /duels/:id/comments
DELETE /comments/:id
POST /comments/:id/like

Likes:

POST /duels/:id/like
DELETE /duels/:id/like

Reports:

POST /duels/:id/report
POST /comments/:id/report

Use consistent API response formats.

Success:

{
  "success": true,
  "data": {},
  "meta": {}
}

Error:

{
  "success": false,
  "error": {
    "code": "DUEL_NOT_FOUND",
    "message": "Duel not found"
  }
}

---

# SECURITY

Security requirements:

- rate limiting
- input validation
- XSS protection
- CSRF protection where applicable
- secure cookies
- password hashing
- authorization guards
- role-based access control
- file upload security
- API throttling
- spam protection
- vote abuse prevention
- server-side validation
- environment secrets
- no credentials committed to Git

Never trust client-provided:

- vote counts
- user IDs
- permissions
- prices
- statistics
- role information

---

# PERFORMANCE

Target:

LCP < 2.5s

CLS < 0.1

INP < 200ms

Use:

- image optimization
- lazy loading
- CDN
- caching
- Redis
- database indexes
- server rendering
- pagination
- optimistic UI where safe

Do not optimize prematurely.

Measure before introducing unnecessary complexity.

---

# ANALYTICS

Track:

- page_view
- duel_view
- vote
- duel_created
- duel_shared
- duel_liked
- comment_created
- search
- registration

Track anonymous users without violating privacy expectations.

---

# VIRAL LOOP

The product must optimize for this loop:

User opens duel

↓

Votes

↓

Sees result

↓

Sees whether they are in the majority/minority

↓

Gets prompted to share

↓

Friend opens shared link

↓

Friend votes

↓

Friend creates duel

↓

New users enter platform

Design the UX around this loop.

---

# GAMIFICATION — FUTURE

Do NOT implement in MVP, but keep the architecture extensible for:

XP
Badges
Leaderboards
Voting streaks
Creator rankings
Voting personality
Achievements

---

# FUTURE MONETIZATION

Do not prioritize monetization in MVP.

Potential future revenue:

1. Sponsored duels
2. Promoted duels
3. Business accounts
4. Affiliate links
5. Product comparison commerce
6. Premium creator features

---

# FUTURE PRODUCT DIRECTION

The long-term product should evolve from:

"Which one do you prefer?"

into:

"Help me decide."

Potential future features:

- product comparisons
- AI summaries
- community recommendations
- buying guides
- affiliate commerce
- decision analytics

But none of these belong in MVP.

---

# DEVELOPMENT PROCESS

DO NOT build the entire application in one giant step.

Work incrementally.

For every feature:

1. Analyze requirements
2. Design data model
3. Implement backend
4. Add validation
5. Add authorization
6. Add tests
7. Implement frontend
8. Add loading state
9. Add empty state
10. Add error state
11. Add responsive UI
12. Integrate
13. Run tests
14. Run lint
15. Run production build
16. Review security

---

# CODING RULES

Never:

- unnecessarily rewrite working code
- introduce dependencies without justification
- duplicate components
- duplicate business logic
- put complex business logic inside React components
- use `any` casually
- hardcode secrets
- skip validation
- trust client-side validation
- ignore TypeScript errors
- ignore lint errors
- skip tests for critical logic

Always:

- keep modules focused
- use meaningful names
- write maintainable TypeScript
- document important architectural decisions
- keep API contracts consistent
- handle errors explicitly
- write tests for critical business logic

---

# DEFINITION OF DONE

A feature is not complete until:

✓ Database implemented
✓ API implemented
✓ Validation implemented
✓ Authorization implemented
✓ Error handling implemented
✓ Loading state implemented
✓ Empty state implemented
✓ Mobile UI implemented
✓ Desktop UI implemented
✓ Tests implemented
✓ Security reviewed
✓ TypeScript passes
✓ ESLint passes
✓ Production build passes

---

# IMPORTANT

Before writing production code:

First produce:

1. Product Requirements Document
2. User stories
3. Complete user flows
4. Information architecture
5. Database ERD
6. Database schema
7. API specification
8. Frontend architecture
9. Backend architecture
10. Component architecture
11. Security architecture
12. Testing strategy
13. Deployment architecture
14. Development roadmap
15. MVP scope

Then wait for confirmation before implementing the next phase.

When implementation begins, work feature-by-feature rather than generating the entire application at once.

The final result must be production-quality, maintainable, secure, responsive, SEO-friendly, and optimized around the viral voting loop.