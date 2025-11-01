import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, TrendingUp, Music, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo.png";
import WalletButton from "@/components/WalletButton";

export default function LandingHero() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/trending?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 md:py-12 bg-gradient-to-b from-background via-background/95 to-background">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-8">
        <div className="mb-3 flex justify-center">
          <img src={logo} alt="ROUGEE Logo" className="w-12 h-12 rounded-full object-cover border border-primary/20" />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
          ROUGEE
        </h1>
        
        <p className="text-xs md:text-sm text-muted-foreground mb-6 max-w-2xl mx-auto px-4">
          The decentralized music platform where artists own their content and fans discover amazing beats
        </p>

        {/* Search Bar */}
        <div className="mb-6 max-w-md mx-auto px-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search artists, songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button 
              size="icon" 
              variant="neon"
              onClick={handleSearch}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 px-4">
          <WalletButton />
          <Button 
            size="lg" 
            variant="outline" 
            className="w-full font-mono text-sm"
            onClick={() => navigate("/trending")}
          >
            [EXPLORE MUSIC]
          </Button>
        </div>
      </div>

      {/* Features Grid - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto w-full px-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Decentralized Storage</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your music is stored on IPFS via Lighthouse
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Artist Ownership</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Artists maintain full ownership of their content
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Copyright Protection</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Built-in ACRCloud scanning ensures safety
          </p>
        </div>
      </div>

      {/* Stats Section - Compact */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto w-full px-4">
        <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
          <div className="text-base md:text-lg font-bold text-primary mb-0.5">100%</div>
          <div className="text-[10px] text-muted-foreground">Ownership</div>
        </div>
        <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
          <div className="text-base md:text-lg font-bold text-primary mb-0.5">IPFS</div>
          <div className="text-[10px] text-muted-foreground">Storage</div>
        </div>
        <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
          <div className="text-base md:text-lg font-bold text-primary mb-0.5">24/7</div>
          <div className="text-[10px] text-muted-foreground">Stories</div>
        </div>
        <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
          <div className="text-base md:text-lg font-bold text-primary mb-0.5">Safe</div>
          <div className="text-[10px] text-muted-foreground">Protected</div>
        </div>
      </div>
    </div>
  );
}
