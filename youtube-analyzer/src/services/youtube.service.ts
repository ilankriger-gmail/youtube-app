// ========== SECAO: SERVICO DA API DO YOUTUBE ==========

import axios from 'axios';
import type {
  Video,
  ChannelInfo,
  YouTubeChannelResponse,
  YouTubePlaylistItemsResponse,
  YouTubeVideosResponse,
} from '../types';
import {
  YOUTUBE_ENDPOINTS,
  CHANNEL_HANDLE,
  API_CONFIG,
} from '../constants';
import { parseDuration, formatDuration, isShortDuration } from '../utils/duration.utils';

/**
 * URL do backend que faz proxy para a API do YouTube
 * Isso evita problemas de CORS e referrer restrictions
 */
const BACKEND_URL = import.meta.env.VITE_DOWNLOAD_API_URL || 'http://localhost:3001';

/**
 * API Key do YouTube (usada para verificar se está configurada)
 */
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

/**
 * Instancia do axios configurada para usar o backend como proxy
 */
const youtubeApi = axios.create({
  baseURL: `${BACKEND_URL}/api/youtube`,
});

// ========== CANAL ==========

/**
 * Busca informacoes do canal pelo handle (@username)
 */
export async function fetchChannelByHandle(handle: string = CHANNEL_HANDLE): Promise<ChannelInfo> {
  const response = await youtubeApi.get<YouTubeChannelResponse>(YOUTUBE_ENDPOINTS.CHANNELS, {
    params: {
      part: 'snippet,statistics,contentDetails',
      forHandle: handle.replace('@', ''),
    },
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error(`Canal nao encontrado: ${handle}`);
  }

  const channel = response.data.items[0];

  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default.url,
    subscriberCount: parseInt(channel.statistics.subscriberCount, 10),
    videoCount: parseInt(channel.statistics.videoCount, 10),
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  };
}

// ========== PLAYLIST ==========

/**
 * Busca IDs dos videos de uma playlist (paginado)
 */
async function fetchPlaylistVideoIds(
  playlistId: string,
  maxVideos: number = API_CONFIG.MAX_VIDEOS_TO_FETCH
): Promise<string[]> {
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await youtubeApi.get<YouTubePlaylistItemsResponse>(
      YOUTUBE_ENDPOINTS.PLAYLIST_ITEMS,
      {
        params: {
          part: 'contentDetails',
          playlistId,
          maxResults: API_CONFIG.MAX_RESULTS_PER_PAGE,
          pageToken,
        },
      }
    );

    const ids = response.data.items.map(item => item.contentDetails.videoId);
    videoIds.push(...ids);

    pageToken = response.data.nextPageToken;
  } while (pageToken && videoIds.length < maxVideos);

  return videoIds.slice(0, maxVideos);
}

// ========== VIDEOS ==========

/**
 * Busca detalhes dos videos por IDs (em lotes de 50)
 */
async function fetchVideoDetails(videoIds: string[]): Promise<Video[]> {
  const videos: Video[] = [];

  // Processa em lotes de 50 (limite da API)
  for (let i = 0; i < videoIds.length; i += API_CONFIG.MAX_RESULTS_PER_PAGE) {
    const batch = videoIds.slice(i, i + API_CONFIG.MAX_RESULTS_PER_PAGE);

    const response = await youtubeApi.get<YouTubeVideosResponse>(YOUTUBE_ENDPOINTS.VIDEOS, {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: batch.join(','),
      },
    });

    const batchVideos = response.data.items.map(item => {
      const durationSeconds = parseDuration(item.contentDetails.duration);

      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails.default.url,
        thumbnailMediumUrl: item.snippet.thumbnails.medium.url,
        thumbnailHighUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
        publishedAt: new Date(item.snippet.publishedAt),
        duration: durationSeconds,
        durationFormatted: formatDuration(durationSeconds),
        viewCount: parseInt(item.statistics.viewCount || '0', 10),
        likeCount: parseInt(item.statistics.likeCount || '0', 10),
        commentCount: parseInt(item.statistics.commentCount || '0', 10),
        isShort: isShortDuration(durationSeconds),
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
      };
    });

    videos.push(...batchVideos);
  }

  return videos;
}

// ========== FUNCAO PRINCIPAL ==========

/**
 * Busca todos os videos do canal @nextleveldj1
 * Usa estrategia quota-eficiente: channels -> playlistItems -> videos
 */
export async function fetchChannelVideos(
  handle: string = CHANNEL_HANDLE
): Promise<{ channel: ChannelInfo; videos: Video[] }> {
  // 1. Busca informacoes do canal (1 unidade de quota)
  const channel = await fetchChannelByHandle(handle);

  // 2. Busca IDs dos videos da playlist de uploads (1 unidade por 50 videos)
  const videoIds = await fetchPlaylistVideoIds(channel.uploadsPlaylistId);

  // 3. Busca detalhes dos videos (1 unidade por 50 videos)
  const videos = await fetchVideoDetails(videoIds);

  return { channel, videos };
}

/**
 * Busca apenas os videos (usa cache do canal se disponivel)
 */
export async function fetchVideosOnly(
  uploadsPlaylistId: string
): Promise<Video[]> {
  const videoIds = await fetchPlaylistVideoIds(uploadsPlaylistId);
  return fetchVideoDetails(videoIds);
}

/**
 * Verifica se a API key esta configurada
 */
export function isApiKeyConfigured(): boolean {
  return Boolean(API_KEY && API_KEY !== 'sua_chave_api_aqui');
}
