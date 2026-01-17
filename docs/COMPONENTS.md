# Components Guide

Comprehensive documentation of React components, contexts, hooks, and services.

## Table of Contents
- [Component Architecture](#component-architecture)
- [Context Providers](#context-providers)
- [Custom Hooks](#custom-hooks)
- [Services Layer](#services-layer)
- [UI Components](#ui-components)
- [Feature Components](#feature-components)

---

## Component Architecture

### Directory Structure

```
src/
├── components/
│   ├── ui/                 # Reusable UI primitives
│   ├── video/              # Video display components
│   ├── filters/            # Filter controls
│   ├── download/           # Download management
│   ├── tiktok/             # TikTok-specific
│   ├── sync/               # Database sync
│   └── charts/             # Data visualization
├── contexts/               # State providers
├── hooks/                  # Custom hooks
├── services/               # API services
├── pages/                  # Route pages
├── types/                  # TypeScript types
├── constants/              # App constants
└── utils/                  # Utilities
```

### Component Hierarchy

```
App
└── BrowserRouter
    └── AuthProvider
        └── Routes
            ├── /login → LoginPage
            ├── / → HomePage
            ├── /youtube → YouTubePage
            │   └── VideoProvider
            │       └── FilterProvider
            │           └── SelectionProvider
            │               └── DownloadProvider
            │                   └── MainLayout
            │                       ├── Header
            │                       │   ├── SyncButton
            │                       │   └── SyncStatus
            │                       └── MainContent
            │                           ├── FilterBar
            │                           ├── VideoGrid/VideoList
            │                           │   └── VideoCard[]
            │                           ├── SelectionBar
            │                           │   └── SmartSelectButtons
            │                           └── DownloadModal
            │                               └── DownloadQueue
            └── /tiktok → TikTokPage
                └── TikTokProvider
                    └── TikTokContent
```

---

## Context Providers

### AuthContext

Manages user authentication state.

**Location:** `src/contexts/AuthContext.tsx`

**State:**
```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: { email: string } | null;
  isLoading: boolean;
}
```

**Methods:**
```typescript
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}
```

**Usage:**
```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { isAuthenticated, user, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm onSubmit={login} />;
  }

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Notes:**
- Credentials are currently hardcoded (development only)
- Session persisted in localStorage
- Automatically checks session on mount

---

### VideoContext

Manages YouTube video data and synchronization.

**Location:** `src/contexts/VideoContext.tsx`

**State:**
```typescript
interface VideoState {
  videos: Video[];
  channelInfo: ChannelInfo | null;
  isLoading: boolean;
  error: string | null;
  lastSync: Date | null;
  dataSource: 'database' | 'cache' | 'api' | null;
}
```

**Methods:**
```typescript
interface VideoContextType extends VideoState {
  fetchVideos: () => Promise<void>;
  syncWithYouTube: () => Promise<void>;
  refreshFromDatabase: () => Promise<void>;
}
```

**Data Loading Priority:**
1. **Database (Neon)** - Primary source
2. **LocalStorage Cache** - Fallback for offline
3. **YouTube API** - Fresh data when needed

**Usage:**
```tsx
import { useVideos } from '../contexts/VideoContext';

function VideoDisplay() {
  const { videos, isLoading, syncWithYouTube } = useVideos();

  if (isLoading) return <Spinner />;

  return (
    <div>
      <button onClick={syncWithYouTube}>Sync</button>
      {videos.map(video => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
```

---

### FilterContext

Manages video filtering and sorting.

**Location:** `src/contexts/FilterContext.tsx`

**State:**
```typescript
interface FilterState {
  duration: 'short' | 'long' | 'all';
  keyword: string;
  dateRange: 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  customDateRange: { start: Date; end: Date } | null;
  sortBy: 'newest' | 'oldest' | 'most_views' | 'least_views';
}
```

**Computed Values:**
```typescript
interface FilterContextType extends FilterState {
  filteredVideos: Video[];          // Videos after all filters applied
  filteredCount: number;            // Count of filtered videos
  setDuration: (d: string) => void;
  setKeyword: (k: string) => void;
  setDateRange: (r: string) => void;
  setCustomDateRange: (range: { start: Date; end: Date }) => void;
  setSortBy: (s: string) => void;
  resetFilters: () => void;
}
```

**Filter Logic:**
```typescript
// Duration filter
if (duration === 'short') {
  videos = videos.filter(v => v.duration < 60);
} else if (duration === 'long') {
  videos = videos.filter(v => v.duration >= 60);
}

// Keyword filter (case-insensitive)
if (keyword) {
  const lower = keyword.toLowerCase();
  videos = videos.filter(v =>
    v.title.toLowerCase().includes(lower) ||
    v.description.toLowerCase().includes(lower)
  );
}

// Date range filter
if (dateRange !== 'all') {
  const cutoff = getDateCutoff(dateRange);
  videos = videos.filter(v => new Date(v.publishedAt) >= cutoff);
}

// Sorting
videos.sort((a, b) => {
  switch (sortBy) {
    case 'newest': return b.publishedAt - a.publishedAt;
    case 'oldest': return a.publishedAt - b.publishedAt;
    case 'most_views': return b.viewCount - a.viewCount;
    case 'least_views': return a.viewCount - b.viewCount;
  }
});
```

**Usage:**
```tsx
import { useFilters } from '../contexts/FilterContext';

function FilterBar() {
  const {
    duration,
    keyword,
    filteredCount,
    setDuration,
    setKeyword
  } = useFilters();

  return (
    <div>
      <input
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        placeholder="Search..."
      />
      <select value={duration} onChange={e => setDuration(e.target.value)}>
        <option value="all">All</option>
        <option value="short">Shorts (&lt;60s)</option>
        <option value="long">Long (≥60s)</option>
      </select>
      <span>{filteredCount} videos</span>
    </div>
  );
}
```

---

### SelectionContext

Manages video multi-selection with limits.

**Location:** `src/contexts/SelectionContext.tsx`

**Constants:**
```typescript
const MAX_SELECTION = 10;  // Prevents browser overload
```

**State:**
```typescript
interface SelectionState {
  selectedIds: Set<string>;
  selectedVideos: Video[];
  selectionCount: number;
  isMaxSelected: boolean;
}
```

**Methods:**
```typescript
interface SelectionContextType extends SelectionState {
  toggleSelection: (videoId: string) => void;
  selectMultiple: (videoIds: string[]) => void;
  selectTopBest: (count?: number) => void;   // Highest views
  selectTopWorst: (count?: number) => void;  // Lowest views
  clearSelection: () => void;
  isSelected: (videoId: string) => boolean;
}
```

**Smart Selection Logic:**
```typescript
// Top Best: Sort by viewCount descending
function selectTopBest(count = 5) {
  const sorted = [...filteredVideos].sort(
    (a, b) => b.viewCount - a.viewCount
  );
  const top = sorted.slice(0, count);
  selectMultiple(top.map(v => v.id));
}

// Top Worst: Sort by viewCount ascending
function selectTopWorst(count = 5) {
  const sorted = [...filteredVideos].sort(
    (a, b) => a.viewCount - b.viewCount
  );
  const bottom = sorted.slice(0, count);
  selectMultiple(bottom.map(v => v.id));
}
```

**Usage:**
```tsx
import { useSelection } from '../contexts/SelectionContext';

function VideoCard({ video }: { video: Video }) {
  const { isSelected, toggleSelection, isMaxSelected } = useSelection();
  const selected = isSelected(video.id);

  return (
    <div className={selected ? 'selected' : ''}>
      <Checkbox
        checked={selected}
        disabled={!selected && isMaxSelected}
        onChange={() => toggleSelection(video.id)}
      />
      {/* ... */}
    </div>
  );
}
```

---

### DownloadContext

Manages download queue and progress tracking.

**Location:** `src/contexts/DownloadContext.tsx`

**State:**
```typescript
interface DownloadQueueItem {
  videoId: string;
  video: Video;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;        // 0-100
  filename: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface DownloadState {
  queue: DownloadQueueItem[];
  isDownloading: boolean;
  currentIndex: number;
  completedCount: number;
  failedCount: number;
}
```

**Methods:**
```typescript
interface DownloadContextType extends DownloadState {
  startDownload: (videos: Video[], quality?: string) => void;
  pauseDownload: () => void;
  resumeDownload: () => void;
  cancelDownload: () => void;
  retryFailed: () => void;
  clearQueue: () => void;
}
```

**Download Process:**
```typescript
async function processQueue() {
  for (const item of queue) {
    if (item.status !== 'pending') continue;

    updateItem(item.videoId, { status: 'downloading', startedAt: new Date() });

    try {
      await downloadWithProgress(
        item.videoId,
        quality,
        (progress) => updateItem(item.videoId, { progress })
      );
      updateItem(item.videoId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date()
      });
    } catch (error) {
      updateItem(item.videoId, {
        status: 'failed',
        error: error.message
      });
    }
  }

  // Generate CSV after all downloads
  generateCSV(queue.filter(i => i.status === 'completed'));
}
```

**Usage:**
```tsx
import { useDownload } from '../contexts/DownloadContext';
import { useSelection } from '../contexts/SelectionContext';

function DownloadButton() {
  const { selectedVideos } = useSelection();
  const { startDownload, isDownloading, queue } = useDownload();

  return (
    <>
      <button
        onClick={() => startDownload(selectedVideos)}
        disabled={selectedVideos.length === 0 || isDownloading}
      >
        Download ({selectedVideos.length})
      </button>

      {isDownloading && (
        <DownloadModal queue={queue} />
      )}
    </>
  );
}
```

---

### TikTokContext

Manages TikTok video data and downloads.

**Location:** `src/contexts/TikTokContext.tsx`

**State:**
```typescript
interface TikTokState {
  videos: TikTokVideo[];
  isLoading: boolean;
  error: string | null;
  username: string;
  // Filter state
  filteredVideos: TikTokVideo[];
  selectedIds: Set<string>;
}
```

**Methods:**
```typescript
interface TikTokContextType extends TikTokState {
  fetchProfile: (username: string) => Promise<void>;
  syncToDatabase: () => Promise<void>;
  // Selection
  toggleSelection: (id: string) => void;
  selectTopBest: () => void;
  clearSelection: () => void;
  // Downloads
  downloadSelected: (quality: string) => Promise<void>;
}
```

---

## Custom Hooks

### useVideos

Wrapper hook for VideoContext with additional helpers.

```typescript
// hooks/useVideos.ts
export function useVideos() {
  const context = useContext(VideoContext);

  const topPerformers = useMemo(() => {
    return [...context.videos]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10);
  }, [context.videos]);

  const avgViews = useMemo(() => {
    if (context.videos.length === 0) return 0;
    const sum = context.videos.reduce((acc, v) => acc + v.viewCount, 0);
    return Math.round(sum / context.videos.length);
  }, [context.videos]);

  return {
    ...context,
    topPerformers,
    avgViews,
  };
}
```

### useFilters

Wrapper hook for FilterContext.

```typescript
// hooks/useFilters.ts
export function useFilters() {
  const context = useContext(FilterContext);

  const hasActiveFilters = useMemo(() => {
    return (
      context.duration !== 'all' ||
      context.keyword !== '' ||
      context.dateRange !== 'all'
    );
  }, [context.duration, context.keyword, context.dateRange]);

  return {
    ...context,
    hasActiveFilters,
  };
}
```

### useSelection

Wrapper hook for SelectionContext.

```typescript
// hooks/useSelection.ts
export function useSelection() {
  const context = useContext(SelectionContext);

  const totalViews = useMemo(() => {
    return context.selectedVideos.reduce(
      (sum, v) => sum + v.viewCount, 0
    );
  }, [context.selectedVideos]);

  return {
    ...context,
    totalViews,
  };
}
```

### useDownload

Wrapper hook for DownloadContext.

```typescript
// hooks/useDownload.ts
export function useDownload() {
  const context = useContext(DownloadContext);

  const overallProgress = useMemo(() => {
    if (context.queue.length === 0) return 0;
    const sum = context.queue.reduce((acc, item) => acc + item.progress, 0);
    return Math.round(sum / context.queue.length);
  }, [context.queue]);

  return {
    ...context,
    overallProgress,
  };
}
```

### useMetricsHistory

Fetch and manage metrics history for a video.

```typescript
// hooks/useMetricsHistory.ts
export function useMetricsHistory(videoId: string, days = 30) {
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        const data = await neonService.getMetricsHistory(videoId, days);
        setHistory(data);
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, [videoId, days]);

  const growth = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    return {
      views: last.viewCount - first.viewCount,
      likes: last.likeCount - first.likeCount,
      period: days,
    };
  }, [history, days]);

  return { history, isLoading, growth };
}
```

---

## Services Layer

### youtube.service.ts

YouTube Data API integration.

```typescript
// services/youtube.service.ts
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const youtubeService = {
  /**
   * Get channel info by handle
   */
  async getChannelByHandle(handle: string): Promise<ChannelInfo> {
    const res = await axios.get(`${BASE_URL}/channels`, {
      params: {
        forHandle: handle,
        part: 'snippet,statistics,contentDetails',
        key: API_KEY,
      },
    });
    return mapChannelResponse(res.data.items[0]);
  },

  /**
   * Get videos from playlist
   */
  async getPlaylistVideos(playlistId: string, limit = 50): Promise<string[]> {
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    while (videoIds.length < limit) {
      const res = await axios.get(`${BASE_URL}/playlistItems`, {
        params: {
          playlistId,
          part: 'contentDetails',
          maxResults: 50,
          pageToken,
          key: API_KEY,
        },
      });

      videoIds.push(...res.data.items.map(
        (item: any) => item.contentDetails.videoId
      ));
      pageToken = res.data.nextPageToken;
      if (!pageToken) break;
    }

    return videoIds.slice(0, limit);
  },

  /**
   * Get video details in batches
   */
  async getVideoDetails(videoIds: string[]): Promise<Video[]> {
    const videos: Video[] = [];

    // Process in batches of 50
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const res = await axios.get(`${BASE_URL}/videos`, {
        params: {
          id: batch.join(','),
          part: 'snippet,statistics,contentDetails',
          key: API_KEY,
        },
      });

      videos.push(...res.data.items.map(mapVideoResponse));
    }

    return videos;
  },
};
```

### neon.service.ts

Neon database integration.

```typescript
// services/neon.service.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_DATABASE_URL);

export const neonService = {
  /**
   * Fetch all videos from database
   */
  async getVideos(): Promise<Video[]> {
    const rows = await sql`
      SELECT * FROM videos
      ORDER BY published_at DESC
    `;
    return rows.map(mapDbRowToVideo);
  },

  /**
   * Sync videos to database
   */
  async syncVideos(videos: Video[]): Promise<void> {
    for (const video of videos) {
      await sql`
        INSERT INTO videos (
          id, channel_id, title, description,
          thumbnail_url, duration, view_count,
          like_count, comment_count, published_at, is_short
        ) VALUES (
          ${video.id}, ${video.channelId}, ${video.title},
          ${video.description}, ${video.thumbnailUrl},
          ${video.duration}, ${video.viewCount},
          ${video.likeCount}, ${video.commentCount},
          ${video.publishedAt}, ${video.isShort}
        )
        ON CONFLICT (id) DO UPDATE SET
          view_count = EXCLUDED.view_count,
          like_count = EXCLUDED.like_count,
          comment_count = EXCLUDED.comment_count,
          updated_at = CURRENT_TIMESTAMP
      `;

      // Record metrics snapshot
      await sql`
        INSERT INTO metrics_history (video_id, view_count, like_count, comment_count)
        VALUES (${video.id}, ${video.viewCount}, ${video.likeCount}, ${video.commentCount})
      `;
    }
  },

  /**
   * Get metrics history for a video
   */
  async getMetricsHistory(videoId: string, days: number): Promise<MetricsSnapshot[]> {
    const rows = await sql`
      SELECT view_count, like_count, comment_count, recorded_at
      FROM metrics_history
      WHERE video_id = ${videoId}
        AND recorded_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      ORDER BY recorded_at ASC
    `;
    return rows.map(mapDbRowToMetrics);
  },

  /**
   * Check database connection
   */
  async checkHealth(): Promise<boolean> {
    try {
      await sql`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
};
```

### storage.service.ts

LocalStorage cache management.

```typescript
// services/storage.service.ts
const VIDEOS_KEY = 'yt_analyzer_videos';
const CHANNEL_KEY = 'yt_analyzer_channel';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

export const storageService = {
  cacheVideos(videos: Video[]): void {
    localStorage.setItem(VIDEOS_KEY, JSON.stringify({
      data: videos,
      timestamp: Date.now(),
    }));
  },

  getCachedVideos(): Video[] | null {
    const stored = localStorage.getItem(VIDEOS_KEY);
    if (!stored) return null;

    const { data, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(VIDEOS_KEY);
      return null;
    }

    return data;
  },

  cacheChannelInfo(info: ChannelInfo): void {
    localStorage.setItem(CHANNEL_KEY, JSON.stringify({
      data: info,
      timestamp: Date.now(),
    }));
  },

  getCachedChannelInfo(): ChannelInfo | null {
    const stored = localStorage.getItem(CHANNEL_KEY);
    if (!stored) return null;

    const { data, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(CHANNEL_KEY);
      return null;
    }

    return data;
  },

  clearCache(): void {
    localStorage.removeItem(VIDEOS_KEY);
    localStorage.removeItem(CHANNEL_KEY);
  },
};
```

### cobalt.service.ts

Video download service.

```typescript
// services/cobalt.service.ts
const API_URL = import.meta.env.VITE_DOWNLOAD_API_URL;

export const cobaltService = {
  /**
   * Get download URL for a video
   */
  getDownloadUrl(videoId: string, quality = 'best'): string {
    return `${API_URL}/api/download?videoId=${videoId}&quality=${quality}`;
  },

  /**
   * Download video with progress tracking
   */
  async downloadWithProgress(
    videoId: string,
    quality: string,
    onProgress: (percent: number) => void
  ): Promise<Blob> {
    const response = await axios.get(
      this.getDownloadUrl(videoId, quality),
      {
        responseType: 'blob',
        onDownloadProgress: (event) => {
          if (event.total) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        },
      }
    );

    return response.data;
  },

  /**
   * Trigger browser download
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
```

---

## UI Components

### Button

```tsx
// components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  children,
  onClick,
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg font-medium transition-colors',
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
}
```

### Card

```tsx
// components/ui/Card.tsx
interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-gray-800 rounded-xl border border-gray-700',
        'hover:border-gray-600 transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
```

### Modal

```tsx
// components/ui/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-gray-800 rounded-xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

### ProgressBar

```tsx
// components/ui/ProgressBar.tsx
interface ProgressBarProps {
  progress: number;  // 0-100
  showLabel?: boolean;
  color?: 'blue' | 'green' | 'red';
}

export function ProgressBar({
  progress,
  showLabel = true,
  color = 'blue',
}: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', colors[color])}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-gray-400 mt-1">
          {progress}%
        </span>
      )}
    </div>
  );
}
```

---

## Feature Components

### VideoCard

Displays a single video with selection capability.

```tsx
// components/video/VideoCard.tsx
interface VideoCardProps {
  video: Video;
  showCheckbox?: boolean;
}

export function VideoCard({ video, showCheckbox = true }: VideoCardProps) {
  const { isSelected, toggleSelection, isMaxSelected } = useSelection();
  const selected = isSelected(video.id);

  return (
    <Card className={cn(selected && 'ring-2 ring-blue-500')}>
      <VideoThumbnail
        url={video.thumbnailUrl}
        duration={video.durationFormatted}
        isShort={video.isShort}
      />
      <div className="p-3">
        <h3 className="font-medium line-clamp-2">{video.title}</h3>
        <VideoStats
          views={video.viewCount}
          likes={video.likeCount}
          comments={video.commentCount}
        />
        <p className="text-sm text-gray-400">
          {formatDate(video.publishedAt)}
        </p>
      </div>
      {showCheckbox && (
        <Checkbox
          checked={selected}
          disabled={!selected && isMaxSelected}
          onChange={() => toggleSelection(video.id)}
        />
      )}
    </Card>
  );
}
```

### FilterBar

Contains all filter controls.

```tsx
// components/filters/FilterBar.tsx
export function FilterBar() {
  const { filteredCount } = useFilters();

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-gray-800 rounded-xl">
      <DurationFilter />
      <KeywordFilter />
      <DateFilter />
      <SortFilter />
      <div className="ml-auto">
        <Badge>{filteredCount} videos</Badge>
      </div>
    </div>
  );
}
```

### DownloadModal

Shows download progress and queue.

```tsx
// components/download/DownloadModal.tsx
export function DownloadModal() {
  const {
    queue,
    isDownloading,
    completedCount,
    failedCount,
    cancelDownload,
    retryFailed,
  } = useDownload();

  return (
    <Modal
      isOpen={isDownloading}
      onClose={cancelDownload}
      title="Downloading Videos"
    >
      <div className="space-y-4">
        <div className="flex gap-4 text-sm">
          <span className="text-green-400">
            Completed: {completedCount}
          </span>
          <span className="text-red-400">
            Failed: {failedCount}
          </span>
          <span className="text-gray-400">
            Total: {queue.length}
          </span>
        </div>

        <DownloadQueue items={queue} />

        <div className="flex gap-2">
          <Button variant="danger" onClick={cancelDownload}>
            Cancel
          </Button>
          {failedCount > 0 && (
            <Button onClick={retryFailed}>
              Retry Failed
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

---

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [API Reference](API.md) - Backend endpoints
- [Types](../youtube-analyzer/src/types/) - TypeScript definitions
