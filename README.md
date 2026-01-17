# YouTube App - Multi-Platform Video Analyzer

A comprehensive full-stack application for analyzing, filtering, and downloading videos from YouTube, TikTok, and Instagram. Built for content creators to analyze video performance and identify content patterns.

## Features

### YouTube Analyzer
- Fetch and analyze videos from YouTube channels
- Advanced filtering (duration, keywords, date range)
- Smart selection (Top 5 Best/Worst performers)
- Batch video downloads with progress tracking
- Metrics history and growth tracking
- Database sync with Neon PostgreSQL

### TikTok Analyzer
- Profile video fetching and analysis
- Multiple URL format support
- Quality-based downloads (1080p, 720p, 480p, 360p)
- Video metadata extraction

### Instagram Analyzer
- Video metadata scraping via Instaloader
- Database-backed storage
- Performance metrics tracking

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router v7** - Client-side routing
- **Recharts** - Data visualization
- **Axios** - HTTP client

### Backend
- **Node.js** with Express
- **TypeScript** - Type safety
- **yt-dlp** - Video downloading
- **FFmpeg** - Video processing

### Database
- **Neon PostgreSQL** - Serverless database

### Deployment
- **Vercel** - Frontend hosting
- **Docker** - Backend containerization

## Prerequisites

- Node.js 18+ (recommended: 20.x)
- npm or yarn
- Python 3 (for Instagram analyzer)
- YouTube Data API v3 key
- Neon PostgreSQL account

## Quick Start

### 1. Clone and Install

```bash
# Navigate to project
cd "Youtube App"

# Install YouTube Analyzer dependencies
cd youtube-analyzer
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install Instagram Analyzer (optional)
cd ../instagram-analyzer
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

Required environment variables:
```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key
VITE_DOWNLOAD_API_URL=http://localhost:3001
DATABASE_URL=your_neon_connection_string
```

### 3. Start Development Servers

```bash
# Terminal 1: Frontend (port 5173)
cd youtube-analyzer
npm run dev

# Terminal 2: Backend (port 3001)
cd youtube-analyzer/server
npm run dev

# Terminal 3: Instagram Backend (port 3002) - optional
cd instagram-analyzer
npm start
```

### 4. Access the Application

Open http://localhost:5173 in your browser.

**Default Credentials:**
- Email: `ilankriger@gmail.com`
- Password: `Aa11231123__1`

## Project Structure

```
Youtube App/
├── README.md                    # This file
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md          # System architecture
│   ├── SETUP.md                 # Detailed setup guide
│   ├── API.md                   # API reference
│   ├── COMPONENTS.md            # Frontend components
│   ├── DATABASE.md              # Database schema
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── TROUBLESHOOTING.md       # Common issues
│   └── PROJECT_STATUS.md        # Current status
│
├── youtube-analyzer/            # Main application
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── ui/              # Reusable UI components
│   │   │   ├── video/           # Video display components
│   │   │   ├── filters/         # Filter components
│   │   │   ├── download/        # Download management
│   │   │   └── tiktok/          # TikTok integration
│   │   ├── contexts/            # React Context providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API services
│   │   ├── pages/               # Route pages
│   │   ├── types/               # TypeScript definitions
│   │   ├── constants/           # App constants
│   │   └── utils/               # Utility functions
│   ├── server/                  # Express backend
│   │   ├── routes/              # API routes
│   │   └── services/            # Backend services
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
└── instagram-analyzer/          # Instagram tool
    ├── server/                  # Express backend
    ├── public/                  # Static frontend
    └── package.json
```

## Available Scripts

### YouTube Analyzer Frontend
```bash
npm run dev       # Start dev server (port 5173)
npm run build     # Build for production
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

### YouTube Analyzer Backend
```bash
npm run dev       # Start with hot reload
npm run start     # Production mode
npm run build     # Compile TypeScript
npm run typecheck # Type checking only
```

### Instagram Analyzer
```bash
npm start         # Start server (port 3002)
npm run dev       # Development mode
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and patterns |
| [Setup Guide](docs/SETUP.md) | Detailed installation steps |
| [API Reference](docs/API.md) | Backend endpoints |
| [Components](docs/COMPONENTS.md) | Frontend component guide |
| [Database](docs/DATABASE.md) | Schema and queries |
| [Deployment](docs/DEPLOYMENT.md) | Production deployment |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues |
| [Project Status](docs/PROJECT_STATUS.md) | Current state & roadmap |

## Key Features Explained

### Data Fallback Chain
The app uses a resilient data loading strategy:
1. **Database** (Neon PostgreSQL) - Primary source
2. **LocalStorage Cache** - Fast offline access
3. **YouTube API** - Fresh data when needed

### Context-Based State Management
```
App
└── AuthProvider
    └── VideoProvider
        └── FilterProvider
            └── SelectionProvider
                └── DownloadProvider
```

### Download Queue System
- Sequential processing to avoid browser overload
- Progress tracking per video
- Automatic retry on failure
- CSV export with metadata

## API Endpoints

### YouTube Download API (port 3001)
- `GET /health` - Health check
- `GET /api/download?videoId=&quality=` - Download video
- `GET /api/info?videoId=` - Get video info
- `GET /api/formats?videoId=` - Available formats

### TikTok API
- `POST /api/tiktok/validate` - Validate URL
- `POST /api/tiktok/profile` - Fetch profile
- `GET /api/tiktok/download?url=&quality=` - Download

See [API Reference](docs/API.md) for complete documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is for personal use. Please respect the terms of service of YouTube, TikTok, and Instagram when using this tool.

## Support

For issues and questions, please check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) first.

---

**Built with React, TypeScript, and Node.js**
