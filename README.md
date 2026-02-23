# USAChat - Encrypted Messaging

## Quick Start

```bash
docker-compose up -d
```

Then visit `http://localhost`

## Architecture

- **Backend:** Node.js + Express + PostgreSQL + WebSocket
- **Frontend:** React + Vite
- **Reverse Proxy:** Nginx
- **Container:** Docker Compose

## Features

- User authentication (signup/login)
- Real-time messaging via WebSocket
- Encrypted messages
- Message history

## Production

Update `.env` secrets before deploying to production.
