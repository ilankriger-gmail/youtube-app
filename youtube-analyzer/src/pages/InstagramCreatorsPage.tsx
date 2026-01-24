// ========== SECAO: PAGINA INSTAGRAM CRIADORES ==========

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Loader2,
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  XSquare,
  Download,
  Eye,
  Clock,
  Calendar,
  X,
  CheckCircle,
  XCircle,
  User,
  FileSpreadsheet,
  Heart,
} from 'lucide-react';
import {
  InstagramCreatorsProvider,
  useInstagramCreators,
} from '../contexts/InstagramCreatorsContext';
import {
  formatViews,
  formatDuration,
  formatInstagramDate,
  downloadInstagramSimple,
  parseDuration,
  type InstagramVideo,
  type InstagramQuality,
} from '../services/instagram.service';

// ========== COMPONENTE: BARRA DE BUSCA ==========

function CreatorsSearchBar() {
  const { username, setUsername, searchCreator, isLoading, error, profile, videos } = useInstagramCreators();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchCreator();
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4 mb-4">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
        {/* Input de username */}
        <div className="flex-1 relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400 w-5 h-5" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Digite o @username do Instagram"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 pl-11 text-white focus:outline-none focus:border-pink-500 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Botao buscar */}
        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          className="px-6 py-3 bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#dc2743] text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Buscando...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Buscar</span>
            </>
          )}
        </button>
      </form>

      {/* Info do perfil encontrado */}
      {profile && (
        <div className="mt-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#dc2743] rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-medium">@{profile.username}</p>
            <p className="text-dark-400 text-sm">
              {videos.length} videos encontrados
              {profile.followers > 0 && ` | ${formatViews(profile.followers)} seguidores`}
            </p>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <p className="text-red-500 text-sm mt-3">{error}</p>
      )}
    </div>
  );
}

// ========== COMPONENTE: BARRA DE FILTROS ==========

function CreatorsFilterBar() {
  const { filters, setFilters, resetFilters, filteredVideos, videos } = useInstagramCreators();

  const [minViewsInput, setMinViewsInput] = useState('');
  const [maxViewsInput, setMaxViewsInput] = useState('');
  const [minDurationInput, setMinDurationInput] = useState('');
  const [maxDurationInput, setMaxDurationInput] = useState('');

  const handleApplyFilters = () => {
    setFilters({
      minViews: minViewsInput ? parseInt(minViewsInput) : null,
      maxViews: maxViewsInput ? parseInt(maxViewsInput) : null,
      minDuration: minDurationInput ? parseDuration(minDurationInput) : null,
      maxDuration: maxDurationInput ? parseDuration(maxDurationInput) : null,
    });
  };

  const handleReset = () => {
    setMinViewsInput('');
    setMaxViewsInput('');
    setMinDurationInput('');
    setMaxDurationInput('');
    resetFilters();
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-pink-500" />
        <span className="text-white font-medium">Filtros</span>
        <span className="text-dark-400 text-sm ml-auto">
          {filteredVideos.length === videos.length
            ? `${videos.length} videos`
            : `${filteredVideos.length} de ${videos.length} videos`}
        </span>
      </div>

      {/* Busca por texto e Periodo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400 w-4 h-4" />
          <input
            type="text"
            value={filters.searchText}
            onChange={(e) => setFilters({ searchText: e.target.value })}
            placeholder="Buscar por titulo..."
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 pl-10 text-white text-sm focus:outline-none focus:border-pink-500"
          />
        </div>

        <select
          value={filters.dateRange}
          onChange={(e) => setFilters({ dateRange: e.target.value as typeof filters.dateRange })}
          className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
        >
          <option value="all">Todo periodo</option>
          <option value="7">Ultimos 7 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="60">Ultimos 60 dias</option>
          <option value="90">Ultimos 90 dias</option>
          <option value="365">Ultimo ano</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Views */}
        <div className="flex gap-2">
          <input
            type="number"
            value={minViewsInput}
            onChange={(e) => setMinViewsInput(e.target.value)}
            placeholder="Views min"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
          />
          <input
            type="number"
            value={maxViewsInput}
            onChange={(e) => setMaxViewsInput(e.target.value)}
            placeholder="Views max"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
          />
        </div>

        {/* Duracao */}
        <div className="flex gap-2">
          <input
            type="text"
            value={minDurationInput}
            onChange={(e) => setMinDurationInput(e.target.value)}
            placeholder="Dur. min (mm:ss)"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
          />
          <input
            type="text"
            value={maxDurationInput}
            onChange={(e) => setMaxDurationInput(e.target.value)}
            placeholder="Dur. max (mm:ss)"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
          />
        </div>

        {/* Ordenacao */}
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ sortBy: e.target.value as typeof filters.sortBy })}
          className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
        >
          <option value="views-desc">Mais Views</option>
          <option value="views-asc">Menos Views</option>
          <option value="likes-desc">Mais Likes</option>
          <option value="likes-asc">Menos Likes</option>
          <option value="date-desc">Mais Recente</option>
          <option value="date-asc">Mais Antigo</option>
          <option value="duration-desc">Maior Duracao</option>
          <option value="duration-asc">Menor Duracao</option>
        </select>

        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors text-sm font-medium"
        >
          Aplicar
        </button>

        <button
          onClick={handleReset}
          className="px-4 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Limpar
        </button>
      </div>
    </div>
  );
}

// ========== COMPONENTE: CONTROLES DE SELECAO ==========

function CreatorsSelectionControls() {
  const {
    selectedIds,
    selectTop5,
    selectBottom5,
    selectAll,
    clearSelection,
    filteredVideos,
    quality,
    setQuality,
    startBatchDownload,
    isDownloading,
    exportCSV,
  } = useInstagramCreators();

  const selectedCount = selectedIds.size;
  const totalCount = filteredVideos.length;

  const qualityOptions: { value: InstagramQuality; label: string }[] = [
    { value: 'best', label: 'Melhor Qualidade' },
    { value: '1080', label: '1080p' },
    { value: '720', label: '720p' },
    { value: '480', label: '480p' },
    { value: 'audio', label: 'Apenas Audio' },
  ];

  return (
    <div className="bg-dark-800 rounded-lg p-4 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{selectedCount} selecionados</span>
          <span className="text-dark-400">de {totalCount} videos</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={selectTop5}
            className="flex items-center gap-2 px-3 py-2 bg-[#f09433]/20 text-[#f09433] rounded hover:bg-[#f09433]/30 transition-colors text-sm"
          >
            <TrendingUp className="w-4 h-4" />
            TOP 5
          </button>

          <button
            onClick={selectBottom5}
            className="flex items-center gap-2 px-3 py-2 bg-pink-500/20 text-pink-500 rounded hover:bg-pink-500/30 transition-colors text-sm"
          >
            <TrendingDown className="w-4 h-4" />
            BOTTOM 5
          </button>

          <button
            onClick={selectAll}
            className="flex items-center gap-2 px-3 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 transition-colors text-sm"
          >
            <CheckSquare className="w-4 h-4" />
            Todos
          </button>

          <button
            onClick={clearSelection}
            className="flex items-center gap-2 px-3 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 transition-colors text-sm"
          >
            <XSquare className="w-4 h-4" />
            Limpar
          </button>
        </div>

        <div className="lg:ml-auto flex items-center gap-3">
          {/* Botao Exportar CSV */}
          <button
            onClick={exportCSV}
            disabled={totalCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            CSV ({totalCount})
          </button>

          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as InstagramQuality)}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
          >
            {qualityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={startBatchDownload}
            disabled={selectedCount === 0 || isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#dc2743] text-white font-medium rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Download className="w-4 h-4" />
            Baixar ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== COMPONENTE: VIDEO CARD ==========

interface VideoCardProps {
  video: InstagramVideo;
}

function CreatorsVideoCard({ video }: VideoCardProps) {
  const { selectedIds, toggleSelection, top5Ids, bottom5Ids, quality } = useInstagramCreators();

  const isSelected = selectedIds.has(video.id);
  const isTop5 = top5Ids.has(video.id);
  const isBottom5 = bottom5Ids.has(video.id);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await downloadInstagramSimple(video.url, quality, video.title, video.views);
    } catch (error) {
      console.error('Erro no download:', error);
    }
  };

  return (
    <div
      onClick={() => toggleSelection(video.id)}
      className={`
        relative bg-dark-800 rounded-lg overflow-hidden cursor-pointer transition-all
        hover:ring-2 hover:ring-pink-500/50
        ${isSelected ? 'ring-2 ring-pink-500' : ''}
        ${isTop5 ? 'border-l-4 border-[#f09433]' : ''}
        ${isBottom5 ? 'border-l-4 border-pink-500' : ''}
      `}
    >
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        {isTop5 && (
          <span className="px-2 py-0.5 bg-[#f09433] text-white text-xs font-bold rounded">
            TOP 5
          </span>
        )}
        {isBottom5 && (
          <span className="px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded">
            BOTTOM 5
          </span>
        )}
        {video.type === 'reel' && (
          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded">
            REEL
          </span>
        )}
      </div>

      {/* Checkbox */}
      <div className="absolute top-2 right-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelection(video.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded border-2 border-dark-500 bg-dark-700 checked:bg-pink-500 checked:border-pink-500 cursor-pointer accent-pink-500"
        />
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-dark-700">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="50" text-anchor="middle" fill="%23666" dy=".3em">IG</text></svg>';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dark-500">
            <span>Sem thumbnail</span>
          </div>
        )}

        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded">
          {formatDuration(video.duration)}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-white text-sm font-medium line-clamp-2 mb-2" title={video.title}>
          {video.title}
        </h3>

        <div className="flex flex-wrap gap-2 text-xs text-dark-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {formatViews(video.views)}
          </span>
          <span className="flex items-center gap-1 text-pink-400">
            <Heart className="w-3 h-3" />
            {formatViews(video.likes)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration)}
          </span>
          {video.uploadDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatInstagramDate(video.uploadDate)}
            </span>
          )}
        </div>

        <button
          onClick={handleDownload}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}

// ========== COMPONENTE: GRID DE VIDEOS ==========

function CreatorsVideoGrid() {
  const { filteredVideos, isLoading, error } = useInstagramCreators();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-dark-400">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p>Carregando videos...</p>
        <p className="text-sm mt-2">Isso pode demorar alguns minutos para perfis grandes</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-pink-500">
        <p className="text-lg font-medium mb-2">Erro ao carregar</p>
        <p className="text-dark-400">{error}</p>
      </div>
    );
  }

  if (filteredVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-dark-400">
        <p className="text-lg">Nenhum video encontrado</p>
        <p className="text-sm mt-2">Digite um @username e clique em Buscar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {filteredVideos.map((video) => (
        <CreatorsVideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

// ========== COMPONENTE: MODAL DE DOWNLOAD ==========

function CreatorsDownloadModal() {
  const {
    isModalOpen,
    closeModal,
    downloadQueue,
    isDownloading,
    cancelDownload,
    completedCount,
    failedCount,
  } = useInstagramCreators();

  if (!isModalOpen) return null;

  const total = downloadQueue.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-dark-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h2 className="text-lg font-bold text-white">
            {isDownloading ? 'Baixando videos...' : 'Download concluido'}
          </h2>
          <button
            onClick={closeModal}
            disabled={isDownloading}
            className="text-dark-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de progresso geral */}
        <div className="p-4 border-b border-dark-700">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-dark-400">Progresso</span>
            <span className="text-white">
              {completedCount} de {total} concluidos
              {failedCount > 0 && <span className="text-pink-500"> ({failedCount} falhas)</span>}
            </span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#dc2743] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Lista de downloads */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {downloadQueue.map((item) => (
            <div
              key={item.video.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg
                ${item.status === 'completed' ? 'bg-green-500/10' : ''}
                ${item.status === 'failed' ? 'bg-pink-500/10' : ''}
                ${item.status === 'downloading' ? 'bg-[#f09433]/10' : ''}
                ${item.status === 'pending' ? 'bg-dark-700' : ''}
              `}
            >
              <div className="flex-shrink-0">
                {item.status === 'pending' && <Clock className="w-5 h-5 text-dark-400" />}
                {item.status === 'downloading' && <Loader2 className="w-5 h-5 text-[#f09433] animate-spin" />}
                {item.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {item.status === 'failed' && <XCircle className="w-5 h-5 text-pink-500" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate" title={item.video.title}>
                  {item.video.title}
                </p>
                <p className="text-dark-400 text-xs">{formatViews(item.video.views)} views</p>
                {item.status === 'failed' && item.error && (
                  <p className="text-pink-500 text-xs mt-1">{item.error}</p>
                )}
              </div>

              {item.status === 'downloading' && (
                <div className="w-16 text-right">
                  <span className="text-[#f09433] text-sm font-medium">{item.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 flex justify-end gap-3">
          {isDownloading ? (
            <button
              onClick={cancelDownload}
              className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
            >
              Cancelar
            </button>
          ) : (
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== COMPONENTE: CONTEUDO DA PAGINA ==========

function InstagramCreatorsContent() {
  const { videos } = useInstagramCreators();

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft size={18} />
              <span>Menu</span>
            </Link>

            <div className="flex items-center gap-3">
              {/* Instagram Logo */}
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-pink-500" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <div>
                <h1 className="text-xl font-bold text-white">Instagram</h1>
                <p className="text-dark-400 text-sm">Outros Criadores</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Busca */}
        <CreatorsSearchBar />

        {/* Filtros e Selecao (so mostrar se tiver videos) */}
        {videos.length > 0 && (
          <>
            <CreatorsFilterBar />
            <CreatorsSelectionControls />
          </>
        )}

        {/* Grid de Videos */}
        <CreatorsVideoGrid />
      </main>

      {/* Modal de Download */}
      <CreatorsDownloadModal />
    </div>
  );
}

// ========== PAGINA PRINCIPAL COM PROVIDER ==========

export function InstagramCreatorsPage() {
  return (
    <InstagramCreatorsProvider>
      <InstagramCreatorsContent />
    </InstagramCreatorsProvider>
  );
}
