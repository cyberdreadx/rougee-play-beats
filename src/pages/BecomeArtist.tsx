import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Music, 
  Shield, 
  Coins, 
  Zap, 
  Globe, 
  Users, 
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Loader2
} from "lucide-react";
import { useEffect } from "react";

const BecomeArtist = () => {
  const navigate = useNavigate();
  const { isConnected, connect } = useWallet();
  const { profile, loading } = useCurrentUserProfile();

  useEffect(() => {
    // If user already has a profile (even incomplete), redirect to profile edit
    if (profile) {
      navigate("/profile/edit");
    }
  }, [profile, navigate]);

  const handleGetStarted = () => {
    if (!isConnected) {
      connect();
    } else {
      navigate("/profile/edit");
    }
  };

  const features = [
    {
      icon: Coins,
      title: "Instant Token Launch",
      description: "Each song mints 1B tokens. You get 1.5% (15M tokens), 98.5% goes to trading pool for fans.",
      color: "text-neon-green"
    },
    {
      icon: TrendingUp,
      title: "Fan Trading & Speculation",
      description: "Fans buy and trade your song tokens. As your music gains popularity, token value grows.",
      color: "text-blue-500"
    },
    {
      icon: Shield,
      title: "Decentralized Ownership",
      description: "Your music lives on IPFS forever. No platform can take it down or delete your content.",
      color: "text-purple-500"
    },
    {
      icon: Zap,
      title: "Unique Artist Ticker",
      description: "Claim your $TICKER symbol - a permanent, tradeable identity on the blockchain.",
      color: "text-yellow-500"
    },
    {
      icon: Globe,
      title: "Verifiable on IPFS",
      description: "Every profile, song, and image is cryptographically verified and permanently stored.",
      color: "text-pink-500"
    },
    {
      icon: Users,
      title: "Direct Fan Connection",
      description: "Connect with listeners who are literally invested in your success through song tokens.",
      color: "text-orange-500"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Connect Your Wallet",
      description: "Use any Web3 wallet to authenticate. Your wallet is your artist identity and receives all tokens."
    },
    {
      number: "02",
      title: "Create Your Profile",
      description: "Upload cover art, avatar, claim your unique $TICKER, and add your bio to establish your brand."
    },
    {
      number: "03",
      title: "Upload & Tokenize Music",
      description: "Each song drop mints 1B tokens. You get 1.5% instantly, the rest goes to fans for trading."
    },
    {
      number: "04",
      title: "Earn as Fans Trade",
      description: "Watch your song tokens get traded by fans. As demand grows, so does the value of your 1.5%."
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 space-y-6">
          <Badge className="bg-neon-green/20 text-neon-green border-neon-green font-mono">
            DECENTRALIZED MUSIC PLATFORM
          </Badge>
          
          <h1 className="text-5xl md:text-6xl font-mono font-bold neon-text">
            BECOME AN ARTIST
          </h1>
          
          <p className="text-xl text-muted-foreground font-mono max-w-3xl mx-auto">
            Launch your music career on a truly decentralized platform where every song becomes a tradeable token.
            Own your content, claim your ticker, and let fans invest in your success.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button 
              variant="neon" 
              size="lg"
              onClick={handleGetStarted}
              className="font-mono text-lg"
            >
              {!isConnected ? (
                <>
                  CONNECT WALLET
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              ) : (
                <>
                  CREATE PROFILE
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate("/")}
              className="font-mono text-lg"
            >
              EXPLORE MUSIC
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-mono font-bold neon-text text-center mb-8">
            WHY LAUNCH HERE?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="console-bg tech-border p-6 hover:border-neon-green transition-colors">
                <feature.icon className={`h-10 w-10 mb-4 ${feature.color}`} />
                <h3 className="font-mono font-bold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* Tokenomics Explainer - NEW FEATURED SECTION */}
        <Card className="console-bg tech-border p-8 mb-16 border-neon-green/50">
          <div className="text-center mb-8">
            <Badge className="bg-neon-green/20 text-neon-green border-neon-green font-mono mb-4">
              HOW SONG TOKENOMICS WORK
            </Badge>
            <h2 className="text-3xl font-mono font-bold neon-text mb-4">
              EVERY SONG = 1 BILLION TOKENS
            </h2>
            <p className="text-muted-foreground font-mono max-w-2xl mx-auto">
              When you drop a song, it automatically mints 1 billion tradeable tokens. 
              Here&apos;s how they&apos;re distributed:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="console-bg tech-border p-6 border-neon-green/30">
              <div className="flex items-start gap-4">
                <div className="bg-neon-green/20 p-3 rounded">
                  <Coins className="h-8 w-8 text-neon-green" />
                </div>
                <div className="flex-1">
                  <h3 className="font-mono font-bold text-xl mb-2 text-neon-green">
                    1.5% TO ARTIST
                  </h3>
                  <p className="text-3xl font-mono font-bold mb-2">15,000,000</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    You receive 15 million tokens instantly when you upload. 
                    Hold them as your song gains value or sell anytime.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="console-bg tech-border p-6 border-blue-500/30">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500/20 p-3 rounded">
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-mono font-bold text-xl mb-2 text-blue-500">
                    98.5% TO TRADING POOL
                  </h3>
                  <p className="text-3xl font-mono font-bold mb-2">985,000,000</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    Goes to liquidity pool for fans to buy, sell, and trade. 
                    More demand = higher token price = your 1.5% grows in value.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="console-bg tech-border p-4">
              <TrendingUp className="h-6 w-6 text-neon-green mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground">
                Song goes viral → More fans buy tokens
              </p>
            </div>
            <div className="console-bg tech-border p-4">
              <Coins className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground">
                Token price increases → Your 1.5% appreciates
              </p>
            </div>
            <div className="console-bg tech-border p-4">
              <Zap className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground">
                You earn from both music and token value
              </p>
            </div>
          </div>
        </Card>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-mono font-bold neon-text text-center mb-8">
            HOW IT WORKS
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <Card key={index} className="console-bg tech-border p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-6xl font-mono font-bold text-neon-green/10">
                  {step.number}
                </div>
                <div className="relative z-10">
                  <div className="text-2xl font-mono font-bold text-neon-green mb-2">
                    {step.number}
                  </div>
                  <h3 className="font-mono font-bold text-lg mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {step.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* What You Get */}
        <Card className="console-bg tech-border p-8 mb-16">
          <h2 className="text-3xl font-mono font-bold neon-text text-center mb-8">
            WHAT YOU GET
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">15M Tokens Per Song</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  Receive 1.5% of 1B tokens instantly when you upload - that&apos;s 15 million tokens in your wallet
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">Token Appreciation Rights</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  As fans trade your song tokens, the value can grow - your 1.5% supply appreciates with demand
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">Tradeable Artist $TICKER</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  Claim your 3-10 character ticker - unique brand identity that can become valuable
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">Unlimited Token Launches</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  Every song gets its own 1B token supply - upload unlimited tracks, get 1.5% of each
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">Analytics Dashboard</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  Track total plays, songs, token performance, and trending position
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">Verifiable Authenticity</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  Every upload gets a CID you can verify on IPFS gateways
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-neon-green flex-shrink-0" />
              <div>
                <h4 className="font-mono font-bold mb-1">Fan Investment Opportunities</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  Appear in Trending Artists as fans buy and trade your song tokens
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <Card className="console-bg tech-border p-12 text-center">
          <Music className="h-16 w-16 text-neon-green mx-auto mb-6" />
          <h2 className="text-3xl font-mono font-bold neon-text mb-4">
            READY TO LAUNCH?
          </h2>
          <p className="text-lg text-muted-foreground font-mono mb-8 max-w-2xl mx-auto">
            Join the music tokenization revolution. Every song becomes an investment opportunity for fans.
            No gatekeepers, no streaming pennies - just you, your music, and fans who believe in you.
          </p>
          <Button 
            variant="neon" 
            size="lg"
            onClick={handleGetStarted}
            className="font-mono text-lg px-8"
          >
            {!isConnected ? (
              <>
                CONNECT WALLET TO START
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            ) : (
              <>
                CREATE YOUR ARTIST PROFILE
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default BecomeArtist;
