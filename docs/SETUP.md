# Setup Guide

Complete guide for setting up the YouTube App development environment.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [YouTube API Setup](#youtube-api-setup)
- [Neon Database Setup](#neon-database-setup)
- [Installing Dependencies](#installing-dependencies)
- [Running the Application](#running-the-application)
- [Verifying Installation](#verifying-installation)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or 20.x | JavaScript runtime |
| npm | 9.x+ | Package manager |
| Python | 3.8+ | Instagram scraping |
| Git | 2.x+ | Version control |

### Optional Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 20.x+ | Containerization |
| yt-dlp | latest | Video downloading |
| FFmpeg | 4.x+ | Video processing |

### Installation Commands

#### macOS (using Homebrew)
```bash
# Install Node.js
brew install node@20

# Install Python
brew install python@3.11

# Install yt-dlp
brew install yt-dlp

# Install FFmpeg
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
# Install Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python
sudo apt-get install python3 python3-pip

# Install yt-dlp
sudo pip3 install yt-dlp

# Install FFmpeg
sudo apt-get install ffmpeg
```

#### Windows
```powershell
# Install Node.js - Download from https://nodejs.org/

# Install Python - Download from https://python.org/

# Install yt-dlp
pip install yt-dlp

# Install FFmpeg - Download from https://ffmpeg.org/download.html
# Add to PATH
```

---

## Environment Variables

### YouTube Analyzer Frontend (`.env`)

Create `/youtube-analyzer/.env`:

```env
# YouTube Data API v3 Key (required)
VITE_YOUTUBE_API_KEY=AIzaSy...your_api_key

# Backend Download Server URL
VITE_DOWNLOAD_API_URL=http://localhost:3001

# Environment mode
VITE_APP_ENV=development

# Neon Database (for frontend direct access)
VITE_DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

### YouTube Analyzer Backend (`.env`)

Create `/youtube-analyzer/server/.env`:

```env
# Server port
PORT=3001

# Allowed origins for CORS
FRONTEND_URL=http://localhost:5173

# Database connection
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# YouTube API Key (server-side)
YOUTUBE_API_KEY=AIzaSy...your_api_key
```

### Instagram Analyzer (`.env`)

Create `/instagram-analyzer/.env`:

```env
# Server port
PORT=3002

# Database connection
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# Instagram credentials (optional, for private accounts)
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `VITE_DOWNLOAD_API_URL` | Yes | Backend server URL |
| `VITE_APP_ENV` | No | `development` or `production` |
| `VITE_DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `DATABASE_URL` | Yes | Same as above, for backend |
| `PORT` | No | Server port (default: 3001) |
| `FRONTEND_URL` | No | CORS allowed origin |

---

## YouTube API Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "YouTube Analyzer")
4. Click "Create"

### Step 2: Enable YouTube Data API v3

1. Go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "Enable"

### Step 3: Create API Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. (Optional) Click "Restrict Key" to limit usage

### Step 4: Configure API Key Restrictions (Recommended)

1. Under "Application restrictions", select:
   - "HTTP referrers" for frontend
   - "IP addresses" for backend
2. Under "API restrictions":
   - Select "Restrict key"
   - Choose "YouTube Data API v3"
3. Save changes

### API Quota Information

| Operation | Quota Cost |
|-----------|------------|
| channels.list | 1 unit |
| playlistItems.list | 1 unit per 50 items |
| videos.list | 1 unit per 50 items |

**Daily Limit:** 10,000 units (free tier)

**Example Usage:**
- Fetching 100 videos = ~5 units
- Fetching 500 videos = ~22 units

---

## Neon Database Setup

### Step 1: Create Neon Account

1. Go to [Neon Console](https://console.neon.tech/)
2. Sign up with GitHub or email
3. Create a new project

### Step 2: Create Database

1. In Neon Console, go to your project
2. Note down the connection string from "Connection Details"
3. Select "Connection string" and copy it

### Step 3: Initialize Database Schema

Connect to your database and run:

```sql
-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    subscriber_count BIGINT DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    uploads_playlist_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(50) PRIMARY KEY,
    channel_id VARCHAR(50) REFERENCES channels(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    thumbnail_medium_url TEXT,
    thumbnail_high_url TEXT,
    duration INTEGER DEFAULT 0,
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    published_at TIMESTAMP,
    is_short BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create metrics history table
CREATE TABLE IF NOT EXISTS metrics_history (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(50) REFERENCES videos(id),
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_video ON metrics_history(video_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON metrics_history(recorded_at DESC);

-- Create Instagram videos table
CREATE TABLE IF NOT EXISTS instagram_videos (
    shortcode VARCHAR(50) PRIMARY KEY,
    thumbnail TEXT,
    caption VARCHAR(500),
    caption_full TEXT,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    duration FLOAT DEFAULT 0,
    timestamp BIGINT,
    type VARCHAR(20),
    url TEXT,
    video_url TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 4: Verify Connection

Test your connection string:

```bash
# Using psql
psql "postgresql://user:pass@host/dbname?sslmode=require"

# Or using Node.js
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql('SELECT 1').then(() => console.log('Connected!')).catch(console.error);
"
```

---

## Installing Dependencies

### YouTube Analyzer

```bash
# Navigate to project
cd "Youtube App/youtube-analyzer"

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Instagram Analyzer

```bash
# Navigate to project
cd "Youtube App/instagram-analyzer"

# Install Node dependencies
npm install

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
.\venv\Scripts\activate   # Windows

# Install Python dependencies
pip install instaloader
```

### Verify yt-dlp Installation

```bash
# Check yt-dlp version
yt-dlp --version

# Check ffmpeg
ffmpeg -version

# Test download (optional)
yt-dlp --simulate "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## Running the Application

### Development Mode

Open three terminal windows:

**Terminal 1: Frontend**
```bash
cd "Youtube App/youtube-analyzer"
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2: YouTube Backend**
```bash
cd "Youtube App/youtube-analyzer/server"
npm run dev
# Runs on http://localhost:3001
```

**Terminal 3: Instagram Backend (Optional)**
```bash
cd "Youtube App/instagram-analyzer"
npm start
# Runs on http://localhost:3002
```

### Production Mode

**Build Frontend:**
```bash
cd youtube-analyzer
npm run build
npm run preview
```

**Run Backend:**
```bash
cd youtube-analyzer/server
npm run build
npm run start
```

### Using Docker

```bash
# Build and run YouTube backend
cd youtube-analyzer
docker build -t youtube-analyzer-server ./server
docker run -p 3001:3001 --env-file ./server/.env youtube-analyzer-server

# Build and run Instagram backend
cd instagram-analyzer
docker build -t instagram-analyzer .
docker run -p 3002:3002 --env-file .env instagram-analyzer
```

---

## Verifying Installation

### Check Frontend

1. Open http://localhost:5173
2. You should see the login page
3. Login with:
   - Email: `ilankriger@gmail.com`
   - Password: `Aa11231123__1`

### Check YouTube Backend

```bash
# Health check
curl http://localhost:3001/health
# Expected: { "status": "ok" }

# Check yt-dlp/ffmpeg
curl http://localhost:3001/api/check
# Expected: { "ytdlp": true, "ffmpeg": true }
```

### Check Instagram Backend

```bash
# Health check
curl http://localhost:3002/health
# Expected: { "status": "ok" }

# Get videos
curl http://localhost:3002/api/videos
# Expected: { "videos": [...], "lastUpdate": "..." }
```

### Check Database Connection

```bash
# In Node.js environment
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql('SELECT COUNT(*) FROM videos')
  .then(result => console.log('Videos in DB:', result[0].count))
  .catch(err => console.error('DB Error:', err));
"
```

---

## Common Setup Issues

### Issue: `yt-dlp: command not found`

**Solution:**
```bash
# macOS
brew install yt-dlp

# or via pip
pip3 install yt-dlp

# Add to PATH if needed
export PATH="$PATH:$(python3 -m site --user-base)/bin"
```

### Issue: `ffmpeg: command not found`

**Solution:**
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

### Issue: CORS Error in Browser

**Solution:**
1. Check `FRONTEND_URL` in backend `.env`
2. Verify backend is running on correct port
3. Check browser console for specific error

### Issue: YouTube API Quota Exceeded

**Solution:**
1. Wait 24 hours for quota reset
2. Use cached data (localStorage)
3. Create additional API key (different project)

### Issue: Neon Connection Failed

**Solution:**
1. Verify connection string format
2. Check if `sslmode=require` is present
3. Ensure IP is not blocked
4. Try connection from Neon Console SQL Editor

### Issue: Python/Instaloader Not Found

**Solution:**
```bash
# Verify Python installation
python3 --version

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install instaloader
pip install instaloader
```

---

## Next Steps

After setup is complete:

1. Read the [Architecture Guide](ARCHITECTURE.md) to understand the system
2. Check the [API Reference](API.md) for endpoint documentation
3. Review [Components Guide](COMPONENTS.md) for frontend development
4. See [Deployment Guide](DEPLOYMENT.md) for production setup

---

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [API Reference](API.md) - Endpoint documentation
- [Deployment](DEPLOYMENT.md) - Production setup
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
