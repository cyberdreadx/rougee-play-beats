import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import NetworkInfo from "@/components/NetworkInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/hooks/useWallet";
import { Loader2, Save, ArrowLeft, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  description: string | null;
  genre: string | null;
  ticker: string | null;
  download_enabled: boolean | null;
  download_type: string | null;
  download_price_usdc: number | null;
}

const SongEdit = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { getAuthHeaders } = usePrivyToken();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloadEnabled, setDownloadEnabled] = useState(false);
  const [downloadType, setDownloadType] = useState<'free' | 'purchase_usdc' | 'holders_only' | 'disabled'>('disabled');
  const [downloadPriceUsdc, setDownloadPriceUsdc] = useState("0");
  const [nsfw, setNsfw] = useState(false);

  useEffect(() => {
    if (isPrivyReady && !isConnected) {
      navigate("/");
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to edit songs",
        variant: "destructive",
      });
      return;
    }

    if (songId) {
      fetchSong();
    }
  }, [songId, isConnected, isPrivyReady, navigate]);

  const fetchSong = async () => {
    if (!songId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("id", songId)
        .single();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Song not found",
          description: "This song does not exist",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Check if user owns this song
      if (fullAddress && data.wallet_address.toLowerCase() !== fullAddress.toLowerCase()) {
        toast({
          title: "Unauthorized",
          description: "You can only edit songs you created",
          variant: "destructive",
        });
        navigate(`/song/${songId}`);
        return;
      }

      setSong(data);
      setDownloadEnabled(data.download_enabled ?? false);
      setDownloadType((data.download_type as any) || 'disabled');
      setDownloadPriceUsdc(data.download_price_usdc?.toString() || "0");
      setNsfw(data.nsfw ?? false);
    } catch (error) {
      console.error("Error fetching song:", error);
      toast({
        title: "Error",
        description: "Failed to load song data",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!songId || !song) return;

    try {
      setUpdating(true);

      const headers = await getAuthHeaders();
      if (!headers) {
        toast({
          title: "Authentication required",
          description: "Please connect your wallet",
          variant: "destructive",
        });
        return;
      }

      const updates: any = {
        download_enabled: downloadEnabled,
        download_type: downloadType,
        nsfw: nsfw,
        updated_at: new Date().toISOString(),
      };

      // Only include price if type is purchase_usdc
      if (downloadType === 'purchase_usdc') {
        const price = parseFloat(downloadPriceUsdc);
        if (isNaN(price) || price < 0) {
          toast({
            title: "Invalid price",
            description: "Please enter a valid USDC price",
            variant: "destructive",
          });
          return;
        }
        updates.download_price_usdc = price;
      } else {
        updates.download_price_usdc = null;
      }

      const { error } = await supabase
        .from("songs")
        .update(updates)
        .eq("id", songId)
        .eq("wallet_address", fullAddress?.toLowerCase());

      if (error) throw error;

      toast({
        title: "✅ Song updated!",
        description: "Your song settings have been saved successfully",
      });

      navigate(`/song/${songId}`);
    } catch (error: any) {
      console.error("Error updating song:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update song",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-neon-green" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-mono text-muted-foreground">Song not found</h1>
          <Button onClick={() => navigate("/")} className="mt-4" variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <NetworkInfo />
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/song/${songId}`)}
            className="font-mono"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Song
          </Button>
          <h1 className="text-2xl md:text-3xl font-mono font-bold neon-text">Edit Song</h1>
        </div>

        {/* Song Preview Card */}
        <Card className="console-bg tech-border p-6 mb-6">
          <h2 className="text-xl font-mono font-bold neon-text mb-4">Song Preview</h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-2 border-neon-green">
              <AvatarImage
                src={song.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-2xl">
                {song.title.substring(0, 2).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left flex-1">
              <h3 className="font-mono font-bold text-lg sm:text-xl mb-1">{song.title}</h3>
              <p className="text-sm text-muted-foreground font-mono mb-2">{song.artist || "Unknown Artist"}</p>
              {song.description && (
                <p className="text-xs text-muted-foreground font-mono mb-2">{song.description}</p>
              )}
              {song.genre && (
                <p className="text-xs text-muted-foreground font-mono">Genre: {song.genre}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Song Settings Card */}
        <Card className="console-bg tech-border p-6 mt-6">
          <h2 className="text-xl font-mono font-bold neon-text mb-4">Song Settings</h2>
          
          {/* NSFW Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-black/20 mb-6">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-red-400" />
              <div>
                <Label htmlFor="nsfw" className="font-mono text-base font-semibold cursor-pointer block">
                  18+ Only (NSFW)
                </Label>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Mark this song as not safe for work / 18+ content only
                </p>
              </div>
            </div>
            <Switch
              id="nsfw"
              checked={nsfw}
              onCheckedChange={setNsfw}
              disabled={updating}
              className="data-[state=checked]:bg-red-500"
            />
          </div>

          <h3 className="text-lg font-mono font-bold neon-text mb-4">Download Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="download-enabled"
                checked={downloadEnabled}
                onChange={(e) => setDownloadEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-neon-green text-neon-green focus:ring-neon-green"
              />
              <Label htmlFor="download-enabled" className="font-mono cursor-pointer">
                Enable downloads for this song
              </Label>
            </div>

            {downloadEnabled && (
              <>
                <div>
                  <Label htmlFor="download-type" className="font-mono">Download Access</Label>
                  <Select
                    value={downloadType}
                    onValueChange={(value: any) => setDownloadType(value)}
                  >
                    <SelectTrigger className="font-mono mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free - Anyone can download</SelectItem>
                      <SelectItem value="purchase_usdc">Purchase Required - Pay with USDC</SelectItem>
                      <SelectItem value="holders_only">Holders Only - Free for token holders</SelectItem>
                      <SelectItem value="disabled">Disabled - No downloads</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {downloadType === 'free' && "Anyone can download this song for free"}
                    {downloadType === 'purchase_usdc' && "Users must pay USDC to download"}
                    {downloadType === 'holders_only' && "Only users who hold tokens can download for free"}
                    {downloadType === 'disabled' && "Downloads are disabled"}
                  </p>
                </div>

                {downloadType === 'purchase_usdc' && (
                  <div>
                    <Label htmlFor="download-price" className="font-mono">USDC Price</Label>
                    <Input
                      id="download-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={downloadPriceUsdc}
                      onChange={(e) => setDownloadPriceUsdc(e.target.value)}
                      className="font-mono mt-1"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Price in USDC that users must pay to download
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex gap-4 mt-6">
          <Button
            onClick={handleSave}
            disabled={updating}
            className="flex-1 font-mono"
            variant="neon"
          >
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Button
            onClick={() => navigate(`/song/${songId}`)}
            variant="outline"
            className="font-mono"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SongEdit;

