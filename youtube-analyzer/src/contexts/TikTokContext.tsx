// ========== SECAO: CONTEXT TIKTOK ==========

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import {
  fetchTikTokVideosFromDB,
  syncTikTokVideos,
  downloadTikTokWithProgress,
  generateTikTokCSV,
  TIKTOK_FIXED_USERNAME,
  type TikTokVideo,
  type TikTokQuality,
} from '../services/tiktok.service';

// ========== TIPOS ==========

type SortOption = 'views-desc' | 'views-asc' | 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc';
type DateRange = '7' | '30' | '60' | '90' | '365' | 'all';

interface TikTokFilters {
  minViews: number | null;
  maxViews: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  sortBy: SortOption;
  dateRange: DateRange;
  searchText: string;
}

interface DownloadQueueItem {
  video: TikTokVideo;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface TikTokContextType {
  // Estado do perfil (fixo: @nextleveldj)
  username: string;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  videos: TikTokVideo[];
  filteredVideos: TikTokVideo[];
  profile: { username: string; videoCount: number } | null;

  // Sincronizacao com banco
  syncVideos: () => Promise<void>;

  // Filtros
  filters: TikTokFilters;
  setFilters: (filters: Partial<TikTokFilters>) => void;
  resetFilters: () => void;

  // Selecao
  selectedIds: Set<string>;
  toggleSelection: (videoId: string) => void;
  selectTop5: () => void;
  selectBottom5: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  top5Ids: Set<string>;
  bottom5Ids: Set<string>;

  // Download
  quality: TikTokQuality;
  setQuality: (quality: TikTokQuality) => void;
  downloadQueue: DownloadQueueItem[];
  isDownloading: boolean;
  isModalOpen: boolean;
  startBatchDownload: () => Promise<void>;
  cancelDownload: () => void;
  closeModal: () => void;
  completedCount: number;
  failedCount: number;

  // Export CSV
  exportCSV: () => void;
}

// ========== CONTEXT ==========

const TikTokContext = createContext<TikTokContextType | null>(null);

// ========== DEFAULT FILTERS ==========

const DEFAULT_FILTERS: TikTokFilters = {
  minViews: null,
  maxViews: null,
  minDuration: null,
  maxDuration: null,
  sortBy: 'views-desc',
  dateRange: 'all',
  searchText: '',
};

// ========== PROVIDER ==========

interface TikTokProviderProps {
  children: ReactNode;
}

export function TikTokProvider({ children }: TikTokProviderProps) {
  // Estado do perfil (fixo: @nextleveldj)
  const username = TIKTOK_FIXED_USERNAME;
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [profile, setProfile] = useState<{ username: string; videoCount: number } | null>(null);

  // Filtros
  const [filters, setFiltersState] = useState<TikTokFilters>(DEFAULT_FILTERS);

  // Selecao
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Download
  const [quality, setQuality] = useState<TikTokQuality>('best');
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadCancelled, setDownloadCancelled] = useState(false);

  // ========== FILTROS ==========

  const setFilters = useCallback((newFilters: Partial<TikTokFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // Videos filtrados e ordenados
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Filtro de busca por texto
    if (filters.searchText.trim()) {
      const search = filters.searchText.toLowerCase().trim();
      result = result.filter(v =>
        v.title.toLowerCase().includes(search) ||
        v.channel.toLowerCase().includes(search)
      );
    }

    // Filtro de periodo (data)
    if (filters.dateRange !== 'all') {
      const days = parseInt(filters.dateRange);
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '');

      result = result.filter(v => {
        if (!v.uploadDate) return false;
        return v.uploadDate >= cutoffStr;
      });
    }

    // Filtro de views
    if (filters.minViews !== null) {
      result = result.filter(v => v.views >= filters.minViews!);
    }
    if (filters.maxViews !== null) {
      result = result.filter(v => v.views <= filters.maxViews!);
    }

    // Filtro de duracao
    if (filters.minDuration !== null) {
      result = result.filter(v => v.duration >= filters.minDuration!);
    }
    if (filters.maxDuration !== null) {
      result = result.filter(v => v.duration <= filters.maxDuration!);
    }

    // Ordenacao
    const [field, order] = filters.sortBy.split('-') as [string, 'asc' | 'desc'];
    const multiplier = order === 'desc' ? -1 : 1;

    result.sort((a, b) => {
      let valueA: number, valueB: number;

      switch (field) {
        case 'views':
          valueA = a.views || 0;
          valueB = b.views || 0;
          break;
        case 'duration':
          valueA = a.duration || 0;
          valueB = b.duration || 0;
          break;
        case 'date':
          valueA = parseInt(a.uploadDate) || 0;
          valueB = parseInt(b.uploadDate) || 0;
          break;
        default:
          valueA = 0;
          valueB = 0;
      }

      return (valueA - valueB) * multiplier;
    });

    return result;
  }, [videos, filters]);

  // ========== TOP 5 / BOTTOM 5 ==========

  const top5Ids = useMemo(() => {
    return new Set(filteredVideos.slice(0, 5).map(v => v.id));
  }, [filteredVideos]);

  const bottom5Ids = useMemo(() => {
    return new Set(filteredVideos.slice(-5).map(v => v.id));
  }, [filteredVideos]);

  // ========== CARREGAR DO BANCO ==========

  // Carrega videos do banco de dados ao iniciar
  useEffect(() => {
    const loadFromDB = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchTikTokVideosFromDB();

        if (!result.success) {
          throw new Error(result.error || 'Falha ao carregar videos');
        }

        setVideos(result.videos);
        setProfile({
          username: result.username,
          videoCount: result.videoCount,
        });
      } catch (err) {
        console.error('[TikTok] Erro ao carregar do banco:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar videos');
      } finally {
        setIsLoading(false);
      }
    };

    loadFromDB();
  }, []);

  // ========== SINCRONIZAR ==========

  const syncVideos = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const result = await syncTikTokVideos(2000);

      if (!result.success) {
        throw new Error(result.error || 'Falha ao sincronizar');
      }

      setVideos(result.videos);
      setProfile({
        username: result.username,
        videoCount: result.videosCount,
      });
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // ========== SELECAO ==========

  const toggleSelection = useCallback((videoId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  }, []);

  const selectTop5 = useCallback(() => {
    setSelectedIds(prev => new Set([...prev, ...top5Ids]));
  }, [top5Ids]);

  const selectBottom5 = useCallback(() => {
    setSelectedIds(prev => new Set([...prev, ...bottom5Ids]));
  }, [bottom5Ids]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredVideos.map(v => v.id)));
  }, [filteredVideos]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ========== DOWNLOAD ==========

  const completedCount = downloadQueue.filter(i => i.status === 'completed').length;
  const failedCount = downloadQueue.filter(i => i.status === 'failed').length;

  const startBatchDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const selectedVideos = filteredVideos.filter(v => selectedIds.has(v.id));

    // Criar fila
    const queue: DownloadQueueItem[] = selectedVideos.map(video => ({
      video,
      status: 'pending',
      progress: 0,
    }));

    setDownloadQueue(queue);
    setIsDownloading(true);
    setIsModalOpen(true);
    setDownloadCancelled(false);

    // Processar downloads sequencialmente
    for (let i = 0; i < queue.length; i++) {
      if (downloadCancelled) break;

      const item = queue[i];

      // Marcar como downloading
      setDownloadQueue(prev =>
        prev.map((q, idx) =>
          idx === i ? { ...q, status: 'downloading' } : q
        )
      );

      try {
        await downloadTikTokWithProgress(
          item.video.url,
          quality,
          item.video.title,
          item.video.views,
          (progress) => {
            setDownloadQueue(prev =>
              prev.map((q, idx) =>
                idx === i ? { ...q, progress } : q
              )
            );
          }
        );

        // Marcar como completo
        setDownloadQueue(prev =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: 'completed', progress: 100 } : q
          )
        );
      } catch (err) {
        // Marcar como falha
        setDownloadQueue(prev =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: 'failed', error: err instanceof Error ? err.message : 'Erro' } : q
          )
        );
      }

      // Delay entre downloads
      if (i < queue.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsDownloading(false);
  }, [selectedIds, filteredVideos, quality, downloadCancelled]);

  const cancelDownload = useCallback(() => {
    setDownloadCancelled(true);
    setIsDownloading(false);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setDownloadQueue([]);
  }, []);

  // ========== EXPORT CSV ==========

  const exportCSV = useCallback(() => {
    if (filteredVideos.length === 0) return;
    generateTikTokCSV(filteredVideos, username);
  }, [filteredVideos, username]);

  // ========== VALUE ==========

  const value: TikTokContextType = {
    username,
    isLoading,
    isSyncing,
    error,
    videos,
    filteredVideos,
    profile,
    syncVideos,
    filters,
    setFilters,
    resetFilters,
    selectedIds,
    toggleSelection,
    selectTop5,
    selectBottom5,
    selectAll,
    clearSelection,
    top5Ids,
    bottom5Ids,
    quality,
    setQuality,
    downloadQueue,
    isDownloading,
    isModalOpen,
    startBatchDownload,
    cancelDownload,
    closeModal,
    completedCount,
    failedCount,
    exportCSV,
  };

  return (
    <TikTokContext.Provider value={value}>
      {children}
    </TikTokContext.Provider>
  );
}

// ========== HOOK ==========

export function useTikTok(): TikTokContextType {
  const context = useContext(TikTokContext);

  if (!context) {
    throw new Error('useTikTok deve ser usado dentro de TikTokProvider');
  }

  return context;
}
