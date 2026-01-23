// ========== SECAO: SERVICO TIKTOK ==========

import { DOWNLOAD_API_URL } from '../constants';

// ========== PERFIL FIXO ==========
export const TIKTOK_FIXED_USERNAME = 'nextleveldj';

// ========== TIPOS ==========

export interface TikTokVideo {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  views: number;
  thumbnail: string;
  uploadDate: string;
  platform: 'tiktok';
}

export interface TikTokVideoInfo {
  valid: boolean;
  url: string;
  platform: 'tiktok';
  title: string;
  duration: number;
  thumbnail: string;
  channel: string;
  views: number;
  error?: string;
}

export interface TikTokProfileResult {
  success: boolean;
  profile: {
    username: string;
    videoCount: number;
  };
  videos: TikTokVideo[];
  error?: string;
}

export type TikTokQuality = 'best' | '1080' | '720' | '480' | '360' | 'audio';

// ========== VALIDACAO ==========

const TIKTOK_PATTERNS = [
  /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
  /^(https?:\/\/)?(www\.)?tiktok\.com\/t\/[\w]+/,
  /^(https?:\/\/)?vm\.tiktok\.com\/[\w]+/,
  /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+/,
];

export function isValidTikTokUrl(url: string): boolean {
  return TIKTOK_PATTERNS.some(pattern => pattern.test(url));
}

// ========== BUSCAR PERFIL ==========

export async function fetchTikTokProfile(
  username: string,
  limit: number = 100
): Promise<TikTokProfileResult> {
  const response = await fetch(`${DOWNLOAD_API_URL}/api/tiktok/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username.replace('@', ''),
      limit,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

// ========== BUSCAR DO BANCO DE DADOS ==========

export interface TikTokVideosResponse {
  success: boolean;
  username: string;
  videoCount: number;
  videos: TikTokVideo[];
  error?: string;
}

export async function fetchTikTokVideosFromDB(): Promise<TikTokVideosResponse> {
  const response = await fetch(`${DOWNLOAD_API_URL}/api/tiktok/videos`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

// ========== SINCRONIZAR COM BANCO ==========

export interface TikTokSyncResponse {
  success: boolean;
  username: string;
  videosCount: number;
  videos: TikTokVideo[];
  error?: string;
}

export async function syncTikTokVideos(limit: number = 500): Promise<TikTokSyncResponse> {
  const response = await fetch(`${DOWNLOAD_API_URL}/api/tiktok/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

// ========== VALIDAR URLs ==========

export async function validateTikTokUrls(urls: string[]): Promise<TikTokVideoInfo[]> {
  const response = await fetch(`${DOWNLOAD_API_URL}/api/tiktok/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

// ========== OBTER INFO DE VIDEO ==========

export async function getTikTokVideoInfo(url: string): Promise<TikTokVideoInfo> {
  const response = await fetch(
    `${DOWNLOAD_API_URL}/api/tiktok/info?url=${encodeURIComponent(url)}`
  );

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}`);
  }

  return response.json();
}

// ========== DOWNLOAD ==========

export function getTikTokDownloadUrl(
  url: string,
  quality: TikTokQuality = 'best',
  title: string = 'video',
  views: number = 0
): string {
  const params = new URLSearchParams({
    url,
    quality,
    title,
    views: String(views),
  });
  return `${DOWNLOAD_API_URL}/api/tiktok/download?${params.toString()}`;
}

export async function downloadTikTokWithProgress(
  url: string,
  quality: TikTokQuality,
  title: string,
  views: number,
  onProgress: (progress: number) => void
): Promise<void> {
  const downloadUrl = getTikTokDownloadUrl(url, quality, title, views);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Erro no download: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new Error('Response body nao disponivel');
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value.buffer);
    received += value.length;

    if (total > 0) {
      onProgress(Math.round((received / total) * 100));
    } else {
      onProgress(Math.min(95, Math.round(received / 1000000)));
    }
  }

  // Extrair filename do header ou gerar
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `TT - ${formatViews(views)} - ${title.substring(0, 50)}.mp4`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) filename = decodeURIComponent(match[1]);
  }

  const mimeType = quality === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const blob = new Blob(chunks, { type: mimeType });
  triggerDownload(blob, filename);
}

export async function downloadTikTokSimple(
  url: string,
  quality: TikTokQuality,
  title: string,
  views: number
): Promise<void> {
  const downloadUrl = getTikTokDownloadUrl(url, quality, title, views);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Erro no download: ${response.status}`);
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `TT - ${formatViews(views)} - ${title.substring(0, 50)}.mp4`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) filename = decodeURIComponent(match[1]);
  }

  const blob = await response.blob();
  triggerDownload(blob, filename);
}

// ========== HELPERS ==========

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTikTokDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return '';
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
}

export function parseDuration(str: string): number {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(str) || 0;
}

export function getTikTokUrl(videoId: string, username: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

// ========== EXPORTAR CSV ==========

function escapeCSVValue(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateTikTokCSV(videos: TikTokVideo[], username: string): void {
  // Headers
  const headers = [
    'Titulo',
    'Views',
    'Views Formatado',
    'Duracao (s)',
    'Duracao Formatada',
    'Data Publicacao',
    'Canal',
    'URL',
    'ID'
  ];

  // Rows
  const rows = videos.map(video => [
    escapeCSVValue(video.title),
    video.views,
    formatViews(video.views),
    video.duration,
    formatDuration(video.duration),
    formatTikTokDate(video.uploadDate),
    escapeCSVValue(video.channel),
    video.url,
    video.id
  ]);

  // Monta CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSVValue(cell)).join(','))
  ].join('\n');

  // Adiciona BOM para UTF-8 (Excel abre corretamente)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Gera nome do arquivo com timestamp e username
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `tiktok_${username}_${timestamp}.csv`;

  // Dispara download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
