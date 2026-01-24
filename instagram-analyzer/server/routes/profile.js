// ========== ROTAS DE PERFIL INSTAGRAM ==========

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const db = require('../services/database');

const router = express.Router();

// Perfil fixo
const FIXED_USERNAME = 'nextleveldj1';

/**
 * Executa script Python e retorna resultado
 */
function runPythonScript(args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/fetch_profile.py');
    // Usa Python do virtual environment
    const venvPython = path.join(__dirname, '../../venv/bin/python3');
    const python = spawn(venvPython, [scriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      console.log(`[Python] ${msg.trim()}`);
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * GET /api/videos
 * Busca videos do banco de dados
 */
router.get('/videos', async (req, res) => {
  try {
    console.log('[Videos] Buscando videos do banco...');

    const videos = await db.getVideos();
    const lastUpdate = await db.getLastUpdate();

    console.log(`[Videos] Encontrados ${videos.length} videos no banco`);

    res.json({
      username: FIXED_USERNAME,
      videos,
      lastUpdate,
      fromCache: true
    });

  } catch (error) {
    console.error('[Videos] Erro:', error);
    res.status(500).json({
      error: 'Erro ao buscar videos',
      details: error.message,
    });
  }
});

/**
 * POST /api/refresh
 * Atualiza videos do Instagram e salva no banco
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log(`[Refresh] Atualizando videos de @${FIXED_USERNAME}...`);

    const result = await runPythonScript([FIXED_USERNAME, 'all', '100']);

    if (result.error) {
      console.log(`[Refresh] Erro: ${result.error}`);
      return res.status(400).json(result);
    }

    // Salva no banco
    console.log(`[Refresh] Salvando ${result.videos?.length || 0} videos no banco...`);
    await db.saveVideos(result.videos || []);

    // Busca dados atualizados
    const videos = await db.getVideos();
    const lastUpdate = await db.getLastUpdate();

    console.log(`[Refresh] Concluido! ${videos.length} videos salvos.`);

    res.json({
      username: FIXED_USERNAME,
      videos,
      lastUpdate,
      fromCache: false
    });

  } catch (error) {
    console.error('[Refresh] Erro:', error);
    res.status(500).json({
      error: 'Erro ao atualizar videos',
      details: error.message,
    });
  }
});

/**
 * GET /api/profile/:username (mantido para compatibilidade)
 */
router.get('/profile/:username', async (req, res) => {
  // Redireciona para endpoint fixo
  res.redirect('/api/videos');
});

/**
 * POST /api/profile/:username
 * Busca videos de qualquer usuario do Instagram (para Instagram Criadores)
 */
router.post('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const limit = req.body.limit || 100;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username e obrigatorio'
      });
    }

    const cleanUsername = username.replace('@', '').trim();
    console.log(`[Profile] Buscando videos de @${cleanUsername}...`);

    const result = await runPythonScript([cleanUsername, 'all', limit.toString()]);

    if (result.error) {
      console.log(`[Profile] Erro: ${result.error}`);
      return res.status(400).json({
        success: false,
        error: result.error,
        username: cleanUsername
      });
    }

    // Transforma para formato compativel com frontend React
    const videos = (result.videos || []).map(v => ({
      id: v.shortcode,
      shortcode: v.shortcode,
      url: v.url,
      title: v.caption || 'Sem titulo',
      channel: result.username || cleanUsername,
      duration: v.duration || 0,
      views: v.views || 0,
      likes: v.likes || 0,
      comments: v.comments || 0,
      thumbnail: v.thumbnail,
      uploadDate: v.timestamp ? v.timestamp.slice(0, 10).replace(/-/g, '') : '',
      type: v.type || 'post',
      videoUrl: v.video_url,
      platform: 'instagram'
    }));

    console.log(`[Profile] Encontrados ${videos.length} videos de @${cleanUsername}`);

    res.json({
      success: true,
      profile: {
        username: result.username || cleanUsername,
        fullName: result.full_name || '',
        profilePic: result.profile_pic || '',
        followers: result.followers || 0,
        videoCount: videos.length
      },
      videos,
      fetchedAt: result.fetched_at || new Date().toISOString()
    });

  } catch (error) {
    console.error('[Profile] Erro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar perfil',
      details: error.message
    });
  }
});

/**
 * POST /api/validate-urls
 * Valida uma lista de URLs do Instagram
 */
router.post('/validate-urls', async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'urls deve ser um array' });
    }

    console.log(`[Validate] Validando ${urls.length} URLs`);

    const instagramRegex = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
    const results = [];

    for (const url of urls) {
      const match = url.match(instagramRegex);

      if (!match) {
        results.push({
          url,
          valid: false,
          error: 'URL invalida',
        });
        continue;
      }

      const shortcode = match[1];

      try {
        const videoInfo = await runPythonScript([shortcode]);

        if (videoInfo.error) {
          results.push({
            url,
            shortcode,
            valid: false,
            error: videoInfo.error,
          });
        } else {
          results.push({
            url,
            shortcode,
            valid: true,
            video: videoInfo,
          });
        }
      } catch (e) {
        results.push({
          url,
          shortcode,
          valid: false,
          error: e.message,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[Validate] ${results.filter(r => r.valid).length}/${urls.length} URLs validas`);
    res.json({ results });

  } catch (error) {
    console.error('[Validate] Erro:', error);
    res.status(500).json({
      error: 'Erro ao validar URLs',
      details: error.message,
    });
  }
});

/**
 * GET /api/comments/:shortcode
 * Busca comentarios de um post especifico
 */
router.get('/comments/:shortcode', async (req, res) => {
  const { shortcode } = req.params;
  const limit = parseInt(req.query.limit) || 500;

  console.log(`[Comments] Buscando comentarios de ${shortcode}...`);

  try {
    const scriptPath = path.join(__dirname, '../scripts/fetch_comments.py');
    const venvPython = path.join(__dirname, '../../venv/bin/python3');

    const result = await new Promise((resolve, reject) => {
      const python = spawn(venvPython, [scriptPath, shortcode, limit.toString()]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        const msg = data.toString();
        stderr += msg;
        console.log(`[Python] ${msg.trim()}`);
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Python exited with code ${code}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      python.on('error', (err) => {
        reject(err);
      });
    });

    if (result.error) {
      console.log(`[Comments] Erro: ${result.error}`);
      return res.status(400).json(result);
    }

    console.log(`[Comments] ${result.fetched_comments} comentarios encontrados`);
    res.json(result);

  } catch (error) {
    console.error('[Comments] Erro:', error);
    res.status(500).json({
      error: 'Erro ao buscar comentarios',
      details: error.message,
    });
  }
});

/**
 * GET /api/proxy-image
 * Proxy para imagens do Instagram (evita CORS e URLs expiradas)
 */
router.get('/proxy-image', async (req, res) => {
  const { url, shortcode } = req.query;

  if (!url && !shortcode) {
    return res.status(400).json({ error: 'URL or shortcode required' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Referer': 'https://www.instagram.com/',
  };

  // Tenta buscar a imagem da URL original
  async function tryFetch(imageUrl) {
    const response = await fetch(imageUrl, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  }

  try {
    let response;
    let succeeded = false;

    // 1. Tenta URL original primeiro (se fornecida)
    if (url) {
      try {
        response = await tryFetch(url);
        succeeded = true;
      } catch (e) {
        console.log(`[Proxy] URL original falhou: ${e.message}`);
      }
    }

    // 2. Se falhou e temos shortcode, tenta URL alternativa do Instagram
    if (!succeeded && shortcode) {
      try {
        // Tenta buscar a página do Instagram e extrair a thumbnail
        const instaUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
        response = await tryFetch(instaUrl);
        succeeded = true;
        console.log(`[Proxy] Fallback funcionou para ${shortcode}`);
      } catch (e) {
        console.log(`[Proxy] Fallback também falhou: ${e.message}`);
      }
    }

    // 3. Se ainda não conseguiu e temos URL, extrai shortcode dela e tenta
    if (!succeeded && url && !shortcode) {
      const match = url.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
      if (match) {
        try {
          const instaUrl = `https://www.instagram.com/p/${match[1]}/media/?size=l`;
          response = await tryFetch(instaUrl);
          succeeded = true;
          console.log(`[Proxy] Fallback extraído funcionou para ${match[1]}`);
        } catch (e) {
          console.log(`[Proxy] Fallback extraído também falhou: ${e.message}`);
        }
      }
    }

    if (!succeeded) {
      return res.status(404).json({ error: 'Image not available' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600'); // Reduzido para 1 hora
    res.send(buffer);

  } catch (error) {
    console.error('[Proxy] Erro:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

module.exports = router;
