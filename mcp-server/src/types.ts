// ========== TYPES - SOCIAL MEDIA MCP SERVER ==========

// ---------- Normalized Video ----------

export interface NormalizedVideo {
  platform: 'youtube' | 'tiktok' | 'instagram';
  account_handle: string;
  external_id: string;
  title: string;
  url: string;
  published_at: string; // ISO 8601
  duration_seconds: number;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  saves: number | null;
  is_short: boolean;
  content_type: 'short' | 'video' | 'reel' | 'post';
  thumbnail: string | null;
  caption: string | null;
  hashtags: string[];
  raw: Record<string, unknown>;
}

// ---------- Tool Response ----------

export type ErrorCode =
  | 'backend_unavailable'
  | 'invalid_handle'
  | 'rate_limited'
  | 'scraping_failed'
  | 'partial_data'
  | 'not_found';

export type SourceStatus = 'ok' | 'partial' | 'error';
export type Source = 'live' | 'database';

export interface ResponseMeta {
  platform: string;
  source: Source;
  source_status: SourceStatus;
  cached: boolean;
  fetched_at: string;
  error?: string;
  error_code?: ErrorCode;
}

export interface PaginationInfo {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  has_next: boolean;
}

export interface Aggregates {
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  avg_views: number;
  median_views: number;
  avg_likes: number;
}

export interface ToolResponseData {
  profile?: Record<string, unknown>;
  videos?: NormalizedVideo[];
  aggregates?: Aggregates;
  pagination?: PaginationInfo;
  comments?: CommentData[];
  platforms?: Record<string, PlatformSummary>;
  combined?: PerformanceSummaryBlock;
}

export interface ToolResponse {
  data: ToolResponseData;
  meta: ResponseMeta;
  formatted_summary: string;
}

// ---------- Instagram Comments ----------

export interface CommentData {
  author: string;
  author_verified: boolean;
  text: string;
  likes: number;
  answers_count: number;
  timestamp: string;
}

// ---------- Performance Summary ----------

export interface ViewsTrend {
  first_half_avg: number;
  second_half_avg: number;
  direction: 'up' | 'down' | 'stable';
}

export interface PerformanceSummaryBlock {
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  avg_views: number;
  median_views: number;
  top_10_videos: NormalizedVideo[];
  bottom_10_videos: NormalizedVideo[];
  shorts_count: number;
  shorts_ratio: number;
  posting_frequency: { posts_per_week: number };
  views_trend: ViewsTrend;
}

export interface PlatformSummary extends PerformanceSummaryBlock {
  platform: string;
  source_status: SourceStatus;
  error?: string;
}

// ---------- Config ----------

export interface BackendConfig {
  youtubeBackend: string;
  instagramBackend: string;
}

// ---------- Defaults ----------

export const DEFAULTS = {
  youtube_handle: '@nextleveldj1',
  tiktok_username: 'nextleveldj',
  instagram_username: 'nextleveldj1',
  max_youtube_videos: 5000,
  max_tiktok_videos: 2000,
  max_instagram_videos: 100,
  default_page_size: 50,
  max_page_size: 200,
} as const;
