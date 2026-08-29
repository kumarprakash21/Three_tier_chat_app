# 💬 ChatApp

A real-time chat application built using **Node.js, Express, Socket.IO, HTML, CSS, and JavaScript**.

The project is being developed step-by-step from a simple real-time chat application into a production-style cloud-native application with authentication, database persistence, Docker, Kubernetes, Azure, CI/CD, and GitOps.

---

## 🚀 Project Status

### Version 1 — Completed

- User registration
- User login
- Session management
- Real-time messaging
- Online users
- Online/offline presence
- Typing indicator
- User-specific chat header
- Logout functionality
- Responsive UI
- Dark modern UI
- Emoji support
- Browser notifications
- Message timestamps
- Send message using Enter
- Shift + Enter for new line

### Version 2 — Planned

- MongoDB database
- Secure password hashing with bcrypt
- JWT authentication
- Persistent chat history
- One-to-one private chat
- Last seen
- Message delivery status
- Read receipts
- Unread message count
- Search messages
- Edit messages
- Delete messages
- Reply to messages

### Version 3 — Planned

- Group chat
- File sharing
- Image sharing
- User profile pictures
- Message reactions
- Push notifications
- Advanced search

### DevOps / Cloud Roadmap

- Docker
- Docker Compose
- Azure Container Registry
- Azure Kubernetes Service (AKS)
- Kubernetes manifests
- Helm
- Azure DevOps CI/CD
- Argo CD
- GitOps
- Monitoring and logging
- Application health checks
- Horizontal Pod Autoscaler

---

# 🏗️ Current Architecture

Version 1 uses a simple Node.js and Socket.IO architecture.

```text
                  ┌──────────────────┐
                  │      Browser     │
                  │                  │
                  │ HTML / CSS / JS  │
                  └────────┬─────────┘
                           │
                           │ WebSocket
                           │
                  ┌────────▼─────────┐
                  │     Socket.IO    │
                  │                  │
                  │ Real-time Chat   │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │     Node.js      │
                  │     Express      │
                  │                  │
                  │    server.js     │
                  └──────────────────┘
