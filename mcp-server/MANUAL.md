# Social Media MCP Server v2.0 - Manual Completo

MCP server que expoe dados normalizados de YouTube, TikTok e Instagram para qualquer cliente MCP (Claude Desktop, Claude Code, ou outro).

Todas as tools retornam **JSON estruturado** com schema unificado de video, agregados, paginacao e status de erro tipado.

---

## Indice

1. [O que e este MCP](#1-o-que-e-este-mcp)
2. [Arquitetura](#2-arquitetura)
3. [Pre-requisitos](#3-pre-requisitos)
4. [Instalacao](#4-instalacao)
5. [Configuracao no Claude Desktop](#5-configuracao-no-claude-desktop)
6. [Configuracao no Claude Code](#6-configuracao-no-claude-code)
7. [Variaveis de ambiente](#7-variaveis-de-ambiente)
8. [Schema de resposta](#8-schema-de-resposta)
9. [Schema de video normalizado](#9-schema-de-video-normalizado)
10. [Parametros compartilhados](#10-parametros-compartilhados)
11. [Tools disponiveis](#11-tools-disponiveis)
12. [Exemplos de uso](#12-exemplos-de-uso)
13. [Codigos de erro](#13-codigos-de-erro)
14. [Troubleshooting](#14-troubleshooting)
15. [Desenvolvimento](#15-desenvolvimento)

---

## 1. O que e este MCP

Este servidor implementa o protocolo MCP via transporte **stdio**. Funciona como ponte entre um cliente MCP e os backends existentes do projeto.

O cliente chama tools como `youtube_get_videos(handle, last_n_days=120)` e recebe JSON estruturado com videos normalizados, agregados e paginacao. Nao precisa conhecer as APIs internas.

**Fluxo:**

```
Cliente MCP  -->  MCP Server (stdio)  -->  Backend YouTube/TikTok (:3001)
                                       -->  Backend Instagram (:3002)
```

---

## 2. Arquitetura

```
mcp-server/
  src/
    types.ts       # Interfaces: NormalizedVideo, ToolResponse, Aggregates...
    helpers.ts     # Normalizers, filtros, paginacao, agregacao, fetchers
    index.ts       # McpServer + definicao das 10 tools
  dist/            # Build compilado
  package.json
  tsconfig.json
  claude-desktop-config.json
  MANUAL.md
```

O servidor:
- SDK: `@modelcontextprotocol/sdk` (oficial)
- Transporte: **stdio** (stdin/stdout)
- Chamadas HTTP para backends existentes
- Sem banco de dados proprio
- Versao: **2.0.0**

---

## 3. Pre-requisitos

### Backends rodando

| Backend | Porta | Diretorio | Comando |
|---------|-------|-----------|---------|
| YouTube + TikTok | `3001` | `youtube-analyzer/server/` | `cd youtube-analyzer && npm run server` |
| Instagram | `3002` | `instagram-analyzer/server/` | `cd instagram-analyzer && node server/index.js` |

**Sem os backends rodando, todas as tools retornam `error_code: "backend_unavailable"`.**

### YouTube API Key

Variavel `YOUTUBE_API_KEY` no backend da porta 3001.

### Software

- **Node.js** >= 18 (fetch nativo)
- **yt-dlp** + **ffmpeg** (backends TikTok/Instagram)
- **Python 3** + **Instaloader** (backend Instagram)

---

## 4. Instalacao

```bash
cd mcp-server
npm install
npm run build
```

### Testar

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js 2>/dev/null
```

Resposta esperada:

```json
{"result":{"serverInfo":{"name":"social-media-data","version":"2.0.0"},...}}
```

---

## 5. Configuracao no Claude Desktop

Edite:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "social-media-data": {
      "command": "node",
      "args": ["/Users/macbookair/Desktop/Dev/Youtube App/mcp-server/dist/index.js"],
      "env": {
        "YOUTUBE_BACKEND_URL": "http://localhost:3001",
        "INSTAGRAM_BACKEND_URL": "http://localhost:3002"
      }
    }
  }
}
```

Apos salvar, **reinicie o Claude Desktop**.

---

## 6. Configuracao no Claude Code

Adicione ao `.claude/settings.json` (projeto ou global):

```json
{
  "mcpServers": {
    "social-media-data": {
      "command": "node",
      "args": ["/Users/macbookair/Desktop/Dev/Youtube App/mcp-server/dist/index.js"],
      "env": {
        "YOUTUBE_BACKEND_URL": "http://localhost:3001",
        "INSTAGRAM_BACKEND_URL": "http://localhost:3002"
      }
    }
  }
}
```

---

## 7. Variaveis de ambiente

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| `YOUTUBE_BACKEND_URL` | `http://localhost:3001` | Backend YouTube/TikTok |
| `INSTAGRAM_BACKEND_URL` | `http://localhost:3002` | Backend Instagram |

Para producao:

```json
{
  "env": {
    "YOUTUBE_BACKEND_URL": "https://meu-backend.railway.app",
    "INSTAGRAM_BACKEND_URL": "https://instagram-analyzer-production-f8bf.up.railway.app"
  }
}
```

---

## 8. Schema de resposta

Todas as tools retornam esta estrutura JSON:

```typescript
{
  data: {
    profile?: { ... },           // Info do canal/perfil
    videos?: NormalizedVideo[],   // Videos normalizados
    aggregates?: {                // Metricas agregadas
      total_videos: number,
      total_views: number,
      total_likes: number,
      total_comments: number,
      avg_views: number,
      median_views: number,
      avg_likes: number,
    },
    pagination?: {                // Info de paginacao
      page: number,
      page_size: number,
      total_count: number,      // Total ANTES da paginacao, DEPOIS dos filtros
      total_pages: number,
      has_next: boolean,
    },
    comments?: CommentData[],    // Apenas em instagram_get_comments
    platforms?: { ... },         // Apenas em tools multi-plataforma
    combined?: { ... },          // Apenas em performance_summary
  },
  meta: {
    platform: string,            // "youtube", "tiktok", "instagram", "all"
    source: "live" | "database",
    source_status: "ok" | "partial" | "error",
    cached: boolean,
    fetched_at: string,          // ISO 8601
    error?: string,              // Mensagem de erro (se houver)
    error_code?: ErrorCode,      // Codigo tipado (se houver)
  },
  formatted_summary: string,     // Resumo legivel em 1 linha
}
```

**Nota para agentes:** Use `data.videos`, `data.aggregates` e `data.pagination` diretamente. O `formatted_summary` e opcional para exibicao humana.

---

## 9. Schema de video normalizado

Todos os videos de todas as plataformas seguem este schema unico:

```typescript
{
  platform: "youtube" | "tiktok" | "instagram",
  account_handle: string,       // @nextleveldj1, nextleveldj, etc.
  external_id: string,          // ID unico na plataforma
  title: string,
  url: string,                  // URL direta do video
  published_at: string,         // ISO 8601
  duration_seconds: number,
  views: number,
  likes: number,
  comments: number,
  shares: number | null,        // Disponivel apenas em algumas plataformas
  saves: number | null,         // Disponivel apenas em algumas plataformas
  is_short: boolean,            // YouTube: <=60s, TikTok: sempre true, Instagram: reel=true
  content_type: "short" | "video" | "reel" | "post",
  thumbnail: string | null,
  caption: string | null,       // Descricao/legenda (ate 500 chars YouTube, 120 Instagram)
  hashtags: string[],           // Extraidas automaticamente do titulo/caption
  raw: { ... },                 // Dados originais da API (para debug/extensao)
}
```

### Campos por plataforma

| Campo | YouTube | TikTok | Instagram |
|-------|---------|--------|-----------|
| `views` | sim | sim | sim |
| `likes` | sim | se disponivel | sim |
| `comments` | sim | se disponivel | sim |
| `shares` | null | se disponivel | null |
| `saves` | null | se disponivel | null |
| `duration_seconds` | sim | sim | sim |
| `thumbnail` | sim | sim | sim |
| `caption` | descricao (500 chars) | titulo | caption (120 chars) |
| `hashtags` | titulo + descricao | titulo | caption |
| `content_type` | short/video | short | reel/post |

---

## 10. Parametros compartilhados

Estes parametros estao disponiveis em todas as tools que retornam videos:

### Filtro por data

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `published_after` | string (ISO date) | Apenas videos publicados apos esta data. Ex: `"2025-01-01"` |
| `published_before` | string (ISO date) | Apenas videos publicados antes desta data. Ex: `"2025-12-31"` |
| `last_n_days` | number | Apenas videos dos ultimos N dias. **Sobrescreve `published_after`** |

**Exemplo:** `last_n_days: 120` = videos dos ultimos 4 meses.

Os filtros sao aplicados APOS buscar os dados e ANTES de paginar. O `aggregates.total_videos` reflete o total filtrado.

### Ordenacao

| Parametro | Tipo | Padrao | Opcoes |
|-----------|------|--------|--------|
| `sort_by` | string | `"date"` | `views`, `likes`, `comments`, `date`, `duration` |
| `sort_order` | string | `"desc"` | `asc`, `desc` |

### Paginacao

| Parametro | Tipo | Padrao | Descricao |
|-----------|------|--------|-----------|
| `page` | number | `1` | Numero da pagina |
| `page_size` | number | `50` | Itens por pagina (max 200) |

### Source (TikTok e Instagram)

| Parametro | Tipo | Padrao | Descricao |
|-----------|------|--------|-----------|
| `source` | string | `"live"` | `"live"` = busca fresca via scraping. `"database"` = dados salvos no banco (mais rapido, pode estar desatualizado) |

---

## 11. Tools disponiveis

### 11.1 `youtube_get_channel`

Informacoes do canal do YouTube.

**Parametros especificos:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `handle` | `@nextleveldj1` | Handle do canal |

**Retorna:** `data.profile` com id, nome, descricao, inscritos, total de videos, views totais, playlist de uploads.

---

### 11.2 `youtube_get_videos`

Videos de um canal do YouTube com todos os filtros.

**Parametros especificos:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `handle` | `@nextleveldj1` | Handle do canal |
| `type` | `"all"` | `all`, `short` (<=60s), `long` (>60s) |

Mais: filtro por data, ordenacao, paginacao.

**Retorna:** `data.profile`, `data.videos[]`, `data.aggregates`, `data.pagination`.

**Limites:** Max 5000 videos. Cada lote de 50 = 1 quota da YouTube API.

---

### 11.3 `tiktok_get_profile`

Videos de um perfil do TikTok (live ou banco).

**Parametros especificos:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `username` | `nextleveldj` | Username |
| `limit` | `100` | Max videos no scraping live (max 2000) |
| `source` | `"live"` | `"live"` ou `"database"` |

Mais: filtro por data, ordenacao, paginacao.

---

### 11.4 `tiktok_get_saved_videos`

Videos do TikTok salvos no banco (perfil `@nextleveldj`).

**Parametros:** Apenas filtro por data, ordenacao e paginacao.

---

### 11.5 `instagram_get_profile`

Videos/reels de um perfil do Instagram (live ou banco).

**Parametros especificos:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `username` | `nextleveldj1` | Username |
| `limit` | `100` | Max videos no scraping live (max 100) |
| `source` | `"live"` | `"live"` ou `"database"` |

Mais: filtro por data, ordenacao, paginacao.

---

### 11.6 `instagram_get_saved_videos`

Videos do Instagram salvos no banco (perfil `@nextleveldj1`).

**Parametros:** Apenas filtro por data, ordenacao e paginacao.

---

### 11.7 `instagram_get_comments`

Comentarios de um post/reel especifico.

**Parametros especificos:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `shortcode` | - | Shortcode do post (ex: `ABC123def`) |
| `limit` | `500` | Max comentarios |

Mais: paginacao.

**Retorna:** `data.comments[]` com autor, texto, likes, verificado, respostas, data.

**Como achar o shortcode:** Na URL `instagram.com/reel/ABC123def/`, o shortcode e `ABC123def`.

---

### 11.8 `social_media_overview`

Resumo consolidado de todas as plataformas.

**Parametros:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `youtube_handle` | `@nextleveldj1` | Handle YouTube |
| `tiktok_username` | `nextleveldj` | Username TikTok |
| `instagram_username` | `nextleveldj1` | Username Instagram |

**Retorna:** `data.platforms` com profile e aggregates por plataforma. Busca YouTube via API ao vivo, TikTok e Instagram do banco (rapido). Se uma plataforma falhar, as outras ainda retornam (`source_status: "partial"`).

---

### 11.9 `social_media_get_videos_normalized` (NOVO)

**Tool consolidada cross-platform.** Busca videos de uma ou todas as plataformas e retorna tudo num schema unico, ordenado junto.

**Parametros:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `platform` | `"all"` | `youtube`, `tiktok`, `instagram`, ou `all` |
| `handle` | (defaults por plataforma) | Handle/username |
| `limit` | `50` | Max videos por plataforma (live) |
| `source` | `"live"` | `"live"` ou `"database"` (TikTok/Instagram) |

Mais: filtro por data, ordenacao, paginacao.

**Comportamento com `platform: "all"`:**
- Busca das 3 plataformas em paralelo (`Promise.allSettled`)
- Se uma falhar, as outras ainda retornam
- Videos sao mesclados e ordenados juntos
- `data.platforms` mostra status individual de cada plataforma

**Exemplo de uso tipico:**

```
social_media_get_videos_normalized(
  platform: "all",
  last_n_days: 120,
  sort_by: "views",
  sort_order: "desc",
  page_size: 20
)
```

Retorna os 20 videos mais vistos de todas as plataformas nos ultimos 120 dias.

---

### 11.10 `social_media_get_performance_summary` (NOVO)

**Analise de performance detalhada** por janela de tempo.

**Parametros:**

| Nome | Padrao | Descricao |
|------|--------|-----------|
| `platform` | `"all"` | `youtube`, `tiktok`, `instagram`, ou `all` |
| `handle` | (defaults por plataforma) | Handle/username |
| `days` | `90` | Janela de analise em dias |

**Retorna por plataforma (`data.platforms`):**

```typescript
{
  total_videos: number,
  total_views: number,
  total_likes: number,
  total_comments: number,
  avg_views: number,
  median_views: number,
  top_10_videos: NormalizedVideo[],    // Os 10 mais vistos no periodo
  bottom_10_videos: NormalizedVideo[], // Os 10 menos vistos
  shorts_count: number,
  shorts_ratio: number,               // 0.0 a 1.0
  posting_frequency: {
    posts_per_week: number,
  },
  views_trend: {
    first_half_avg: number,            // Media de views da 1a metade
    second_half_avg: number,           // Media de views da 2a metade
    direction: "up" | "down" | "stable",  // >10% diff = up/down
  },
}
```

**Retorna combinado (`data.combined`):** Mesma estrutura, com dados de todas as plataformas juntos.

**Exemplo de uso:**

```
social_media_get_performance_summary(
  platform: "all",
  days: 90
)
```

Retorna performance dos ultimos 3 meses: medias, medianas, top 10, tendencia, frequencia de postagem.

---

## 12. Exemplos de uso

### Para agentes/M1

> "Me da todos os videos dos ultimos 120 dias de todas as plataformas, ordenados por views"

```
social_media_get_videos_normalized(platform: "all", last_n_days: 120, sort_by: "views")
```

> "Analise de performance dos ultimos 3 meses"

```
social_media_get_performance_summary(platform: "all", days: 90)
```

> "Apenas shorts do YouTube do ultimo mes, pagina 2"

```
youtube_get_videos(type: "short", last_n_days: 30, page: 2, page_size: 20)
```

> "Reels do Instagram de janeiro a marco 2025"

```
instagram_get_profile(published_after: "2025-01-01", published_before: "2025-03-31")
```

> "Videos do TikTok salvos no banco, dos ultimos 60 dias, mais curtidos primeiro"

```
tiktok_get_profile(source: "database", last_n_days: 60, sort_by: "likes")
```

### Para humanos

> "Me da um resumo de todas as minhas redes sociais"

Chama `social_media_overview`. Retorna inscritos, videos e views de cada plataforma.

> "Quais sao meus 10 videos mais vistos do YouTube?"

Chama `youtube_get_videos(sort_by: "views", page_size: 10)`.

> "Pega os comentarios do meu reel ABC123"

Chama `instagram_get_comments(shortcode: "ABC123")`.

> "Compara YouTube vs TikTok nos ultimos 90 dias"

Chama `social_media_get_performance_summary(platform: "all", days: 90)` e compara os blocos youtube vs tiktok.

---

## 13. Codigos de erro

Quando algo falha, `meta.error_code` retorna um dos seguintes:

| Codigo | Causa | Solucao |
|--------|-------|---------|
| `backend_unavailable` | Backend (3001 ou 3002) nao esta rodando | Inicie os backends |
| `not_found` | Handle/username nao existe | Verifique o handle |
| `rate_limited` | Limite de requisicoes excedido | Espere e tente novamente |
| `invalid_handle` | Parametro invalido | Verifique o formato |
| `scraping_failed` | Erro generico de scraping | Verifique logs do backend |
| `partial_data` | Dados parciais retornados | Alguns dados podem estar faltando |

As tools **nunca crasham**. Sempre retornam a estrutura JSON completa com status de erro no `meta`.

Em tools multi-plataforma (`social_media_overview`, `_normalized`, `_performance_summary`), se uma plataforma falha as outras ainda retornam. O `meta.source_status` sera `"partial"`.

---

## 14. Troubleshooting

### "backend_unavailable" em tudo

```bash
# Inicie os backends
cd youtube-analyzer && npm run server    # Terminal 1
cd instagram-analyzer && node server/index.js  # Terminal 2
```

### "YouTube API Key not configured"

Crie `.env` em `youtube-analyzer/`:
```
YOUTUBE_API_KEY=sua_chave_aqui
```

### "not_found" no YouTube

Use formato com `@`: `@nextleveldj1`, nao `nextleveldj1`.

### Tools nao aparecem no Claude Desktop

1. Verifique que o JSON em `claude_desktop_config.json` e valido
2. Verifique o caminho absoluto para `dist/index.js`
3. Reinicie completamente o Claude Desktop
4. Procure o icone de martelo na interface

### Instagram demora muito

Use `source: "database"` para dados rapidos (pre-salvos), ou `limit` menor para live.

### TikTok retorna poucos videos

Use `limit` maior (ate 2000) no live, ou `source: "database"` apos sincronizar pela interface web.

### Dados desatualizados no modo "database"

Os dados do banco sao do ultimo sync. Para atualizar:
- TikTok: use `source: "live"` ou sincronize pela interface web
- Instagram: use `source: "live"` ou `POST /api/refresh` no backend

---

## 15. Desenvolvimento

### Rodar em modo dev

```bash
cd mcp-server
npm run dev
```

### Rebuild

```bash
npm run build
```

### Estrutura do codigo

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/types.ts` | Interfaces TypeScript (NormalizedVideo, ToolResponse, Aggregates, etc.) |
| `src/helpers.ts` | Normalizers, fetchJSON, filtros de data, paginacao, agregacao, error mapping |
| `src/index.ts` | McpServer + definicao das 10 tools |

### Adicionar nova tool

```typescript
// Em src/index.ts
server.tool(
  "nome_da_tool",
  "Descricao",
  {
    param: z.string().describe("..."),
    ...dateFilterSchema,    // Reutilize os schemas compartilhados
    ...sortSchema,
    ...paginationSchema,
  },
  async ({ param, ...rest }) => {
    try {
      // Buscar dados
      let videos = await fetchAlgumaCoisaDoBackend(config, param);

      // Pipeline padrao: filtrar -> agregar -> ordenar -> paginar
      videos = applyDateFilter(videos, rest);
      const aggregates = computeAggregates(videos);
      videos = sortVideos(videos, rest.sort_by, rest.sort_order);
      const { items, pagination } = paginate(videos, rest.page, rest.page_size);

      const response: ToolResponse = {
        data: { videos: items, aggregates, pagination },
        meta: buildMeta('plataforma', 'live', 'ok'),
        formatted_summary: formatVideoSummary(aggregates, items.length, 'Plataforma'),
      };
      return toMcpResult(response);
    } catch (err) {
      return toMcpResult(buildErrorResponse('plataforma', 'live', err));
    }
  }
);
```

### Adicionar novo normalizer

Em `src/helpers.ts`, crie uma funcao que mapeia dados brutos para `NormalizedVideo`. Extraia hashtags com `extractHashtags()`. Campos nao disponiveis devem ser `null` (shares, saves).

Apos alteracoes: `npm run build` e reinicie o cliente MCP.
