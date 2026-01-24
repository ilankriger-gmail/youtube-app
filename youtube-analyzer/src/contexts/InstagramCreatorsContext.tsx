// ========== SECAO: CONTEXT INSTAGRAM CRIADORES ==========

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  fetchInstagramProfile,
  downloadInstagramWithProgress,
  generateInstagramCSV,
  type InstagramVideo,
  type InstagramQuality,
} from '../services/instagram.service';

// ========== TIPOS ==========

type SortOption = 'views-desc' | 'views-asc' | 'likes-desc' | 'likes-asc' | 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc';
type DateRange = '7' | '30' | '60' | '90' | '180' | '365' | 'all';

interface InstagramFilters {
  minViews: number | null;
  maxViews: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  sortBy: SortOption;
  dateRange: DateRange;
  searchText: string;
}

interface DownloadQueueItem {
  video: InstagramVideo;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface InstagramCreatorsContextType {
  // Busca de criador
  username: string;
  setUsername: (username: string) => void;
  searchCreator: () => Promise<void>;

  // Estado
  isLoading: boolean;
  error: string | null;
  videos: InstagramVideo[];
  filteredVideos: InstagramVideo[];
  profile: { username: string; fullName: string; videoCount: number; followers: number } | null;

  // Filtros
  filters: InstagramFilters;
  setFilters: (filters: Partial<InstagramFilters>) => void;
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
  quality: InstagramQuality;
  setQuality: (quality: InstagramQuality) => void;
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

const InstagramCreatorsContext = createContext<InstagramCreatorsContextType | null>(null);

// ========== DEFAULT FILTERS ==========

const DEFAULT_FILTERS: InstagramFilters = {
  minViews: null,
  maxViews: null,
  minDuration: null,
  maxDuration: null,
  sortBy: 'views-desc',
  dateRange: 'all',
  searchText: '',
};

// ========== PROVIDER ==========

interface InstagramCreatorsProviderProps {
  children: ReactNode;
}

export function InstagramCreatorsProvider({ children }: InstagramCreatorsProviderProps) {
  // Estado da busca
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<InstagramVideo[]>([]);
  const [profile, setProfile] = useState<{ username: string; fullName: string; videoCount: number; followers: number } | null>(null);

  // Filtros
  const [filters, setFiltersState] = useState<InstagramFilters>(DEFAULT_FILTERS);

  // Selecao
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Download
  const [quality, setQuality] = useState<InstagramQuality>('best');
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadCancelled, setDownloadCancelled] = useState(false);

  // ========== BUSCAR CRIADOR ==========

  const searchCreator = useCallback(async () => {
    if (!username.trim()) {
      setError('Digite um username');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideos([]);
    setProfile(null);
    setSelectedIds(new Set());

    try {
      const result = await fetchInstagramProfile(username.trim(), 100);

      if (!result.success) {
        throw new Error(result.error || 'Falha ao buscar perfil');
      }

      setVideos(result.videos);
      setProfile(result.profile);
    } catch (err) {
      console.error('[Instagram Creators] Erro ao buscar perfil:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar perfil');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  // ========== FILTROS ==========

  const setFilters = useCallback((newFilters: Partial<InstagramFilters>) => {
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
        case 'likes':
          valueA = a.likes || 0;
          valueB = b.likes || 0;
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
        await downloadInstagramWithProgress(
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
    const creatorUsername = profile?.username || username || 'unknown';
    generateInstagramCSV(filteredVideos, creatorUsername);
  }, [filteredVideos, profile, username]);

  // ========== VALUE ==========

  const value: InstagramCreatorsContextType = {
    username,
    setUsername,
    searchCreator,
    isLoading,
    error,
    videos,
    filteredVideos,
    profile,
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
    <InstagramCreatorsContext.Provider value={value}>
      {children}
    </InstagramCreatorsContext.Provider>
  );
}

// ========== HOOK ==========

export function useInstagramCreators(): InstagramCreatorsContextType {
  const context = useContext(InstagramCreatorsContext);

  if (!context) {
    throw new Error('useInstagramCreators deve ser usado dentro de InstagramCreatorsProvider');
  }

  return context;
}
