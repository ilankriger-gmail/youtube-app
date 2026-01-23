// ========== COMPONENTE: CONTROLES DE SELECAO TIKTOK ==========

import { TrendingUp, TrendingDown, CheckSquare, XSquare, Download, FileSpreadsheet } from 'lucide-react';
import { useTikTok } from '../../contexts';
import type { TikTokQuality } from '../../services/tiktok.service';

export function TikTokSelectionControls() {
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
  } = useTikTok();

  const selectedCount = selectedIds.size;
  const totalCount = filteredVideos.length;

  const qualityOptions: { value: TikTokQuality; label: string }[] = [
    { value: 'best', label: 'Melhor Qualidade' },
    { value: '1080', label: '1080p' },
    { value: '720', label: '720p' },
    { value: '480', label: '480p' },
    { value: 'audio', label: 'Apenas Audio' },
  ];

  return (
    <div className="bg-dark-800 rounded-lg p-4 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Contagem */}
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">
            {selectedCount} selecionados
          </span>
          <span className="text-dark-400">
            de {totalCount} videos
          </span>
        </div>

        {/* Botoes de selecao */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={selectTop5}
            className="flex items-center gap-2 px-3 py-2 bg-[#25f4ee]/20 text-[#25f4ee] rounded hover:bg-[#25f4ee]/30 transition-colors text-sm"
          >
            <TrendingUp className="w-4 h-4" />
            TOP 5
          </button>

          <button
            onClick={selectBottom5}
            className="flex items-center gap-2 px-3 py-2 bg-[#fe2c55]/20 text-[#fe2c55] rounded hover:bg-[#fe2c55]/30 transition-colors text-sm"
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

        {/* Qualidade e Acoes */}
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
            onChange={(e) => setQuality(e.target.value as TikTokQuality)}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#fe2c55]"
          >
            {qualityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Botao download em lote */}
          <button
            onClick={startBatchDownload}
            disabled={selectedCount === 0 || isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#25f4ee] to-[#fe2c55] text-white font-medium rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Download className="w-4 h-4" />
            Baixar ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
