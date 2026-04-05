#!/usr/bin/env node

// ========== MCP SERVER - SOCIAL MEDIA DATA ==========
// Expoe dados de YouTube, TikTok e Instagram para outros clientes MCP
// Transporte: stdio (compativel com Claude Desktop e Claude Code)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ========== CONFIG ==========

const YOUTUBE_BACKEND = process.env.YOUTUBE_BACKEND_URL || "http://localhost:3001";
const INSTAGRAM_BACKEND = process.env.INSTAGRAM_BACKEND_URL || "http://localhost:3002";

// ========== HELPERS ==========

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json();
}

// Formata numero para exibicao (1.2M, 3.4K)
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Formata duracao em segundos para mm:ss
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ========== SERVER ==========

const server = new McpServer({
  name: "social-media-data",
  version: "1.0.0",
});

// ========== YOUTUBE TOOLS ==========

server.tool(
  "youtube_get_channel",
  "Busca informacoes de um canal do YouTube pelo handle (@usuario). Retorna nome, descricao, inscritos, total de videos.",
  {
    handle: z.string().describe("Handle do canal (ex: @nextleveldj1)"),
  },
  async ({ handle }) => {
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;

    // 1. Buscar canal
    const channelData = await fetchJSON(
      `${YOUTUBE_BACKEND}/api/youtube/channels?forHandle=${encodeURIComponent(cleanHandle)}&part=snippet,statistics,contentDetails`
    );

    if (!channelData.items?.length) {
      return {
        content: [{ type: "text", text: `Canal "${cleanHandle}" nao encontrado.` }],
      };
    }

    const ch = channelData.items[0];
    const info = {
      id: ch.id,
      nome: ch.snippet.title,
      descricao: ch.snippet.description?.substring(0, 300),
      thumbnail: ch.snippet.thumbnails?.default?.url,
      inscritos: Number(ch.statistics.subscriberCount),
      totalVideos: Number(ch.statistics.videoCount),
      visualizacoesTotais: Number(ch.statistics.viewCount),
      uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
    };

    return {
      content: [
        {
          type: "text",
          text: [
            `📺 Canal: ${info.nome}`,
            `ID: ${info.id}`,
            `Inscritos: ${formatNumber(info.inscritos)}`,
            `Videos: ${formatNumber(info.totalVideos)}`,
            `Views totais: ${formatNumber(info.visualizacoesTotais)}`,
            `Playlist de uploads: ${info.uploadsPlaylistId}`,
            "",
            `Descricao: ${info.descricao || "Sem descricao"}`,
          ].join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "youtube_get_videos",
  "Busca todos os videos de um canal do YouTube. Retorna titulo, views, likes, comentarios, duracao, data de publicacao. Pode filtrar por shorts ou videos longos.",
  {
    handle: z.string().describe("Handle do canal (ex: @nextleveldj1)"),
    type: z.enum(["all", "short", "long"]).default("all").describe("Filtrar por tipo: all, short (<=60s), long (>60s)"),
    limit: z.number().default(0).describe("Limite de videos (0 = todos)"),
    sort_by: z.enum(["views", "likes", "comments", "date", "duration"]).default("date").describe("Ordenar por"),
    sort_order: z.enum(["asc", "desc"]).default("desc").describe("Ordem"),
  },
  async ({ handle, type, limit, sort_by, sort_order }) => {
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;

    // 1. Buscar canal
    const channelData = await fetchJSON(
      `${YOUTUBE_BACKEND}/api/youtube/channels?forHandle=${encodeURIComponent(cleanHandle)}&part=snippet,statistics,contentDetails`
    );

    if (!channelData.items?.length) {
      return {
        content: [{ type: "text", text: `Canal "${cleanHandle}" nao encontrado.` }],
      };
    }

    const channel = channelData.items[0];
    const playlistId = channel.contentDetails.relatedPlaylists.uploads;

    // 2. Buscar todos os video IDs da playlist
    const videoIds: string[] = [];
    let nextPageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        playlistId,
        part: "contentDetails",
        maxResults: "50",
      });
      if (nextPageToken) params.set("pageToken", nextPageToken);

      const page = await fetchJSON(`${YOUTUBE_BACKEND}/api/youtube/playlistItems?${params}`);
      const ids = page.items?.map((item: any) => item.contentDetails.videoId) || [];
      videoIds.push(...ids);
      nextPageToken = page.nextPageToken;
    } while (nextPageToken && videoIds.length < 5000);

    // 3. Buscar detalhes dos videos em lotes de 50
    const videos: any[] = [];

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const data = await fetchJSON(
        `${YOUTUBE_BACKEND}/api/youtube/videos?id=${batch.join(",")}&part=snippet,contentDetails,statistics`
      );

      for (const v of data.items || []) {
        const duration = parseDuration(v.contentDetails.duration);
        const isShort = duration <= 60;

        if (type === "short" && !isShort) continue;
        if (type === "long" && isShort) continue;

        videos.push({
          id: v.id,
          titulo: v.snippet.title,
          publicadoEm: v.snippet.publishedAt,
          duracao: duration,
          duracaoFormatada: formatDuration(duration),
          views: Number(v.statistics.viewCount || 0),
          likes: Number(v.statistics.likeCount || 0),
          comentarios: Number(v.statistics.commentCount || 0),
          isShort,
          url: `https://youtube.com/watch?v=${v.id}`,
        });
      }
    }

    // 4. Ordenar
    const sortKey = {
      views: "views",
      likes: "likes",
      comments: "comentarios",
      date: "publicadoEm",
      duration: "duracao",
    }[sort_by] as string;

    videos.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (sort_order === "desc") return va > vb ? -1 : 1;
      return va < vb ? -1 : 1;
    });

    // 5. Aplicar limite
    const result = limit > 0 ? videos.slice(0, limit) : videos;

    // 6. Calcular totais
    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
    const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;

    const header = [
      `📺 Canal: ${channel.snippet.title}`,
      `Total de videos: ${videos.length} | Mostrando: ${result.length}`,
      `Views totais: ${formatNumber(totalViews)} | Media: ${formatNumber(avgViews)} | Likes totais: ${formatNumber(totalLikes)}`,
      `Filtro: ${type} | Ordenado por: ${sort_by} ${sort_order}`,
      "---",
    ].join("\n");

    const rows = result.map(
      (v, i) =>
        `${i + 1}. ${v.titulo}\n   ${formatNumber(v.views)} views | ${formatNumber(v.likes)} likes | ${v.comentarios} comments | ${v.duracaoFormatada} | ${v.isShort ? "Short" : "Video"} | ${v.publicadoEm.slice(0, 10)}\n   ${v.url}`
    );

    return {
      content: [{ type: "text", text: header + "\n" + rows.join("\n\n") }],
    };
  }
);

// ========== TIKTOK TOOLS ==========

server.tool(
  "tiktok_get_profile",
  "Busca videos de um perfil do TikTok. Retorna titulo, views, duracao, data de publicacao.",
  {
    username: z.string().describe("Username do TikTok (ex: nextleveldj)"),
    limit: z.number().default(100).describe("Limite de videos (max 2000)"),
  },
  async ({ username, limit }) => {
    const cleanUser = username.replace("@", "");

    const data = await fetchJSON(`${YOUTUBE_BACKEND}/api/tiktok/profile`, {
      method: "POST",
      body: JSON.stringify({ username: cleanUser, limit: Math.min(limit, 2000) }),
    });

    if (!data.success) {
      return {
        content: [{ type: "text", text: `Erro ao buscar @${cleanUser}: ${data.error}` }],
      };
    }

    const videos = data.videos || [];
    const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
    const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;

    const header = [
      `🎵 TikTok: @${data.profile?.username || cleanUser}`,
      `Videos: ${data.profile?.videoCount || videos.length}`,
      `Views totais: ${formatNumber(totalViews)} | Media: ${formatNumber(avgViews)}`,
      "---",
    ].join("\n");

    const rows = videos.map(
      (v: any, i: number) =>
        `${i + 1}. ${v.title || "Sem titulo"}\n   ${formatNumber(v.views || 0)} views | ${v.duration || "?"} | ${formatTikTokDate(v.uploadDate)}\n   ${v.url}`
    );

    return {
      content: [{ type: "text", text: header + "\n" + rows.join("\n\n") }],
    };
  }
);

server.tool(
  "tiktok_get_saved_videos",
  "Retorna videos do TikTok salvos no banco de dados (perfil @nextleveldj, sincronizado previamente).",
  {},
  async () => {
    const data = await fetchJSON(`${YOUTUBE_BACKEND}/api/tiktok/videos`);

    if (!data.success) {
      return {
        content: [{ type: "text", text: `Erro: ${data.error}` }],
      };
    }

    const videos = data.videos || [];
    const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);

    const header = [
      `🎵 TikTok (banco): @${data.username}`,
      `Videos salvos: ${data.videoCount}`,
      `Views totais: ${formatNumber(totalViews)}`,
      "---",
    ].join("\n");

    const rows = videos.map(
      (v: any, i: number) =>
        `${i + 1}. ${v.title || "Sem titulo"}\n   ${formatNumber(v.views || 0)} views | ${v.duration || "?"}\n   ${v.url}`
    );

    return {
      content: [{ type: "text", text: header + "\n" + rows.join("\n\n") }],
    };
  }
);

// ========== INSTAGRAM TOOLS ==========

server.tool(
  "instagram_get_profile",
  "Busca videos/reels de um perfil do Instagram. Retorna titulo, views, likes, comentarios, tipo (reel/post).",
  {
    username: z.string().describe("Username do Instagram (ex: nextleveldj1)"),
    limit: z.number().default(100).describe("Limite de videos (max 100)"),
  },
  async ({ username, limit }) => {
    const cleanUser = username.replace("@", "");

    const data = await fetchJSON(`${INSTAGRAM_BACKEND}/api/profile/${cleanUser}`, {
      method: "POST",
      body: JSON.stringify({ limit: Math.min(limit, 100) }),
    });

    if (!data.success) {
      return {
        content: [{ type: "text", text: `Erro ao buscar @${cleanUser}: ${data.error}` }],
      };
    }

    const videos = data.videos || [];
    const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
    const totalLikes = videos.reduce((s: number, v: any) => s + (v.likes || 0), 0);
    const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;

    const header = [
      `📸 Instagram: @${data.profile?.username || cleanUser}`,
      data.profile?.fullName ? `Nome: ${data.profile.fullName}` : null,
      data.profile?.followers ? `Seguidores: ${formatNumber(data.profile.followers)}` : null,
      `Videos: ${videos.length}`,
      `Views totais: ${formatNumber(totalViews)} | Media: ${formatNumber(avgViews)} | Likes totais: ${formatNumber(totalLikes)}`,
      "---",
    ]
      .filter(Boolean)
      .join("\n");

    const rows = videos.map(
      (v: any, i: number) =>
        `${i + 1}. ${(v.title || "Sem titulo").substring(0, 80)}\n   ${formatNumber(v.views || 0)} views | ${formatNumber(v.likes || 0)} likes | ${v.comments || 0} comments | ${v.type || "post"}\n   ${v.url}`
    );

    return {
      content: [{ type: "text", text: header + "\n" + rows.join("\n\n") }],
    };
  }
);

server.tool(
  "instagram_get_saved_videos",
  "Retorna videos do Instagram salvos no banco de dados (perfil @nextleveldj1, sincronizado previamente).",
  {},
  async () => {
    const data = await fetchJSON(`${INSTAGRAM_BACKEND}/api/videos`);

    const videos = data.videos || [];
    const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);

    const header = [
      `📸 Instagram (banco): @${data.username}`,
      `Videos salvos: ${videos.length}`,
      `Views totais: ${formatNumber(totalViews)}`,
      `Ultima atualizacao: ${data.lastUpdate || "desconhecido"}`,
      "---",
    ].join("\n");

    const rows = videos.map(
      (v: any, i: number) =>
        `${i + 1}. ${(v.caption || v.title || "Sem titulo").substring(0, 80)}\n   ${formatNumber(v.views || 0)} views | ${formatNumber(v.likes || 0)} likes | ${v.type || "post"}`
    );

    return {
      content: [{ type: "text", text: header + "\n" + rows.join("\n\n") }],
    };
  }
);

server.tool(
  "instagram_get_comments",
  "Busca comentarios de um post/reel do Instagram pelo shortcode.",
  {
    shortcode: z.string().describe("Shortcode do post (ex: ABC123def)"),
    limit: z.number().default(500).describe("Limite de comentarios"),
  },
  async ({ shortcode, limit }) => {
    const data = await fetchJSON(
      `${INSTAGRAM_BACKEND}/api/comments/${shortcode}?limit=${limit}`
    );

    if (data.error) {
      return {
        content: [{ type: "text", text: `Erro: ${data.error}` }],
      };
    }

    const comments = data.comments || [];

    const header = [
      `💬 Comentarios: ${shortcode}`,
      `Total: ${data.total_comments || "?"} | Buscados: ${data.fetched_comments || comments.length}`,
      "---",
    ].join("\n");

    const rows = comments.map(
      (c: any, i: number) =>
        `${i + 1}. @${c.author}${c.author_verified ? " ✓" : ""}: ${c.text?.substring(0, 200)}\n   ${c.likes || 0} likes | ${c.answers_count || 0} respostas | ${c.timestamp || ""}`
    );

    return {
      content: [{ type: "text", text: header + "\n" + rows.join("\n\n") }],
    };
  }
);

// ========== TOOL: RESUMO GERAL ==========

server.tool(
  "social_media_overview",
  "Retorna um resumo geral de todas as plataformas (YouTube, TikTok, Instagram) para o perfil padrao.",
  {
    youtube_handle: z.string().default("@nextleveldj1").describe("Handle do YouTube"),
    tiktok_username: z.string().default("nextleveldj").describe("Username do TikTok"),
    instagram_username: z.string().default("nextleveldj1").describe("Username do Instagram"),
  },
  async ({ youtube_handle, tiktok_username, instagram_username }) => {
    const results: string[] = ["📊 RESUMO GERAL - SOCIAL MEDIA", "==="];

    // YouTube
    try {
      const cleanHandle = youtube_handle.startsWith("@") ? youtube_handle : `@${youtube_handle}`;
      const channelData = await fetchJSON(
        `${YOUTUBE_BACKEND}/api/youtube/channels?forHandle=${encodeURIComponent(cleanHandle)}&part=snippet,statistics`
      );

      if (channelData.items?.length) {
        const ch = channelData.items[0];
        results.push(
          "",
          `📺 YOUTUBE: ${ch.snippet.title}`,
          `   Inscritos: ${formatNumber(Number(ch.statistics.subscriberCount))}`,
          `   Videos: ${formatNumber(Number(ch.statistics.videoCount))}`,
          `   Views totais: ${formatNumber(Number(ch.statistics.viewCount))}`
        );
      }
    } catch (e: any) {
      results.push("", `📺 YOUTUBE: Erro - ${e.message}`);
    }

    // TikTok
    try {
      const data = await fetchJSON(`${YOUTUBE_BACKEND}/api/tiktok/videos`);
      if (data.success) {
        const videos = data.videos || [];
        const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
        results.push(
          "",
          `🎵 TIKTOK: @${data.username}`,
          `   Videos salvos: ${videos.length}`,
          `   Views totais: ${formatNumber(totalViews)}`,
          `   Media por video: ${formatNumber(videos.length ? Math.round(totalViews / videos.length) : 0)}`
        );
      }
    } catch (e: any) {
      results.push("", `🎵 TIKTOK: Erro - ${e.message}`);
    }

    // Instagram
    try {
      const data = await fetchJSON(`${INSTAGRAM_BACKEND}/api/videos`);
      const videos = data.videos || [];
      const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
      const totalLikes = videos.reduce((s: number, v: any) => s + (v.likes || 0), 0);
      results.push(
        "",
        `📸 INSTAGRAM: @${data.username}`,
        `   Videos salvos: ${videos.length}`,
        `   Views totais: ${formatNumber(totalViews)}`,
        `   Likes totais: ${formatNumber(totalLikes)}`,
        `   Ultima atualizacao: ${data.lastUpdate || "?"}`
      );
    } catch (e: any) {
      results.push("", `📸 INSTAGRAM: Erro - ${e.message}`);
    }

    return {
      content: [{ type: "text", text: results.join("\n") }],
    };
  }
);

// ========== UTILS ==========

// Parse ISO 8601 duration (PT1H2M3S) to seconds
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  return h * 3600 + m * 60 + s;
}

// Format YYYYMMDD to DD/MM/YYYY
function formatTikTokDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr || "";
  return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

// ========== START ==========

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Social Media Data server running on stdio");
}

main().catch((err) => {
  console.error("[MCP] Fatal error:", err);
  process.exit(1);
});
