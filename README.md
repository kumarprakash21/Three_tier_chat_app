# ChatApp

ChatApp is a real-time one-to-one messaging application built with Node.js, Express, MongoDB, Mongoose, Socket.IO, HTML, CSS, and JavaScript.

The application includes authentication, persistent private messages, online presence, typing indicators, message read status, message editing and deletion, account deletion, and personal chat-list management.

## Current Features

### Authentication and sessions

- User registration with username and password validation.
- Passwords are securely hashed with `bcryptjs` before storage.
- User login using JWT authentication.
- JWT tokens expire after 24 hours.
- Automatic session restoration after refreshing the page.
- Logout functionality with a custom in-app button.
- Startup loading state prevents the register screen from flashing during refresh.

### Private real-time chat

- One-to-one private conversations between registered users.
- Messages are stored in MongoDB and loaded when a conversation opens.
- Real-time delivery through Socket.IO.
- Message timestamps.
- Press `Enter` to send a message.
- Press `Shift + Enter` to add a new line.
- Responsive layout for desktop and mobile screens.

### Presence and notifications

- Online and offline user indicators.
- Last-seen time for offline users.
- Typing indicator while another user is typing.
- Browser-independent in-app toast notifications.
- Unread message counts in the chat list.
- Read status with sent and read message ticks.
- Conversation list sorting based on latest activity.

### Message management

#### Edit message

Users can edit messages they sent. The edit action opens a custom application modal instead of a browser prompt.

- Only the original sender can edit a message.
- Empty messages are rejected.
- Messages are limited to 2,000 characters.
- Edited messages display an `edited` label.
- Changes are immediately synchronized with the other participant.
- The conversation preview is updated after editing.

#### Delete message

Users can delete messages they sent for both participants.

- Only the original sender can delete a message.
- Deletion requires confirmation in a custom danger modal.
- The message is removed from MongoDB.
- The message disappears from both users' open conversations.
- The conversation preview is refreshed after deletion.

### Account management

#### Delete account

Users can permanently delete their own account from the chat header.

Account deletion:

1. Shows a clear confirmation modal.
2. Deletes the authenticated user.
3. Deletes all messages sent or received by that user.
4. Disconnects the active Socket.IO session.
5. Removes the user from other users' lists.
6. Clears the local JWT session and returns to the login screen.

This action is permanent and cannot be undone.

### Remove user from my chats

The `Remove from chats` action hides a user from the current user's chat list.

- The action is private to the current account.
- The existing conversation history is preserved.
- The other user is not deleted or blocked.
- If a new message is sent between the users later, the conversation automatically appears again.
- Removing a selected conversation clears the active chat view and disables the message input.

The hidden chat relationships are stored in the user's `hiddenChats` array.

### User interface

- Modern gradient-based chat layout.
- Responsive desktop and mobile design.
- Custom toast messages for errors, success messages, and status updates.
- Custom modals for editing and destructive actions.
- No native browser `alert`, `confirm`, or `prompt` dialogs for application actions.
- Hover-based message controls for edit and delete.
- Clean logout and delete-account SVG-style controls.
- Empty chat, loading, and no-user states.
- HTML escaping for user-generated content displayed in empty-state messages.

## API Endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---:|---|
| `POST` | `/api/register` | No | Create a new user account |
| `POST` | `/api/login` | No | Authenticate a user and return a JWT |
| `GET` | `/api/users` | Yes | Get available users and conversation summaries |
| `GET` | `/api/messages/:userId` | Yes | Load a private conversation and mark incoming messages as read |
| `DELETE` | `/api/account` | Yes | Permanently delete the current account and its messages |
| `DELETE` | `/api/chats/:userId` | Yes | Hide a user from the current user's chat list |

## Socket.IO Events

### Client to server

- `private message` - Send a private message.
- `typing` - Notify the recipient that the user is typing.
- `stop typing` - Stop the typing notification.
- `mark read` - Mark messages from a user as read.
- `edit message` - Edit a message owned by the current user.
- `delete message` - Delete a message owned by the current user.

### Server to client

- `private message` - Deliver a new private message.
- `user online` - Notify clients that a user is online.
- `user offline` - Notify clients that a user is offline.
- `online users` - Send the current online-user list.
- `user typing` - Display a typing indicator.
- `user stopped typing` - Hide a typing indicator.
- `messages read` - Update sent-message read status.
- `message edited` - Update an edited message in real time.
- `message deleted` - Remove a deleted message in real time.
- `conversation updated` - Refresh conversation previews and unread counts.
- `user deleted` - Remove a deleted account from user lists.
- `account deleted` - Close the deleted user's active session.

## Data Models

### User

- `username` - Unique username between 3 and 30 characters.
- `password` - Bcrypt-hashed password.
- `lastSeen` - Most recent offline or activity timestamp.
- `hiddenChats` - User IDs hidden from this user's chat list.
- `createdAt` and `updatedAt` - Mongoose timestamps.

### Message

- `sender` - User ID of the message sender.
- `receiver` - User ID of the message recipient.
- `message` - Message content with a maximum length of 2,000 characters.
- `read` - Whether the recipient has read the message.
- `edited` - Whether the message has been edited.
- `createdAt` and `updatedAt` - Mongoose timestamps.

## Project Structure

```text
Three_tier_chat_app/
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── models/
│   ├── Message.js           # Message schema
│   └── User.js              # User schema and hidden chats
├── public/
│   ├── app.js               # Frontend application logic
│   ├── index.html           # ChatApp markup
│   └── style.css            # Application styles and responsive layout
├── server.js                # Express and Socket.IO server
├── package.json             # Dependencies and scripts
└── .env                     # Local environment configuration
```

## Setup

### Requirements

- Node.js 18 or later.
- MongoDB database.
- npm.

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create or update `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/chatapp
JWT_SECRET=replace-with-a-long-random-secret
```

### Start the application

```bash
npm start
```

Open `http://localhost:3000` in a browser.

## Security Notes

- Protected endpoints require a Bearer JWT in the `Authorization` header.
- Message edit and delete operations verify ownership on the server.
- Account deletion is restricted to the authenticated account.
- User input is trimmed and length-limited on the server.
- Passwords are never stored in plain text.
- Use a strong, private `JWT_SECRET` in production.
- Restrict CORS origins before deploying to production.

## Current Roadmap

Planned improvements include:

- Group conversations.
- File and image sharing.
- User profile pictures.
- Message reactions.
- Push notifications.
- Advanced message search.
- Docker and Docker Compose support.
- Kubernetes and Helm deployment manifests.
- Health checks, monitoring, logging, and autoscaling.
