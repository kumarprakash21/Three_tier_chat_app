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

### V2.2 Profile and account settings

- Profile panel with display name and personal bio.
- Profile picture upload supporting JPG, PNG, and WebP images up to 1 MB.
- Profile picture preview before saving.
- Change password flow requiring the current password.
- New passwords must contain at least 6 characters.
- Online/offline presence and last-seen information in the profile panel.
- Notification preference for incoming messages.
- New-message in-app notifications when the conversation is not currently open.
- Profile details and preferences persist in MongoDB.

### V2.3 Media and file sharing

- Emoji picker with frequently used emojis.
- Upload and send images in private conversations.
- Upload and send videos with browser playback controls.
- Share PDF files and common office documents.
- Share plain-text documents.
- Attachment upload limit of 50 MB per file.
- Image, video, and document metadata are stored with the message.
- Images and videos display inline in the conversation.
- PDFs and documents display as downloadable attachment links.
- Download links preserve the original filename.
- Attachment uploads use server-side storage instead of storing binary data in MongoDB.
- Empty attachment-only messages are supported.

### V2.4 Groups and message interactions

- Create group conversations from the sidebar.
- Group owners are automatically made group administrators.
- Admins can add or remove members by username.
- Every group member can view the complete member list.
- Admins can promote members to admin or remove admin privileges.
- Group members can mute or unmute a group for their own account.
- Group messages are delivered in real time through Socket.IO rooms.
- Reply to group messages with visible reply context.
- Add quick reactions to group messages.
- Group administrators can pin and unpin messages.
- Pinned messages are highlighted for group members.

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

Either participant can delete a message for both participants.

- The sender or recipient can delete a message.
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
| `GET` | `/api/profile` | Yes | Get the authenticated user's profile and preferences |
| `PATCH` | `/api/profile` | Yes | Update display name, bio, profile picture, and notifications |
| `PATCH` | `/api/password` | Yes | Change the authenticated user's password |
| `POST` | `/api/upload` | Yes | Upload an image, video, PDF, or supported document |
| `GET` | `/api/groups` | Yes | Get groups for the authenticated user |
| `POST` | `/api/groups` | Yes | Create a group conversation |
| `GET` | `/api/groups/:groupId/messages` | Yes | Load group message history |
| `PATCH` | `/api/groups/:groupId/members` | Yes | Add or remove group members as an admin |
| `PATCH` | `/api/groups/:groupId/mute` | Yes | Mute or unmute a group for the current user |
| `DELETE` | `/api/account` | Yes | Permanently delete the current account and its messages |
| `DELETE` | `/api/chats/:userId` | Yes | Hide a user from the current user's chat list |

## Socket.IO Events

### Client to server

- `private message` - Send a text message, emoji message, or attachment message.
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
- Profile settings are loaded and saved over the authenticated profile endpoints.
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

## Deployment options

The application can be deployed in three stages:

1. Run Node.js directly on a Linux server.
2. Package the application with Docker and Docker Compose.
3. Deploy the container to Kubernetes.

### 1. Deploy directly on a Linux server

Install Node.js, npm, Git, and MongoDB on the server, or use a managed MongoDB
database. Then clone and install the application:

```bash
git clone YOUR_REPOSITORY_URL Three_tier_chat_app
cd Three_tier_chat_app
npm ci --omit=dev
cp .env.example .env
```

If `.env.example` does not exist, create `.env` manually:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/chatapp
JWT_SECRET=replace-with-a-long-random-secret
```

Test the application:

```bash
npm start
curl http://127.0.0.1:3000
```

For a server deployment, run the app as a `systemd` service so it starts on
boot and restarts after a failure. Create `/etc/systemd/system/chatapp.service`:

```ini
[Unit]
Description=ChatApp Node.js application
After=network.target

[Service]
Type=simple
User=azureuser
WorkingDirectory=/home/azureuser/Three_tier_chat_app
EnvironmentFile=/home/azureuser/Three_tier_chat_app/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `azureuser` and the paths with your Linux username and project path,
then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chatapp
sudo systemctl status chatapp
sudo journalctl -u chatapp -f
```

The direct server URL is `http://SERVER_PUBLIC_IP:3000`. For production, put
Nginx or another reverse proxy in front of Node.js and expose ports 80/443.

### 2. Run with Docker Compose

Build and start the application with MongoDB:

```bash
docker compose up --build
```

Set a JWT secret before starting the containers. You can create a `.env` file
in the project root:

```env
JWT_SECRET=replace-with-a-long-random-secret
```

Open `http://localhost:3000`. MongoDB data and uploaded files are stored in
Docker volumes so they survive container restarts.

Stop the services with:

```bash
docker compose down
```

To run only the Docker image instead of Compose:

```bash
docker build -t chatapp:1.0 .
docker run --env-file .env -p 3000:3000 -v chatapp_uploads:/app/uploads chatapp:1.0
```

## Deploy to Kubernetes

1. Build and push the image, replacing the placeholder registry name:

```bash
docker build -t YOUR_DOCKERHUB_USERNAME/chatapp:1.0 .
docker push YOUR_DOCKERHUB_USERNAME/chatapp:1.0
```

2. Copy `k8s/secret.example.yaml` to `k8s/secret.yaml`, then replace the JWT
secret and MongoDB connection string. Keep `secret.yaml` out of source control.

3. Replace `YOUR_DOCKERHUB_USERNAME/chatapp:1.0` in `k8s/deployment.yaml` with
your image. The included Ingress matches the VM IP directly. Add a `host` value
and DNS record later when you have a real domain.

4. Apply the manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml -n chatapp
kubectl apply -f k8s/uploads-pvc.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/ingress.yaml -n chatapp
```

5. Check the rollout:

```bash
kubectl rollout status deployment/chatapp -n chatapp
kubectl get pods,service,ingress -n chatapp
```

The cluster needs an Ingress controller and a default StorageClass. The
Ingress includes longer timeouts for Socket.IO connections. The initial
deployment uses one replica because online-user state and uploads are local
to the application pod. Add Redis Socket.IO scaling and shared object storage
before increasing the replica count.

### Optional: MongoDB inside Kubernetes

For development or learning, MongoDB manifests are available in
`k8s/mongodb/`. Copy `k8s/mongodb/secret.example.yaml` to
`k8s/mongodb/secret.yaml`, set a strong password, and apply them:

```bash
kubectl apply -f k8s/mongodb/secret.yaml -n chatapp
kubectl apply -f k8s/mongodb/service.yaml -f k8s/mongodb/statefulset.yaml -n chatapp
```

Then set the application `MONGODB_URI` in `k8s/secret.yaml` to:

```text
mongodb://root:PASSWORD@mongodb:27017/chatapp?authSource=admin
```

The StatefulSet creates its own persistent volume claim from
`volumeClaimTemplates`; a manual PersistentVolume is normally unnecessary
when the cluster has a default StorageClass. Use managed MongoDB for
production unless you also plan backups, monitoring, upgrades, and replica
set management.

### Kubernetes cleanup

Remove only the ChatApp resources:

```bash
kubectl delete namespace chatapp
```

Remove only the NGINX Ingress controller:

```bash
kubectl delete namespace ingress-nginx
```

Delete the complete Kind cluster:

```bash
kind delete cluster
```

Deleting the `chatapp` namespace removes the application Deployment, Service,
Ingress, Secrets, and upload storage claim. Deleting the Kind cluster removes
all Kubernetes resources and data stored inside that cluster. Recreate a clean
Kind cluster with:

```bash
kind create cluster --config kind-config.yaml
```

Check for remaining Kind containers:

```bash
docker ps
```

These delete commands are destructive. Do not delete the namespace or cluster
if you need to preserve its database or uploaded files.

## Security Notes

- Protected endpoints require a Bearer JWT in the `Authorization` header.
- Message edit and delete operations verify ownership on the server.
- Account deletion is restricted to the authenticated account.
- User input is trimmed and length-limited on the server.
- Passwords are never stored in plain text.
- Use a strong, private `JWT_SECRET` in production.
- Restrict CORS origins before deploying to production.

## Current Roadmap

Future improvements include:

- Group conversations.
- File and image sharing.
- Message reactions.
- Push notifications.
- Advanced message search.
- Health checks, monitoring, logging, and autoscaling.
