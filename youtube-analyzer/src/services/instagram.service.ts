// ========== SECAO: SERVICO INSTAGRAM ==========

// Instagram Analyzer roda na porta 3002
export const INSTAGRAM_API_URL = 'http://localhost:3002';

// ========== TIPOS ==========

export interface InstagramVideo {
  id: string;
  shortcode: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  thumbnail: string;
  uploadDate: string;
  type: 'reel' | 'post';
  videoUrl?: string;
  platform: 'instagram';
}

export interface InstagramProfileResult {
  success: boolean;
  profile: {
    username: string;
    fullName: string;
    profilePic: string;
    followers: number;
    videoCount: number;
  };
  videos: InstagramVideo[];
  error?: string;
}

export type InstagramQuality = 'best' | '1080' | '720' | '480' | 'audio';

// ========== BUSCAR PERFIL ==========

export async function fetchInstagramProfile(
  username: string,
  limit: number = 100
): Promise<InstagramProfileResult> {
  const cleanUsername = username.replace('@', '').trim();

  const response = await fetch(`${INSTAGRAM_API_URL}/api/profile/${cleanUsername}`, {
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

// ========== DOWNLOAD ==========

export function getInstagramDownloadUrl(
  url: string,
  quality: InstagramQuality = 'best',
  filename?: string
): string {
  const params = new URLSearchParams({ url, quality });
  if (filename) params.append('filename', filename);
  return `${INSTAGRAM_API_URL}/api/download?${params.toString()}`;
}

export function getInstagramDirectDownloadUrl(
  videoUrl: string,
  filename?: string
): string {
  const params = new URLSearchParams({ url: videoUrl });
  if (filename) params.append('filename', filename);
  return `${INSTAGRAM_API_URL}/api/download-direct?${params.toString()}`;
}

export async function downloadInstagramWithProgress(
  url: string,
  quality: InstagramQuality,
  title: string,
  views: number,
  onProgress: (progress: number) => void
): Promise<void> {
  const downloadUrl = getInstagramDownloadUrl(url, quality);
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

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `IG - ${formatViews(views)} - ${title.substring(0, 50)}.mp4`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) filename = decodeURIComponent(match[1]);
  }

  const mimeType = quality === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const blob = new Blob(chunks, { type: mimeType });
  triggerDownload(blob, filename);
}

export async function downloadInstagramSimple(
  url: string,
  quality: InstagramQuality,
  title: string,
  views: number
): Promise<void> {
  const downloadUrl = getInstagramDownloadUrl(url, quality);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Erro no download: ${response.status}`);
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `IG - ${formatViews(views)} - ${title.substring(0, 50)}.mp4`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) filename = decodeURIComponent(match[1]);
  }

  const blob = await response.blob();
  triggerDownload(blob, filename);
}

// Download direto via CDN (mais rapido)
export async function downloadInstagramDirect(
  videoUrl: string,
  title: string,
  views: number
): Promise<void> {
  const downloadUrl = getInstagramDirectDownloadUrl(videoUrl);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Erro no download direto: ${response.status}`);
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `IG - ${formatViews(views)} - ${title.substring(0, 50)}.mp4`;
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

export function formatInstagramDate(dateStr: string): string {
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

// ========== EXPORTAR CSV ==========

function escapeCSVValue(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateInstagramCSV(videos: InstagramVideo[], username: string): void {
  const headers = [
    'Titulo',
    'Views',
    'Views Formatado',
    'Likes',
    'Likes Formatado',
    'Comentarios',
    'Duracao (s)',
    'Duracao Formatada',
    'Data Publicacao',
    'Tipo',
    'Canal',
    'URL',
    'ID'
  ];

  const rows = videos.map(video => [
    escapeCSVValue(video.title),
    escapeCSVValue(video.views),
    escapeCSVValue(formatViews(video.views)),
    escapeCSVValue(video.likes),
    escapeCSVValue(formatViews(video.likes)),
    escapeCSVValue(video.comments),
    escapeCSVValue(video.duration),
    escapeCSVValue(formatDuration(video.duration)),
    escapeCSVValue(formatInstagramDate(video.uploadDate)),
    escapeCSVValue(video.type),
    escapeCSVValue(video.channel),
    escapeCSVValue(video.url),
    escapeCSVValue(video.id)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `instagram_${username}_${timestamp}.csv`;

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
