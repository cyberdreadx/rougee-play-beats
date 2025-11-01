import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  Music, 
  Coins, 
  ArrowRightLeft, 
  Lock, 
  Upload, 
  TrendingUp,
  Wallet,
  Play,
  Share2,
  Sparkles,
  Shield,
  Zap,
  Globe,
  CheckCircle2
} from "lucide-react";

const HowItWorks = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: Wallet,
      title: "Connect Your Wallet",
      subtitle: "Just like logging in!",
      description: "Your wallet is your account. No password needed - just connect and you're in!",
      details: [
        "Click 'Connect Wallet' button",
        "Choose your wallet (we'll help you set one up if needed)",
        "Approve the connection - Done! 🎉"
      ],
      layman: "Think of it like using your fingerprint to unlock your phone, but for apps.",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      step: "01"
    },
    {
      icon: Music,
      title: "Discover Music",
      subtitle: "100% Free Listening",
      description: "Browse thousands of songs and play anything you want - completely free!",
      details: [
        "Search for any genre or artist",
        "Play unlimited songs for free",
        "Create playlists and share with friends"
      ],
      layman: "Just like Spotify or Apple Music, but you actually own a piece of what you love.",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      step: "02"
    },
    {
      icon: Coins,
      title: "Understand Song Tokens",
      subtitle: "Like Digital Trading Cards",
      description: "Every song has its own token. When you buy a token, you're investing in that song's success!",
      details: [
        "Each song = unique token (like a collectible card)",
        "Artists get tokens when they upload",
        "Fans can buy/sell tokens as songs get popular"
      ],
      layman: "Remember Pokémon cards? Same idea, but for music. Rare songs = valuable tokens!",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      step: "03"
    },
    {
      icon: ArrowRightLeft,
      title: "Buy & Trade Tokens",
      subtitle: "Simple as 1-2-3",
      description: "Swap your crypto (ETH, USDC, KTA) for XRGE or song tokens. Trade anytime!",
      details: [
        "Go to Swap page or any song page",
        "Choose how much to invest",
        "Approve → Trade → Own tokens! 💎"
      ],
      layman: "Like exchanging dollars for euros, but with music tokens instead.",
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10",
      step: "04"
    },
    {
      icon: TrendingUp,
      title: "Support Artists Directly",
      subtitle: "No Middlemen",
      description: "Artists keep 100% control. When their tokens trade, they earn money directly!",
      details: [
        "Artists upload → get tokens instantly",
        "Fans buy tokens → artists earn immediately",
        "No record labels taking cuts"
      ],
      layman: "Like buying merch at a concert - money goes straight to the artist, not some company.",
      color: "from-pink-500 to-rose-500",
      bgColor: "bg-pink-500/10",
      step: "05"
    },
    {
      icon: Share2,
      title: "Grow Your Collection",
      subtitle: "Earn as Songs Blow Up",
      description: "The more a song gets played and shared, the more valuable its tokens become!",
      details: [
        "Share songs you believe in",
        "Watch token values rise as songs trend",
        "Sell anytime to take profits or hold forever"
      ],
      layman: "Like owning a piece of a hit song. The bigger it gets, the more your tokens are worth!",
      color: "from-cyan-500 to-blue-500",
      bgColor: "bg-cyan-500/10",
      step: "06"
    }
  ];

  const features = [
    {
      icon: Shield,
      title: "Copyright Protected",
      description: "Every song is verified for copyright before upload",
      layman: "Artists' work is protected - no stealing or copying allowed!",
      emoji: "🛡️",
      color: "text-blue-500"
    },
    {
      icon: Globe,
      title: "Decentralized Storage",
      description: "Music lives on IPFS - permanent, censorship-resistant storage",
      layman: "Your music can never be deleted or taken down by anyone. It's stored across thousands of computers worldwide!",
      emoji: "☁️",
      color: "text-purple-500"
    },
    {
      icon: Sparkles,
      title: "Token Trading",
      description: "Buy, sell, and collect music tokens like digital art",
      layman: "Imagine owning a piece of your favorite song - that's what tokens let you do!",
      emoji: "💎",
      color: "text-green-500"
    },
    {
      icon: Zap,
      title: "Always Free",
      description: "Listen to unlimited music without paying a subscription",
      layman: "No monthly fees, no ads, no limits. Just pure music enjoyment!",
      emoji: "🎵",
      color: "text-orange-500"
    }
  ];

  return (
    <>
      <Helmet>
        <title>How It Works - ROUGEE</title>
        <meta name="description" content="Learn how ROUGEE works in simple steps. Upload music, trade tokens, and support artists." />
        <meta property="og:image" content={`${window.location.origin}/rougee-new-og.jpg`} />
        <meta name="twitter:image" content={`${window.location.origin}/rougee-new-og.jpg`} />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 mb-20">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-16 animate-fade-in">
            <Badge className="mb-4 text-sm sm:text-base px-4 py-1.5 bg-gradient-to-r from-primary/20 to-purple-500/20 border-primary/50">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2 inline" />
              Simple Guide for Everyone
            </Badge>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent px-2">
              How ROUGEE Works
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto mb-3 px-4">
              Music + Blockchain = Magic ✨
            </p>
            <p className="text-base sm:text-lg text-muted-foreground/80 px-4">
              No crypto knowledge needed. We'll explain everything in simple terms!
            </p>
          </div>

          {/* Main Steps */}
          <div className="space-y-6 sm:space-y-8 lg:space-y-10 mb-12 sm:mb-16 lg:mb-20">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card 
                  key={index} 
                  className={`overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl ${step.bgColor}`}
                >
                  <div className="grid lg:grid-cols-12 gap-0">
                    {/* Step Number & Icon - Mobile optimized */}
                    <div className={`lg:col-span-3 bg-gradient-to-br ${step.color} p-6 sm:p-8 flex flex-col items-center justify-center text-white relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/20"></div>
                      <div className="relative z-10 text-center">
                        <div className="text-5xl sm:text-6xl lg:text-7xl font-black opacity-30 mb-2">
                          {step.step}
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-3 sm:mb-4">
                          <Icon className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16" />
                        </div>
                        <Badge className="bg-white/30 hover:bg-white/40 text-white border-white/50 text-xs sm:text-sm px-3 py-1">
                          Step {index + 1}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-9 p-6 sm:p-8 lg:p-10">
                      <CardHeader className="p-0 mb-4 sm:mb-6">
                        <CardTitle className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
                          {step.title}
                        </CardTitle>
                        <CardDescription className="text-base sm:text-lg lg:text-xl text-primary font-semibold">
                          {step.subtitle}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="p-0 space-y-4 sm:space-y-6">
                        {/* Main Description */}
                        <p className="text-base sm:text-lg text-foreground leading-relaxed">
                          {step.description}
                        </p>

                        {/* Layman's Terms */}
                        <div className="bg-muted/50 rounded-xl p-4 sm:p-5 border-l-4 border-primary">
                          <p className="text-sm sm:text-base text-muted-foreground flex items-start gap-2 sm:gap-3">
                            <span className="text-xl sm:text-2xl shrink-0">💡</span>
                            <span><strong className="text-foreground">In simple terms:</strong> {step.layman}</span>
                          </p>
                        </div>

                        {/* Step Details */}
                        <div className="space-y-2 sm:space-y-3">
                          {step.details.map((detail, i) => (
                            <div key={i} className="flex items-start gap-3 sm:gap-4 text-sm sm:text-base">
                              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground leading-relaxed">{detail}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Simple Comparison */}
          <Card className="mb-8 sm:mb-12 lg:mb-16 bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-2 overflow-hidden">
            <CardHeader className="text-center pb-4 sm:pb-6">
              <div className="text-5xl sm:text-6xl lg:text-7xl mb-4">🎵</div>
              <CardTitle className="text-2xl sm:text-3xl lg:text-4xl mb-3 sm:mb-4 px-2">
                Think of it like this...
              </CardTitle>
              <CardDescription className="text-base sm:text-lg lg:text-xl px-4">
                <strong className="text-foreground">ROUGEE</strong> combines the best of three worlds
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 sm:pt-4">
              <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="p-5 sm:p-6 bg-background/80 backdrop-blur rounded-xl border-2 border-primary/20 hover:border-primary/50 transition-all hover:scale-105">
                  <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🎧</div>
                  <p className="font-bold text-lg sm:text-xl mb-2">Listen Free</p>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Like <strong>Spotify</strong> - unlimited streaming, no subscription
                  </p>
                </div>
                <div className="p-5 sm:p-6 bg-background/80 backdrop-blur rounded-xl border-2 border-purple-500/20 hover:border-purple-500/50 transition-all hover:scale-105">
                  <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🃏</div>
                  <p className="font-bold text-lg sm:text-xl mb-2">Collect Tokens</p>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Like <strong>Trading Cards</strong> - own rare pieces of music
                  </p>
                </div>
                <div className="p-5 sm:p-6 bg-background/80 backdrop-blur rounded-xl border-2 border-pink-500/20 hover:border-pink-500/50 transition-all hover:scale-105">
                  <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">💰</div>
                  <p className="font-bold text-lg sm:text-xl mb-2">Trade & Earn</p>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Like <strong>Crypto</strong> - invest in what you believe in
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Features */}
          <div className="mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-6 sm:mb-8 lg:mb-10 px-2">
              Why It's Awesome 🔥
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card 
                    key={index} 
                    className="text-center hover:shadow-xl transition-all hover:scale-105 border-2 overflow-hidden"
                  >
                    <CardContent className="pt-6 sm:pt-8 pb-6 px-4 sm:px-5">
                      <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">{feature.emoji}</div>
                      <div className={`mb-3 sm:mb-4 ${feature.color}`}>
                        <Icon className="h-7 w-7 sm:h-8 sm:w-8 mx-auto" />
                      </div>
                      <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed">
                        {feature.description}
                      </p>
                      <div className="bg-muted/50 rounded-lg p-3 text-xs sm:text-sm text-left">
                        <span className="text-primary font-semibold">💡 </span>
                        {feature.layman}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* FAQ Section */}
          <Card className="mb-8 sm:mb-12 lg:mb-16 border-2">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-2xl sm:text-3xl lg:text-4xl text-center px-2">
                Quick Questions 🤔
              </CardTitle>
              <CardDescription className="text-center text-sm sm:text-base px-4">
                Common questions answered in plain English
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 border-l-4 border-primary">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">💰</span>
                  What is XRGE?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pl-8 sm:pl-9">
                  XRGE is the main token on our platform. Think of it like game coins or arcade tokens - you can buy them with real money, use them to support artists, and trade them back for cash anytime!
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 border-l-4 border-purple-500">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">🎵</span>
                  Can I listen for free?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pl-8 sm:pl-9">
                  Absolutely! All music is 100% free to stream - no subscription, no ads, no limits. You only need tokens if you want to invest in artists and collect their music tokens.
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 border-l-4 border-green-500">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">👨‍🎨</span>
                  How do artists make money?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pl-8 sm:pl-9">
                  When an artist uploads a song, they receive tokens immediately. As fans buy and trade these tokens, the artist earns money directly - no record label taking 70% of their earnings!
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 border-l-4 border-orange-500">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">🔒</span>
                  Is my music safe?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pl-8 sm:pl-9">
                  Super safe! Your music is stored on IPFS (a decentralized network of computers worldwide). It's like having thousands of backup copies that nobody can delete, hack, or censor. Once it's uploaded, it's there forever!
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 border-l-4 border-pink-500">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">🆕</span>
                  Do I need crypto experience?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pl-8 sm:pl-9">
                  Not at all! If you can use Instagram or TikTok, you can use ROUGEE. We guide you through everything step-by-step. Just connect a wallet (we'll help you create one) and start exploring!
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 border-l-4 border-cyan-500">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">💎</span>
                  What's a "bonding curve"?
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pl-8 sm:pl-9">
                  It's a fancy way of saying "the price goes up as more people buy." Early supporters pay less, and as a song gets popular, tokens become more valuable. It's like buying concert tickets - the earlier you buy, the cheaper they are!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="text-center space-y-4 sm:space-y-6">
            <div className="inline-block">
              <Badge className="mb-4 text-sm sm:text-base px-4 py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50">
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 inline" />
                Join 1000+ Music Lovers
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold px-2">
              Ready to Start Your Journey? 🚀
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Join thousands of artists and fans building the future of music!
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 px-4">
              <Button 
                size="lg"
                onClick={() => navigate("/")}
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto"
              >
                <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Explore Music
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate("/swap")}
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-2 w-full sm:w-auto"
              >
                <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Start Trading
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate("/become-artist")}
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-2 w-full sm:w-auto"
              >
                <Music className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Become Artist
              </Button>
            </div>
            
            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto pt-6 sm:pt-8 px-4">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-1">100%</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Artist Owned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-1">24/7</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Trading</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-1">∞</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Free Listening</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default HowItWorks;
