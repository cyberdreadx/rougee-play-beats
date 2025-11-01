import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Music, X, Send, ImageIcon as ImageIconLucide, ChevronsUpDown, Check, Play, Pause, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import TagAutocomplete from "@/components/TagAutocomplete";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { toast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { supabase } from "@/integrations/supabase/client";

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasXRGE: boolean;
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
  onPostCreated?: () => void;
}

export default function CreatePostModal({ 
  open, 
  onOpenChange, 
  hasXRGE, 
  playSong, 
  currentSong, 
  isPlaying,
  onPostCreated 
}: CreatePostModalProps) {
  const navigate = useNavigate();
  const { fullAddress } = useWallet();
  const { getAuthHeaders } = usePrivyToken();

  const [contentText, setContentText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [posting, setPosting] = useState(false);
  
  const [songSearchOpen, setSongSearchOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [loadingAllSongs, setLoadingAllSongs] = useState(false);

  const loadAllSongsForSearch = async () => {
    if (allSongs.length > 0) return;
    
    setLoadingAllSongs(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, cover_cid, audio_cid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllSongs(data || []);
    } catch (error) {
      console.error('Error loading songs:', error);
      toast({
        title: "Error",
        description: "Failed to load songs",
        variant: "destructive",
      });
    } finally {
      setLoadingAllSongs(false);
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!selectedSong) {
      toast({
        title: "Song Required",
        description: "Please select a song for your post",
        variant: "destructive",
      });
      return;
    }

    if (!contentText && !mediaFile) {
      toast({
        title: "Content Required",
        description: "Please add some text or media to your post",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content_text', contentText);
      formData.append('song_id', selectedSong.id);
      formData.append('walletAddress', fullAddress || '');
      if (mediaFile) {
        formData.append('media', mediaFile);
      }

      const authHeaders = await getAuthHeaders();
      console.log('🔐 Auth headers for post creation:', authHeaders);
      
      // Don't set Content-Type when sending FormData - browser will set it automatically with boundary
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-feed-post`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          // Content-Type is intentionally omitted for FormData
        },
        body: formData,
      });
      
      console.log('📬 Post creation response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create post');
      }

      toast({
        title: "Success!",
        description: "Your post has been created",
      });

      // Reset form
      setContentText("");
      setMediaFile(null);
      setMediaPreview(null);
      setSelectedSong(null);
      
      // Close modal and refresh feed
      onOpenChange(false);
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-black/95 backdrop-blur-xl border-2 border-neon-green/30 shadow-[0_0_50px_rgba(0,255,159,0.3)]">
        {/* Cyberpunk Circuit Lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-neon-green/20 via-transparent to-transparent" />
          <div className="absolute top-0 right-1/4 w-[1px] h-full bg-gradient-to-b from-cyan-500/20 via-transparent to-transparent" />
          <div className="absolute left-0 top-1/4 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-green/20 to-transparent" />
          <div className="absolute left-0 top-3/4 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
          
          {/* Corner Accents */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-neon-green/40" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-500/40" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-500/40" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-neon-green/40" />
        </div>
        
        <DialogHeader className="relative z-10">
          <DialogTitle className="text-2xl font-bold font-mono text-neon-green uppercase tracking-wider drop-shadow-[0_0_10px_rgba(0,255,159,0.8)]">
            ⚡ Create GLTCH Post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 relative z-10">
          {!hasXRGE && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 border-2 border-yellow-500/30 shadow-[0_0_20px_rgba(255,255,0,0.2)] backdrop-blur-sm">
              <Lock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(255,255,0,0.8)]" />
              <div className="flex-1">
                <p className="text-sm font-mono font-bold text-yellow-400 mb-1 uppercase tracking-wide">
                  ⚠️ XRGE Holder Required
                </p>
                <p className="text-xs font-mono text-yellow-400/90">
                  You need to hold XRGE tokens to post on GLTCH.{' '}
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/swap');
                    }}
                    className="underline hover:text-yellow-300 transition-colors font-bold"
                  >
                    Get XRGE →
                  </button>
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <TagAutocomplete
              value={contentText}
              onChange={setContentText}
              placeholder="⚡ What's on your mind? Use $ to tag artists and songs..."
              className="min-h-[100px] resize-none w-full rounded-xl border-2 border-neon-green/30 bg-black/60 backdrop-blur-sm px-4 py-3 text-base font-mono text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green/50 focus-visible:border-neon-green/60 focus-visible:shadow-[0_0_20px_rgba(0,255,159,0.3)] disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              disabled={!hasXRGE}
              maxLength={360}
            />
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-400">{contentText.length} / 360 characters</span>
              {contentText.length > 320 && (
                <span className="text-yellow-400 font-bold animate-pulse">
                  ⚠️ {360 - contentText.length} characters remaining
                </span>
              )}
            </div>
          </div>

          {mediaPreview && (
            <div className="relative">
              <img src={mediaPreview} alt="Preview" className="max-h-64 rounded-lg mx-auto" />
              <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => {
                setMediaFile(null);
                setMediaPreview(null);
              }}>
                Remove
              </Button>
            </div>
          )}

          {/* Song Selection - MANDATORY */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Music className="w-4 h-4 text-neon-green" />
              Select a song for your post <span className="text-red-400">*</span>
            </label>
            {selectedSong ? (
              <div className="flex items-center gap-2 p-3 bg-neon-green/10 border border-neon-green/20 rounded-lg">
                {selectedSong.cover_cid && (
                  <img 
                    src={getIPFSGatewayUrl(selectedSong.cover_cid)} 
                    alt={selectedSong.title}
                    className="w-10 h-10 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedSong.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedSong.artist}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSong(null)}
                  disabled={!hasXRGE}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Popover open={songSearchOpen} onOpenChange={(open) => {
                setSongSearchOpen(open);
                if (open) {
                  loadAllSongsForSearch();
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={songSearchOpen}
                    className="w-full justify-between"
                    disabled={!hasXRGE}
                  >
                    <span className="text-muted-foreground">Search for a song...</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search songs..." 
                      value={songSearchQuery}
                      onValueChange={setSongSearchQuery}
                    />
                    <CommandList>
                      {loadingAllSongs ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                          Loading songs...
                        </div>
                      ) : (
                        <>
                          <CommandEmpty>No songs found.</CommandEmpty>
                          <CommandGroup>
                            {(songSearchQuery ? allSongs : allSongs.slice(0, 20))
                              .filter(song => 
                                !songSearchQuery || 
                                song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
                              )
                              .slice(0, 50)
                              .map(song => {
                                const isCurrentlyPlaying = currentSong?.id === song.id && isPlaying;
                                return (
                                  <CommandItem
                                    key={song.id}
                                    value={`${song.title} ${song.artist}`.toLowerCase()}
                                    onSelect={() => {
                                      setSelectedSong(song);
                                      setSongSearchOpen(false);
                                      setSongSearchQuery('');
                                    }}
                                    className="flex items-center gap-2 group"
                                  >
                                    {song.cover_cid && (
                                      <img 
                                        src={getIPFSGatewayUrl(song.cover_cid)} 
                                        alt={song.title}
                                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm truncate">{song.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (playSong) {
                                            playSong(song);
                                          }
                                        }}
                                        disabled={!playSong}
                                      >
                                        {isCurrentlyPlaying ? (
                                          <Pause className="h-3 w-3" />
                                        ) : (
                                          <Play className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Check className={selectedSong?.id === song.id ? "h-4 w-4" : "h-4 w-4 opacity-0"} />
                                    </div>
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="flex gap-3">
            <Input type="file" accept="image/*" onChange={handleMediaChange} className="hidden" id="media-upload-modal" disabled={!hasXRGE} />
            <label htmlFor="media-upload-modal">
              <Button variant="outline" size="sm" asChild disabled={!hasXRGE} className="border-2 border-cyan-500/30 bg-black/60 hover:bg-cyan-500/10 hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300 font-mono shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all">
                <span className={hasXRGE ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                  <ImageIconLucide className="w-4 h-4 mr-2" />
                  ADD MEDIA
                </span>
              </Button>
            </label>

            <Button 
              onClick={handlePost} 
              disabled={posting || !selectedSong || !contentText && !mediaFile || !hasXRGE} 
              className="ml-auto bg-gradient-to-r from-neon-green to-emerald-500 hover:from-neon-green/90 hover:to-emerald-500/90 text-black font-mono font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(0,255,159,0.4)] hover:shadow-[0_0_30px_rgba(0,255,159,0.6)] border-2 border-neon-green/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  UPLOADING...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  POST TO GLTCH
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

