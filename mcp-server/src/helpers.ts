// ========== HELPERS - SOCIAL MEDIA MCP SERVER ==========

import type {
  NormalizedVideo,
  Aggregates,
  PaginationInfo,
  ResponseMeta,
  ToolResponse,
  ErrorCode,
  SourceStatus,
  Source,
  PerformanceSummaryBlock,
  ViewsTrend,
  CommentData,
  BackendConfig,
} from './types.js';

// ========== HTTP ==========

export async function fetchJSON(url: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(res.status, body);
  }

  return res.json();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = 'HttpError';
  }
}

// ========== ERROR MAPPING ==========

export function mapErrorCode(err: unknown): ErrorCode {
  if (err instanceof HttpError) {
    if (err.status === 404) return 'not_found';
    if (err.status === 429) return 'rate_limited';
    if (err.status >= 400 && err.status < 500) return 'invalid_handle';
    return 'scraping_failed';
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('ENOTFOUND')) {
    return 'backend_unavailable';
  }
  return 'scraping_failed';
}

export function mapErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ========== FORMATTING ==========

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ========== DURATION PARSING ==========

export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  return h * 3600 + m * 60 + s;
}

// Parse TikTok's YYYYMMDD to ISO
function tiktokDateToISO(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return new Date(0).toISOString();
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
}

// Parse TikTok duration string "M:SS" or "H:MM:SS" or just seconds
function parseTiktokDuration(dur: string | number | undefined): number {
  if (dur === undefined || dur === null) return 0;
  if (typeof dur === 'number') return dur;
  const str = String(dur);
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const n = Number(str);
  return isNaN(n) ? 0 : n;
}

// ========== HASHTAG EXTRACTION ==========

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  if (!matches) return [];
  return [...new Set(matches.map(h => h.toLowerCase()))];
}

// ========== NORMALIZERS ==========

export function normalizeYouTubeVideo(v: Record<string, any>, handle: string): NormalizedVideo {
  const duration = parseDuration(v.contentDetails?.duration || 'PT0S');
  const isShort = duration <= 60;
  const title = v.snippet?.title || '';
  const description = v.snippet?.description || '';
  const allText = `${title} ${description}`;

  return {
    platform: 'youtube',
    account_handle: handle,
    external_id: v.id,
    title,
    url: `https://youtube.com/watch?v=${v.id}`,
    published_at: v.snippet?.publishedAt || new Date(0).toISOString(),
    duration_seconds: duration,
    views: Number(v.statistics?.viewCount || 0),
    likes: Number(v.statistics?.likeCount || 0),
    comments: Number(v.statistics?.commentCount || 0),
    shares: null,
    saves: null,
    is_short: isShort,
    content_type: isShort ? 'short' : 'video',
    thumbnail: v.snippet?.thumbnails?.default?.url || null,
    caption: description ? description.substring(0, 500) : null,
    hashtags: extractHashtags(allText),
    raw: v,
  };
}

export function normalizeTikTokVideo(v: Record<string, any>, username: string): NormalizedVideo {
  const title = v.title || '';
  const duration = parseTiktokDuration(v.duration);
  const isShort = true; // TikTok videos are always short-form

  return {
    platform: 'tiktok',
    account_handle: username,
    external_id: v.id || v.url || '',
    title,
    url: v.url || '',
    published_at: v.uploadDate ? tiktokDateToISO(v.uploadDate) : (v.createTime ? new Date(Number(v.createTime) * 1000).toISOString() : new Date(0).toISOString()),
    duration_seconds: duration,
    views: Number(v.views || v.playCount || 0),
    likes: Number(v.likes || v.diggCount || 0),
    comments: Number(v.comments || v.commentCount || 0),
    shares: v.shares !== undefined ? Number(v.shares || v.shareCount || 0) : null,
    saves: v.saves !== undefined ? Number(v.saves || v.collectCount || 0) : null,
    is_short: isShort,
    content_type: 'short',
    thumbnail: v.thumbnail || v.cover || null,
    caption: title || null,
    hashtags: extractHashtags(title),
    raw: v,
  };
}

export function normalizeInstagramVideo(v: Record<string, any>, username: string): NormalizedVideo {
  const caption = v.caption || v.title || '';
  const isReel = v.type === 'reel' || v.isVideo === true || (v.videoUrl && v.videoUrl.length > 0);
  const duration = Number(v.duration || v.videoDuration || 0);

  return {
    platform: 'instagram',
    account_handle: username,
    external_id: v.shortcode || v.id || '',
    title: caption ? caption.substring(0, 120) : '',
    url: v.url || (v.shortcode ? `https://instagram.com/p/${v.shortcode}/` : ''),
    published_at: v.date || v.timestamp || v.takenAt || new Date(0).toISOString(),
    duration_seconds: duration,
    views: Number(v.views || v.videoViewCount || 0),
    likes: Number(v.likes || v.likeCount || 0),
    comments: Number(v.comments || v.commentCount || 0),
    shares: null,
    saves: null,
    is_short: isReel,
    content_type: isReel ? 'reel' : 'post',
    thumbnail: v.thumbnail || v.displayUrl || null,
    caption: caption || null,
    hashtags: extractHashtags(caption),
    raw: v,
  };
}

export function normalizeInstagramComment(c: Record<string, any>): CommentData {
  return {
    author: c.author || c.username || '',
    author_verified: Boolean(c.author_verified || c.isVerified),
    text: c.text || c.content || '',
    likes: Number(c.likes || c.likeCount || 0),
    answers_count: Number(c.answers_count || c.replyCount || 0),
    timestamp: c.timestamp || c.date || '',
  };
}

// ========== DATE FILTERING ==========

export interface DateFilterParams {
  published_after?: string;
  published_before?: string;
  last_n_days?: number;
}

export function applyDateFilter(videos: NormalizedVideo[], params: DateFilterParams): NormalizedVideo[] {
  let afterDate: Date | null = null;
  let beforeDate: Date | null = null;

  if (params.last_n_days !== undefined && params.last_n_days > 0) {
    afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - params.last_n_days);
    afterDate.setHours(0, 0, 0, 0);
  } else if (params.published_after) {
    afterDate = new Date(params.published_after);
  }

  if (params.published_before) {
    beforeDate = new Date(params.published_before);
    beforeDate.setHours(23, 59, 59, 999);
  }

  if (!afterDate && !beforeDate) return videos;

  return videos.filter(v => {
    const pubDate = new Date(v.published_at);
    if (afterDate && pubDate < afterDate) return false;
    if (beforeDate && pubDate > beforeDate) return false;
    return true;
  });
}

// ========== SORTING ==========

export type SortField = 'views' | 'likes' | 'comments' | 'date' | 'duration';

export function sortVideos(
  videos: NormalizedVideo[],
  sortBy: SortField,
  sortOrder: 'asc' | 'desc',
): NormalizedVideo[] {
  const sorted = [...videos];
  sorted.sort((a, b) => {
    let va: number | string;
    let vb: number | string;

    switch (sortBy) {
      case 'views':
        va = a.views; vb = b.views; break;
      case 'likes':
        va = a.likes; vb = b.likes; break;
      case 'comments':
        va = a.comments; vb = b.comments; break;
      case 'date':
        va = a.published_at; vb = b.published_at; break;
      case 'duration':
        va = a.duration_seconds; vb = b.duration_seconds; break;
      default:
        va = a.published_at; vb = b.published_at;
    }

    if (va < vb) return sortOrder === 'desc' ? 1 : -1;
    if (va > vb) return sortOrder === 'desc' ? -1 : 1;
    return 0;
  });
  return sorted;
}

// ========== PAGINATION ==========

export function paginate(
  videos: NormalizedVideo[],
  page: number,
  pageSize: number,
): { items: NormalizedVideo[]; pagination: PaginationInfo } {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(pageSize, 200));
  const totalCount = videos.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeSize));
  const start = (safePage - 1) * safeSize;
  const items = videos.slice(start, start + safeSize);

  return {
    items,
    pagination: {
      page: safePage,
      page_size: safeSize,
      total_count: totalCount,
      total_pages: totalPages,
      has_next: safePage < totalPages,
    },
  };
}

// ========== AGGREGATION ==========

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function computeAggregates(videos: NormalizedVideo[]): Aggregates {
  const total = videos.length;
  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
  const totalComments = videos.reduce((s, v) => s + v.comments, 0);

  return {
    total_videos: total,
    total_views: totalViews,
    total_likes: totalLikes,
    total_comments: totalComments,
    avg_views: total > 0 ? Math.round(totalViews / total) : 0,
    median_views: median(videos.map(v => v.views)),
    avg_likes: total > 0 ? Math.round(totalLikes / total) : 0,
  };
}

// ========== PERFORMANCE SUMMARY ==========

export function computePerformanceSummary(videos: NormalizedVideo[]): PerformanceSummaryBlock {
  const agg = computeAggregates(videos);
  const sortedByViews = sortVideos(videos, 'views', 'desc');
  const top10 = sortedByViews.slice(0, 10);
  const bottom10 = sortedByViews.slice(-10).reverse();

  const shorts = videos.filter(v => v.is_short);

  // Posting frequency: posts per week
  let postsPerWeek = 0;
  if (videos.length >= 2) {
    const dates = videos.map(v => new Date(v.published_at).getTime()).sort((a, b) => a - b);
    const spanMs = dates[dates.length - 1] - dates[0];
    const spanWeeks = Math.max(1, spanMs / (7 * 24 * 60 * 60 * 1000));
    postsPerWeek = Math.round((videos.length / spanWeeks) * 10) / 10;
  } else if (videos.length === 1) {
    postsPerWeek = 1;
  }

  // Views trend: compare first half vs second half chronologically
  const sortedByDate = sortVideos(videos, 'date', 'asc');
  const mid = Math.floor(sortedByDate.length / 2);
  const firstHalf = sortedByDate.slice(0, mid || 1);
  const secondHalf = sortedByDate.slice(mid || 1);

  const firstAvg = firstHalf.length > 0
    ? Math.round(firstHalf.reduce((s, v) => s + v.views, 0) / firstHalf.length)
    : 0;
  const secondAvg = secondHalf.length > 0
    ? Math.round(secondHalf.reduce((s, v) => s + v.views, 0) / secondHalf.length)
    : 0;

  let direction: ViewsTrend['direction'] = 'stable';
  if (secondAvg > firstAvg * 1.1) direction = 'up';
  else if (secondAvg < firstAvg * 0.9) direction = 'down';

  return {
    total_videos: agg.total_videos,
    total_views: agg.total_views,
    total_likes: agg.total_likes,
    total_comments: agg.total_comments,
    avg_views: agg.avg_views,
    median_views: agg.median_views,
    top_10_videos: top10,
    bottom_10_videos: bottom10,
    shorts_count: shorts.length,
    shorts_ratio: videos.length > 0 ? Math.round((shorts.length / videos.length) * 100) / 100 : 0,
    posting_frequency: { posts_per_week: postsPerWeek },
    views_trend: {
      first_half_avg: firstAvg,
      second_half_avg: secondAvg,
      direction,
    },
  };
}

// ========== RESPONSE BUILDERS ==========

export function buildMeta(
  platform: string,
  source: Source,
  status: SourceStatus,
  error?: string,
  errorCode?: ErrorCode,
): ResponseMeta {
  return {
    platform,
    source,
    source_status: status,
    cached: false,
    fetched_at: new Date().toISOString(),
    ...(error ? { error } : {}),
    ...(errorCode ? { error_code: errorCode } : {}),
  };
}

export function buildErrorResponse(
  platform: string,
  source: Source,
  err: unknown,
): ToolResponse {
  const errorCode = mapErrorCode(err);
  const errorMsg = mapErrorMessage(err);
  return {
    data: {},
    meta: buildMeta(platform, source, 'error', errorMsg, errorCode),
    formatted_summary: `Error fetching ${platform} data: ${errorMsg}`,
  };
}

export function toMcpResult(response: ToolResponse) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
  };
}

// ========== SUMMARY FORMATTERS ==========

export function formatVideoSummary(agg: Aggregates, count: number, platform: string): string {
  return [
    `${platform}: ${agg.total_videos} videos`,
    `Views: ${formatNumber(agg.total_views)} total, ${formatNumber(agg.avg_views)} avg, ${formatNumber(agg.median_views)} median`,
    `Likes: ${formatNumber(agg.total_likes)} total, ${formatNumber(agg.avg_likes)} avg`,
    `Comments: ${formatNumber(agg.total_comments)} total`,
    `Showing: ${count} videos`,
  ].join(' | ');
}

export function formatProfileSummary(profile: Record<string, unknown>, platform: string): string {
  const name = profile.name || profile.username || profile.handle || 'Unknown';
  const parts = [`${platform}: ${name}`];
  if (profile.subscribers) parts.push(`Subscribers: ${formatNumber(Number(profile.subscribers))}`);
  if (profile.followers) parts.push(`Followers: ${formatNumber(Number(profile.followers))}`);
  if (profile.videoCount) parts.push(`Videos: ${formatNumber(Number(profile.videoCount))}`);
  if (profile.totalViews) parts.push(`Total views: ${formatNumber(Number(profile.totalViews))}`);
  return parts.join(' | ');
}

// ========== DATA FETCHERS ==========

export async function fetchYouTubeChannel(
  config: BackendConfig,
  handle: string,
): Promise<{ channel: Record<string, any>; playlistId: string }> {
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const channelData = await fetchJSON(
    `${config.youtubeBackend}/api/youtube/channels?forHandle=${encodeURIComponent(cleanHandle)}&part=snippet,statistics,contentDetails`,
  ) as Record<string, any>;

  if (!channelData.items?.length) {
    throw new HttpError(404, `Channel "${cleanHandle}" not found`);
  }

  const ch = channelData.items[0];
  return {
    channel: ch,
    playlistId: ch.contentDetails.relatedPlaylists.uploads,
  };
}

export async function fetchAllYouTubeVideos(
  config: BackendConfig,
  playlistId: string,
  handle: string,
  typeFilter: 'all' | 'short' | 'long' = 'all',
): Promise<NormalizedVideo[]> {
  // 1. Fetch all video IDs from playlist
  const videoIds: string[] = [];
  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      playlistId,
      part: 'contentDetails',
      maxResults: '50',
    });
    if (nextPageToken) params.set('pageToken', nextPageToken);

    const page = await fetchJSON(
      `${config.youtubeBackend}/api/youtube/playlistItems?${params}`,
    ) as Record<string, any>;

    const ids = page.items?.map((item: Record<string, any>) => item.contentDetails.videoId) || [];
    videoIds.push(...ids);
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && videoIds.length < 5000);

  // 2. Fetch video details in batches of 50
  const videos: NormalizedVideo[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await fetchJSON(
      `${config.youtubeBackend}/api/youtube/videos?id=${batch.join(',')}&part=snippet,contentDetails,statistics`,
    ) as Record<string, any>;

    for (const v of data.items || []) {
      const normalized = normalizeYouTubeVideo(v, handle);
      if (typeFilter === 'short' && !normalized.is_short) continue;
      if (typeFilter === 'long' && normalized.is_short) continue;
      videos.push(normalized);
    }
  }

  return videos;
}

export async function fetchTikTokLive(
  config: BackendConfig,
  username: string,
  limit: number,
): Promise<{ videos: NormalizedVideo[]; profile: Record<string, any> | null }> {
  const cleanUser = username.replace('@', '');
  const data = await fetchJSON(`${config.youtubeBackend}/api/tiktok/profile`, {
    method: 'POST',
    body: JSON.stringify({ username: cleanUser, limit: Math.min(limit, 2000) }),
  }) as Record<string, any>;

  if (!data.success) {
    throw new Error(data.error || 'TikTok scraping failed');
  }

  const videos = (data.videos || []).map((v: Record<string, any>) =>
    normalizeTikTokVideo(v, cleanUser),
  );

  return { videos, profile: data.profile || null };
}

export async function fetchTikTokDatabase(
  config: BackendConfig,
): Promise<{ videos: NormalizedVideo[]; username: string; videoCount: number }> {
  const data = await fetchJSON(`${config.youtubeBackend}/api/tiktok/videos`) as Record<string, any>;

  if (!data.success) {
    throw new Error(data.error || 'TikTok database fetch failed');
  }

  const username = data.username || 'unknown';
  const videos = (data.videos || []).map((v: Record<string, any>) =>
    normalizeTikTokVideo(v, username),
  );

  return { videos, username, videoCount: data.videoCount || videos.length };
}

export async function fetchInstagramLive(
  config: BackendConfig,
  username: string,
  limit: number,
): Promise<{ videos: NormalizedVideo[]; profile: Record<string, any> | null }> {
  const cleanUser = username.replace('@', '');
  const data = await fetchJSON(`${config.instagramBackend}/api/profile/${cleanUser}`, {
    method: 'POST',
    body: JSON.stringify({ limit: Math.min(limit, 100) }),
  }) as Record<string, any>;

  if (!data.success) {
    throw new Error(data.error || 'Instagram scraping failed');
  }

  const videos = (data.videos || []).map((v: Record<string, any>) =>
    normalizeInstagramVideo(v, cleanUser),
  );

  return { videos, profile: data.profile || null };
}

export async function fetchInstagramDatabase(
  config: BackendConfig,
): Promise<{ videos: NormalizedVideo[]; username: string; lastUpdate: string }> {
  const data = await fetchJSON(`${config.instagramBackend}/api/videos`) as Record<string, any>;

  const username = data.username || 'unknown';
  const videos = (data.videos || []).map((v: Record<string, any>) =>
    normalizeInstagramVideo(v, username),
  );

  return { videos, username, lastUpdate: data.lastUpdate || 'unknown' };
}

export async function fetchInstagramComments(
  config: BackendConfig,
  shortcode: string,
  limit: number,
): Promise<{ comments: CommentData[]; totalComments: number; fetchedComments: number }> {
  const data = await fetchJSON(
    `${config.instagramBackend}/api/comments/${shortcode}?limit=${limit}`,
  ) as Record<string, any>;

  if (data.error) {
    throw new Error(data.error);
  }

  const comments = (data.comments || []).map((c: Record<string, any>) =>
    normalizeInstagramComment(c),
  );

  return {
    comments,
    totalComments: data.total_comments || comments.length,
    fetchedComments: data.fetched_comments || comments.length,
  };
}
