# Task List - User Registration, Recovery, Profiles, Excel Export, and Admin Improvements

## Phase 1: Database & Model Extensions
- [x] Update `User` model (`User.js`):
  - Add `realName` (String)
  - Add `passwordHash` (String, bcrypt)
  - Add `isRegistered` (Boolean, default false)
  - Add `registrationDate` (Date)
  - Add `lastLogin` (Date)
  - Add `mustChangePassword` (Boolean, default false)
- [x] Create `PasswordResetRequest` model (`PasswordResetRequest.js`):
  - `username` (String)
  - `realName` (String)
  - `campus` (String)
  - `reason` (String)
  - `status` (String: 'pending', 'completed', 'rejected')
  - `createdAt` (Date)

## Phase 2: Backend Routes & Middleware
- [x] Add `xlsx` dependency to `server/package.json`.
- [x] Create authentication and registration endpoints in `auth.js` / new auth routes:
  - `POST /api/auth/register` (Hash password, update current/anonymous user record to registered)
  - `POST /api/auth/login` (Verify password hash, return token)
  - `POST /api/auth/change-password` (Update password, clear `mustChangePassword` flag)
  - `POST /api/auth/reset-request` (Submit PasswordResetRequest)
  - `POST /api/auth/update-profile` (Edit Anonymous Username, Password)
- [x] Add admin moderation and recovery endpoints in `admin.js`:
  - `GET /api/admin/registered-users` (Paginated list of registered users with search/filter/sort)
  - `GET /api/admin/registered-users/:id/details` (Get user stats: warnings count, messages count, confessions count, memes count, polls count)
  - `GET /api/admin/export-users` (Excel sheet download of all registered users and stats)
  - `DELETE /api/admin/registered-users/:id` (Delete account, anonymize previous public contents, keep log)
  - `GET /api/admin/reset-requests` (Get reset requests queue)
  - `POST /api/admin/reset-requests/:id/action` (Generate temporary password, update hash, mark completed, send Support chat message)
- [x] Update `parseUser` middleware (`auth.js`):
  - Recognize registered users, enforce ban system restrictions (cannot chat, confess, meme, vote).
  - Enforce `mustChangePassword` blocks (only allow change-password API/screen, block normal actions).

## Phase 3: Client Authentication & Routing Contexts
- [x] Create registration / login overlay pages & modal components (`LoginModal.jsx`):
  - Tabbed interface for Login, Register, Forgot Password.
  - Intercept chat sending, support messages, appeals to trigger modal for unregistered users.
  - Auto-send originally typed message after login/registration.
- [x] Create Profile management modal (`ProfileModal.jsx`) for editing username and password.
- [x] Create forced password change screen (`ForceChangePassword.jsx`) when `mustChangePassword` is active.
- [x] Update `UserContext.jsx`:
  - Expose `register`, `login`, `logout`, `changePassword`, `updateProfile` handlers.
  - Keep `user` context state populated with registration properties.

## Phase 4: Admin Panel Tab Extensions
- [x] Create **Registered Users** tab in `AdminPanel.jsx`:
  - Grid list showing Real Name, Campus, Anonymous Username, Registration Date, Last Login, Last Seen, Ban Status.
  - Search, filter (by campus and ban status), sorting, and Excel download button.
  - Clicking user opens **User Details** modal displaying stats (warning count, messages, confessions, memes, polls) with Reset Password, Ban, Unban, Delete Account triggers.
- [x] Create **Password Reset Requests** tab in `AdminPanel.jsx`:
  - Table of requests with action triggers (Generate Temp Password & Send, Reject).
- [x] Optimize Support & Appeal Chat UI in `BannedPage.jsx` and `AdminPanel.jsx`:
  - White background + black text for incoming messages.
  - Light purple background + black text for outgoing messages.
  - Grey timestamps.
- [x] Polish Admin Panel typography, spacing, contrast, message alignments, and unread conversation highlight.

## Phase 5: Testing & Verification
- [x] Install node dependencies (`xlsx` package in server).
- [x] Run production asset builds (`npm run build`).
- [x] Manually test registration, login, profile updates, password requests, force password screen, Excel download, and banned user restrictions.
