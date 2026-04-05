#!/usr/bin/env node

// ========== MCP SERVER - SOCIAL MEDIA DATA ==========
// Exposes YouTube, TikTok, and Instagram video data via MCP (stdio transport)
// Returns structured JSON with normalized videos, aggregates, and pagination

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type { BackendConfig, NormalizedVideo, PlatformSummary, ToolResponse } from './types.js';
import { DEFAULTS } from './types.js';
import {
  fetchJSON,
  fetchYouTubeChannel,
  fetchAllYouTubeVideos,
  fetchTikTokLive,
  fetchTikTokDatabase,
  fetchInstagramLive,
  fetchInstagramDatabase,
  fetchInstagramComments,
  normalizeInstagramComment,
  applyDateFilter,
  sortVideos,
  paginate,
  computeAggregates,
  computePerformanceSummary,
  buildMeta,
  buildErrorResponse,
  toMcpResult,
  formatVideoSummary,
  formatProfileSummary,
  formatNumber,
  mapErrorCode,
  mapErrorMessage,
} from './helpers.js';

// ========== CONFIG ==========

const config: BackendConfig = {
  youtubeBackend: process.env.YOUTUBE_BACKEND_URL || 'http://localhost:3001',
  instagramBackend: process.env.INSTAGRAM_BACKEND_URL || 'http://localhost:3002',
};

// ========== SHARED ZOD SCHEMAS ==========

const dateFilterSchema = {
  published_after: z.string().optional().describe('Filter: only videos published after this date (ISO, e.g. "2025-01-01")'),
  published_before: z.string().optional().describe('Filter: only videos published before this date (ISO, e.g. "2025-12-31")'),
  last_n_days: z.number().optional().describe('Filter: only videos from the last N days (overrides published_after)'),
};

const paginationSchema = {
  page: z.number().default(1).describe('Page number (default 1)'),
  page_size: z.number().default(50).describe('Results per page (default 50, max 200)'),
};

const sortSchema = {
  sort_by: z.enum(['views', 'likes', 'comments', 'date', 'duration']).default('date').describe('Sort field'),
  sort_order: z.enum(['asc', 'desc']).default('desc').describe('Sort order'),
};

const sourceSchema = {
  source: z.enum(['live', 'database']).default('live').describe("Data source: 'live' (fresh scraping) or 'database' (saved data)"),
};

// ========== SERVER ==========

const server = new McpServer({
  name: 'social-media-data',
  version: '2.0.0',
});

// ========== YOUTUBE: GET CHANNEL ==========

server.tool(
  'youtube_get_channel',
  'Get YouTube channel info by handle. Returns structured profile data with subscriber count, video count, and total views.',
  {
    handle: z.string().default(DEFAULTS.youtube_handle).describe('Channel handle (e.g. @nextleveldj1)'),
  },
  async ({ handle }) => {
    try {
      const { channel } = await fetchYouTubeChannel(config, handle);
      const ch = channel;

      const profile = {
        id: ch.id,
        name: ch.snippet.title,
        handle,
        description: ch.snippet.description?.substring(0, 500) || null,
        thumbnail: ch.snippet.thumbnails?.default?.url || null,
        subscribers: Number(ch.statistics.subscriberCount),
        videoCount: Number(ch.statistics.videoCount),
        totalViews: Number(ch.statistics.viewCount),
        uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
      };

      const response: ToolResponse = {
        data: { profile },
        meta: buildMeta('youtube', 'live', 'ok'),
        formatted_summary: formatProfileSummary(profile, 'YouTube'),
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('youtube', 'live', err));
    }
  },
);

// ========== YOUTUBE: GET VIDEOS ==========

server.tool(
  'youtube_get_videos',
  'Get all videos from a YouTube channel. Returns normalized videos with views, likes, comments, duration. Supports date filtering, sorting, and pagination.',
  {
    handle: z.string().default(DEFAULTS.youtube_handle).describe('Channel handle (e.g. @nextleveldj1)'),
    type: z.enum(['all', 'short', 'long']).default('all').describe('Filter by type: all, short (<=60s), long (>60s)'),
    ...dateFilterSchema,
    ...sortSchema,
    ...paginationSchema,
  },
  async ({ handle, type, published_after, published_before, last_n_days, sort_by, sort_order, page, page_size }) => {
    try {
      const { channel, playlistId } = await fetchYouTubeChannel(config, handle);
      let videos = await fetchAllYouTubeVideos(config, playlistId, handle, type);

      // Date filter
      videos = applyDateFilter(videos, { published_after, published_before, last_n_days });

      // Aggregates (before pagination)
      const aggregates = computeAggregates(videos);

      // Sort
      videos = sortVideos(videos, sort_by, sort_order);

      // Paginate
      const { items, pagination } = paginate(videos, page, page_size);

      const profile = {
        id: channel.id,
        name: channel.snippet.title,
        handle,
        subscribers: Number(channel.statistics.subscriberCount),
        videoCount: Number(channel.statistics.videoCount),
        totalViews: Number(channel.statistics.viewCount),
      };

      const response: ToolResponse = {
        data: { profile, videos: items, aggregates, pagination },
        meta: buildMeta('youtube', 'live', 'ok'),
        formatted_summary: formatVideoSummary(aggregates, items.length, `YouTube (${channel.snippet.title})`),
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('youtube', 'live', err));
    }
  },
);

// ========== TIKTOK: GET PROFILE ==========

server.tool(
  'tiktok_get_profile',
  'Fetch videos from a TikTok profile (live scraping or database). Returns normalized videos with views, duration, date. Supports date filtering, sorting, and pagination.',
  {
    username: z.string().default(DEFAULTS.tiktok_username).describe('TikTok username (e.g. nextleveldj)'),
    limit: z.number().default(100).describe('Max videos to fetch from live scraping (max 2000)'),
    ...sourceSchema,
    ...dateFilterSchema,
    ...sortSchema,
    ...paginationSchema,
  },
  async ({ username, limit, source, published_after, published_before, last_n_days, sort_by, sort_order, page, page_size }) => {
    try {
      let videos: NormalizedVideo[];
      let profile: Record<string, unknown> | null = null;
      const cleanUser = username.replace('@', '');

      if (source === 'database') {
        const dbData = await fetchTikTokDatabase(config);
        videos = dbData.videos;
        profile = { username: dbData.username, videoCount: dbData.videoCount, source: 'database' };
      } else {
        const liveData = await fetchTikTokLive(config, cleanUser, limit);
        videos = liveData.videos;
        profile = liveData.profile ? {
          username: liveData.profile.username || cleanUser,
          videoCount: liveData.profile.videoCount || videos.length,
          followers: liveData.profile.followers || null,
          source: 'live',
        } : { username: cleanUser, videoCount: videos.length, source: 'live' };
      }

      // Date filter
      videos = applyDateFilter(videos, { published_after, published_before, last_n_days });

      // Aggregates (before pagination)
      const aggregates = computeAggregates(videos);

      // Sort
      videos = sortVideos(videos, sort_by, sort_order);

      // Paginate
      const { items, pagination } = paginate(videos, page, page_size);

      const response: ToolResponse = {
        data: { profile: profile || undefined, videos: items, aggregates, pagination },
        meta: buildMeta('tiktok', source, 'ok'),
        formatted_summary: formatVideoSummary(aggregates, items.length, `TikTok (@${cleanUser})`),
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('tiktok', 'live', err));
    }
  },
);

// ========== TIKTOK: GET SAVED VIDEOS ==========

server.tool(
  'tiktok_get_saved_videos',
  'Get TikTok videos saved in the database (previously synced). Returns normalized videos with aggregates. Supports date filtering, sorting, and pagination.',
  {
    ...dateFilterSchema,
    ...sortSchema,
    ...paginationSchema,
  },
  async ({ published_after, published_before, last_n_days, sort_by, sort_order, page, page_size }) => {
    try {
      const dbData = await fetchTikTokDatabase(config);
      let videos = dbData.videos;

      // Date filter
      videos = applyDateFilter(videos, { published_after, published_before, last_n_days });

      // Aggregates
      const aggregates = computeAggregates(videos);

      // Sort
      videos = sortVideos(videos, sort_by, sort_order);

      // Paginate
      const { items, pagination } = paginate(videos, page, page_size);

      const profile = {
        username: dbData.username,
        videoCount: dbData.videoCount,
        source: 'database' as const,
      };

      const response: ToolResponse = {
        data: { profile, videos: items, aggregates, pagination },
        meta: buildMeta('tiktok', 'database', 'ok'),
        formatted_summary: formatVideoSummary(aggregates, items.length, `TikTok DB (@${dbData.username})`),
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('tiktok', 'database', err));
    }
  },
);

// ========== INSTAGRAM: GET PROFILE ==========

server.tool(
  'instagram_get_profile',
  'Fetch videos/reels from an Instagram profile (live scraping or database). Returns normalized videos with views, likes, comments. Supports date filtering, sorting, and pagination.',
  {
    username: z.string().default(DEFAULTS.instagram_username).describe('Instagram username (e.g. nextleveldj1)'),
    limit: z.number().default(100).describe('Max videos to fetch from live scraping (max 100)'),
    ...sourceSchema,
    ...dateFilterSchema,
    ...sortSchema,
    ...paginationSchema,
  },
  async ({ username, limit, source, published_after, published_before, last_n_days, sort_by, sort_order, page, page_size }) => {
    try {
      let videos: NormalizedVideo[];
      let profile: Record<string, unknown> | null = null;
      const cleanUser = username.replace('@', '');

      if (source === 'database') {
        const dbData = await fetchInstagramDatabase(config);
        videos = dbData.videos;
        profile = { username: dbData.username, lastUpdate: dbData.lastUpdate, source: 'database' };
      } else {
        const liveData = await fetchInstagramLive(config, cleanUser, limit);
        videos = liveData.videos;
        profile = liveData.profile ? {
          username: liveData.profile.username || cleanUser,
          fullName: liveData.profile.fullName || null,
          followers: liveData.profile.followers || null,
          following: liveData.profile.following || null,
          videoCount: videos.length,
          source: 'live',
        } : { username: cleanUser, videoCount: videos.length, source: 'live' };
      }

      // Date filter
      videos = applyDateFilter(videos, { published_after, published_before, last_n_days });

      // Aggregates
      const aggregates = computeAggregates(videos);

      // Sort
      videos = sortVideos(videos, sort_by, sort_order);

      // Paginate
      const { items, pagination } = paginate(videos, page, page_size);

      const response: ToolResponse = {
        data: { profile: profile || undefined, videos: items, aggregates, pagination },
        meta: buildMeta('instagram', source, 'ok'),
        formatted_summary: formatVideoSummary(aggregates, items.length, `Instagram (@${cleanUser})`),
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('instagram', 'live', err));
    }
  },
);

// ========== INSTAGRAM: GET SAVED VIDEOS ==========

server.tool(
  'instagram_get_saved_videos',
  'Get Instagram videos saved in the database (previously synced). Returns normalized videos with aggregates. Supports date filtering, sorting, and pagination.',
  {
    ...dateFilterSchema,
    ...sortSchema,
    ...paginationSchema,
  },
  async ({ published_after, published_before, last_n_days, sort_by, sort_order, page, page_size }) => {
    try {
      const dbData = await fetchInstagramDatabase(config);
      let videos = dbData.videos;

      // Date filter
      videos = applyDateFilter(videos, { published_after, published_before, last_n_days });

      // Aggregates
      const aggregates = computeAggregates(videos);

      // Sort
      videos = sortVideos(videos, sort_by, sort_order);

      // Paginate
      const { items, pagination } = paginate(videos, page, page_size);

      const profile = {
        username: dbData.username,
        lastUpdate: dbData.lastUpdate,
        source: 'database' as const,
      };

      const response: ToolResponse = {
        data: { profile, videos: items, aggregates, pagination },
        meta: buildMeta('instagram', 'database', 'ok'),
        formatted_summary: formatVideoSummary(aggregates, items.length, `Instagram DB (@${dbData.username})`),
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('instagram', 'database', err));
    }
  },
);

// ========== INSTAGRAM: GET COMMENTS ==========

server.tool(
  'instagram_get_comments',
  'Fetch comments from an Instagram post/reel by shortcode. Returns structured comment data with pagination.',
  {
    shortcode: z.string().describe('Post shortcode (e.g. ABC123def)'),
    limit: z.number().default(500).describe('Max comments to fetch'),
    ...paginationSchema,
  },
  async ({ shortcode, limit, page, page_size }) => {
    try {
      const { comments, totalComments, fetchedComments } = await fetchInstagramComments(config, shortcode, limit);

      // Paginate comments
      const safePage = Math.max(1, page);
      const safeSize = Math.max(1, Math.min(page_size, 200));
      const totalPages = Math.max(1, Math.ceil(comments.length / safeSize));
      const start = (safePage - 1) * safeSize;
      const pageComments = comments.slice(start, start + safeSize);

      const response: ToolResponse = {
        data: {
          comments: pageComments,
          pagination: {
            page: safePage,
            page_size: safeSize,
            total_count: comments.length,
            total_pages: totalPages,
            has_next: safePage < totalPages,
          },
        },
        meta: buildMeta('instagram', 'live', 'ok'),
        formatted_summary: `Instagram comments for ${shortcode}: ${fetchedComments} fetched of ${totalComments} total, showing page ${safePage}`,
      };

      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('instagram', 'live', err));
    }
  },
);

// ========== SOCIAL MEDIA OVERVIEW ==========

server.tool(
  'social_media_overview',
  'Get a combined overview of all platforms (YouTube, TikTok, Instagram) with aggregated stats. Returns structured data per platform with profiles and aggregates.',
  {
    youtube_handle: z.string().default(DEFAULTS.youtube_handle).describe('YouTube handle'),
    tiktok_username: z.string().default(DEFAULTS.tiktok_username).describe('TikTok username'),
    instagram_username: z.string().default(DEFAULTS.instagram_username).describe('Instagram username'),
  },
  async ({ youtube_handle, tiktok_username, instagram_username }) => {
    const platforms: Record<string, { profile?: Record<string, unknown>; aggregates?: ReturnType<typeof computeAggregates>; error?: string }> = {};
    const summaryParts: string[] = [];
    let overallStatus: 'ok' | 'partial' | 'error' = 'ok';

    // Fetch all platforms concurrently
    const [ytResult, ttResult, igResult] = await Promise.allSettled([
      // YouTube
      (async () => {
        const { channel, playlistId } = await fetchYouTubeChannel(config, youtube_handle);
        const videos = await fetchAllYouTubeVideos(config, playlistId, youtube_handle);
        const aggregates = computeAggregates(videos);
        const profile = {
          name: channel.snippet.title,
          handle: youtube_handle,
          subscribers: Number(channel.statistics.subscriberCount),
          videoCount: Number(channel.statistics.videoCount),
          totalViews: Number(channel.statistics.viewCount),
        };
        return { profile, aggregates };
      })(),
      // TikTok (from database for speed)
      (async () => {
        const dbData = await fetchTikTokDatabase(config);
        const aggregates = computeAggregates(dbData.videos);
        const profile = { username: dbData.username, videoCount: dbData.videoCount };
        return { profile, aggregates };
      })(),
      // Instagram (from database for speed)
      (async () => {
        const dbData = await fetchInstagramDatabase(config);
        const aggregates = computeAggregates(dbData.videos);
        const profile = { username: dbData.username, lastUpdate: dbData.lastUpdate };
        return { profile, aggregates };
      })(),
    ]);

    // Process YouTube
    if (ytResult.status === 'fulfilled') {
      platforms.youtube = ytResult.value;
      const p = ytResult.value.profile;
      summaryParts.push(`YouTube (${p.name}): ${formatNumber(Number(p.subscribers))} subs, ${formatNumber(ytResult.value.aggregates.total_views)} views across ${ytResult.value.aggregates.total_videos} videos`);
    } else {
      platforms.youtube = { error: mapErrorMessage(ytResult.reason) };
      summaryParts.push(`YouTube: Error - ${mapErrorMessage(ytResult.reason)}`);
      overallStatus = 'partial';
    }

    // Process TikTok
    if (ttResult.status === 'fulfilled') {
      platforms.tiktok = ttResult.value;
      summaryParts.push(`TikTok (@${ttResult.value.profile.username}): ${formatNumber(ttResult.value.aggregates.total_views)} views across ${ttResult.value.aggregates.total_videos} videos`);
    } else {
      platforms.tiktok = { error: mapErrorMessage(ttResult.reason) };
      summaryParts.push(`TikTok: Error - ${mapErrorMessage(ttResult.reason)}`);
      overallStatus = 'partial';
    }

    // Process Instagram
    if (igResult.status === 'fulfilled') {
      platforms.instagram = igResult.value;
      summaryParts.push(`Instagram (@${igResult.value.profile.username}): ${formatNumber(igResult.value.aggregates.total_views)} views across ${igResult.value.aggregates.total_videos} videos`);
    } else {
      platforms.instagram = { error: mapErrorMessage(igResult.reason) };
      summaryParts.push(`Instagram: Error - ${mapErrorMessage(igResult.reason)}`);
      overallStatus = 'partial';
    }

    // If all failed
    if (ytResult.status === 'rejected' && ttResult.status === 'rejected' && igResult.status === 'rejected') {
      overallStatus = 'error';
    }

    const response: ToolResponse = {
      data: { platforms: platforms as Record<string, unknown> as Record<string, PlatformSummary> },
      meta: buildMeta('all', 'live', overallStatus),
      formatted_summary: summaryParts.join('\n'),
    };

    return toMcpResult(response);
  },
);

// ========== CONSOLIDATED NORMALIZED TOOL ==========

server.tool(
  'social_media_get_videos_normalized',
  'Unified video search across one or all platforms. Returns normalized videos from YouTube, TikTok, and/or Instagram with combined aggregates. When platform is "all", fetches concurrently and merges results.',
  {
    platform: z.enum(['youtube', 'tiktok', 'instagram', 'all']).default('all').describe('Platform to fetch from'),
    handle: z.string().optional().describe('Account handle/username (uses platform defaults if omitted)'),
    ...dateFilterSchema,
    limit: z.number().default(50).describe('Max videos per platform for live fetch'),
    ...sortSchema,
    source: z.enum(['live', 'database']).default('live').describe("Data source: 'live' or 'database'"),
    ...paginationSchema,
  },
  async ({ platform, handle, published_after, published_before, last_n_days, limit, sort_by, sort_order, source, page, page_size }) => {
    const platformsToFetch = platform === 'all'
      ? ['youtube', 'tiktok', 'instagram'] as const
      : [platform] as const;

    const dateFilter = { published_after, published_before, last_n_days };
    const perPlatformStatus: Record<string, { status: 'ok' | 'error'; error?: string }> = {};

    // Fetch each platform
    const fetchPromises = platformsToFetch.map(async (p) => {
      try {
        let videos: NormalizedVideo[] = [];

        switch (p) {
          case 'youtube': {
            const ytHandle = handle || DEFAULTS.youtube_handle;
            const { playlistId } = await fetchYouTubeChannel(config, ytHandle);
            videos = await fetchAllYouTubeVideos(config, playlistId, ytHandle);
            break;
          }
          case 'tiktok': {
            const ttUser = handle || DEFAULTS.tiktok_username;
            if (source === 'database') {
              const db = await fetchTikTokDatabase(config);
              videos = db.videos;
            } else {
              const live = await fetchTikTokLive(config, ttUser, limit);
              videos = live.videos;
            }
            break;
          }
          case 'instagram': {
            const igUser = handle || DEFAULTS.instagram_username;
            if (source === 'database') {
              const db = await fetchInstagramDatabase(config);
              videos = db.videos;
            } else {
              const live = await fetchInstagramLive(config, igUser, limit);
              videos = live.videos;
            }
            break;
          }
        }

        perPlatformStatus[p] = { status: 'ok' };
        return videos;
      } catch (err) {
        perPlatformStatus[p] = { status: 'error', error: mapErrorMessage(err) };
        return [] as NormalizedVideo[];
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    let allVideos: NormalizedVideo[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        allVideos.push(...r.value);
      }
    }

    // Date filter
    allVideos = applyDateFilter(allVideos, dateFilter);

    // Aggregates (before pagination)
    const aggregates = computeAggregates(allVideos);

    // Sort
    allVideos = sortVideos(allVideos, sort_by, sort_order);

    // Paginate
    const { items, pagination } = paginate(allVideos, page, page_size);

    // Determine overall status
    const statuses = Object.values(perPlatformStatus);
    const allOk = statuses.every(s => s.status === 'ok');
    const allError = statuses.every(s => s.status === 'error');
    const overallStatus: 'ok' | 'partial' | 'error' = allOk ? 'ok' : allError ? 'error' : 'partial';

    const response: ToolResponse = {
      data: {
        videos: items,
        aggregates,
        pagination,
        platforms: perPlatformStatus as unknown as Record<string, PlatformSummary>,
      },
      meta: buildMeta(platform, source, overallStatus),
      formatted_summary: formatVideoSummary(aggregates, items.length, `Normalized (${platform})`),
    };

    return toMcpResult(response);
  },
);

// ========== PERFORMANCE SUMMARY TOOL ==========

server.tool(
  'social_media_get_performance_summary',
  'Get a detailed performance summary for one or all platforms over a time period. Includes total stats, averages, medians, top/bottom videos, posting frequency, and views trend.',
  {
    platform: z.enum(['youtube', 'tiktok', 'instagram', 'all']).default('all').describe('Platform to analyze'),
    handle: z.string().optional().describe('Account handle/username (uses platform defaults if omitted)'),
    days: z.number().default(90).describe('Number of days to analyze (default 90)'),
  },
  async ({ platform, handle, days }) => {
    const platformsToFetch = platform === 'all'
      ? ['youtube', 'tiktok', 'instagram'] as const
      : [platform] as const;

    const dateFilter = { last_n_days: days };
    const platformResults: Record<string, PlatformSummary> = {};
    const allVideos: NormalizedVideo[] = [];

    const fetchPromises = platformsToFetch.map(async (p) => {
      try {
        let videos: NormalizedVideo[] = [];

        switch (p) {
          case 'youtube': {
            const ytHandle = handle || DEFAULTS.youtube_handle;
            const { playlistId } = await fetchYouTubeChannel(config, ytHandle);
            videos = await fetchAllYouTubeVideos(config, playlistId, ytHandle);
            break;
          }
          case 'tiktok': {
            const ttUser = handle || DEFAULTS.tiktok_username;
            const db = await fetchTikTokDatabase(config);
            videos = db.videos;
            break;
          }
          case 'instagram': {
            const igUser = handle || DEFAULTS.instagram_username;
            const db = await fetchInstagramDatabase(config);
            videos = db.videos;
            break;
          }
        }

        // Apply date filter
        videos = applyDateFilter(videos, dateFilter);

        const summary = computePerformanceSummary(videos);
        platformResults[p] = {
          ...summary,
          platform: p,
          source_status: 'ok',
        };
        allVideos.push(...videos);
      } catch (err) {
        platformResults[p] = {
          platform: p,
          source_status: 'error',
          error: mapErrorMessage(err),
          total_videos: 0,
          total_views: 0,
          total_likes: 0,
          total_comments: 0,
          avg_views: 0,
          median_views: 0,
          top_10_videos: [],
          bottom_10_videos: [],
          shorts_count: 0,
          shorts_ratio: 0,
          posting_frequency: { posts_per_week: 0 },
          views_trend: { first_half_avg: 0, second_half_avg: 0, direction: 'stable' },
        };
      }
    });

    await Promise.allSettled(fetchPromises);

    // Combined summary
    const combined = computePerformanceSummary(allVideos);

    // Overall status
    const statuses = Object.values(platformResults).map(p => p.source_status);
    const allOk = statuses.every(s => s === 'ok');
    const allError = statuses.every(s => s === 'error');
    const overallStatus: 'ok' | 'partial' | 'error' = allOk ? 'ok' : allError ? 'error' : 'partial';

    // Summary text
    const summaryParts: string[] = [`Performance summary (last ${days} days)`];
    for (const [p, data] of Object.entries(platformResults)) {
      if (data.source_status === 'ok') {
        summaryParts.push(
          `${p}: ${data.total_videos} videos, ${formatNumber(data.total_views)} views, ${formatNumber(data.avg_views)} avg, trend: ${data.views_trend.direction}, ${data.posting_frequency.posts_per_week} posts/wk`,
        );
      } else {
        summaryParts.push(`${p}: Error - ${data.error}`);
      }
    }
    if (platform === 'all') {
      summaryParts.push(
        `Combined: ${combined.total_videos} videos, ${formatNumber(combined.total_views)} views, ${formatNumber(combined.avg_views)} avg, trend: ${combined.views_trend.direction}`,
      );
    }

    const response: ToolResponse = {
      data: {
        platforms: platformResults,
        combined,
      },
      meta: buildMeta(platform, 'live', overallStatus),
      formatted_summary: summaryParts.join('\n'),
    };

    return toMcpResult(response);
  },
);

// ========== START ==========

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Social Media Data server v2.0.0 running on stdio');
}

main().catch((err) => {
  console.error('[MCP] Fatal error:', err);
  process.exit(1);
});
