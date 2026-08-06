# Walkthrough - User Registration, Persistent Login, Profiles, Excel Export, and Password Recovery Systems

This document summarizes the changes made to add full user registration, persistent login sessions, profile dashboards, password recovery queues, Excel exports, and admin moderation upgrades.

## Changes Made

### 1. Database Extensions
* **`User.js`**: Updated the visitor schema with attributes: `realName`, `passwordHash`, `isRegistered` (boolean), `registrationDate`, `lastLogin`, and `mustChangePassword` (boolean).
* **`PasswordResetRequest.js`**: Added a new collection model to register reset request tickets including `username` (Anonymous Username), `realName`, `campus`, `reason`, `status`, and timestamps.

### 2. Backend API Handlers
* **`routes/auth.js`**: Exposed endpoints for user registration (`/register`), account login (`/login`), forced password update (`/change-password`), profile settings modifications (`/update-profile`), and forgot password tickets (`/reset-request`).
  * Updated `/reset-request` to query registered users, automatically insert the system message into the user's Support Message history, trigger real-time Socket.IO broadcasts to the admin, and return the user's `browserToken` to the client.
* **`routes/admin.js`**: Added administrative endpoints to get registered users directory (`/registered-users`), get user detailed counts and statistics (`/registered-users/:id/details`), download Excel reports (`/export-users`), trigger direct password resets (`/reset-requests/direct-reset`), retrieve reset requests (`/reset-requests`), and execute actions (`/reset-requests/:id/action`).
  * Integrated automated password hashing and lockout flags inside the `/support/reply` endpoint if the admin sends exactly 8 alphanumeric characters or sets `isTempPassword`.

### 3. Middleware & Security Enforcements
* **`middleware/auth.js`**: Updated `parseUser` and `requireAuth` to support forced password change redirects (blocking all actions except profile change password APIs) and block banned users from chat, confessions, memes, and voting.
* **`server.js`**: Added a socket message interceptor to reject messages from users marked with `mustChangePassword: true` or `isBanned: true`. Also corrected the `support-typing` and `support-seen` logic to properly evaluate the admin's role, and enabled standard users to join their respective `support-${token}` rooms on socket connection.

### 4. Client Pages & Authentication Contexts
* **`context/UserContext.jsx`**: Exposed session handlers (`register`, `login`, `logout`, `changePassword`, `updateProfile`) and added global triggers (`showLoginModal`, `openLoginModal`, `onLoginSuccess`) to support inline login interceptions.
* **`components/LoginModal.jsx`**: Implemented a responsive user registration, login, and forgot password overlay. Automatically stores recovered user tokens on forgot password success and dispatches an event to redirect to support desk.
* **`components/ProfileModal.jsx`**: Added a profile drawer allowing registered users to edit their anonymous username and password while showing their locked registration date, along with a "Contact Professor" support shortcut.
* **`components/SupportChat.jsx`**: Created a client-side support messenger tab for normal users, enabling secure real-time message exchange with the Professor, image file appeals, and unread receipt updates.
* **`components/ForceChangePassword.jsx`**: Implemented a full-screen block requiring users logged in via temporary credentials to change their passwords.

### 5. Admin Panel Enhancements
* **`components/AdminPanel.jsx`**:
  * Created **Registered Users** tab showing registered users directory with search, campus filter, status filters, column sorts, and an **Export Excel** button.
  * Clicking a user card opens **User Details** displaying message, confessions, memes, and polls counts with Ban/Unban, Reset Password, and Delete Account triggers.
  * Added **Password Reset Requests** queue with Approve & Send (auto-messaging credentials via support appeals chat) and Reject options.
  * Improved Appeal and Support thread chat bubble layouts (White background for incoming, light purple background for outgoing, grey timestamps) and selected thread selection highlights.
  * Added a **Generate Temporary Password** quick action button to auto-populate secure credentials.
  * Enhanced the **Support Inbox** to display the user's username, real name, campus, online indicator dot, and ban status, with support for filtering and case-insensitive searches.

## Verification Results

* **Vite Static Asset Build**: The frontend compiles cleanly with exit code 0 (`dist/` outputs generated).
* **Excel Export Output**: The `xlsx` package generates clean, download-compatible Excel buffers transmitted via standard secure binary blobs.
