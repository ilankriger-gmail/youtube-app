// ========== DOWNLOAD MODULE ==========

const Download = {
  queue: [],
  currentIndex: -1,
  isRunning: false,
  aborted: false,
  includeComments: false,
  allComments: [], // Armazena todos os comentarios coletados

  /**
   * Inicia downloads
   */
  async start(videos, quality = 'best') {
    if (videos.length === 0) return;

    // Verifica se deve incluir comentarios
    this.includeComments = document.getElementById('include-comments')?.checked || false;
    this.allComments = [];

    this.queue = videos.map(video => ({
      video,
      status: 'pending', // pending, downloading, completed, failed
      error: null,
      filename: generateFilename(video),
      commentsStatus: this.includeComments ? 'pending' : null,
    }));

    this.currentIndex = -1;
    this.isRunning = true;
    this.aborted = false;

    // Gera CSV antes de iniciar
    this.generateCSV(videos);

    // Abre modal
    this.showModal();
    this.renderQueue();

    // Processa fila
    for (let i = 0; i < this.queue.length; i++) {
      if (this.aborted) break;

      this.currentIndex = i;
      await this.processItem(i, quality);

      // Delay entre downloads
      if (i < this.queue.length - 1 && !this.aborted) {
        await this.delay(1500);
      }
    }

    // Se incluiu comentarios, gera CSV de comentarios
    if (this.includeComments && this.allComments.length > 0) {
      this.generateCommentsCSV();
    }

    // Aguardar conclusao do ultimo item
    await this.delay(500);

    this.isRunning = false;
    this.updateProgress();
  },

  /**
   * Baixa apenas os comentarios (sem baixar videos)
   */
  async startCommentsOnly(videos) {
    if (videos.length === 0) return;

    this.allComments = [];
    this.includeComments = true;

    this.queue = videos.map(video => ({
      video,
      status: 'completed', // Video nao sera baixado
      error: null,
      filename: generateFilename(video),
      commentsStatus: 'pending',
    }));

    this.currentIndex = -1;
    this.isRunning = true;
    this.aborted = false;

    // Abre modal
    this.showModal();
    this.renderQueue();

    // Processa fila - apenas comentarios
    for (let i = 0; i < this.queue.length; i++) {
      if (this.aborted) break;

      this.currentIndex = i;
      const item = this.queue[i];

      // Buscar comentarios
      if (item.video.shortcode) {
        await this.fetchVideoComments(item);
      }

      this.renderQueue();
      this.updateProgress();

      // Delay entre requisicoes
      if (i < this.queue.length - 1 && !this.aborted) {
        await this.delay(1500);
      }
    }

    // Gera CSV de comentarios
    if (this.allComments.length > 0) {
      this.generateCommentsCSV();
    } else {
      console.log('Nenhum comentario encontrado');
      alert('Nenhum comentario encontrado nos videos selecionados.');
    }

    await this.delay(500);
    this.isRunning = false;
    this.updateCommentsProgress();
  },

  /**
   * Atualiza progresso para modo apenas comentarios
   */
  updateCommentsProgress() {
    const completed = this.queue.filter(i => i.commentsStatus === 'completed' || i.commentsStatus === 'failed').length;
    const total = this.queue.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent =
      `${completed} de ${total} videos processados (${percent}%)`;
  },

  /**
   * Processa um item da fila
   */
  async processItem(index, quality) {
    const item = this.queue[index];
    item.status = 'downloading';
    this.renderQueue();

    try {
      // Usa download direto se tiver video_url (mais rapido e confiavel)
      // Caso contrario usa yt-dlp
      let downloadUrl;
      if (item.video.video_url) {
        downloadUrl = getDirectDownloadUrl(item.video.video_url, item.filename);
      } else {
        downloadUrl = getDownloadUrl(item.video.url, quality, item.filename);
      }

      // Cria link de download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = item.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      item.status = 'completed';
    } catch (error) {
      item.status = 'failed';
      item.error = error.message;
      console.error(`Erro ao baixar ${item.video.caption}:`, error);
    }

    // Buscar comentarios se habilitado
    if (this.includeComments && item.video.shortcode) {
      await this.fetchVideoComments(item);
    }

    this.renderQueue();
    this.updateProgress();
  },

  /**
   * Busca comentarios de um video
   */
  async fetchVideoComments(item) {
    item.commentsStatus = 'fetching';
    this.renderQueue();

    try {
      const result = await fetchComments(item.video.shortcode);

      if (result.error) {
        item.commentsStatus = 'failed';
        console.error(`Erro ao buscar comentarios de ${item.video.shortcode}:`, result.error);
        return;
      }

      // Adiciona comentarios ao array geral com info do video
      if (result.comments && result.comments.length > 0) {
        result.comments.forEach(comment => {
          this.allComments.push({
            videoShortcode: item.video.shortcode,
            videoCaption: item.video.caption,
            videoUrl: item.video.url,
            ...comment
          });
        });
      }

      item.commentsStatus = 'completed';
      item.commentsCount = result.fetched_comments || 0;
      console.log(`[Comments] ${item.commentsCount} comentarios de ${item.video.shortcode}`);

    } catch (error) {
      item.commentsStatus = 'failed';
      console.error(`Erro ao buscar comentarios de ${item.video.shortcode}:`, error);
    }
  },

  /**
   * Cancela todos os downloads
   */
  cancelAll() {
    this.aborted = true;
    this.queue.forEach(item => {
      if (item.status === 'pending' || item.status === 'downloading') {
        item.status = 'failed';
        item.error = 'Cancelado pelo usuario';
      }
    });
    this.isRunning = false;
    this.renderQueue();
    this.updateProgress();
  },

  /**
   * Gera CSV com todos os dados dos videos
   */
  generateCSV(videos) {
    const headers = [
      'Shortcode',
      'Titulo',
      'Descricao Completa',
      'Views',
      'Likes',
      'Comentarios',
      'Duracao (seg)',
      'Duracao (formatada)',
      'Tipo',
      'Data Publicacao',
      'URL Post',
      'URL Video',
      'URL Thumbnail'
    ];

    const formatDurationCSV = (seconds) => {
      if (!seconds) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDateCSV = (timestamp) => {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const escapeCSV = (text) => {
      if (!text) return '';
      // Escapa aspas duplas e envolve em aspas se tiver vírgula, quebra de linha ou aspas
      const escaped = String(text).replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
        return `"${escaped}"`;
      }
      return escaped;
    };

    const rows = videos.map(video => [
      video.shortcode || '',
      escapeCSV(video.caption || 'Sem titulo'),
      escapeCSV(video.caption_full || video.caption || ''),
      video.views || 0,
      video.likes || 0,
      video.comments || 0,
      video.duration || 0,
      formatDurationCSV(video.duration),
      video.type || 'video',
      formatDateCSV(video.timestamp),
      video.url || '',
      video.video_url || '',
      video.thumbnail || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // BOM para UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `instagram_nextleveldj1_${timestamp}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    console.log(`CSV gerado com ${videos.length} videos`);
  },

  /**
   * Gera CSV com todos os comentarios
   */
  generateCommentsCSV() {
    if (this.allComments.length === 0) {
      console.log('Nenhum comentario para exportar');
      return;
    }

    const headers = [
      'Video Shortcode',
      'Video Titulo',
      'Video URL',
      'Comentario ID',
      'Autor',
      'Autor Verificado',
      'Texto',
      'Likes',
      'Data',
      'Respostas'
    ];

    const formatDateCSV = (timestamp) => {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const escapeCSV = (text) => {
      if (!text) return '';
      const escaped = String(text).replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
        return `"${escaped}"`;
      }
      return escaped;
    };

    const rows = this.allComments.map(comment => [
      comment.videoShortcode || '',
      escapeCSV(comment.videoCaption || ''),
      comment.videoUrl || '',
      comment.id || '',
      escapeCSV(comment.author || ''),
      comment.author_verified ? 'Sim' : 'Nao',
      escapeCSV(comment.text || ''),
      comment.likes || 0,
      formatDateCSV(comment.timestamp),
      comment.answers_count || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // BOM para UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `instagram_comentarios_${timestamp}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    console.log(`CSV de comentarios gerado com ${this.allComments.length} comentarios`);
  },

  /**
   * Mostra modal de download
   */
  showModal() {
    document.getElementById('download-modal').classList.add('active');
  },

  /**
   * Esconde modal
   */
  hideModal() {
    document.getElementById('download-modal').classList.remove('active');
  },

  /**
   * Atualiza barra de progresso
   */
  updateProgress() {
    const completed = this.queue.filter(i => i.status === 'completed').length;
    const total = this.queue.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent =
      `${completed} de ${total} concluidos (${percent}%)`;
  },

  /**
   * Renderiza lista de downloads
   */
  renderQueue() {
    const container = document.getElementById('download-list');
    const commentsOnlyMode = this.queue.length > 0 && this.queue[0].status === 'completed' && this.queue[0].commentsStatus;

    container.innerHTML = this.queue.map((item, index) => {
      let statusIcon = '';

      // No modo apenas comentarios, mostra o status dos comentarios como icone principal
      if (commentsOnlyMode) {
        switch (item.commentsStatus) {
          case 'pending':
            statusIcon = '⏳';
            break;
          case 'fetching':
            statusIcon = '💬';
            break;
          case 'completed':
            statusIcon = '✅';
            break;
          case 'failed':
            statusIcon = '❌';
            break;
        }
      } else {
        switch (item.status) {
          case 'pending':
            statusIcon = '⏳';
            break;
          case 'downloading':
            statusIcon = '⬇️';
            break;
          case 'completed':
            statusIcon = '✅';
            break;
          case 'failed':
            statusIcon = '❌';
            break;
        }
      }

      // Status dos comentarios (apenas se nao estiver no modo apenas comentarios)
      let commentsInfo = '';
      if (this.includeComments && item.commentsStatus && !commentsOnlyMode) {
        switch (item.commentsStatus) {
          case 'pending':
            commentsInfo = '<span class="comments-status pending">Comentarios: aguardando</span>';
            break;
          case 'fetching':
            commentsInfo = '<span class="comments-status fetching">Buscando comentarios...</span>';
            break;
          case 'completed':
            commentsInfo = `<span class="comments-status completed">Comentarios: ${item.commentsCount || 0}</span>`;
            break;
          case 'failed':
            commentsInfo = '<span class="comments-status failed">Comentarios: erro</span>';
            break;
        }
      }

      // Info de comentarios no modo apenas comentarios
      let commentsCount = '';
      if (commentsOnlyMode && item.commentsStatus === 'completed') {
        commentsCount = `<span class="comments-status completed">${item.commentsCount || 0} comentarios</span>`;
      }

      return `
        <div class="download-item">
          <span class="download-item-status">${statusIcon}</span>
          <div class="download-item-info">
            <div class="download-item-title">${item.video.caption || 'Sem titulo'}</div>
            ${commentsInfo}
            ${commentsCount}
            ${item.error ? `<div class="download-item-error">${item.error}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
