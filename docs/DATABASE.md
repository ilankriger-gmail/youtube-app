# Database Schema

Documentation of the Neon PostgreSQL database structure.

## Table of Contents
- [Overview](#overview)
- [Connection Configuration](#connection-configuration)
- [Table Schemas](#table-schemas)
- [Entity Relationships](#entity-relationships)
- [Indexes](#indexes)
- [Common Queries](#common-queries)
- [Data Sync Workflow](#data-sync-workflow)

---

## Overview

The application uses **Neon PostgreSQL**, a serverless PostgreSQL database with:
- Automatic scaling
- Connection pooling
- Database branching
- Point-in-time recovery

### Database Structure

```
neondb
├── channels            # YouTube channel information
├── videos              # YouTube video metadata
├── metrics_history     # Historical metrics snapshots
└── instagram_videos    # Instagram video data
```

---

## Connection Configuration

### Connection String Format

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

### Example

```
postgresql://neondb_owner:abc123@ep-cool-star-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Using the Neon Serverless Driver

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Simple query
const result = await sql`SELECT * FROM videos LIMIT 10`;

// Parameterized query
const videoId = 'dQw4w9WgXcQ';
const video = await sql`SELECT * FROM videos WHERE id = ${videoId}`;
```

### Connection Pooling

For high-traffic applications, use the pooled connection:

```typescript
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const client = await pool.connect();
try {
  const result = await client.query('SELECT * FROM videos');
  return result.rows;
} finally {
  client.release();
}
```

---

## Table Schemas

### channels

Stores YouTube channel information.

```sql
CREATE TABLE channels (
    -- Primary key: YouTube channel ID
    id VARCHAR(50) PRIMARY KEY,

    -- Channel metadata
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,

    -- Statistics
    subscriber_count BIGINT DEFAULT 0,
    video_count INTEGER DEFAULT 0,

    -- YouTube-specific
    uploads_playlist_id VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Column Details:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(50) | No | YouTube channel ID (e.g., UCuAXFkgsw1L7xaCfnd5JJOw) |
| title | VARCHAR(255) | No | Channel display name |
| description | TEXT | Yes | Channel description |
| thumbnail_url | TEXT | Yes | Channel avatar URL |
| subscriber_count | BIGINT | Yes | Number of subscribers |
| video_count | INTEGER | Yes | Total videos on channel |
| uploads_playlist_id | VARCHAR(50) | Yes | Playlist ID for all uploads |
| created_at | TIMESTAMP | Yes | Row creation time |
| updated_at | TIMESTAMP | Yes | Last update time |

---

### videos

Stores YouTube video metadata and statistics.

```sql
CREATE TABLE videos (
    -- Primary key: YouTube video ID
    id VARCHAR(50) PRIMARY KEY,

    -- Foreign key to channel
    channel_id VARCHAR(50) REFERENCES channels(id),

    -- Video metadata
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Thumbnails (multiple sizes)
    thumbnail_url TEXT,          -- Default (120x90)
    thumbnail_medium_url TEXT,   -- Medium (320x180)
    thumbnail_high_url TEXT,     -- High (480x360)

    -- Video properties
    duration INTEGER DEFAULT 0,   -- Duration in seconds
    is_short BOOLEAN DEFAULT FALSE,

    -- Statistics
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,

    -- Timestamps
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Column Details:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(50) | No | YouTube video ID (11 chars) |
| channel_id | VARCHAR(50) | Yes | Reference to channels.id |
| title | VARCHAR(500) | No | Video title |
| description | TEXT | Yes | Video description |
| thumbnail_url | TEXT | Yes | Default thumbnail (120x90) |
| thumbnail_medium_url | TEXT | Yes | Medium thumbnail (320x180) |
| thumbnail_high_url | TEXT | Yes | High quality thumbnail |
| duration | INTEGER | Yes | Duration in seconds |
| is_short | BOOLEAN | Yes | True if duration < 60s |
| view_count | BIGINT | Yes | Total views |
| like_count | BIGINT | Yes | Total likes |
| comment_count | BIGINT | Yes | Total comments |
| published_at | TIMESTAMP | Yes | Video publish date |
| created_at | TIMESTAMP | Yes | Row creation time |
| updated_at | TIMESTAMP | Yes | Last update time |

---

### metrics_history

Tracks historical metrics for growth analysis.

```sql
CREATE TABLE metrics_history (
    -- Auto-increment primary key
    id SERIAL PRIMARY KEY,

    -- Foreign key to video
    video_id VARCHAR(50) REFERENCES videos(id) ON DELETE CASCADE,

    -- Metrics snapshot
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,

    -- Timestamp
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Column Details:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | SERIAL | No | Auto-increment ID |
| video_id | VARCHAR(50) | Yes | Reference to videos.id |
| view_count | BIGINT | Yes | Views at record time |
| like_count | BIGINT | Yes | Likes at record time |
| comment_count | BIGINT | Yes | Comments at record time |
| recorded_at | TIMESTAMP | Yes | When snapshot was taken |

---

### instagram_videos

Stores Instagram video/reel data.

```sql
CREATE TABLE instagram_videos (
    -- Primary key: Instagram shortcode
    shortcode VARCHAR(50) PRIMARY KEY,

    -- Media information
    thumbnail TEXT,
    caption VARCHAR(500),
    caption_full TEXT,

    -- Statistics
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,

    -- Video properties
    duration FLOAT DEFAULT 0,
    timestamp BIGINT,            -- Unix timestamp
    type VARCHAR(20),            -- 'video', 'reel', 'igtv'

    -- URLs
    url TEXT,                    -- Instagram post URL
    video_url TEXT,              -- Direct video URL

    -- Timestamps
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Column Details:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| shortcode | VARCHAR(50) | No | Instagram post ID |
| thumbnail | TEXT | Yes | Thumbnail URL |
| caption | VARCHAR(500) | Yes | Truncated caption |
| caption_full | TEXT | Yes | Full caption text |
| views | INTEGER | Yes | View count |
| likes | INTEGER | Yes | Like count |
| comments | INTEGER | Yes | Comment count |
| duration | FLOAT | Yes | Duration in seconds |
| timestamp | BIGINT | Yes | Unix timestamp |
| type | VARCHAR(20) | Yes | Content type |
| url | TEXT | Yes | Post URL |
| video_url | TEXT | Yes | Direct video URL |
| updated_at | TIMESTAMP | Yes | Last update time |

---

## Entity Relationships

### ERD (ASCII)

```
┌─────────────────┐
│    channels     │
├─────────────────┤
│ PK id           │◄────────────────────────┐
│    title        │                         │
│    description  │                         │
│    thumbnail_url│                         │
│    subscriber_  │                         │
│      count      │                         │
│    video_count  │                         │
│    uploads_     │                         │
│      playlist_id│                         │
│    created_at   │                         │
│    updated_at   │                         │
└─────────────────┘                         │
                                            │
┌─────────────────┐         ┌───────────────┴───────┐
│ metrics_history │         │        videos         │
├─────────────────┤         ├───────────────────────┤
│ PK id           │         │ PK id                 │
│ FK video_id     │────────►│ FK channel_id         │
│    view_count   │         │    title              │
│    like_count   │         │    description        │
│    comment_count│         │    thumbnail_url      │
│    recorded_at  │         │    thumbnail_medium_  │
└─────────────────┘         │      url              │
                            │    thumbnail_high_url │
                            │    duration           │
                            │    is_short           │
                            │    view_count         │
                            │    like_count         │
                            │    comment_count      │
                            │    published_at       │
                            │    created_at         │
                            │    updated_at         │
                            └───────────────────────┘

┌─────────────────────┐
│  instagram_videos   │
├─────────────────────┤
│ PK shortcode        │
│    thumbnail        │
│    caption          │
│    caption_full     │
│    views            │
│    likes            │
│    comments         │
│    duration         │
│    timestamp        │
│    type             │
│    url              │
│    video_url        │
│    updated_at       │
└─────────────────────┘
```

### Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| channels → videos | 1:N | One channel has many videos |
| videos → metrics_history | 1:N | One video has many metric snapshots |
| instagram_videos | Standalone | No foreign key relationships |

---

## Indexes

### Performance Indexes

```sql
-- Channels indexes
CREATE INDEX idx_channels_title ON channels(title);

-- Videos indexes
CREATE INDEX idx_videos_channel ON videos(channel_id);
CREATE INDEX idx_videos_published ON videos(published_at DESC);
CREATE INDEX idx_videos_views ON videos(view_count DESC);
CREATE INDEX idx_videos_is_short ON videos(is_short);

-- Metrics history indexes
CREATE INDEX idx_metrics_video ON metrics_history(video_id);
CREATE INDEX idx_metrics_recorded ON metrics_history(recorded_at DESC);

-- Instagram videos indexes
CREATE INDEX idx_instagram_views ON instagram_videos(views DESC);
CREATE INDEX idx_instagram_timestamp ON instagram_videos(timestamp DESC);
```

### Composite Indexes

```sql
-- For filtered queries
CREATE INDEX idx_videos_channel_published
ON videos(channel_id, published_at DESC);

-- For metrics range queries
CREATE INDEX idx_metrics_video_recorded
ON metrics_history(video_id, recorded_at DESC);
```

---

## Common Queries

### Get All Videos with Channel Info

```sql
SELECT
    v.*,
    c.title as channel_title,
    c.thumbnail_url as channel_thumbnail
FROM videos v
LEFT JOIN channels c ON v.channel_id = c.id
ORDER BY v.published_at DESC;
```

### Get Videos with Filters

```sql
-- By duration (Shorts only)
SELECT * FROM videos
WHERE is_short = true
ORDER BY view_count DESC;

-- By date range (last 30 days)
SELECT * FROM videos
WHERE published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY published_at DESC;

-- By keyword search
SELECT * FROM videos
WHERE title ILIKE '%remix%' OR description ILIKE '%remix%'
ORDER BY view_count DESC;
```

### Get Top Performing Videos

```sql
SELECT * FROM videos
ORDER BY view_count DESC
LIMIT 10;
```

### Get Metrics History

```sql
SELECT
    recorded_at,
    view_count,
    like_count,
    comment_count
FROM metrics_history
WHERE video_id = 'dQw4w9WgXcQ'
    AND recorded_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY recorded_at ASC;
```

### Calculate View Growth

```sql
WITH first_last AS (
    SELECT
        video_id,
        FIRST_VALUE(view_count) OVER (
            PARTITION BY video_id
            ORDER BY recorded_at ASC
        ) as first_views,
        LAST_VALUE(view_count) OVER (
            PARTITION BY video_id
            ORDER BY recorded_at ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) as last_views
    FROM metrics_history
    WHERE recorded_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
)
SELECT
    video_id,
    MAX(last_views) - MIN(first_views) as view_growth
FROM first_last
GROUP BY video_id
ORDER BY view_growth DESC;
```

### Upsert Video

```sql
INSERT INTO videos (
    id, channel_id, title, description,
    thumbnail_url, duration, view_count,
    like_count, comment_count, published_at, is_short
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    view_count = EXCLUDED.view_count,
    like_count = EXCLUDED.like_count,
    comment_count = EXCLUDED.comment_count,
    updated_at = CURRENT_TIMESTAMP;
```

### Record Metrics Snapshot

```sql
INSERT INTO metrics_history (video_id, view_count, like_count, comment_count)
VALUES ($1, $2, $3, $4);
```

### Get Instagram Videos

```sql
SELECT * FROM instagram_videos
ORDER BY views DESC;
```

### Upsert Instagram Video

```sql
INSERT INTO instagram_videos (
    shortcode, thumbnail, caption, caption_full,
    views, likes, comments, duration,
    timestamp, type, url, video_url
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
ON CONFLICT (shortcode) DO UPDATE SET
    views = EXCLUDED.views,
    likes = EXCLUDED.likes,
    comments = EXCLUDED.comments,
    updated_at = CURRENT_TIMESTAMP;
```

---

## Data Sync Workflow

### YouTube Sync Process

```
┌──────────────────────────────────────────────────────────────┐
│                    YOUTUBE SYNC WORKFLOW                      │
└──────────────────────────────────────────────────────────────┘

1. User clicks "Sync" button
         │
         ▼
2. Fetch channel info from YouTube API
         │
         ▼
3. Upsert channel record in database
         │
         ▼
4. Fetch video IDs from uploads playlist
         │
         ▼
5. Fetch video details in batches of 50
         │
         ▼
6. For each video:
   ├─ Upsert video record
   └─ Insert metrics snapshot
         │
         ▼
7. Update cache in localStorage
         │
         ▼
8. Return sync result to frontend
```

### Sync Code Example

```typescript
async function syncVideos(handle: string): Promise<SyncResult> {
  // 1. Get channel info
  const channel = await youtubeService.getChannelByHandle(handle);

  // 2. Upsert channel
  await sql`
    INSERT INTO channels (id, title, description, thumbnail_url,
      subscriber_count, video_count, uploads_playlist_id)
    VALUES (${channel.id}, ${channel.title}, ${channel.description},
      ${channel.thumbnailUrl}, ${channel.subscriberCount},
      ${channel.videoCount}, ${channel.uploadsPlaylistId})
    ON CONFLICT (id) DO UPDATE SET
      subscriber_count = EXCLUDED.subscriber_count,
      video_count = EXCLUDED.video_count,
      updated_at = CURRENT_TIMESTAMP
  `;

  // 3. Get video IDs
  const videoIds = await youtubeService.getPlaylistVideos(
    channel.uploadsPlaylistId,
    500
  );

  // 4. Get video details
  const videos = await youtubeService.getVideoDetails(videoIds);

  // 5. Upsert videos and record metrics
  for (const video of videos) {
    await sql`
      INSERT INTO videos (...)
      VALUES (...)
      ON CONFLICT (id) DO UPDATE SET ...
    `;

    await sql`
      INSERT INTO metrics_history (video_id, view_count, like_count, comment_count)
      VALUES (${video.id}, ${video.viewCount}, ${video.likeCount}, ${video.commentCount})
    `;
  }

  return {
    channelId: channel.id,
    videosSynced: videos.length,
    timestamp: new Date(),
  };
}
```

---

## Database Maintenance

### Cleanup Old Metrics

Keep only last 90 days of metrics history:

```sql
DELETE FROM metrics_history
WHERE recorded_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
```

### Vacuum and Analyze

```sql
VACUUM ANALYZE videos;
VACUUM ANALYZE metrics_history;
```

### Check Table Sizes

```sql
SELECT
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Neon-Specific Features

### Database Branching

Create a development branch:

```bash
# Using Neon CLI
neonctl branches create --name dev --project-id your-project-id
```

### Point-in-Time Recovery

```bash
# Restore to specific timestamp
neonctl branches create \
  --name recovery \
  --project-id your-project-id \
  --parent main \
  --timestamp "2024-01-15T10:00:00Z"
```

### Connection Limits

Neon Free Tier:
- Concurrent connections: 100 (pooled)
- Compute hours: 191.9 hours/month
- Storage: 512 MB

---

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [Setup Guide](SETUP.md) - Database setup
- [API Reference](API.md) - Endpoint documentation
