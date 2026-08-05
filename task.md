# Checklists - Advanced Mod, Support, Trash & Stealth Presence

## Phase 1: Database & Schema Extensions
- [x] Create `Announcement` model schema
- [x] Create `PinnedMessage` model schema
- [x] Create `SupportMessage` model schema
- [x] Create `AdminNotification` model schema
- [x] Create `AdminSession` model schema
- [x] Update `User` model schema with warnings, notes, shadow-ban, browser, ip, ban fields
- [x] Update `LiveChatMessage`, `Confession`, `Meme`, `Poll` schemas with trash status fields
- [x] Update `LiveChatMessage` schema with replyTo reference and messageType field

## Phase 2: Middleware & Authentication Integration
- [x] Update `parseUser` in `auth.js` to handle admin session, map it to `Professor (ADMIN)` User document, and restrict banned users access except for auth/me & support routes.
- [x] Implement backend protection checks to block spoofing of `Professor (ADMIN)` and verify roles.
- [x] Configure robust cookie settings (`sameSite: 'lax'`, `secure` in production, `httpOnly`).
- [x] Verify backend compares the correct CSRF token and provides precise error messages.

## Phase 3: REST API Implementation
- [x] Create `server/src/routes/support.js` containing banned support chat endpoints
- [x] Create public settings endpoint `GET /api/settings`, `GET /api/announcements`, `GET /api/chat/pinned`
- [x] Update `admin.js` to implement warnings management, admin notes editor, settings customizer, trash bin restorer/purger, support replies, chat pinning, session login history logs, and paginated official notice history.

## Phase 4: Sockets & Real-Time Setup
- [x] Update `server.js` Socket.IO logic to manage typing, seen, messages inside `support-${token}` room.
- [x] Integrate user-typing, user-warned, announcement updates, and stealth mode online count sync inside server socket event loop.
- [x] Implement daily soft-delete cleanup schedule intervals.
- [x] Set shadow-ban emit boundaries to prevent message leakage.

## Phase 5: Client-Side UI Redesigns
- [x] Create `BannedPage.jsx` overlay page featuring bidirectional support messenger
- [x] Update `App.jsx` to render `BannedPage` and load dynamic site name/logo/theme variables
- [x] Update `ChatBox.jsx` with chat replies previews, admin style highlighting, typing indicators, pinned panels, and Professor presence indicators
- [x] Update `AdminPanel.jsx` to add Support Inbox messenger tab, Announcements & Notice History tab, Settings editor tab, Trash Bin tab, and Login History logs tab.
- [x] Implement DiceBear avatar fallback mappings inside general card, avatar, and comment elements.
- [x] Scale up font sizes globally in `index.css` by 10-15%.
- [x] Integrate reusable `adminFetch` helper in `UserContext` to automate CSRF tokens and cross-origin `credentials: 'include'` headers.
- [x] Intercept session expiration errors and redirect admin back to login with indicator warning toast.
- [x] Import localized `professor-avatar.png` asset to override DiceBear generators for authenticated admin accounts.
- [x] Style admin avatar to 40x40px inside global lounge chat messages and 48x48px inside left sidebar drawer profile widgets.

## Phase 6: Build & Final Verification
- [x] Install npm dependencies
- [x] Build production assets with Vite
- [x] Configure DNS resolvers override inside backend to solve MongoDB querySrv SRV lookup issues.
- [x] Setup 5x reconnect retry logic with backoff for primary database cluster.
- [x] Bind HTTP server listen *after* database connections resolve to prevent buffering timeout crashes on startup.
- [x] Run application dev servers and perform manual/automated testing passes
- [x] Disable file system writes inside logger (`logger.js`) when deploying to serverless Vercel environments.
- [x] Bypass local uploads folder creation on server boot (`server.js`) if running on Vercel.
- [x] Disable local backups folder creation on cron trigger (`backup.js`) if running on Vercel.
- [x] Add default and named ESM exports for Express `app` and `server` at the bottom of `server.js`.
- [x] Configure Socket.IO server target endpoint dynamically using `import.meta.env.VITE_API_URL` fallback to localhost.
- [x] Create `client/.env.example` defining default VITE_API_URL settings for production Vercel servers.
- [x] Configure reusable API_BASE constant matching VITE_API_URL environment variables.
- [x] Prepend API_BASE to every `fetch('/api/...')` call inside the client codebase.
- [x] Enable cross-origin credentials inclusions on frontend user identity checks (`/api/auth/me`).
