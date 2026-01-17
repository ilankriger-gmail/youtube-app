# API Reference

Complete documentation of all backend API endpoints.

## Table of Contents
- [Overview](#overview)
- [YouTube Download API](#youtube-download-api)
- [TikTok API](#tiktok-api)
- [Instagram API](#instagram-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Overview

The application has three backend servers:

| Server | Port | Purpose |
|--------|------|---------|
| YouTube Download | 3001 | Video downloads & info |
| Instagram | 3002 | Instagram video management |

### Base URLs

**Development:**
- YouTube API: `http://localhost:3001`
- Instagram API: `http://localhost:3002`

**Production:**
- YouTube API: `https://your-domain.vercel.app`
- Instagram API: `https://your-instagram-api.railway.app`

### Common Headers

```http
Content-Type: application/json
Accept: application/json
```

---

## YouTube Download API

Base URL: `http://localhost:3001`

### Health Check

Check if the server is running.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Check Dependencies

Verify yt-dlp and ffmpeg are installed.

```http
GET /api/check
```

**Response:**
```json
{
  "ytdlp": true,
  "ffmpeg": true,
  "ytdlpVersion": "2024.01.16",
  "ffmpegVersion": "6.1"
}
```

---

### Get Video Info

Retrieve metadata for a YouTube video.

```http
GET /api/info?videoId={videoId}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| videoId | string | Yes | YouTube video ID (11 characters) |

**Example:**
```bash
curl "http://localhost:3001/api/info?videoId=dQw4w9WgXcQ"
```

**Response:**
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "description": "The official video for...",
  "duration": 213,
  "durationFormatted": "3:33",
  "viewCount": 1500000000,
  "likeCount": 15000000,
  "uploadDate": "2009-10-25",
  "uploader": "Rick Astley",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "formats": [
    {
      "format_id": "137",
      "ext": "mp4",
      "resolution": "1920x1080",
      "filesize": 150000000
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "Video not found",
  "code": "VIDEO_NOT_FOUND"
}
```

---

### Get Available Formats

List all available download formats for a video.

```http
GET /api/formats?videoId={videoId}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| videoId | string | Yes | YouTube video ID |

**Example:**
```bash
curl "http://localhost:3001/api/formats?videoId=dQw4w9WgXcQ"
```

**Response:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "formats": [
    {
      "format_id": "137",
      "ext": "mp4",
      "quality": "1080p",
      "resolution": "1920x1080",
      "fps": 30,
      "vcodec": "avc1.640028",
      "acodec": "none",
      "filesize": 150000000
    },
    {
      "format_id": "136",
      "ext": "mp4",
      "quality": "720p",
      "resolution": "1280x720",
      "fps": 30,
      "vcodec": "avc1.4d401f",
      "acodec": "none",
      "filesize": 75000000
    },
    {
      "format_id": "140",
      "ext": "m4a",
      "quality": "audio",
      "acodec": "mp4a.40.2",
      "abr": 128,
      "filesize": 3500000
    }
  ]
}
```

---

### Download Video

Download a YouTube video with specified quality.

```http
GET /api/download?videoId={videoId}&quality={quality}
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| videoId | string | Yes | - | YouTube video ID |
| quality | string | No | best | Video quality |

**Quality Options:**
| Value | Description |
|-------|-------------|
| `best` | Best available quality |
| `1080` | 1080p (Full HD) |
| `720` | 720p (HD) |
| `480` | 480p (SD) |
| `360` | 360p (Low) |
| `audio` | Audio only (MP3) |

**Example:**
```bash
# Download best quality
curl -OJ "http://localhost:3001/api/download?videoId=dQw4w9WgXcQ&quality=best"

# Download 720p
curl -OJ "http://localhost:3001/api/download?videoId=dQw4w9WgXcQ&quality=720"

# Download audio only
curl -OJ "http://localhost:3001/api/download?videoId=dQw4w9WgXcQ&quality=audio"
```

**Response Headers:**
```http
Content-Type: video/mp4
Content-Disposition: attachment; filename="Rick Astley - Never Gonna Give You Up.mp4"
Content-Length: 150000000
```

**Response:** Binary video/audio file stream

**Error Response:**
```json
{
  "error": "Download failed",
  "code": "DOWNLOAD_ERROR",
  "details": "Video is unavailable"
}
```

---

## TikTok API

Base URL: `http://localhost:3001/api/tiktok`

### Validate TikTok URL

Check if a TikTok URL is valid and accessible.

```http
POST /api/tiktok/validate
```

**Request Body:**
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

**Supported URL Formats:**
- `https://www.tiktok.com/@username/video/1234567890`
- `https://vm.tiktok.com/abc123/`
- `https://tiktok.com/t/abc123/`

**Response:**
```json
{
  "valid": true,
  "videoId": "1234567890",
  "username": "username"
}
```

**Error Response:**
```json
{
  "valid": false,
  "error": "Invalid TikTok URL format"
}
```

---

### Get TikTok Profile Videos

Fetch all videos from a TikTok profile.

```http
POST /api/tiktok/profile
```

**Request Body:**
```json
{
  "username": "nextleveldj",
  "limit": 100
}
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| username | string | Yes | - | TikTok username (without @) |
| limit | number | No | 50 | Max videos to fetch |

**Response:**
```json
{
  "username": "nextleveldj",
  "profileUrl": "https://www.tiktok.com/@nextleveldj",
  "videoCount": 150,
  "videos": [
    {
      "id": "1234567890",
      "title": "Check out this mix!",
      "views": 1500000,
      "likes": 150000,
      "comments": 5000,
      "shares": 10000,
      "duration": 45,
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "url": "https://www.tiktok.com/@nextleveldj/video/1234567890",
      "thumbnail": "https://..."
    }
  ]
}
```

---

### Get TikTok Video Info

Get metadata for a specific TikTok video.

```http
GET /api/tiktok/info?url={encodedUrl}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL-encoded TikTok video URL |

**Example:**
```bash
curl "http://localhost:3001/api/tiktok/info?url=https%3A%2F%2Fwww.tiktok.com%2F%40user%2Fvideo%2F123"
```

**Response:**
```json
{
  "id": "1234567890",
  "title": "Video description",
  "author": {
    "username": "nextleveldj",
    "nickname": "Next Level DJ"
  },
  "stats": {
    "views": 1500000,
    "likes": 150000,
    "comments": 5000,
    "shares": 10000
  },
  "duration": 45,
  "createTime": "2024-01-15T10:30:00.000Z",
  "music": {
    "title": "Original Sound",
    "author": "nextleveldj"
  }
}
```

---

### Download TikTok Video

Download a TikTok video with quality selection.

```http
GET /api/tiktok/download?url={encodedUrl}&quality={quality}
```

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| url | string | Yes | - | URL-encoded TikTok video URL |
| quality | string | No | best | Video quality |

**Quality Options:**
| Value | Description |
|-------|-------------|
| `best` | Best available |
| `1080` | 1080p if available |
| `720` | 720p |
| `480` | 480p |
| `audio` | Audio only |

**Example:**
```bash
curl -OJ "http://localhost:3001/api/tiktok/download?url=https%3A%2F%2Fwww.tiktok.com%2F%40user%2Fvideo%2F123&quality=720"
```

**Response:** Binary video file stream

---

### Sync TikTok Videos to Database

Sync profile videos to the database.

```http
POST /api/tiktok/sync
```

**Request Body:**
```json
{
  "username": "nextleveldj",
  "limit": 100
}
```

**Response:**
```json
{
  "success": true,
  "synced": 100,
  "new": 25,
  "updated": 75,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Get Synced TikTok Videos

Retrieve TikTok videos from database.

```http
GET /api/tiktok/videos
```

**Query Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| limit | number | No | 50 | Max videos to return |
| offset | number | No | 0 | Pagination offset |
| sortBy | string | No | views | Sort field |
| order | string | No | desc | Sort order (asc/desc) |

**Response:**
```json
{
  "videos": [
    {
      "id": "1234567890",
      "username": "nextleveldj",
      "title": "Video description",
      "views": 1500000,
      "likes": 150000,
      "comments": 5000,
      "shares": 10000,
      "duration": 45,
      "uploadDate": "2024-01-15",
      "url": "https://www.tiktok.com/@nextleveldj/video/1234567890",
      "thumbnail": "https://..."
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

## Instagram API

Base URL: `http://localhost:3002`

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

### Get All Videos

Retrieve all Instagram videos from database.

```http
GET /api/videos
```

**Response:**
```json
{
  "videos": [
    {
      "shortcode": "ABC123xyz",
      "thumbnail": "https://...",
      "caption": "Check out this track!",
      "views": 50000,
      "likes": 5000,
      "comments": 200,
      "duration": 30.5,
      "timestamp": 1705312200,
      "type": "video",
      "url": "https://www.instagram.com/reel/ABC123xyz/",
      "video_url": "https://..."
    }
  ],
  "lastUpdate": "2024-01-15T10:30:00.000Z"
}
```

---

### Refresh Instagram Data

Trigger a refresh of Instagram data using instaloader.

```http
POST /api/refresh
```

**Request Body:**
```json
{
  "username": "nextleveldj"
}
```

**Response:**
```json
{
  "success": true,
  "videosUpdated": 50,
  "newVideos": 5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Download Instagram Video

Download an Instagram video by shortcode.

```http
GET /api/download?shortcode={shortcode}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| shortcode | string | Yes | Instagram post shortcode |

**Example:**
```bash
curl -OJ "http://localhost:3002/api/download?shortcode=ABC123xyz"
```

**Response:** Binary video file stream

---

## Error Handling

### Error Response Format

All API errors follow this format:

```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": "Additional error details (optional)"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VIDEO_NOT_FOUND` | 404 | Video doesn't exist or is private |
| `INVALID_URL` | 400 | Malformed URL parameter |
| `DOWNLOAD_ERROR` | 500 | yt-dlp failed to download |
| `RATE_LIMITED` | 429 | Too many requests |
| `YTDLP_NOT_FOUND` | 500 | yt-dlp not installed |
| `FFMPEG_NOT_FOUND` | 500 | ffmpeg not installed |
| `DATABASE_ERROR` | 500 | Database connection failed |
| `INVALID_QUALITY` | 400 | Unknown quality parameter |

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

### Current Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/download` | 10 requests | per minute |
| `/api/info` | 30 requests | per minute |
| `/api/tiktok/*` | 20 requests | per minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1705312260
```

### Rate Limit Response

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMITED",
  "retryAfter": 45
}
```

---

## CORS Configuration

### Allowed Origins

**Development:**
- `http://localhost:3000`
- `http://localhost:3003`
- `http://localhost:5173`
- `http://localhost:5174`

**Production:**
- `https://*.vercel.app`
- Custom domains as configured

### CORS Headers

```http
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## Frontend Integration Examples

### Fetch Video Info

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_DOWNLOAD_API_URL;

async function getVideoInfo(videoId: string) {
  const response = await axios.get(`${API_URL}/api/info`, {
    params: { videoId }
  });
  return response.data;
}
```

### Download Video with Progress

```typescript
async function downloadVideo(
  videoId: string,
  quality: string,
  onProgress: (percent: number) => void
) {
  const response = await axios.get(`${API_URL}/api/download`, {
    params: { videoId, quality },
    responseType: 'blob',
    onDownloadProgress: (event) => {
      if (event.total) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    }
  });

  // Create download link
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `video_${videoId}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Validate TikTok URL

```typescript
async function validateTikTokUrl(url: string): Promise<boolean> {
  try {
    const response = await axios.post(`${API_URL}/api/tiktok/validate`, {
      url
    });
    return response.data.valid;
  } catch {
    return false;
  }
}
```

---

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [Setup Guide](SETUP.md) - Installation
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
