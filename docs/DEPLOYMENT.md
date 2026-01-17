# Deployment Guide

Instructions for deploying the YouTube App to production.

## Table of Contents
- [Overview](#overview)
- [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
- [Backend Deployment](#backend-deployment)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Domain Configuration](#domain-configuration)
- [Monitoring](#monitoring)

---

## Overview

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

                         ┌─────────────────┐
                         │    Cloudflare   │
                         │   (DNS/CDN)     │
                         └────────┬────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│      Vercel       │  │     Railway/      │  │       Neon        │
│    (Frontend)     │  │   Docker/Fly.io   │  │   (PostgreSQL)    │
│                   │  │    (Backend)      │  │                   │
│  - React SPA      │  │  - Express API    │  │  - Serverless DB  │
│  - Static assets  │  │  - yt-dlp         │  │  - Auto-scaling   │
│  - Edge functions │  │  - ffmpeg         │  │  - Branching      │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Deployment Checklist

- [ ] Configure Neon database
- [ ] Deploy backend to Railway/Fly.io
- [ ] Deploy frontend to Vercel
- [ ] Set up environment variables
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring

---

## Frontend Deployment (Vercel)

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `youtube-analyzer`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variables
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend directory
cd youtube-analyzer

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

### vercel.json Configuration

Create `youtube-analyzer/vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Environment Variables (Vercel)

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_YOUTUBE_API_KEY` | Your API key | Production |
| `VITE_DOWNLOAD_API_URL` | https://your-backend.railway.app | Production |
| `VITE_DATABASE_URL` | postgresql://... | Production |
| `VITE_APP_ENV` | production | Production |

---

## Backend Deployment

### Option 1: Railway

Railway provides easy deployment with automatic Docker builds.

#### Deploy via Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Configure:
   - **Root Directory**: `youtube-analyzer/server`
   - **Start Command**: `npm run start`
5. Add environment variables
6. Deploy

#### railway.json Configuration

Create `youtube-analyzer/server/railway.json`:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

### Option 2: Fly.io

#### Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

#### Deploy to Fly.io

```bash
# Navigate to server directory
cd youtube-analyzer/server

# Login
fly auth login

# Create app
fly launch

# Deploy
fly deploy
```

#### fly.toml Configuration

```toml
app = "youtube-analyzer-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true

[[services]]
  http_checks = []
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    timeout = "2s"
```

### Option 3: Docker (Self-Hosted)

#### Build Docker Image

```bash
cd youtube-analyzer/server

# Build image
docker build -t youtube-analyzer-server .

# Run container
docker run -d \
  --name youtube-api \
  -p 3001:3001 \
  --env-file .env.production \
  youtube-analyzer-server
```

#### Dockerfile

```dockerfile
# youtube-analyzer/server/Dockerfile
FROM node:20-slim

# Install yt-dlp dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3001/health || exit 1

# Start server
CMD ["npm", "run", "start"]
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  youtube-api:
    build:
      context: ./youtube-analyzer/server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - FRONTEND_URL=https://your-frontend.vercel.app
      - DATABASE_URL=${DATABASE_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  instagram-api:
    build:
      context: ./instagram-analyzer
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - DATABASE_URL=${DATABASE_URL}
    restart: unless-stopped
```

---

## Database Setup

### Neon PostgreSQL

#### Create Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Click "New Project"
3. Choose region (closest to your backend)
4. Copy connection string

#### Initialize Schema

```bash
# Connect to database
psql "postgresql://user:pass@host/neondb?sslmode=require"

# Run schema
\i schema.sql
```

Or use Neon SQL Editor in the console.

#### Production Settings

1. Enable **Connection Pooling**
   - Go to Settings → Connection Pooling
   - Enable pooler
   - Use pooled connection string for high traffic

2. Configure **IP Allowlist** (optional)
   - Settings → IP Allow
   - Add your backend server IPs

3. Set up **Branching** for staging
   ```bash
   neonctl branches create --name staging --project-id abc123
   ```

---

## Environment Configuration

### Production Environment Variables

#### Frontend (.env.production)

```env
# YouTube API
VITE_YOUTUBE_API_KEY=AIzaSy...

# Backend URL (your deployed backend)
VITE_DOWNLOAD_API_URL=https://youtube-api.railway.app

# Database
VITE_DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require

# Environment
VITE_APP_ENV=production
```

#### Backend (.env.production)

```env
# Server
PORT=3001
NODE_ENV=production

# CORS (your frontend URL)
FRONTEND_URL=https://youtube-analyzer.vercel.app

# Database
DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require

# YouTube API (if needed server-side)
YOUTUBE_API_KEY=AIzaSy...
```

### Secrets Management

#### Vercel

```bash
# Add secret via CLI
vercel secrets add youtube-api-key "AIzaSy..."

# Reference in vercel.json
{
  "env": {
    "VITE_YOUTUBE_API_KEY": "@youtube-api-key"
  }
}
```

#### Railway

```bash
# Add via CLI
railway variables set YOUTUBE_API_KEY="AIzaSy..."

# Or via dashboard
# Settings → Variables
```

---

## Domain Configuration

### Custom Domain on Vercel

1. Go to Project → Settings → Domains
2. Add your domain (e.g., `youtube-analyzer.com`)
3. Configure DNS:
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   ```

### Custom Domain on Railway

1. Go to Project → Settings → Networking
2. Add custom domain
3. Configure DNS:
   ```
   Type: CNAME
   Name: api
   Value: your-app.railway.app
   ```

### SSL/TLS

- **Vercel**: Automatic SSL via Let's Encrypt
- **Railway**: Automatic SSL
- **Fly.io**: Automatic SSL

### CORS Configuration

Update backend CORS for production:

```typescript
// server/index.ts
const allowedOrigins = [
  'https://youtube-analyzer.vercel.app',
  'https://youtube-analyzer.com',
  'https://www.youtube-analyzer.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

---

## Monitoring

### Vercel Analytics

Enable in Vercel Dashboard:
1. Project → Analytics → Enable
2. Add to your app:

```tsx
// main.tsx
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <Router />
      <Analytics />
    </>
  );
}
```

### Railway Metrics

Available in Railway Dashboard:
- CPU usage
- Memory usage
- Network traffic
- Request logs

### Health Check Endpoint

```typescript
// server/index.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // Check dependencies
  try {
    await sql`SELECT 1`;
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});
```

### Error Tracking (Sentry)

```bash
npm install @sentry/react @sentry/node
```

```typescript
// Frontend
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://...@sentry.io/...',
  environment: import.meta.env.VITE_APP_ENV,
});

// Backend
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://...@sentry.io/...',
  environment: process.env.NODE_ENV,
});
```

### Logging

```typescript
// Use structured logging
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  next();
});
```

---

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: youtube-analyzer
        run: npm ci

      - name: Build
        working-directory: youtube-analyzer
        run: npm run build
        env:
          VITE_YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
          VITE_DOWNLOAD_API_URL: ${{ secrets.BACKEND_URL }}
          VITE_DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: youtube-analyzer

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v1.0.0
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: youtube-api
```

---

## Troubleshooting Deployment

### Frontend Build Fails

```bash
# Check build locally
cd youtube-analyzer
npm run build

# Common issues:
# - Missing environment variables
# - TypeScript errors
# - Import path issues
```

### Backend Container Fails

```bash
# Check logs
railway logs
# or
fly logs

# Common issues:
# - Missing yt-dlp/ffmpeg
# - Port not exposed
# - Environment variables missing
```

### Database Connection Fails

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Common issues:
# - Invalid connection string
# - IP not allowed
# - SSL mode missing
```

---

## Cost Estimation

### Free Tier Limits

| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth, unlimited deploys |
| Railway | $5 credit/month, 500 hours |
| Fly.io | 3 shared VMs, 3GB storage |
| Neon | 512MB storage, 191 compute hours |

### Estimated Monthly Costs

| Usage Level | Vercel | Backend | Database | Total |
|-------------|--------|---------|----------|-------|
| Low (<1K users) | $0 | $5 | $0 | ~$5 |
| Medium (<10K users) | $20 | $20 | $19 | ~$59 |
| High (<100K users) | $50 | $50 | $49 | ~$149 |

---

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [Setup Guide](SETUP.md) - Local development
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
