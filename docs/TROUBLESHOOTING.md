# Troubleshooting Guide

Solutions for common issues encountered in the YouTube App.

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Frontend Issues](#frontend-issues)
- [Backend Issues](#backend-issues)
- [Database Issues](#database-issues)
- [API Issues](#api-issues)
- [Download Issues](#download-issues)
- [Deployment Issues](#deployment-issues)

---

## Quick Diagnostics

### Health Check Commands

```bash
# Check frontend
curl http://localhost:5173

# Check YouTube backend
curl http://localhost:3001/health
curl http://localhost:3001/api/check

# Check Instagram backend
curl http://localhost:3002/health

# Check database
psql $DATABASE_URL -c "SELECT 1"

# Check yt-dlp
yt-dlp --version

# Check ffmpeg
ffmpeg -version
```

### Log Locations

| Component | Log Location |
|-----------|--------------|
| Frontend (Vite) | Terminal running `npm run dev` |
| Backend | Terminal running `npm run dev` |
| Browser Console | DevTools → Console (F12) |
| Network Requests | DevTools → Network (F12) |

---

## Frontend Issues

### Issue: App shows blank white screen

**Symptoms:**
- Page loads but shows nothing
- No errors in terminal
- Console shows JavaScript errors

**Solutions:**

1. **Check browser console for errors**
   ```
   Press F12 → Console tab
   Look for red error messages
   ```

2. **Clear browser cache**
   ```
   Ctrl+Shift+Delete → Clear cached images and files
   ```

3. **Verify environment variables**
   ```bash
   # Check .env file exists
   ls -la youtube-analyzer/.env

   # Verify variables are set
   cat youtube-analyzer/.env
   ```

4. **Rebuild the application**
   ```bash
   cd youtube-analyzer
   rm -rf node_modules dist
   npm install
   npm run dev
   ```

---

### Issue: "VITE_YOUTUBE_API_KEY is not defined"

**Symptoms:**
- Console error about missing API key
- Videos don't load

**Solutions:**

1. **Create .env file**
   ```bash
   cd youtube-analyzer
   cp .env.example .env
   ```

2. **Add API key**
   ```env
   VITE_YOUTUBE_API_KEY=your_actual_api_key_here
   ```

3. **Restart dev server**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

> **Note:** Vite requires restart after .env changes

---

### Issue: Videos not loading / "No videos found"

**Symptoms:**
- Empty video grid
- Loading spinner never stops
- Network requests failing

**Solutions:**

1. **Check data source priority**
   - Database → Cache → YouTube API
   - If all fail, no videos show

2. **Clear localStorage cache**
   ```javascript
   // In browser console
   localStorage.removeItem('yt_analyzer_videos');
   localStorage.removeItem('yt_analyzer_channel');
   location.reload();
   ```

3. **Verify YouTube API key**
   ```bash
   # Test API key directly
   curl "https://www.googleapis.com/youtube/v3/channels?forHandle=@nextleveldj1&part=id&key=YOUR_API_KEY"
   ```

4. **Check network tab for errors**
   - 403: API key invalid or restricted
   - 429: Quota exceeded
   - CORS: Backend not configured

---

### Issue: Styles not loading / broken layout

**Symptoms:**
- Unstyled HTML elements
- Missing colors/spacing
- Tailwind classes not applied

**Solutions:**

1. **Check Tailwind configuration**
   ```bash
   # Verify config exists
   cat youtube-analyzer/tailwind.config.js
   ```

2. **Verify PostCSS is configured**
   ```bash
   cat youtube-analyzer/postcss.config.js
   ```

3. **Rebuild CSS**
   ```bash
   npm run build
   npm run dev
   ```

4. **Check for CSS import**
   ```tsx
   // src/main.tsx should have:
   import './index.css';
   ```

---

## Backend Issues

### Issue: "yt-dlp: command not found"

**Symptoms:**
- `/api/check` returns `{ ytdlp: false }`
- Downloads fail immediately
- Error: "spawn yt-dlp ENOENT"

**Solutions:**

1. **Install yt-dlp**
   ```bash
   # macOS
   brew install yt-dlp

   # Linux
   pip3 install yt-dlp

   # Windows
   pip install yt-dlp
   ```

2. **Verify installation**
   ```bash
   which yt-dlp
   yt-dlp --version
   ```

3. **Add to PATH (if needed)**
   ```bash
   # Find installation location
   pip3 show yt-dlp | grep Location

   # Add to PATH in ~/.bashrc or ~/.zshrc
   export PATH="$PATH:$(python3 -m site --user-base)/bin"
   ```

4. **Update yt-dlp**
   ```bash
   pip3 install -U yt-dlp
   # or
   yt-dlp -U
   ```

---

### Issue: "ffmpeg: command not found"

**Symptoms:**
- `/api/check` returns `{ ffmpeg: false }`
- Video downloads but won't merge audio/video
- Error in download logs

**Solutions:**

1. **Install ffmpeg**
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg

   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

2. **Verify installation**
   ```bash
   ffmpeg -version
   ```

3. **Check PATH**
   ```bash
   which ffmpeg
   ```

---

### Issue: CORS errors in browser

**Symptoms:**
- Console error: "Access-Control-Allow-Origin"
- Requests blocked by browser
- Backend works with curl but not from app

**Solutions:**

1. **Verify backend CORS configuration**
   ```typescript
   // server/index.ts
   app.use(cors({
     origin: [
       'http://localhost:5173',
       'http://localhost:3000',
     ],
     credentials: true,
   }));
   ```

2. **Check frontend URL matches**
   ```bash
   # Ensure frontend runs on allowed origin
   # Default Vite: http://localhost:5173
   ```

3. **Add missing origin**
   ```typescript
   const allowedOrigins = [
     'http://localhost:5173',
     'http://localhost:5174',  // Add if using different port
   ];
   ```

4. **Restart backend server**

---

### Issue: Backend crashes on startup

**Symptoms:**
- "Port already in use"
- "Module not found"
- TypeScript compilation errors

**Solutions:**

1. **Port conflict**
   ```bash
   # Find process using port
   lsof -i :3001

   # Kill process
   kill -9 <PID>
   ```

2. **Missing dependencies**
   ```bash
   cd youtube-analyzer/server
   rm -rf node_modules
   npm install
   ```

3. **TypeScript errors**
   ```bash
   npm run typecheck
   # Fix any reported errors
   ```

---

## Database Issues

### Issue: "Connection refused" / Database unreachable

**Symptoms:**
- "ECONNREFUSED" error
- Sync fails
- Videos don't save

**Solutions:**

1. **Verify connection string**
   ```bash
   # Check format
   echo $DATABASE_URL
   # Should be: postgresql://user:pass@host/dbname?sslmode=require
   ```

2. **Test connection**
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

3. **Check Neon status**
   - Go to [console.neon.tech](https://console.neon.tech)
   - Verify project is active
   - Check if compute is suspended (free tier auto-suspends)

4. **Wake up Neon compute**
   - Make any query to wake it up
   - Or manually start from console

---

### Issue: "SSL required" error

**Symptoms:**
- Connection works locally but fails in production
- "SSL connection is required"

**Solutions:**

1. **Add sslmode to connection string**
   ```
   postgresql://user:pass@host/dbname?sslmode=require
   ```

2. **Use Neon serverless driver**
   ```typescript
   import { neon } from '@neondatabase/serverless';
   const sql = neon(process.env.DATABASE_URL);
   ```

---

### Issue: "Table does not exist"

**Symptoms:**
- "relation 'videos' does not exist"
- Database queries fail

**Solutions:**

1. **Run schema setup**
   ```bash
   psql "$DATABASE_URL" -f schema.sql
   ```

2. **Verify tables exist**
   ```sql
   \dt
   -- Should list: channels, videos, metrics_history
   ```

3. **Check database name**
   ```bash
   # Connection string should point to correct database
   # Default Neon database is 'neondb'
   ```

---

## API Issues

### Issue: YouTube API quota exceeded

**Symptoms:**
- Error 403: "quotaExceeded"
- Sync stops working
- Only cached data available

**Solutions:**

1. **Wait for quota reset**
   - Quota resets daily at midnight Pacific Time
   - Check usage at [Google Cloud Console](https://console.cloud.google.com)

2. **Use cached data**
   - App automatically falls back to localStorage
   - Database data still available

3. **Optimize quota usage**
   - Reduce sync frequency
   - Limit video fetch count
   - Use database instead of API

4. **Request quota increase**
   - Go to Google Cloud Console → APIs → Quotas
   - Request increase (requires justification)

---

### Issue: "API key not valid"

**Symptoms:**
- Error 400: "API key not valid"
- All YouTube requests fail

**Solutions:**

1. **Verify API key**
   ```bash
   # Test directly
   curl "https://www.googleapis.com/youtube/v3/videos?id=dQw4w9WgXcQ&part=id&key=YOUR_KEY"
   ```

2. **Check API restrictions**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - APIs & Services → Credentials
   - Check HTTP referrer restrictions
   - Check IP restrictions

3. **Enable YouTube Data API**
   - APIs & Services → Library
   - Search "YouTube Data API v3"
   - Ensure it's enabled

4. **Create new API key**
   - APIs & Services → Credentials → Create Credentials

---

## Download Issues

### Issue: Downloads fail immediately

**Symptoms:**
- Progress stays at 0%
- Error message appears
- File not downloaded

**Solutions:**

1. **Check backend is running**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/check
   ```

2. **Verify video is available**
   ```bash
   # Test with yt-dlp directly
   yt-dlp --simulate "https://youtube.com/watch?v=VIDEO_ID"
   ```

3. **Check for region restrictions**
   - Some videos are region-locked
   - Try VPN if needed

4. **Update yt-dlp**
   ```bash
   pip3 install -U yt-dlp
   ```

---

### Issue: Downloads stuck / very slow

**Symptoms:**
- Progress bar moves slowly
- Downloads take forever
- Timeout errors

**Solutions:**

1. **Check internet connection**
   ```bash
   # Test download speed
   curl -o /dev/null -w "Speed: %{speed_download}\n" \
     "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   ```

2. **Try lower quality**
   - Select 720p instead of 1080p
   - Audio-only if video not needed

3. **Check disk space**
   ```bash
   df -h
   ```

4. **Clear temp files**
   ```bash
   # Remove partial downloads
   rm -rf /tmp/yt-dlp-*
   ```

---

### Issue: Downloaded file is corrupted

**Symptoms:**
- File won't play
- "Invalid file format" error
- File size is 0 or very small

**Solutions:**

1. **Check ffmpeg installation**
   ```bash
   ffmpeg -version
   ```

2. **Verify download completed**
   - Don't close browser during download
   - Check for network interruptions

3. **Try different quality**
   - Some formats may have issues
   - Try "best" quality

4. **Re-download the video**

---

## Deployment Issues

### Issue: Vercel build fails

**Symptoms:**
- Build error in Vercel dashboard
- Deployment rejected

**Solutions:**

1. **Check build logs**
   - Go to Vercel Dashboard → Deployments
   - Click failed deployment → View logs

2. **Common fixes**
   ```bash
   # Ensure build works locally
   cd youtube-analyzer
   npm run build
   ```

3. **Verify environment variables**
   - All VITE_* variables must be set in Vercel

4. **Check Node.js version**
   - Add `.nvmrc` file: `20`
   - Or specify in `package.json`

---

### Issue: Railway deployment fails

**Symptoms:**
- Docker build fails
- Container won't start

**Solutions:**

1. **Check Dockerfile**
   ```bash
   # Build locally first
   docker build -t test ./youtube-analyzer/server
   docker run -p 3001:3001 test
   ```

2. **Verify environment variables**
   - All required env vars set in Railway

3. **Check health check**
   - Ensure `/health` endpoint works
   - Check container logs in Railway

---

## Debug Checklist

When troubleshooting, check these in order:

1. [ ] **Environment variables** - All required vars set?
2. [ ] **Dependencies installed** - `npm install` run?
3. [ ] **Services running** - Frontend, backend, database?
4. [ ] **Network connectivity** - Can services talk to each other?
5. [ ] **Browser console** - Any JavaScript errors?
6. [ ] **Backend logs** - Any server errors?
7. [ ] **Database connection** - Can connect to Neon?
8. [ ] **API keys valid** - YouTube API working?

---

## Getting Help

If issues persist:

1. **Check existing documentation**
   - [Setup Guide](SETUP.md)
   - [Architecture](ARCHITECTURE.md)
   - [API Reference](API.md)

2. **Search for similar issues**
   - [yt-dlp issues](https://github.com/yt-dlp/yt-dlp/issues)
   - [Neon docs](https://neon.tech/docs)
   - [Vercel docs](https://vercel.com/docs)

3. **Collect debug information**
   ```bash
   # System info
   node --version
   npm --version
   yt-dlp --version
   ffmpeg -version

   # Environment
   echo $DATABASE_URL | head -c 20  # Don't share full URL!

   # Logs
   # Copy relevant error messages
   ```

---

## Related Documentation

- [Setup Guide](SETUP.md) - Installation steps
- [API Reference](API.md) - Endpoint documentation
- [Deployment Guide](DEPLOYMENT.md) - Production setup
