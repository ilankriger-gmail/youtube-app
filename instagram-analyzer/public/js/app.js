// ========== INSTAGRAM ANALYZER - MAIN APP ==========

const App = {
  videos: [],
  filteredVideos: [],
  lastUpdate: null,

  /**
   * Inicializa aplicacao
   */
  async init() {
    this.bindEvents();
    await this.loadVideos();
  },

  /**
   * Vincula eventos
   */
  bindEvents() {
    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.refreshFromInstagram();
    });

    // Filtros
    document.getElementById('btn-apply-filters').addEventListener('click', () => {
      this.applyFilters();
    });

    // Filtro de período - aplica automaticamente
    document.getElementById('filter-period').addEventListener('change', () => {
      this.applyFilters();
    });

    // Busca por texto - aplica com debounce
    let searchTimeout;
    document.getElementById('filter-search').addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this.applyFilters(), 300);
    });

    // Selecao
    document.getElementById('btn-top5').addEventListener('click', () => {
      Selection.selectTop(this.filteredVideos, 5);
      this.renderVideos();
      this.updateSelectionUI();
    });

    document.getElementById('btn-bottom5').addEventListener('click', () => {
      Selection.selectBottom(this.filteredVideos, 5);
      this.renderVideos();
      this.updateSelectionUI();
    });

    document.getElementById('btn-select-all').addEventListener('click', () => {
      Selection.selectAll(this.filteredVideos.map(v => v.shortcode));
      this.renderVideos();
      this.updateSelectionUI();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      Selection.clear();
      this.renderVideos();
      this.updateSelectionUI();
    });

    // Download
    document.getElementById('btn-download').addEventListener('click', () => {
      this.startDownload();
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', () => {
      Download.hideModal();
    });

    document.getElementById('btn-cancel-all').addEventListener('click', () => {
      Download.cancelAll();
    });
  },

  /**
   * Carrega videos do banco de dados
   */
  async loadVideos() {
    this.showLoading('Carregando videos...');

    try {
      const result = await fetchVideos();

      this.videos = result.videos || [];
      this.lastUpdate = result.lastUpdate;

      Filters.reset();
      this.filteredVideos = Filters.apply(this.videos);

      this.renderVideos();
      this.updateUI();

    } catch (error) {
      console.error('Erro ao carregar videos:', error);
      this.showEmptyState('Erro ao carregar. Clique em Atualizar.');
    }

    this.hideLoading();
  },

  /**
   * Atualiza videos do Instagram
   */
  async refreshFromInstagram() {
    this.showLoading('Buscando videos do Instagram...');

    try {
      const result = await refreshVideos();

      this.videos = result.videos || [];
      this.lastUpdate = result.lastUpdate;

      Filters.reset();
      this.filteredVideos = Filters.apply(this.videos);
      Selection.clear();

      this.renderVideos();
      this.updateUI();

      alert(`Atualizado! ${this.videos.length} videos encontrados.`);

    } catch (error) {
      console.error('Erro ao atualizar:', error);
      alert(`Erro: ${error.message}`);
    }

    this.hideLoading();
  },

  /**
   * Aplica filtros aos videos
   */
  applyFilters() {
    Filters.updateFromInputs();
    this.filteredVideos = Filters.apply(this.videos);
    this.renderVideos();
    this.updateUI();
  },

  /**
   * Renderiza grid de videos
   */
  renderVideos() {
    const grid = document.getElementById('videos-grid');

    if (this.filteredVideos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📹</div>
          <div class="empty-state-text">Nenhum video encontrado</div>
        </div>
      `;
      return;
    }

    const sortedByViews = [...this.filteredVideos].sort((a, b) => b.views - a.views);
    const top5 = new Set(sortedByViews.slice(0, 5).map(v => v.shortcode));
    const bottom5 = new Set(sortedByViews.slice(-5).map(v => v.shortcode));

    grid.innerHTML = this.filteredVideos.map(video => {
      const isSelected = Selection.isSelected(video.shortcode);
      const isTop = top5.has(video.shortcode);
      const isBottom = bottom5.has(video.shortcode) && !isTop;

      return `
        <div class="video-card ${isSelected ? 'selected' : ''}" data-shortcode="${video.shortcode}">
          <div class="video-checkbox">${isSelected ? '✓' : ''}</div>
          ${isTop ? '<div class="video-badge top">TOP 5</div>' : ''}
          ${isBottom ? '<div class="video-badge bottom">BOTTOM 5</div>' : ''}
          <img
            class="video-thumbnail"
            src="/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}"
            alt="${video.caption}"
            loading="lazy"
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 fill=%22%23666%22 text-anchor=%22middle%22 font-size=%2240%22>📹</text></svg>'"
          >
          <div class="video-type">${video.type || 'video'}</div>
          <div class="video-duration">${formatDuration(video.duration)}</div>
          <div class="video-info">
            <div class="video-caption">${video.caption || 'Sem titulo'}</div>
            <div class="video-stats">
              <span class="video-stat">👁 ${formatNumber(video.views)}</span>
              <span class="video-stat">❤️ ${formatNumber(video.likes)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.video-card').forEach(card => {
      card.addEventListener('click', () => {
        const shortcode = card.dataset.shortcode;
        Selection.toggle(shortcode);
        this.renderVideos();
        this.updateSelectionUI();
      });
    });
  },

  /**
   * Inicia downloads
   */
  startDownload() {
    const selectedVideos = Selection.getSelectedVideos(this.videos);

    if (selectedVideos.length === 0) {
      alert('Selecione pelo menos um video');
      return;
    }

    const quality = document.getElementById('quality-select').value;
    Download.start(selectedVideos, quality);
  },

  /**
   * Atualiza UI geral
   */
  updateUI() {
    // Info bar
    document.getElementById('video-count').textContent = `${this.filteredVideos.length} videos`;
    document.getElementById('last-update').textContent = this.lastUpdate
      ? `Atualizado: ${formatDate(this.lastUpdate)}`
      : 'Nunca atualizado';

    // Download bar
    const hasVideos = this.filteredVideos.length > 0;
    document.getElementById('download-bar').style.display = hasVideos ? 'flex' : 'none';

    this.updateSelectionUI();
  },

  /**
   * Atualiza UI de selecao
   */
  updateSelectionUI() {
    const count = Selection.count;

    document.getElementById('selected-count').textContent = count;
    document.getElementById('download-count').textContent = count;

    const downloadBtn = document.getElementById('btn-download');
    downloadBtn.disabled = count === 0;
  },

  /**
   * Mostra loading
   */
  showLoading(text = 'Carregando...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading').style.display = 'flex';
  },

  /**
   * Esconde loading
   */
  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  },

  /**
   * Mostra estado vazio
   */
  showEmptyState(message) {
    document.getElementById('videos-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📹</div>
        <div class="empty-state-text">${message}</div>
      </div>
    `;
  }
};

// Inicializa quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => App.init());
