import { Helmet } from 'react-helmet-async';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

export default function Whitepaper() {
  return (
    <>
      <Helmet>
        <title>Whitepaper - ROUGEE.PLAY</title>
        <meta name="description" content="ROUGEE.PLAY Whitepaper - Decentralized Music Platform" />
      </Helmet>

      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-4xl font-bold mb-4 font-mono">ROUGEE.PLAY Whitepaper</h1>
                <p className="text-muted-foreground text-lg">
                  Decentralized Music Platform - Version 1.0
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // Create a download link for the markdown file
                    const link = document.createElement('a');
                    link.href = '/WHITEPAPER.md';
                    link.download = 'ROUGEE_PLAY_Whitepaper_v1.0.md';
                    link.click();
                  }}
                  variant="outline"
                  className="font-mono border-neon-green/30 hover:border-neon-green/50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download MD
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      // Fetch the markdown content
                      const response = await fetch('/WHITEPAPER.md');
                      const markdown = await response.text();
                      
                      // Create a blob and download
                      const blob = new Blob([markdown], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'ROUGEE_PLAY_Whitepaper_v1.0.md';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Failed to download whitepaper:', error);
                      // Fallback: open in new tab
                      window.open('/WHITEPAPER.md', '_blank');
                    }
                  }}
                  variant="default"
                  className="font-mono bg-neon-green/20 hover:bg-neon-green/30 text-neon-green border border-neon-green/50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Download Doc
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            <div className="space-y-8 prose prose-invert max-w-none">
              {/* Executive Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Executive Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    ROUGEE.PLAY is a revolutionary decentralized music platform that transforms how artists and fans interact with music. 
                    Built on blockchain technology, it enables artists to launch their music as tradeable assets while giving fans the 
                    opportunity to become stakeholders in their favorite artists' success.
                  </p>
                  <p>
                    The platform combines free streaming, tokenized music ownership, social features, and live streaming to create a 
                    comprehensive ecosystem where artists maintain ownership and control while fans can invest in and support the music 
                    they love.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-bold text-neon-green mb-2">Decentralized</h3>
                      <p className="text-sm text-muted-foreground">
                        Music stored on IPFS, smart contracts handle trading, no single point of failure
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-bold text-neon-green mb-2">Tokenized</h3>
                      <p className="text-sm text-muted-foreground">
                        Each song is divided into 1,000,000 tradeable tokens via bonding curves
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-bold text-neon-green mb-2">Social</h3>
                      <p className="text-sm text-muted-foreground">
                        Stories, comments, feed, live streaming, and direct fan-artist engagement
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Table of Contents */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Table of Contents</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2">
                    <li><a href="#introduction" className="text-neon-green hover:underline">Introduction</a></li>
                    <li><a href="#problem" className="text-neon-green hover:underline">Problem Statement</a></li>
                    <li><a href="#solution" className="text-neon-green hover:underline">Solution Overview</a></li>
                    <li><a href="#architecture" className="text-neon-green hover:underline">Architecture & Technology</a></li>
                    <li><a href="#tokenomics" className="text-neon-green hover:underline">Tokenomics</a></li>
                    <li><a href="#features" className="text-neon-green hover:underline">Features</a></li>
                    <li><a href="#technical" className="text-neon-green hover:underline">Technical Implementation</a></li>
                    <li><a href="#roadmap" className="text-neon-green hover:underline">Roadmap</a></li>
                    <li><a href="#conclusion" className="text-neon-green hover:underline">Conclusion</a></li>
                  </ol>
                </CardContent>
              </Card>

              {/* Introduction */}
              <Card id="introduction">
                <CardHeader>
                  <CardTitle className="text-2xl">1. Introduction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    ROUGEE.PLAY represents a paradigm shift in the music industry, leveraging blockchain technology to create a 
                    decentralized platform where artists and fans can interact directly without intermediaries. The platform enables 
                    artists to monetize their music through tokenization while providing fans with investment opportunities and direct 
                    engagement.
                  </p>
                  <p>
                    Built on Base Network (an Ethereum L2), ROUGEE.PLAY combines the benefits of blockchain technology with a 
                    user-friendly interface, making Web3 music accessible to both crypto-native and traditional music fans.
                  </p>
                  <h3 className="text-xl font-bold mt-6">Vision</h3>
                  <p>
                    Our vision is to create a future where:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Artists own and control their music without label dependency</li>
                    <li>Fans can invest in and support artists they believe in</li>
                    <li>Revenue distribution is transparent and automated</li>
                    <li>Music discovery is decentralized and algorithm-free</li>
                    <li>Global access is available without geographical restrictions</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Problem Statement */}
              <Card id="problem">
                <CardHeader>
                  <CardTitle className="text-2xl">2. Problem Statement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="text-xl font-bold">Traditional Music Industry Challenges</h3>
                  <div className="space-y-4">
                    <div className="p-4 border-l-4 border-red-500 bg-red-500/10">
                      <h4 className="font-bold mb-2">Revenue Distribution</h4>
                      <p className="text-sm">
                        Artists receive minimal revenue from streaming platforms, often less than $0.01 per stream. 
                        Labels and platforms take the majority of revenue, leaving artists with a small fraction.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-red-500 bg-red-500/10">
                      <h4 className="font-bold mb-2">Centralized Control</h4>
                      <p className="text-sm">
                        Major labels and platforms control distribution, discovery, and monetization. Artists have limited 
                        autonomy and must rely on intermediaries to reach their audience.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-red-500 bg-red-500/10">
                      <h4 className="font-bold mb-2">Limited Fan Engagement</h4>
                      <p className="text-sm">
                        Fans can only stream music but cannot invest in or directly support artists. There's no mechanism 
                        for fans to benefit from an artist's success beyond listening.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-red-500 bg-red-500/10">
                      <h4 className="font-bold mb-2">Geographical Restrictions</h4>
                      <p className="text-sm">
                        Content licensing and distribution agreements create geographical barriers, limiting global access 
                        to music.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-red-500 bg-red-500/10">
                      <h4 className="font-bold mb-2">Censorship Risk</h4>
                      <p className="text-sm">
                        Centralized platforms can remove or restrict content based on policies, potentially silencing 
                        artists and limiting creative expression.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Solution Overview */}
              <Card id="solution">
                <CardHeader>
                  <CardTitle className="text-2xl">3. Solution Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    ROUGEE.PLAY addresses these challenges through a decentralized platform that combines music streaming, 
                    tokenization, trading, and social features into a unified ecosystem.
                  </p>
                  <h3 className="text-xl font-bold mt-6">Core Solutions</h3>
                  <div className="space-y-4">
                    <div className="p-4 border-l-4 border-neon-green bg-neon-green/10">
                      <h4 className="font-bold mb-2">Tokenized Music Ownership</h4>
                      <p className="text-sm">
                        Each song is divided into 1,000,000 tradeable tokens. Fans can buy and sell shares, creating a 
                        liquid market for music ownership. Artists receive tokens at launch and benefit from trading activity.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-neon-green bg-neon-green/10">
                      <h4 className="font-bold mb-2">Bonding Curve Pricing</h4>
                      <p className="text-sm">
                        Fair, algorithmic price discovery through bonding curves. Prices increase as tokens are sold, ensuring 
                        early supporters benefit while preventing manipulation.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-neon-green bg-neon-green/10">
                      <h4 className="font-bold mb-2">Decentralized Storage</h4>
                      <p className="text-sm">
                        Music stored on IPFS (InterPlanetary File System) ensures censorship resistance and permanent 
                        availability. No single entity can remove or restrict content.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-neon-green bg-neon-green/10">
                      <h4 className="font-bold mb-2">Direct Artist-Fan Engagement</h4>
                      <p className="text-sm">
                        Social features including stories, comments, feed posts, and live streaming enable direct 
                        communication between artists and fans without intermediaries.
                      </p>
                    </div>
                    <div className="p-4 border-l-4 border-neon-green bg-neon-green/10">
                      <h4 className="font-bold mb-2">Free Streaming with Optional Monetization</h4>
                      <p className="text-sm">
                        All music is free to stream, removing barriers to access. Artists can monetize through token 
                        trading, tips, premium content, and live streaming.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Architecture & Technology */}
              <Card id="architecture">
                <CardHeader>
                  <CardTitle className="text-2xl">4. Architecture & Technology</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="text-xl font-bold">Technology Stack</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">Frontend</h4>
                      <ul className="text-sm space-y-1">
                        <li>• React 18 with TypeScript</li>
                        <li>• Vite for build tooling</li>
                        <li>• Tailwind CSS for styling</li>
                        <li>• shadcn/ui components</li>
                        <li>• Progressive Web App (PWA)</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">Web3</h4>
                      <ul className="text-sm space-y-1">
                        <li>• wagmi & viem for Ethereum</li>
                        <li>• Privy for wallet auth</li>
                        <li>• Base Network (L2)</li>
                        <li>• Smart contracts for trading</li>
                        <li>• IPFS for storage</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">Backend</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Supabase (PostgreSQL)</li>
                        <li>• Edge Functions</li>
                        <li>• Real-time subscriptions</li>
                        <li>• Row-Level Security (RLS)</li>
                        <li>• Lighthouse IPFS pinning</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">Infrastructure</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Netlify for hosting</li>
                        <li>• Global CDN</li>
                        <li>• Agora for live streaming</li>
                        <li>• Base Mini App support</li>
                      </ul>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mt-6">Architecture Principles</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Decentralized by Design:</strong> Music on IPFS, trading on smart contracts, no single point of failure</li>
                    <li><strong>User-Centric Experience:</strong> Fast, responsive interface with mobile-first design</li>
                    <li><strong>Scalable Infrastructure:</strong> Edge computing, caching strategies, database optimization</li>
                    <li><strong>Security First:</strong> Row-Level Security, JWT validation, wallet verification</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Tokenomics */}
              <Card id="tokenomics">
                <CardHeader>
                  <CardTitle className="text-2xl">5. Tokenomics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="text-xl font-bold">Dual-Token Economy</h3>
                  <p>
                    ROUGEE.PLAY operates a dual-token economy combining XRGE (platform token) with USDC (via x402 protocol) 
                    for payments and consumption.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2 text-neon-green">XRGE Token</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Name:</strong> RougeCoin</li>
                        <li>• <strong>Symbol:</strong> XRGE</li>
                        <li>• <strong>Network:</strong> Base (Ethereum L2)</li>
                        <li>• <strong>Use Cases:</strong></li>
                        <li className="ml-4">- Song token trading</li>
                        <li className="ml-4">- Platform governance</li>
                        <li className="ml-4">- Tier-based access</li>
                        <li className="ml-4">- Upload slot purchases</li>
                        <li className="ml-4">- Staking rewards</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2 text-blue-400">USDC (via x402)</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Purpose:</strong> Payments & consumption</li>
                        <li>• <strong>Network:</strong> Base (native USDC)</li>
                        <li>• <strong>Use Cases:</strong></li>
                        <li className="ml-4">- Premium streaming (pay-per-play)</li>
                        <li className="ml-4">- API access fees</li>
                        <li className="ml-4">- AI music generation</li>
                        <li className="ml-4">- Direct tips to artists</li>
                        <li className="ml-4">- Automated royalties</li>
                      </ul>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mt-6">Song Token Economics</h3>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-bold mb-2">Token Structure</h4>
                    <ul className="text-sm space-y-2">
                      <li>• <strong>Total Supply:</strong> 1,000,000 tokens per song</li>
                      <li>• <strong>Initial Price:</strong> 0.001 XRGE per token</li>
                      <li>• <strong>Price Increment:</strong> 0.000001 XRGE per token sold</li>
                      <li>• <strong>Bonding Curve Formula:</strong> Price = Initial Price + (Tokens Sold × Price Increment)</li>
                      <li>• <strong>Trading Fee:</strong> 2% per trade (50% burn, 50% treasury)</li>
                    </ul>
                  </div>
                  <h3 className="text-xl font-bold mt-6">Revenue Distribution</h3>
                  <div className="space-y-3">
                    <div className="p-3 border rounded">
                      <h4 className="font-bold text-sm">Trading Fees</h4>
                      <p className="text-xs text-muted-foreground">2% per song token trade → 50% burned, 50% to treasury</p>
                    </div>
                    <div className="p-3 border rounded">
                      <h4 className="font-bold text-sm">Premium Streaming</h4>
                      <p className="text-xs text-muted-foreground">20% platform fee on USDC payments → 50% operations, 50% XRGE buyback</p>
                    </div>
                    <div className="p-3 border rounded">
                      <h4 className="font-bold text-sm">Upload Slots</h4>
                      <p className="text-xs text-muted-foreground">10 XRGE per 20 slots → 100% to treasury (operating capital)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Features */}
              <Card id="features">
                <CardHeader>
                  <CardTitle className="text-2xl">6. Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="text-xl font-bold">Core Features</h3>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">🎵 Music Streaming</h4>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Free, unlimited streaming of all music</li>
                        <li>• High-quality audio playback</li>
                        <li>• Continuous playback across pages</li>
                        <li>• Playlist creation and management</li>
                        <li>• Radio mode for discovery</li>
                        <li>• Offline PWA support</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">💰 Token Trading</h4>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Buy/sell song tokens via bonding curves</li>
                        <li>• Real-time price charts and history</li>
                        <li>• Trading history and analytics</li>
                        <li>• Portfolio tracking</li>
                        <li>• Price alerts and notifications</li>
                        <li>• XRGE token swap integration</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">👤 Artist Profiles</h4>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Customizable profiles with avatar and cover</li>
                        <li>• Artist bio and social links</li>
                        <li>• Unique ticker symbols</li>
                        <li>• Analytics dashboard</li>
                        <li>• Play count and engagement stats</li>
                        <li>• Verified artist badges</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">📱 Social Features</h4>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• 24-hour ephemeral stories</li>
                        <li>• Feed posts with media</li>
                        <li>• Comments on songs and posts</li>
                        <li>• Like and share functionality</li>
                        <li>• Direct messaging (XMTP)</li>
                        <li>• Follow artists and fans</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">🔴 Live Streaming</h4>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Real-time video/audio broadcasting</li>
                        <li>• Live chat during streams</li>
                        <li>• Viewer count tracking</li>
                        <li>• Stream discovery feed</li>
                        <li>• Tips during live streams</li>
                        <li>• Mobile PWA support</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">🎯 Discovery & Trending</h4>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Trending songs and artists</li>
                        <li>• Genre-based browsing</li>
                        <li>• 24-hour price change tracking</li>
                        <li>• Market cap calculations</li>
                        <li>• Top gainers and volume leaders</li>
                        <li>• Search functionality</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Implementation */}
              <Card id="technical">
                <CardHeader>
                  <CardTitle className="text-2xl">7. Technical Implementation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="text-xl font-bold">Smart Contracts</h3>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-bold mb-2">Song Token Factory</h4>
                    <p className="text-sm mb-2">
                      Deploys ERC-20 tokens for each song with a total supply of 1,000,000 tokens.
                    </p>
                    <h4 className="font-bold mb-2 mt-4">Bonding Curve Contract</h4>
                    <p className="text-sm mb-2">
                      Manages token trading via bonding curves. Handles buy/sell operations with automatic price 
                      calculation based on supply and demand.
                    </p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Address: <code className="text-xs">0xCeE9c18C448487a1deAac3E14974C826142C50b5</code></li>
                      <li>• Supports XRGE and ETH payments</li>
                      <li>• Slippage protection</li>
                      <li>• Real-time price queries</li>
                    </ul>
                  </div>
                  <h3 className="text-xl font-bold mt-6">Data Storage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">IPFS (Music Files)</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Lighthouse pinning service</li>
                        <li>• Decentralized storage</li>
                        <li>• Permanent availability</li>
                        <li>• Censorship-resistant</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-bold mb-2">Supabase (Metadata)</h4>
                      <ul className="text-sm space-y-1">
                        <li>• PostgreSQL database</li>
                        <li>• Real-time subscriptions</li>
                        <li>• Row-Level Security</li>
                        <li>• Edge Functions</li>
                      </ul>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mt-6">Security</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                    <li><strong>Authentication:</strong> Privy wallet-based authentication with JWT tokens</li>
                    <li><strong>Authorization:</strong> Row-Level Security policies on all database tables</li>
                    <li><strong>Smart Contracts:</strong> Audited contracts with upgradeable patterns</li>
                    <li><strong>Data Protection:</strong> Encryption at rest and in transit</li>
                    <li><strong>Rate Limiting:</strong> Protection against abuse and spam</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Roadmap */}
              <Card id="roadmap">
                <CardHeader>
                  <CardTitle className="text-2xl">8. Roadmap</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="text-xl font-bold">Phase 1: Core Platform ✅</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                    <li>✅ Music upload and streaming</li>
                    <li>✅ Token trading system</li>
                    <li>✅ Artist profiles</li>
                    <li>✅ Social features (stories, feed, comments)</li>
                    <li>✅ Live streaming</li>
                    <li>✅ Base Mini App integration</li>
                  </ul>
                  <h3 className="text-xl font-bold mt-6">Phase 2: Enhanced Features 🚧</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                    <li>🔄 Advanced analytics dashboard</li>
                    <li>🔄 Playlist sharing and collaboration</li>
                    <li>🔄 Mobile native apps (iOS/Android)</li>
                    <li>🔄 x402 payment integration</li>
                    <li>🔄 AI music generation</li>
                    <li>🔄 API monetization</li>
                  </ul>
                  <h3 className="text-xl font-bold mt-6">Phase 3: Ecosystem Expansion 📋</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                    <li>📋 Label partnerships</li>
                    <li>📋 Festival integrations</li>
                    <li>📋 Cross-platform sync</li>
                    <li>📋 AI-powered discovery</li>
                    <li>📋 Multi-chain support</li>
                    <li>📋 NFT marketplace integration</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Conclusion */}
              <Card id="conclusion">
                <CardHeader>
                  <CardTitle className="text-2xl">9. Conclusion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    ROUGEE.PLAY represents a fundamental shift in how music is created, distributed, and monetized. 
                    By combining blockchain technology, decentralized storage, and social features, we've created a platform 
                    that empowers artists and engages fans in unprecedented ways.
                  </p>
                  <p>
                    The tokenized music ownership model creates new economic opportunities for both artists and fans, while 
                    the decentralized architecture ensures censorship resistance and permanent availability of content.
                  </p>
                  <p>
                    As we continue to build and expand the platform, we remain committed to our core principles: 
                    decentralization, artist empowerment, fan engagement, and fair revenue distribution.
                  </p>
                  <div className="p-4 border-l-4 border-neon-green bg-neon-green/10 mt-6">
                    <p className="font-bold mb-2">Join the Music Revolution</p>
                    <p className="text-sm">
                      ROUGEE.PLAY is more than a platform—it's a movement toward a more equitable, decentralized, and 
                      artist-centric music industry. Together, we're building the future of music.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact & Resources */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Resources & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-bold mb-2">Platform</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Website: <a href="https://rougee.app" className="text-neon-green hover:underline">rougee.app</a></li>
                        <li>• GitHub: <a href="https://github.com/cyberdreadx/rougee-play-beats" className="text-neon-green hover:underline">Repository</a></li>
                        <li>• Base Mini App: Integrated</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold mb-2">Token Information</h4>
                      <ul className="text-sm space-y-1">
                        <li>• XRGE Token: <code className="text-xs">0x147120faEC9277ec02d957584CFCD92B56A24317</code></li>
                        <li>• Network: Base (Ethereum L2)</li>
                        <li>• Bonding Curve: <code className="text-xs">0xCeE9c18C448487a1deAac3E14974C826142C50b5</code></li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </Layout>
    </>
  );
}

