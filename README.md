# 🏠 Nikupangishe API

> **Tanzanian Long-term Rental Platform** — Owner-led, Agent-powered, Tenant-friendly.

Built with **NestJS**, **PostgreSQL**, **Redis**, and **Socket.IO**.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NIKUPANGISHE API                          │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Auth    │  │  Houses  │  │ Viewings │  │   Exchanges    │  │
│  │  Module  │  │  Module  │  │  Module  │  │    Module      │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                   │
│  ┌──────────────────────┐    ┌────────────────────────────────┐  │
│  │   Chat Module        │    │    Notifications Module        │  │
│  │  (REST + Socket.IO)  │    │   (REST + Real-time push)      │  │
│  └──────────────────────┘    └────────────────────────────────┘  │
│                                                                   │
│           PostgreSQL ◄──────────► Redis Cache                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### 1. Clone & Install
```bash
git clone <repo>
cd nikupangishe-api
cp .env.example .env
npm install
```

### 2. Start with Docker (recommended)
```bash
docker-compose up -d
```

### 3. Or run locally (requires PostgreSQL + Redis running)
```bash
# Edit .env with your DB/Redis credentials
npm run start:dev
```

API will be available at: **http://localhost:3000/api/v1**  
Swagger docs: **http://localhost:3000/docs**

---

## 📋 API Modules

### 🔐 Auth (`/api/v1/auth`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/register` | Public | Register (owner/agent/tenant) |
| POST | `/login` | Public | Login with email + password |
| POST | `/verify-phone` | Public | Verify phone with OTP |
| POST | `/resend-otp/:phone` | Public | Resend verification OTP |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/logout` | Any | Invalidate tokens |
| GET | `/me` | Any | Get current user profile |
| POST | `/change-password` | Any | Change password |

### 🏠 Houses (`/api/v1/houses`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | Browse all available houses |
| GET | `/my-houses` | Owner | List owner's houses |
| GET | `/pending-verification` | Admin | Houses awaiting review |
| GET | `/:id` | Public | Get house details |
| POST | `/` | Owner | Create a new listing |
| PUT | `/:id` | Owner | Update house |
| DELETE | `/:id` | Owner | Deactivate listing |
| POST | `/:id/agents` | Owner | Assign agent to house |
| DELETE | `/:id/agents/:agentId` | Owner | Remove agent |
| PATCH | `/:id/verify` | Admin | Verify or reject listing |
| POST | `/:id/photos` | Owner | Upload photos |

### 📅 Viewings (`/api/v1/viewings`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/` | Tenant | Request a viewing |
| GET | `/my-viewings` | Any | Get my viewings (role-based) |
| GET | `/:id` | Any | Get viewing details |
| PATCH | `/:id` | Agent/Tenant | Update viewing status |

**Viewing statuses:** `pending` → `confirmed` → `completed` / `cancelled` / `no_show`

### 🔄 Exchanges (`/api/v1/exchanges`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/` | Tenant | Request move or exchange |
| GET | `/my-exchanges` | Any | Get my exchange requests |
| GET | `/:id` | Any | Exchange details |
| PATCH | `/:id/approve` | Owner | Approve the exchange |
| PATCH | `/:id/reject` | Owner | Reject the exchange |
| POST | `/confirm-tenancy` | Owner | Confirm tenant occupancy |

**Exchange flow:**
```
Tenant requests → Initiator's Owner approves → Target Owner approves → Auto-completed
```

### 💬 Chat (`/api/v1/chat` + WebSocket `/chat`)

**REST endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | All conversations |
| GET | `/conversations/:id/messages` | Messages in conversation |
| GET | `/unread-count` | Total unread count |

**Socket.IO events (connect to `ws://localhost:3000/chat`):**

```javascript
// Connect with auth token
const socket = io('http://localhost:3000/chat', {
  auth: { token: 'your_jwt_token' }
});

// Emit events
socket.emit('join:conversation', { conversationId: 'house:uuid:tenant:uuid' });
socket.emit('message:send', {
  conversationId: 'house:uuid:tenant:uuid',
  receiverId: 'receiver-user-id',
  content: 'Hello! Is the house still available?',
  type: 'text'
});
socket.emit('message:read', { conversationId: '...' });
socket.emit('typing:start', { conversationId: '...' });
socket.emit('typing:stop', { conversationId: '...' });

// Listen to events
socket.on('message:new', (message) => { /* new message */ });
socket.on('message:read', (data) => { /* messages read */ });
socket.on('typing:start', (data) => { /* someone typing */ });
socket.on('typing:stop', (data) => { /* stopped typing */ });
socket.on('notification:new', (notification) => { /* new notification */ });
socket.on('user:online', ({ userId }) => { /* user came online */ });
socket.on('user:offline', ({ userId }) => { /* user went offline */ });
```

**Conversation ID format:** `house:{houseId}:tenant:{tenantId}`

### 🔔 Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all notifications |
| GET | `/unread-count` | Unread count |
| PATCH | `/:id/read` | Mark as read |
| PATCH | `/mark-all-read` | Mark all read |

---

## 👥 User Roles

| Role | Description | Key Abilities |
|------|-------------|---------------|
| `owner` | Property owner | List houses, assign agents, approve tenants |
| `agent` | Verified agent | Handle viewings, coordinate tenants |
| `tenant` | Renter | Browse, request viewings, request moves |
| `admin` | Platform admin | Verify listings and agents |

---

## 🗃️ Database Schema

```
users
├── agent_profiles (1:1 with users where role=agent)
├── tenant_profiles (1:1 with users where role=tenant)
│
houses (owned by users with role=owner)
├── house_agents (M:M junction - owner assigns agents to houses)
├── tenancies (official tenant-house records)
│
viewing_requests (tenant → house, handled by agent)
exchange_requests (tenant move/swap, requires both owner approvals)
│
chat_messages (conversationId-based threading)
notifications (user-specific, real-time via socket.io)
```

---

## 🔑 Key Business Rules

1. **One listing per house** — GPS proximity check (20m radius) prevents duplicates
2. **Owner-controlled agents** — Agents can only work on houses where owners explicitly assigned them
3. **Rent paid to owners directly** — Platform never handles money
4. **Phone verification required** — Tanzanian number (+255XXXXXXXXX)
5. **Exchange requires both owners** — Both the current and new house owners must approve
6. **Agent earns on re-exchange** — Every tenant move through the same house earns the agent commission again

---

## 🔧 Environment Variables

See `.env.example` for all configuration options.

Key variables:
```env
DB_HOST=localhost          # PostgreSQL host
REDIS_HOST=localhost       # Redis host  
JWT_SECRET=...             # Must be strong in production
JWT_EXPIRES_IN=7d          # Access token expiry
JWT_REFRESH_EXPIRES_IN=30d # Refresh token expiry
```

---

## 📡 Redis Usage

- **Listing cache** — House search results cached for 5 minutes
- **Single house cache** — Individual house details cached for 5 minutes
- **Socket.IO adapter** — (configure with `@socket.io/redis-adapter` for multi-instance)

To enable Redis caching, update `app.module.ts` CacheModule config with `cache-manager-redis-yet`.

---

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use strong, random `JWT_SECRET` and `JWT_REFRESH_SECRET`
3. Enable SSL for PostgreSQL connection
4. Configure Redis with authentication
5. Set up reverse proxy (nginx) with SSL termination
6. Configure Socket.IO Redis adapter for horizontal scaling

```bash
npm run build
npm run start:prod
```