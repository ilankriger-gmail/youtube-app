// ========== API SERVICE ==========

const API_BASE = '/api';

/**
 * Busca videos do banco de dados
 */
async function fetchVideos() {
  const response = await fetch(`${API_BASE}/videos`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao buscar videos');
  }

  return response.json();
}

/**
 * Atualiza videos do Instagram
 */
async function refreshVideos() {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao atualizar videos');
  }

  return response.json();
}

/**
 * Gera URL de download (usa yt-dlp)
 */
function getDownloadUrl(videoUrl, quality = 'best', filename = '') {
  const params = new URLSearchParams({
    url: videoUrl,
    quality,
  });

  if (filename) {
    params.append('filename', filename);
  }

  return `${API_BASE}/download?${params.toString()}`;
}

/**
 * Gera URL de download direto (proxy CDN)
 */
function getDirectDownloadUrl(videoUrl, filename = '') {
  // Encode URL explicitly to handle special characters
  const encodedUrl = encodeURIComponent(videoUrl);
  const encodedFilename = encodeURIComponent(filename);

  return `${API_BASE}/download-direct?url=${encodedUrl}&filename=${encodedFilename}`;
}

/**
 * Formata numero com sufixo (K, M)
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Formata duracao em segundos para mm:ss
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formata data para exibicao
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Gera nome de arquivo para download
 */
function generateFilename(video) {
  const viewsFormatted = formatNumber(video.views);
  let title = video.caption || 'video';

  title = title
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);

  return `IG - ${viewsFormatted} - ${title}.mp4`;
}

/**
 * Busca comentarios de um post
 */
async function fetchComments(shortcode, limit = 500) {
  const response = await fetch(`${API_BASE}/comments/${shortcode}?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao buscar comentarios');
  }

  return response.json();
}
