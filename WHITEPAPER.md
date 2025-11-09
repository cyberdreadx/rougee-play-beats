# ROUGEE.PLAY Whitepaper

**Decentralized Music Platform - Version 1.0**

---

**Last Updated:** January 2025

**Document Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Introduction](#introduction)
3. [Problem Statement](#problem-statement)
4. [Solution Overview](#solution-overview)
5. [Architecture & Technology](#architecture--technology)
6. [Tokenomics](#tokenomics)
7. [Features](#features)
8. [Technical Implementation](#technical-implementation)
9. [Roadmap](#roadmap)
10. [Conclusion](#conclusion)
11. [Resources & Contact](#resources--contact)

---

## Executive Summary

ROUGEE.PLAY is a revolutionary decentralized music platform that transforms how artists and fans interact with music. Built on blockchain technology, it enables artists to launch their music as tradeable assets while giving fans the opportunity to become stakeholders in their favorite artists' success.

The platform combines free streaming, tokenized music ownership, social features, and live streaming to create a comprehensive ecosystem where artists maintain ownership and control while fans can invest in and support the music they love.

### Key Highlights

- **Decentralized**: Music stored on IPFS, smart contracts handle trading, no single point of failure
- **Tokenized**: Each song is divided into 1,000,000 tradeable tokens via bonding curves
- **Social**: Stories, comments, feed, live streaming, and direct fan-artist engagement
- **Free Streaming**: All music is free to stream, removing barriers to access
- **Fair Revenue**: Transparent, automated payouts with artists keeping majority of revenue

---

## 1. Introduction

ROUGEE.PLAY represents a paradigm shift in the music industry, leveraging blockchain technology to create a decentralized platform where artists and fans can interact directly without intermediaries. The platform enables artists to monetize their music through tokenization while providing fans with investment opportunities and direct engagement.

Built on Base Network (an Ethereum L2), ROUGEE.PLAY combines the benefits of blockchain technology with a user-friendly interface, making Web3 music accessible to both crypto-native and traditional music fans.

### Vision

Our vision is to create a future where:

- **Artists Own Their Music**: No more label dependency
- **Fans Are Investors**: Support artists you believe in
- **Fair Revenue Distribution**: Transparent, automated payouts
- **Decentralized Discovery**: Algorithm-free music discovery
- **Global Access**: No geographical restrictions

### Mission

To empower artists and fans by creating a decentralized music ecosystem that:
- Eliminates intermediaries
- Ensures fair revenue distribution
- Enables direct artist-fan relationships
- Provides investment opportunities for fans
- Maintains censorship resistance

---

## 2. Problem Statement

### Traditional Music Industry Challenges

#### Revenue Distribution

Artists receive minimal revenue from streaming platforms, often less than $0.01 per stream. Labels and platforms take the majority of revenue, leaving artists with a small fraction. This creates an unsustainable model where artists struggle to make a living from their art.

**Impact:**
- Artists receive only 10-15% of streaming revenue
- Labels take 50-70% of revenue
- Platforms take 20-30% of revenue
- Artists struggle to monetize their work

#### Centralized Control

Major labels and platforms control distribution, discovery, and monetization. Artists have limited autonomy and must rely on intermediaries to reach their audience. This creates barriers to entry and limits creative freedom.

**Impact:**
- Labels control which artists get promoted
- Platforms control algorithm-based discovery
- Artists have limited control over their content
- Geographic restrictions limit global reach

#### Limited Fan Engagement

Fans can only stream music but cannot invest in or directly support artists. There's no mechanism for fans to benefit from an artist's success beyond listening. This creates a one-way relationship where fans consume but don't participate.

**Impact:**
- Fans cannot invest in artists they believe in
- No direct support mechanism
- Limited engagement beyond streaming
- Fans don't benefit from artist success

#### Geographical Restrictions

Content licensing and distribution agreements create geographical barriers, limiting global access to music. This prevents artists from reaching international audiences and fans from accessing content.

**Impact:**
- Content unavailable in certain regions
- Licensing restrictions limit distribution
- Artists miss international opportunities
- Fans miss out on global music

#### Censorship Risk

Centralized platforms can remove or restrict content based on policies, potentially silencing artists and limiting creative expression. This creates uncertainty and risk for artists.

**Impact:**
- Content can be removed without notice
- Policies can change arbitrarily
- Artists risk losing their platform
- Creative expression is limited

---

## 3. Solution Overview

ROUGEE.PLAY addresses these challenges through a decentralized platform that combines music streaming, tokenization, trading, and social features into a unified ecosystem.

### Core Solutions

#### Tokenized Music Ownership

Each song is divided into 1,000,000 tradeable tokens. Fans can buy and sell shares, creating a liquid market for music ownership. Artists receive tokens at launch and benefit from trading activity.

**Benefits:**
- Fans can invest in music they love
- Artists receive value from token trading
- Liquid market for music ownership
- Transparent ownership records

#### Bonding Curve Pricing

Fair, algorithmic price discovery through bonding curves. Prices increase as tokens are sold, ensuring early supporters benefit while preventing manipulation.

**Benefits:**
- Fair price discovery
- No manipulation possible
- Early supporters rewarded
- Transparent pricing

#### Decentralized Storage

Music stored on IPFS (InterPlanetary File System) ensures censorship resistance and permanent availability. No single entity can remove or restrict content.

**Benefits:**
- Censorship-resistant
- Permanent availability
- No single point of failure
- Global access

#### Direct Artist-Fan Engagement

Social features including stories, comments, feed posts, and live streaming enable direct communication between artists and fans without intermediaries.

**Benefits:**
- Direct communication
- Real-time engagement
- Community building
- Authentic relationships

#### Free Streaming with Optional Monetization

All music is free to stream, removing barriers to access. Artists can monetize through token trading, tips, premium content, and live streaming.

**Benefits:**
- No barriers to access
- Multiple monetization options
- Fan choice in support
- Global reach

---

## 4. Architecture & Technology

### Technology Stack

#### Frontend Layer

- **React 18**: Modern UI library with concurrent features
- **TypeScript**: Type-safe development
- **Vite**: Lightning-fast build tool
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Beautiful component library
- **Progressive Web App (PWA)**: Offline-capable, app-like experience

#### Web3 Layer

- **wagmi**: React hooks for Ethereum
- **viem**: TypeScript interface for Ethereum
- **Privy**: Wallet authentication and management
- **Base Network**: Ethereum L2 for low-cost transactions
- **Smart Contracts**: Trading and revenue logic
- **IPFS**: Decentralized file storage

#### Backend Layer

- **Supabase**: Backend-as-a-Service
- **PostgreSQL**: Relational database
- **Edge Functions**: Serverless compute
- **Row-Level Security (RLS)**: Data protection
- **Real-time**: Live updates via WebSockets

#### Infrastructure

- **Netlify**: Hosting and CDN
- **Lighthouse**: IPFS pinning service
- **Base Network**: Primary blockchain
- **Agora**: Live streaming infrastructure

### Architecture Principles

#### Decentralized by Design

- Music stored on IPFS
- Smart contracts handle trading logic
- No single point of failure
- Censorship-resistant platform

#### User-Centric Experience

- Fast, responsive web interface
- Mobile-first design
- Offline-capable PWA
- Intuitive navigation

#### Scalable Infrastructure

- Edge computing for global performance
- Caching strategies for optimal speed
- Database optimization
- Real-time updates

#### Security First

- Row-Level Security on all tables
- JWT validation for authentication
- Wallet signature verification
- Rate limiting protection

### Data Flow Architecture

#### Music Upload Flow
```
User Upload → Lighthouse → IPFS → Smart Contract → Database
```

#### Trading Flow
```
User Trade → Smart Contract → Blockchain → Real-time Update → UI
```

#### Streaming Flow
```
User Play → IPFS Gateway → CDN → Browser → Audio Player
```

#### Social Flow
```
User Action → Edge Function → Database → Real-time → All Users
```

---

## 5. Tokenomics

### Dual-Token Economy

ROUGEE.PLAY operates a dual-token economy combining XRGE (platform token) with USDC (via x402 protocol) for payments and consumption.

#### XRGE Token

**Details:**
- **Name**: RougeCoin
- **Symbol**: XRGE
- **Network**: Base (Ethereum L2)
- **Address**: `0x147120faEC9277ec02d957584CFCD92B56A24317`

**Use Cases:**
- Song token trading
- Platform governance
- Tier-based access
- Upload slot purchases
- Staking rewards

**Token Utility:**
- Trading currency for all song tokens
- Governance voting rights
- Access to premium features
- Staking for rewards
- Platform fee payments

#### USDC (via x402)

**Purpose**: Payments & consumption

**Network**: Base (native USDC)

**Use Cases:**
- Premium streaming (pay-per-play)
- API access fees
- AI music generation
- Direct tips to artists
- Automated royalties

**Benefits:**
- Stable value ($1 = 1 USDC)
- Instant settlement
- Micropayment support
- Global acceptance

### Song Token Economics

#### Token Structure

- **Total Supply**: 1,000,000 tokens per song
- **Initial Price**: 0.001 XRGE per token
- **Price Increment**: 0.000001 XRGE per token sold
- **Bonding Curve Formula**: `Price = Initial Price + (Tokens Sold × Price Increment)`

#### Example Calculation

```
Initial Price: 0.001 XRGE
Price Increment: 0.000001 XRGE
Tokens Sold: 100,000

Current Price = 0.001 + (100,000 × 0.000001)
Current Price = 0.001 + 0.1
Current Price = 0.101 XRGE per token
```

#### Trading Mechanics

- **Trading Fee**: 2% per trade
- **Fee Distribution**: 50% burned, 50% to treasury
- **Slippage Protection**: Built into smart contracts
- **Real-time Pricing**: Live price updates from blockchain

### Revenue Distribution

#### Trading Fees

- **Rate**: 2% per song token trade
- **Distribution**: 50% burned, 50% to treasury
- **Purpose**: Deflationary mechanism and platform operations

#### Premium Streaming

- **Rate**: 20% platform fee on USDC payments
- **Distribution**: 50% operations, 50% XRGE buyback
- **Purpose**: Platform sustainability and token value

#### Upload Slots

- **Rate**: 10 XRGE per 20 slots
- **Distribution**: 100% to treasury
- **Purpose**: Operating capital

### Token Allocation

#### Song Token Distribution

- **Artist Allocation**: Varies by song
- **Public Sale**: Via bonding curve
- **Platform Reserve**: For future features
- **Liquidity**: Ensured through bonding curve

---

## 6. Features

### Core Features

#### Music Streaming

- **Free Access**: Unlimited streaming of all music
- **High Quality**: Professional-grade audio playback
- **Continuous Playback**: Seamless experience across pages
- **Playlist Management**: Create and manage playlists
- **Radio Mode**: Algorithm-free discovery
- **Offline Support**: PWA with offline capabilities

#### Token Trading

- **Buy/Sell Tokens**: Via bonding curves
- **Real-time Charts**: Price history and analytics
- **Trading History**: Complete transaction records
- **Portfolio Tracking**: Monitor your investments
- **Price Alerts**: Notifications for price changes
- **XRGE Integration**: Built-in token swap

#### Artist Profiles

- **Customizable**: Avatar, cover, bio, social links
- **Analytics**: Play counts, engagement stats
- **Ticker Symbols**: Unique artist identifiers
- **Verified Badges**: Authenticated artist status
- **Stats Dashboard**: Comprehensive analytics

#### Social Features

- **Stories**: 24-hour ephemeral content
- **Feed Posts**: Share updates with media
- **Comments**: Engage on songs and posts
- **Likes & Shares**: Social interactions
- **Direct Messaging**: XMTP integration
- **Follow System**: Connect with artists and fans

#### Live Streaming

- **Real-time Broadcasting**: Video/audio streaming
- **Live Chat**: Real-time chat during streams
- **Viewer Tracking**: Live viewer counts
- **Stream Discovery**: Feed of live streams
- **Tips**: Support during live streams
- **Mobile Support**: PWA compatible

#### Discovery & Trending

- **Trending Songs**: Based on plays and trading
- **Genre Browsing**: Filter by music style
- **24h Price Changes**: Track market movements
- **Market Cap**: Calculate song valuations
- **Top Gainers**: Biggest price increases
- **Volume Leaders**: Highest trading volume
- **Search**: Find songs, artists, genres

---

## 7. Technical Implementation

### Smart Contracts

#### Song Token Factory

Deploys ERC-20 tokens for each song with a total supply of 1,000,000 tokens.

**Features:**
- Standard ERC-20 implementation
- Custom metadata storage
- Artist allocation support
- Transfer restrictions (if needed)

#### Bonding Curve Contract

Manages token trading via bonding curves. Handles buy/sell operations with automatic price calculation based on supply and demand.

**Contract Address**: `0xCeE9c18C448487a1deAac3E14974C826142C50b5`

**Features:**
- Supports XRGE and ETH payments
- Slippage protection
- Real-time price queries
- Automatic price calculation
- Fee distribution

**Functions:**
- `buyWithXRGE()`: Purchase tokens with XRGE
- `buyWithETH()`: Purchase tokens with ETH
- `sell()`: Sell tokens back to curve
- `getCurrentPrice()`: Query current token price
- `getPriceForAmount()`: Calculate price for token amount

### Data Storage

#### IPFS (Music Files)

- **Service**: Lighthouse pinning
- **Benefits**: Decentralized, permanent, censorship-resistant
- **Format**: Audio files stored as-is
- **Access**: Multiple IPFS gateways

#### Supabase (Metadata)

- **Database**: PostgreSQL
- **Features**: Real-time subscriptions, RLS, Edge Functions
- **Tables**: Profiles, songs, stories, comments, trades
- **Security**: Row-Level Security policies

### Security

#### Authentication

- **Method**: Privy wallet-based authentication
- **Tokens**: JWT tokens for API access
- **Verification**: Blockchain signature verification
- **Session Management**: Secure session storage

#### Authorization

- **Row-Level Security**: Policies on all database tables
- **Wallet Verification**: Blockchain signature checks
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Server-side validation

#### Smart Contract Security

- **Audited Contracts**: Professional security audits
- **Upgradeable Patterns**: Security fix capability
- **Multi-sig**: Critical operations require multiple signatures
- **Access Control**: Role-based permissions

#### Data Protection

- **Encryption**: At rest and in transit
- **HTTPS**: All communications encrypted
- **CORS**: Proper cross-origin resource sharing
- **CSP**: Content Security Policy headers

---

## 8. Roadmap

### Phase 1: Core Platform ✅

**Status**: Completed

- ✅ Music upload and streaming
- ✅ Token trading system
- ✅ Artist profiles
- ✅ Social features (stories, feed, comments)
- ✅ Live streaming
- ✅ Base Mini App integration

### Phase 2: Enhanced Features 🚧

**Status**: In Progress

- 🔄 Advanced analytics dashboard
- 🔄 Playlist sharing and collaboration
- 🔄 Mobile native apps (iOS/Android)
- 🔄 x402 payment integration
- 🔄 AI music generation
- 🔄 API monetization

### Phase 3: Ecosystem Expansion 📋

**Status**: Planned

- 📋 Label partnerships
- 📋 Festival integrations
- 📋 Cross-platform sync
- 📋 AI-powered discovery
- 📋 Multi-chain support
- 📋 NFT marketplace integration

### Future Considerations

- **Gaming Integration**: Music licensing for games
- **B2B Licensing**: Business music solutions
- **Virtual Events**: Concert streaming platform
- **Merchandise**: Integrated artist merchandise
- **Fan Clubs**: Exclusive fan communities

---

## 9. Conclusion

ROUGEE.PLAY represents a fundamental shift in how music is created, distributed, and monetized. By combining blockchain technology, decentralized storage, and social features, we've created a platform that empowers artists and engages fans in unprecedented ways.

The tokenized music ownership model creates new economic opportunities for both artists and fans, while the decentralized architecture ensures censorship resistance and permanent availability of content.

### Key Achievements

- **Decentralized Platform**: No single point of failure
- **Fair Revenue Distribution**: Artists keep majority of revenue
- **Fan Investment**: Fans can invest in music they love
- **Global Access**: No geographical restrictions
- **Censorship Resistance**: Permanent content availability

### Vision for the Future

As we continue to build and expand the platform, we remain committed to our core principles:

- **Decentralization**: Empowering users through blockchain technology
- **Artist Empowerment**: Giving artists control and ownership
- **Fan Engagement**: Creating meaningful connections
- **Fair Distribution**: Transparent and automated revenue sharing

### Join the Music Revolution

ROUGEE.PLAY is more than a platform—it's a movement toward a more equitable, decentralized, and artist-centric music industry. Together, we're building the future of music.

---

## 10. Resources & Contact

### Platform Information

- **Website**: https://rougee.app
- **GitHub**: https://github.com/cyberdreadx/rougee-play-beats
- **Base Mini App**: Integrated and available

### Token Information

- **XRGE Token Address**: `0x147120faEC9277ec02d957584CFCD92B56A24317`
- **Network**: Base (Ethereum L2)
- **Bonding Curve Address**: `0xCeE9c18C448487a1deAac3E14974C826142C50b5`

### Community

- **X (Twitter)**: @rougeenetwork
- **Discord**: https://discord.gg/Vumf5tcMTp
- **Documentation**: https://rougee-web3.gitbook.io/rougee-web3-documentation/

### Support

- **Email**: Support available via Discord
- **Issues**: GitHub Issues
- **Documentation**: Comprehensive guides available

---

## Appendix

### Glossary

- **Bonding Curve**: Algorithmic pricing mechanism for token trading
- **IPFS**: InterPlanetary File System - decentralized storage protocol
- **XRGE**: RougeCoin - platform native token
- **Base Network**: Ethereum L2 for low-cost transactions
- **PWA**: Progressive Web App - app-like web experience

### Technical Specifications

- **Blockchain**: Base Network (Ethereum L2)
- **Storage**: IPFS via Lighthouse
- **Database**: PostgreSQL via Supabase
- **Frontend**: React 18 + TypeScript
- **Backend**: Supabase Edge Functions

### Legal Disclaimer

This whitepaper is for informational purposes only. It does not constitute investment advice, financial advice, or a solicitation to buy or sell any securities or tokens. Always conduct your own research and consult with financial advisors before making investment decisions.

---

**© 2025 ROUGEE.PLAY. All rights reserved.**

*This document is subject to updates and revisions. Please refer to the latest version available at https://rougee.app/whitepaper*

