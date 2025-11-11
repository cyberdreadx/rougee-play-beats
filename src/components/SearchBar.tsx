import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Music, User, Loader2, CheckCircle } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";

interface SearchResult {
  type: "artist" | "song";
  id: string;
  name: string;
  artist?: string;
  wallet_address?: string;
  audio_cid?: string;
  cover_cid?: string;
  avatar_cid?: string;
  artist_ticker?: string;
  verified?: boolean;
}

const SearchBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchDatabase = async () => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      const searchTerm = searchQuery.trim();

      try {
        // Search artists
        const { data: artists } = await supabase
          .from("public_profiles")
          .select("wallet_address, artist_name, avatar_cid, artist_ticker, verified")
          .ilike("artist_name", `%${searchTerm}%`)
          .limit(5);

        // Search songs
        const { data: songs } = await supabase
          .from("songs")
          .select("id, title, artist, wallet_address, audio_cid, cover_cid, genre, ticker")
          .or(`title.ilike.%${searchTerm}%,artist.ilike.%${searchTerm}%,genre.ilike.%${searchTerm}%,ticker.ilike.%${searchTerm}%`)
          .limit(5);

        const artistResults: SearchResult[] = (artists || []).map((a) => ({
          type: "artist" as const,
          id: a.wallet_address,
          name: a.artist_name,
          wallet_address: a.wallet_address,
          avatar_cid: a.avatar_cid,
          artist_ticker: a.artist_ticker,
          verified: a.verified,
        }));

        const songResults: SearchResult[] = (songs || []).map((s) => ({
          type: "song" as const,
          id: s.id,
          name: s.title,
          artist: s.artist,
          wallet_address: s.wallet_address,
          audio_cid: s.audio_cid,
          cover_cid: s.cover_cid,
        }));

        setResults([...artistResults, ...songResults]);
        setShowDropdown(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchDatabase, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "artist") {
      console.log('SearchBar: Navigating to artist page:', `/artist/${result.wallet_address}`);
      navigate(`/artist/${result.wallet_address}`);
    } else {
      console.log('SearchBar: Navigating to song page:', `/song/${result.id}`);
      navigate(`/song/${result.id}`);
    }
    setShowDropdown(false);
    setSearchQuery("");
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="w-full px-2 md:px-6 py-4" ref={dropdownRef}>
      <div className="relative max-w-4xl">
        <div className="flex space-x-2 md:space-x-4">
          <Input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 glass text-foreground placeholder:text-muted-foreground font-mono border-neon-green/30"
          />
          <Button variant="neon" className="px-4 md:px-6">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `[${t('search.button').toUpperCase()}]`
            )}
          </Button>
        </div>

        {/* Dropdown Results */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full left-0 right-16 mt-2 glass-card shadow-lg z-50 max-h-96 overflow-y-auto">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neon-green/10 transition-colors text-left border-b border-border last:border-b-0"
              >
                {result.type === "artist" ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {result.avatar_cid ? (
                        <img
                          src={getIPFSGatewayUrl(result.avatar_cid, undefined, true)}
                          alt={result.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-neon-green" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-bold text-foreground truncate">
                          {result.name}
                        </p>
                        {result.verified && (
                          <CheckCircle className="h-3.5 w-3.5 text-neon-green" aria-label="Verified artist" />
                        )}
                        {result.artist_ticker && (
                          <span className="font-mono text-xs text-neon-green border border-neon-green/30 px-1.5 py-0.5 rounded">
                            ${result.artist_ticker}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatAddress(result.wallet_address || "")}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded bg-neon-green/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {result.cover_cid ? (
                        <img
                          src={getIPFSGatewayUrl(result.cover_cid, undefined, true)}
                          alt={result.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-5 w-5 text-neon-green" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-bold text-foreground truncate">
                        {result.name}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground truncate">
                        {result.artist || "Unknown Artist"}
                      </p>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {showDropdown && results.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
          <div className="absolute top-full left-0 right-16 mt-2 glass-card shadow-lg z-50 p-4">
            <p className="font-mono text-sm text-muted-foreground text-center">
              {t('search.noResults')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;