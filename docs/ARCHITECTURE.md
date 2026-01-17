# Architecture Documentation

This document describes the system architecture, design patterns, and technical decisions of the YouTube App.

## Table of Contents
- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Tech Stack](#tech-stack)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Service Layer](#service-layer)

---

## System Overview

The YouTube App is a multi-platform video analysis tool consisting of:

1. **YouTube Analyzer** - React SPA with Express backend
2. **Instagram Analyzer** - Express server with Python integration
3. **Shared Database** - Neon PostgreSQL (serverless)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUTUBE APP                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │ YouTube Analyzer │    │ Instagram Analyzer│    │ Neon Database │ │
│  │  (React + Node)  │    │  (Node + Python)  │    │  (PostgreSQL) │ │
│  └──────────────────┘    └──────────────────┘    └───────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     REACT FRONTEND (Vite)                            │   │
│   │                        Port: 5173                                    │   │
│   ├─────────────────────────────────────────────────────────────────────┤   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │   │
│   │   │   Pages     │  │  Contexts   │  │   Hooks     │  │ Services  │ │   │
│   │   │             │  │             │  │             │  │           │ │   │
│   │   │ - Home      │  │ - Auth      │  │ - useVideos │  │ - youtube │ │   │
│   │   │ - YouTube   │  │ - Video     │  │ - useFilter │  │ - neon    │ │   │
│   │   │ - TikTok    │  │ - Filter    │  │ - useSelect │  │ - cobalt  │ │   │
│   │   │ - Instagram │  │ - Selection │  │ - useDownld │  │ - tiktok  │ │   │
│   │   │ - Login     │  │ - Download  │  │             │  │ - storage │ │   │
│   │   │             │  │ - TikTok    │  │             │  │           │ │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ HTTP/REST                               │
│                                    ▼                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────────────────────┐    ┌───────────────────────────────┐   │
│   │   YOUTUBE DOWNLOAD SERVER     │    │   INSTAGRAM SERVER            │   │
│   │        Port: 3001             │    │        Port: 3002             │   │
│   ├───────────────────────────────┤    ├───────────────────────────────┤   │
│   │                               │    │                               │   │
│   │  Express.js + TypeScript      │    │  Express.js + JavaScript      │   │
│   │                               │    │                               │   │
│   │  Routes:                      │    │  Routes:                      │   │
│   │  ├─ /health                   │    │  ├─ /health                   │   │
│   │  ├─ /api/check                │    │  ├─ /api/videos               │   │
│   │  ├─ /api/info                 │    │  ├─ /api/refresh              │   │
│   │  ├─ /api/download             │    │  └─ /api/download             │   │
│   │  ├─ /api/formats              │    │                               │   │
│   │  └─ /api/tiktok/*             │    │  Dependencies:                │   │
│   │                               │    │  ├─ pg (PostgreSQL)           │   │
│   │  Dependencies:                │    │  └─ instaloader (Python)      │   │
│   │  ├─ yt-dlp (CLI)              │    │                               │   │
│   │  └─ ffmpeg (CLI)              │    │                               │   │
│   │                               │    │                               │   │
│   └───────────────────────────────┘    └───────────────────────────────┘   │
│                │                                    │                        │
│                │                                    │                        │
│                └────────────────┬───────────────────┘                        │
│                                 │                                            │
│                                 ▼                                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐  │
│   │   NEON DATABASE   │  │   YOUTUBE API     │  │   TIKTOK / INSTAGRAM  │  │
│   │   (PostgreSQL)    │  │   (Data API v3)   │  │   (Web Scraping)      │  │
│   ├───────────────────┤  ├───────────────────┤  ├───────────────────────┤  │
│   │                   │  │                   │  │                       │  │
│   │ Tables:           │  │ Endpoints:        │  │ TikTok:               │  │
│   │ ├─ channels       │  │ ├─ channels       │  │ ├─ Profile scraping   │  │
│   │ ├─ videos         │  │ ├─ playlistItems  │  │ └─ Video download     │  │
│   │ ├─ metrics_history│  │ └─ videos         │  │                       │  │
│   │ └─ instagram_vids │  │                   │  │ Instagram:            │  │
│   │                   │  │ Quota: 10k/day    │  │ └─ instaloader        │  │
│   │                   │  │                   │  │                       │  │
│   └───────────────────┘  └───────────────────┘  └───────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 4.4.x | Build tool |
| Tailwind CSS | 3.x | Styling |
| React Router | 7.x | Routing |
| Axios | 1.x | HTTP client |
| Recharts | 2.x | Charts |
| Lucide React | 0.x | Icons |
| date-fns | 2.x | Date utilities |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18-20.x | Runtime |
| Express | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| yt-dlp | latest | Video download |
| FFmpeg | latest | Video processing |
| pg | 8.x | PostgreSQL client |

### Database
| Technology | Purpose |
|------------|---------|
| Neon PostgreSQL | Serverless database |
| @neondatabase/serverless | Client SDK |

### DevOps
| Technology | Purpose |
|------------|---------|
| Vercel | Frontend hosting |
| Docker | Backend containerization |
| Railway | Backend hosting (optional) |

---

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ui/                 # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   └── ProgressBar.tsx
│   │
│   ├── video/              # Video display
│   │   ├── VideoCard.tsx
│   │   ├── VideoGrid.tsx
│   │   ├── VideoList.tsx
│   │   ├── VideoListItem.tsx
│   │   ├── VideoStats.tsx
│   │   ├── VideoThumbnail.tsx
│   │   ├── ViewToggle.tsx
│   │   └── EmptyState.tsx
│   │
│   ├── filters/            # Filter controls
│   │   ├── FilterBar.tsx
│   │   ├── DurationFilter.tsx
│   │   ├── KeywordFilter.tsx
│   │   ├── DateFilter.tsx
│   │   ├── DateRangePicker.tsx
│   │   └── SortFilter.tsx
│   │
│   ├── download/           # Download management
│   │   ├── DownloadButton.tsx
│   │   ├── DownloadModal.tsx
│   │   ├── DownloadProgress.tsx
│   │   ├── DownloadQueue.tsx
│   │   ├── SelectionBar.tsx
│   │   └── SmartSelectButtons.tsx
│   │
│   ├── tiktok/             # TikTok integration
│   │   ├── TikTokVideoCard.tsx
│   │   ├── TikTokVideoGrid.tsx
│   │   ├── TikTokFilterBar.tsx
│   │   ├── TikTokDownloadModal.tsx
│   │   └── TikTokSelectionControls.tsx
│   │
│   ├── sync/               # Database sync
│   │   ├── SyncButton.tsx
│   │   └── SyncStatus.tsx
│   │
│   └── charts/             # Data visualization
│       └── MetricsChart.tsx
│
├── contexts/               # State management
│   ├── AuthContext.tsx
│   ├── VideoContext.tsx
│   ├── FilterContext.tsx
│   ├── SelectionContext.tsx
│   ├── DownloadContext.tsx
│   └── TikTokContext.tsx
│
├── hooks/                  # Custom hooks
│   ├── useVideos.ts
│   ├── useFilters.ts
│   ├── useDownload.ts
│   ├── useSelection.ts
│   └── useMetricsHistory.ts
│
├── services/               # API services
│   ├── youtube.service.ts
│   ├── neon.service.ts
│   ├── cobalt.service.ts
│   ├── tiktok.service.ts
│   └── storage.service.ts
│
├── pages/                  # Route pages
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── YouTubePage.tsx
│   ├── TikTokPage.tsx
│   └── InstagramPage.tsx
│
├── types/                  # TypeScript types
│   ├── video.ts
│   ├── api.ts
│   ├── download.ts
│   ├── filter.ts
│   └── database.ts
│
├── constants/              # App constants
│   ├── api.ts
│   ├── ui.ts
│   └── filters.ts
│
├── utils/                  # Utilities
│   ├── filename.utils.ts
│   ├── date.utils.ts
│   └── number.utils.ts
│
├── layouts/                # Layout components
│   └── Header.tsx
│
├── App.tsx                 # Root component
└── main.tsx                # Entry point
```

### Provider Hierarchy

```
<BrowserRouter>
  <AuthProvider>                    // Authentication state
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/youtube" element={
        <VideoProvider>             // YouTube video data
          <FilterProvider>          // Filtering logic
            <SelectionProvider>     // Video selection
              <DownloadProvider>    // Download queue
                <YouTubePage />
              </DownloadProvider>
            </SelectionProvider>
          </FilterProvider>
        </VideoProvider>
      } />
      <Route path="/tiktok" element={
        <TikTokProvider>            // TikTok-specific state
          <TikTokPage />
        </TikTokProvider>
      } />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

---

## Backend Architecture

### YouTube Download Server (Port 3001)

```
server/
├── index.ts                # Express app entry
├── routes/
│   ├── download.ts         # YouTube download routes
│   └── tiktok.ts           # TikTok routes
└── services/
    ├── ytdlp.service.ts    # yt-dlp wrapper
    └── tiktok.service.ts   # TikTok API integration
```

### Route Structure

```typescript
// Health check
GET /health

// YouTube endpoints
GET /api/check              // Verify yt-dlp/ffmpeg
GET /api/info?videoId=      // Get video metadata
GET /api/download?videoId=&quality=  // Download video
GET /api/formats?videoId=   // Available formats

// TikTok endpoints
POST /api/tiktok/validate   // Validate URL
POST /api/tiktok/profile    // Fetch profile videos
GET /api/tiktok/info?url=   // Get video info
GET /api/tiktok/download?url=&quality=  // Download
```

### Instagram Server (Port 3002)

```
instagram-analyzer/
├── server/
│   └── index.js            # Express app
├── public/                 # Static frontend
└── venv/                   # Python environment
```

---

## Data Flow

### Video Loading Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO LOADING SEQUENCE                        │
└─────────────────────────────────────────────────────────────────┘

User Opens App
      │
      ▼
┌─────────────────┐
│ Check Database  │ ──────────────────┐
└─────────────────┘                   │
      │                               │
      │ Success                       │ Failure
      ▼                               ▼
┌─────────────────┐           ┌─────────────────┐
│ Return Videos   │           │ Check Cache     │
└─────────────────┘           └─────────────────┘
                                      │
                              ┌───────┴───────┐
                              │               │
                        Has Cache        No Cache
                              │               │
                              ▼               ▼
                      ┌───────────┐   ┌───────────────┐
                      │ Use Cache │   │ YouTube API   │
                      └───────────┘   └───────────────┘
                                              │
                                              ▼
                                      ┌───────────────┐
                                      │ Cache Results │
                                      └───────────────┘
```

### Download Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOWNLOAD SEQUENCE                             │
└─────────────────────────────────────────────────────────────────┘

User Clicks Download
      │
      ▼
┌─────────────────────┐
│ Create Queue Items  │
│ (selectedVideos)    │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Process Queue       │ ◄──────────────────┐
│ (Sequential)        │                    │
└─────────────────────┘                    │
      │                                    │
      ▼                                    │
┌─────────────────────┐                    │
│ Request Download    │                    │
│ from Backend        │                    │
└─────────────────────┘                    │
      │                                    │
      ▼                                    │
┌─────────────────────┐                    │
│ Backend: yt-dlp     │                    │
│ Downloads Video     │                    │
└─────────────────────┘                    │
      │                                    │
      ▼                                    │
┌─────────────────────┐                    │
│ Stream to Browser   │                    │
│ with Progress       │                    │
└─────────────────────┘                    │
      │                                    │
      ▼                                    │
┌─────────────────────┐      More items?   │
│ Update Queue Status │ ───────────────────┘
└─────────────────────┘        Yes
      │
      │ No
      ▼
┌─────────────────────┐
│ Generate CSV        │
│ (Metadata Export)   │
└─────────────────────┘
```

---

## State Management

### Context Pattern

Each context follows this pattern:

```typescript
// 1. Define State Interface
interface VideoState {
  videos: Video[];
  isLoading: boolean;
  error: string | null;
}

// 2. Define Context Interface
interface VideoContextType extends VideoState {
  fetchVideos: () => Promise<void>;
  syncWithYouTube: () => Promise<void>;
}

// 3. Create Context
const VideoContext = createContext<VideoContextType | undefined>(undefined);

// 4. Create Provider
export function VideoProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchVideos = useCallback(async () => {
    // Implementation
  }, []);

  const value = useMemo(() => ({
    videos,
    isLoading,
    fetchVideos,
  }), [videos, isLoading, fetchVideos]);

  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  );
}

// 5. Create Hook
export function useVideos() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideos must be used within VideoProvider');
  }
  return context;
}
```

### Context Dependencies

```
AuthContext (independent)
     │
     ▼
VideoContext (depends on Auth for API calls)
     │
     ▼
FilterContext (depends on VideoContext.videos)
     │
     ▼
SelectionContext (depends on FilterContext.filteredVideos)
     │
     ▼
DownloadContext (depends on SelectionContext.selectedVideos)
```

---

## Service Layer

### YouTube Service

```typescript
// youtube.service.ts
export const youtubeService = {
  // Get channel info by handle
  getChannelByHandle(handle: string): Promise<ChannelInfo>

  // Get videos from channel
  getChannelVideos(channelId: string, limit?: number): Promise<Video[]>

  // Get video details by IDs
  getVideoDetails(videoIds: string[]): Promise<Video[]>
};
```

### Neon Service

```typescript
// neon.service.ts
export const neonService = {
  // Sync videos to database
  syncVideos(handle: string): Promise<SyncResult>

  // Get videos from database
  getVideos(): Promise<Video[]>

  // Get metrics history
  getMetricsHistory(videoId: string, days: number): Promise<MetricsSnapshot[]>

  // Check database health
  checkHealth(): Promise<boolean>
};
```

### Storage Service

```typescript
// storage.service.ts
export const storageService = {
  // Cache management
  cacheVideos(videos: Video[]): void
  getCachedVideos(): Video[] | null

  cacheChannelInfo(info: ChannelInfo): void
  getCachedChannelInfo(): ChannelInfo | null

  // Cache expiry: 30 days
  isCacheValid(): boolean
  clearCache(): void
};
```

---

## Design Decisions

### Why Context API over Redux?

1. **Simpler Setup** - No boilerplate, no actions/reducers
2. **Type Safety** - Better TypeScript integration
3. **Scoped State** - Each context handles specific domain
4. **Performance** - useMemo prevents unnecessary re-renders

### Why yt-dlp over Direct API?

1. **Quality Options** - Supports all formats/qualities
2. **No Rate Limits** - Unlike official API
3. **Audio Extraction** - Can extract audio only
4. **Reliability** - Community maintained, updated frequently

### Why Neon PostgreSQL?

1. **Serverless** - Scales automatically
2. **Free Tier** - Generous for development
3. **PostgreSQL** - Full SQL support
4. **Branching** - Database branches for testing

### Why Vite over CRA?

1. **Speed** - 10-100x faster HMR
2. **Modern** - ESM-first approach
3. **Simple Config** - Minimal setup required
4. **TypeScript** - Native support

---

## Security Considerations

### Current Implementation (Development)

- **Hardcoded credentials** - For testing only
- **No token authentication** - Session stored in localStorage
- **Open CORS** - Allows multiple origins

### Production Recommendations

1. Implement proper authentication (JWT/OAuth)
2. Use environment-based CORS configuration
3. Add rate limiting to API endpoints
4. Implement API key rotation
5. Use HTTPS everywhere
6. Add input validation/sanitization

---

## Performance Optimizations

### Frontend

1. **Memoization** - useMemo for filtered videos
2. **Lazy Loading** - Code splitting per route
3. **Virtual Lists** - For large video lists (planned)
4. **Image Optimization** - Thumbnail lazy loading

### Backend

1. **Sequential Downloads** - Prevents overload
2. **Streaming** - Direct file streaming to browser
3. **Temp Cleanup** - Automatic temp file removal

### Database

1. **Connection Pooling** - Via Neon serverless driver
2. **Indexed Queries** - On frequently accessed columns
3. **Batch Operations** - For sync operations

---

## Related Documentation

- [Setup Guide](SETUP.md) - Installation instructions
- [API Reference](API.md) - Endpoint documentation
- [Components Guide](COMPONENTS.md) - Frontend components
- [Database Schema](DATABASE.md) - Data model
