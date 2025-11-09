# 🎵 ROUGEE.PLAY - Decentralized Music Platform

<div align="center">
  <img src="public/favicon.png" alt="ROUGEE.PLAY Logo" width="120" />
  
  **Stream. Launch. Trade. Own.**
  
  A blockchain-powered music platform where artists launch their music as tradeable assets and fans become stakeholders.
</div>

---

## 🌟 Features

### For Artists
- **Launch Music as NFTs** - Upload tracks and create tradeable music tokens
- **Artist Profiles** - Customizable profiles with avatar, cover, and social links
- **Create Stories** - Share behind-the-scenes content with 24-hour ephemeral stories
- **Ticker Symbols** - Unique artist tickers for brand identity
- **Analytics Dashboard** - Track plays, engagement, and popularity

### For Fans
- **Discover Music** - Browse trending artists and top songs
- **Stream for Free** - Listen to all music without restrictions
- **Trade Music Tokens** - Buy and sell song shares on integrated DEX
- **Support Artists** - Direct wallet-to-wallet support
- **Collect & Own** - Build your music portfolio

### Platform Features
- **Web3 Wallet Integration** - Connect with WalletConnect, MetaMask, and more
- **IPFS Storage** - Decentralized file storage via Lighthouse
- **Real-time Updates** - Live play counts and trending charts
- **Responsive Design** - Beautiful UI on desktop and mobile
- **Dark/Light Mode** - Customizable theme preferences

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful component library

### Backend & Infrastructure
- **Supabase** - Database, authentication, storage, and edge functions
- **IPFS (Lighthouse)** - Decentralized file storage
- **PostgreSQL** - Robust database with RLS policies

### Web3
- **wagmi** - React hooks for Ethereum
- **Web3Modal** - Multi-wallet connection
- **viem** - TypeScript interface for Ethereum
- **Base Mini App** - Native Base App integration

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Bun or npm package manager
- Web3 wallet (MetaMask, WalletConnect, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/cyberdreadx/rougee-play-beats.git

# Navigate to project directory
cd rougee-play-beats

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

The app will be available at `http://localhost:8080`

### Environment Setup

The project uses Supabase for backend services. All sensitive keys are stored in Supabase Secrets.

**Public keys in the codebase:**
- `VITE_SUPABASE_URL` - Public Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Public anon key (secured by RLS)
- `VITE_SUPABASE_PROJECT_ID` - Public project identifier

These are meant to be public and are protected by Row-Level Security policies.

---

## 📦 Project Structure

```
rougee-play-beats/
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # shadcn UI components
│   │   ├── ArtistCard.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── Header.tsx
│   │   └── ...
│   ├── pages/            # Route pages
│   │   ├── Index.tsx
│   │   ├── Trending.tsx
│   │   ├── Artist.tsx
│   │   └── ...
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React context providers
│   ├── lib/              # Utility functions
│   ├── integrations/     # Third-party integrations
│   └── assets/           # Static assets
├── supabase/
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
└── public/               # Public static files
```

---

## 🗄️ Database Schema

### Core Tables
- **profiles** - User profiles with artist info and stats
- **songs** - Music tracks with metadata and play counts
- **stories** - 24-hour ephemeral content
- **comments** - User comments on songs

### Security
All tables have Row-Level Security (RLS) enabled with policies for:
- Public read access for discovery
- Authenticated write access with ownership validation
- Admin-only operations for moderation

---

## 🎨 Design System

The app uses a cyberpunk/neon aesthetic with:
- **Primary Color** - Neon green (`#00FF41`)
- **Typography** - Monospace fonts for retro-futuristic look
- **Animations** - Glow effects, pulses, and smooth transitions
- **Glass Morphism** - Translucent UI elements

All design tokens are in `src/index.css` and `tailwind.config.ts`

---

## 🔐 Security

### What's Safe to Commit
✅ Supabase URL and anon key (public by design)  
✅ Public configuration files  
✅ Frontend code and assets  

### What's Protected
🔒 Service role keys (Supabase Secrets)  
🔒 API keys (Lighthouse, etc.)  
🔒 Private user data (protected by RLS)  

### Security Features
- Row-Level Security on all database tables
- Server-side validation in edge functions
- Wallet-based authentication
- CORS protection on storage buckets

---

## 🚢 Deployment

### Netlify (Recommended)
The project is configured for Netlify deployment:

```bash
# Build command
bun run build

# Publish directory
dist
```

### Manual Deployment
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the MIT License.

---

## 📱 Base Mini App

ROUGEE.PLAY is configured as a Base Mini App, allowing it to run natively within the Base App ecosystem.

### Features
- **Native Integration** - Runs seamlessly within Base App
- **Wallet Integration** - Leverage Base App's built-in wallet
- **Easy Sharing** - Share content directly within Base App
- **Instant Access** - No downloads required

### Setup
See [BASE_MINI_APP_SETUP.md](./BASE_MINI_APP_SETUP.md) for detailed setup instructions.

### Manifest
The Base Mini App manifest is located at `/.well-known/farcaster.json` and is automatically served by the app.

---

## 🔗 Links

- **Live App**: [Coming Soon]
- **Lovable Project**: https://lovable.dev/projects/edbd29f5-fe8e-435d-b3d2-8111ac95287a
- **GitHub**: https://github.com/cyberdreadx/rougee-play-beats
- **Base Mini App Docs**: [BASE_MINI_APP_SETUP.md](./BASE_MINI_APP_SETUP.md)

---

## 💬 Support

For questions or support:
- Open an issue on GitHub
- Reach out via the Lovable platform

---

<div align="center">
  <strong>Built with 💚 using Lovable</strong>
  
  Stream music. Own music. Be music.
</div>
