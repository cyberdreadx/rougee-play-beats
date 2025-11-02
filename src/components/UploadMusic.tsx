import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Music, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { AICoverPaymentModal } from "@/components/AICoverPaymentModal";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { useCreateSong } from "@/hooks/useSongBondingCurve";
import { useUploadSlots } from "@/hooks/useUploadSlots";
import { UploadSlotsCard } from "@/components/UploadSlotsCard";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Predefined list of music genres (sorted alphabetically)
const MUSIC_GENRES = [
  "8-Bit",
  "A Cappella",
  "Acoustic",
  "Afro House",
  "Afrobeat",
  "Afrobeats",
  "Alternative R&B",
  "Alternative Rock",
  "Ambient",
  "Americana",
  "Amapiano",
  "Animecore",
  "Azonto",
  "Bachata",
  "Baile Funk",
  "Baroque",
  "Bass House",
  "Bebop",
  "Bedroom Pop",
  "Bitcrush",
  "Black Metal",
  "Blues",
  "Blues Rock",
  "Bluegrass",
  "Boom Bap",
  "Bossa Nova",
  "Breakbeat",
  "Breakcore",
  "Brostep",
  "Chill Trap",
  "Chillhop",
  "Chillwave",
  "Chiptune",
  "Christian Rock",
  "Classical",
  "Cloud Rap",
  "Conscious Rap",
  "Contemporary Classical",
  "Contemporary Gospel",
  "Contemporary R&B",
  "Corridos Tumbados",
  "Country",
  "Country Pop",
  "Cumbia",
  "Cybergrind",
  "Dancehall",
  "Dark Ambient",
  "Darkwave",
  "Death Metal",
  "Deathcore",
  "Deep House",
  "Dembow",
  "Detroit Techno",
  "Digicore",
  "Disco",
  "Djent",
  "Doom Metal",
  "Downtempo",
  "Dream Pop",
  "Drift Phonk",
  "Drill",
  "Drone",
  "Drum & Bass",
  "Dub",
  "Dubstep",
  "EDM",
  "Electropop",
  "Electronic",
  "Emo",
  "Emo Rap",
  "Ethereal",
  "Ethereal Wave",
  "Experimental",
  "Folk",
  "Folk Rock",
  "Funk",
  "Funk Rock",
  "Future Bass",
  "Future House",
  "Gabber",
  "Gangsta Rap",
  "Garage Rock",
  "Glitch",
  "Glitch Hop",
  "Glitchcore",
  "Gospel",
  "Gqom",
  "Grunge",
  "Hard Techno",
  "Hard Tekk",
  "Hardcore",
  "Hardcore Punk",
  "Hardstyle",
  "Heavy Metal",
  "Highlife",
  "Hip Hop",
  "House",
  "Hyperpop",
  "Hyperpop Rap",
  "IDM",
  "Indie Folk",
  "Indie Pop",
  "Indie Rock",
  "Instrumental",
  "J-Pop",
  "Jazz",
  "Jazz Fusion",
  "Jazzhop",
  "Jungle",
  "K-Pop",
  "Kwaito",
  "Latin",
  "Liquid DnB",
  "Lo-Fi",
  "Lo-Fi Hip Hop",
  "Math Rock",
  "Merengue",
  "Metal",
  "Metalcore",
  "Minimal Techno",
  "Mumble Rap",
  "Musique Concrète",
  "Neo-Soul",
  "Neurofunk",
  "New Wave",
  "Nightcore",
  "Noise",
  "Nu-Disco",
  "Opera",
  "Orchestral",
  "P-Funk",
  "Phonk",
  "Pop",
  "Pop Punk",
  "Post-Hardcore",
  "Post-Punk",
  "Post-Rock",
  "Power Metal",
  "Progressive House",
  "Progressive Metal",
  "Progressive Rock",
  "Progressive Trance",
  "Psychedelic Rock",
  "Psytrance",
  "Punk",
  "R&B",
  "Reggae",
  "Reggaeton",
  "Riddim",
  "Rock",
  "Romantic",
  "Roots Reggae",
  "Salsa",
  "Samba",
  "Score",
  "Screamo",
  "Shoegaze",
  "Ska",
  "Ska Punk",
  "Smooth Jazz",
  "Soul",
  "Sound Collage",
  "Soundtrack",
  "Speedcore",
  "Swing",
  "Synth Pop",
  "Synthwave",
  "Tango",
  "Tech House",
  "Techno",
  "Thrash Metal",
  "Trance",
  "Trap",
  "Trap (EDM)",
  "UK Garage",
  "Vaporwave",
  "Video Game Music",
  "Webcore",
  "Witch House",
  "Worship",
].sort(); // Ensure alphabetical order

export default function UploadMusic() {
  const navigate = useNavigate();
  const { fullAddress: address, isConnected } = useWallet();
  const { getAuthHeaders } = usePrivyToken();
  const { slotsRemaining, xrgeBalance, xrgeNeeded, refetch: refetchSlots } = useUploadSlots();
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [genreOpen, setGenreOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [ticker, setTicker] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [aiCoverPrompt, setAiCoverPrompt] = useState("");
  const [selectedAIModel, setSelectedAIModel] = useState("flux-schnell");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [generatedCovers, setGeneratedCovers] = useState<string[]>([]);
  const [selectedGeneratedCover, setSelectedGeneratedCover] = useState<string | null>(null);
  const [isAISectionExpanded, setIsAISectionExpanded] = useState(false);
  const [aiUsage, setAiUsage] = useState<'none' | 'partial' | 'full'>('none');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [confirmRights, setConfirmRights] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [nsfw, setNsfw] = useState(false);
  const generationInProgress = useRef(false);

  // Cleanup audio preview URL on unmount
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);
  const [copyrightWarning, setCopyrightWarning] = useState<{
    show: boolean;
    detectedInfo: any;
    violationCount: number;
  }>({ show: false, detectedInfo: null, violationCount: 0 });

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (20MB = 20 * 1024 * 1024 bytes)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast.error(`Cover image too large. Must be less than 20MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
      // Clear the input
      e.target.value = '';
      return;
    }

    setCoverFile(file);
    setSelectedGeneratedCover(null); // Clear AI generated selection
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const generateAICover = async () => {
    if (!aiCoverPrompt.trim()) {
      toast.error("Please enter a description for your album cover");
      return;
    }

    // Check if user is authenticated before opening payment modal
    if (!isConnected) {
      toast.error("Please log in to generate AI covers");
      return;
    }

    // Prevent multiple simultaneous requests
    if (isGeneratingCover) {
      toast.error("AI generation is already in progress. Please wait...");
      return;
    }

    // Show payment modal instead of direct generation
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = useCallback(async (paymentProof: string) => {
    if (generationInProgress.current) {
      console.log('⚠️ Generation already in progress, skipping...');
      return;
    }

    generationInProgress.current = true;
    setIsGeneratingCover(true);
    console.log('🎨 Starting AI cover generation with payment proof...');
    
    try {
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 120000); // 2 minute timeout

      // Use the x402 endpoint with payment proof (same as tip-artist)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-x402`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'x-payment': paymentProof,
        },
        body: JSON.stringify({
          prompt: aiCoverPrompt,
          model: selectedAIModel,
          genre: genre || 'music',
          style: 'album cover, square format, high quality'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 AI generation response:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ AI generation successful:', data);
        
        setGeneratedCovers(data.images || []);
        
        if (data.images && data.images.length > 0) {
          const paymentAmount = selectedAIModel === 'flux-schnell' ? '0.01' : '0.05';
          toast.success(`Generated ${data.images.length} cover options for $${paymentAmount} using ${data.provider}!`);
        } else {
          toast.error("No covers were generated. Try a different prompt.");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ AI generation failed:', errorData);
        toast.error(`Generation failed: ${errorData.message || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      console.error('❌ Error generating cover:', error);
      
      if (error.name === 'AbortError') {
        toast.error("Generation timed out. Please try again with a simpler prompt.");
      } else {
        toast.error("Failed to generate cover. Please try again.");
      }
    } finally {
      console.log('🏁 AI generation completed, resetting state');
      setIsGeneratingCover(false);
      generationInProgress.current = false;
    }
  }, [aiCoverPrompt, selectedAIModel]);

  const selectGeneratedCover = (coverUrl: string) => {
    setSelectedGeneratedCover(coverUrl);
    setCoverPreview(coverUrl);
    setCoverFile(null); // Clear uploaded file
  };

  const scanForCopyright = async (file: File) => {
    if (!address) return;
    
    setScanning(true);
    try {
      const headers = await getAuthHeaders();
      
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('file_name', file.name);

      const { data, error } = await supabase.functions.invoke('check-copyright', {
        headers: {
          ...headers,
          'x-wallet-address': address, // Send wallet address in header instead
        },
        body: formData,
      });

      if (error) {
        // Check if it's a service unavailable error
        if (error.message?.includes('unavailable')) {
          toast.error('Copyright verification service is temporarily unavailable. Please try again in a few minutes.');
          return;
        }
        throw error;
      }

      if (data.isCopyrighted) {
        setCopyrightWarning({
          show: true,
          detectedInfo: data.detectedInfo,
          violationCount: data.violationCount,
        });
      }
    } catch (error) {
      console.error('Error scanning for copyright:', error);
      toast.error('Copyright check failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (50MB = 50 * 1024 * 1024 bytes)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error(`Audio file too large. Must be less than 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
      // Clear the input
      e.target.value = '';
      return;
    }

    setAudioFile(file);
    
    // Create preview URL for audio playback
    const url = URL.createObjectURL(file);
    setAudioPreviewUrl(url);

    // Scan for copyright - block upload if scan fails
    if (address) {
      await scanForCopyright(file);
      // If scan failed, clear the file
      if (!file) {
        setAudioFile(null);
        setAudioPreviewUrl(null);
      }
    }
  };

  const proceedWithUpload = async () => {
    if (!confirmRights) {
      toast.error("Please confirm you own or are authorized to upload this content.");
      return;
    }
    setCopyrightWarning({ show: false, detectedInfo: null, violationCount: 0 });
    await performUpload();
  };

  const handleUpload = async () => {
    if (!audioFile || !address) {
      toast.error("Please connect wallet and select an audio file");
      return;
    }

    if (!confirmRights) {
      toast.error("Please confirm you own or are authorized to upload this content.");
      return;
    }

    // If copyright detected, show warning dialog
    if (copyrightWarning.show) {
      return;
    }

    await performUpload();
  };

  const performUpload = async () => {
    if (!audioFile || !address) return;

    // Validate required fields
    if (!ticker.trim()) {
      toast.error("Ticker symbol is required");
      return;
    }

    if (ticker.length < 2) {
      toast.error("Ticker symbol must be at least 2 characters");
      return;
    }

    // Check upload slots before uploading
    if (slotsRemaining <= 0) {
      const message = xrgeBalance > 0 
        ? `No upload slots remaining! You need ${xrgeNeeded.toLocaleString()} more XRGE for unlimited uploads.`
        : 'No upload slots remaining! Hold 1,000,000 XRGE to unlock unlimited uploads.';
      toast.error(message);
      return;
    }

    setUploading(true);
    try {
      const headers = await getAuthHeaders();
      
      const formData = new FormData();
      formData.append('file', audioFile);
      if (coverFile) {
        formData.append('coverFile', coverFile);
      } else if (selectedGeneratedCover) {
        // Convert AI-generated cover URL to blob and append
        const response = await fetch(selectedGeneratedCover);
        const blob = await response.blob();
        formData.append('coverFile', blob, 'ai-generated-cover.png');
      }
      formData.append('metadata', JSON.stringify({
        title: title || audioFile.name,
        artist,
        genre,
        description,
        ticker,
        aiUsage,
        nsfw,
        aiCoverPrompt: selectedGeneratedCover ? aiCoverPrompt : null
      }));

      // Upload to IPFS
      toast.success('Uploading to IPFS...');
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-to-lighthouse', {
        headers: {
          ...headers,
          'x-wallet-address': address, // Send wallet address in header
        },
        body: formData
      });

      if (uploadError) throw uploadError;

      // Refresh upload slots count
      refetchSlots();

      toast.success('Music uploaded to IPFS successfully!');

      // Reset form
      setTitle("");
      setArtist("");
      setGenre("");
      setDescription("");
      setTicker("");
      setAiUsage('none');
      setAudioFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setAiCoverPrompt("");
      setSelectedAIModel("flux-schnell");
      setGeneratedCovers([]);
      setSelectedGeneratedCover(null);
      setIsAISectionExpanded(false);
      setAudioPreviewUrl(null);
      setIsPlaying(false);
      setNsfw(false);
      setCopyrightWarning({ show: false, detectedInfo: null, violationCount: 0 });

      // Auto-redirect to home after successful upload
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Music className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Launch Music on ROUGEE</h2>
            </div>
            {/* Subtle slots indicator */}
            <div className="text-right">
              <div className="text-sm font-mono text-muted-foreground">
                {slotsRemaining > 0 ? (
                  <span className="text-green-500">{slotsRemaining} slots left</span>
                ) : (
                  <span className="text-red-500">No slots available</span>
                )}
              </div>
              {xrgeBalance && xrgeBalance > 0 && (
                <div className="text-xs text-muted-foreground">
                  {xrgeBalance.toLocaleString()} XRGE
                </div>
              )}
            </div>
          </div>

        {/* Audio File Upload Section */}
        <div className="space-y-6">
          <div className="p-4 sm:p-5 border border-blue-500/20 rounded-xl bg-gradient-to-br from-blue-500/5 to-transparent backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
              <h3 className="text-base sm:text-lg font-semibold text-blue-500">1. Upload Audio File</h3>
            </div>
            
            <div>
              <Label htmlFor="audio-file" className="text-sm font-medium text-foreground mb-2 block">
                Audio File *
              </Label>
              <Input
                id="audio-file"
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,.wma,.aiff,.alac,audio/*"
                onChange={handleAudioChange}
                disabled={uploading || scanning}
                className="file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-4 file:py-2 file:mr-4 file:text-sm file:font-medium hover:file:bg-primary/90"
              />
              <p className="text-xs text-muted-foreground mt-2">
                MP3, WAV, M4A, OGG up to <span className="font-semibold text-yellow-500">50MB</span>
              </p>
              {scanning && (
                <p className="text-sm text-yellow-500 mt-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning for copyright...
                </p>
              )}
              
              {/* Audio Preview - Show after copyright check passes */}
              {audioFile && !scanning && audioPreviewUrl && (
                <div className="mt-4 p-4 border border-blue-500/20 rounded-lg bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h4 className="text-sm font-semibold text-blue-500">Audio Preview</h4>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Audio Player */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const audio = document.getElementById('audio-preview') as HTMLAudioElement;
                          if (audio) {
                            if (isPlaying) {
                              audio.pause();
                              setIsPlaying(false);
                            } else {
                              audio.play();
                              setIsPlaying(true);
                            }
                          }
                        }}
                        className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                      >
                        {isPlaying ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground mb-1">
                          {audioFile.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(audioFile.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                    </div>
                    
                    {/* Audio Element */}
                    <audio
                      id="audio-preview"
                      src={audioPreviewUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPause={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      className="w-full"
                      controls
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Album Cover Section */}
          <div className="p-4 sm:p-5 border border-purple-500/20 rounded-xl bg-gradient-to-br from-purple-500/5 to-transparent backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-500 rounded-full"></div>
              <h3 className="text-base sm:text-lg font-semibold text-purple-500">2. Album Cover Art</h3>
              <span className="text-xs text-muted-foreground bg-black/20 px-2 py-1 rounded-full">
                Optional
              </span>
            </div>

            {/* Manual Upload */}
            <div className="mb-4 flex flex-col items-center">
              <Label htmlFor="cover-art" className="text-sm font-medium text-foreground mb-2 block">
                Upload Cover Image
              </Label>
              <div className="relative">
                <input
                  id="cover-art"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  disabled={uploading || scanning}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-48 h-48 border-2 border-dashed border-tech-border rounded-lg flex flex-col items-center justify-center bg-console-bg/20 hover:bg-console-bg/40 transition-all duration-300 hover:border-neon-green">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover preview" className="w-full h-full object-contain bg-black/10 rounded-lg" />
                  ) : (
                    <>
                      <Music className="w-12 h-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground text-center px-4">
                        Upload your cover art
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, WEBP up to <span className="font-semibold text-yellow-500">20MB</span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* AI Cover Generation Section - Collapsible */}
            <div className="border border-neon-green/20 rounded-xl bg-gradient-to-br from-neon-green/5 to-transparent backdrop-blur-sm overflow-hidden">
              {/* Collapsible Header */}
              <button
                onClick={() => setIsAISectionExpanded(!isAISectionExpanded)}
                className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-neon-green/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                  <h4 className="text-xs sm:text-sm font-semibold text-neon-green">Or Generate with AI</h4>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground bg-black/20 px-2 py-1 rounded-full">
                    Powered by AI
                  </div>
                  <div className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full font-mono">
                    {selectedAIModel === 'flux-schnell' ? '$0.01' : '$0.05'} USDC
                  </div>
                  <div className={`transform transition-transform duration-200 ${isAISectionExpanded ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Collapsible Content */}
              {isAISectionExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
                <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  <div>
                    <Label htmlFor="ai-prompt" className="text-xs font-medium text-foreground mb-1 sm:mb-2 block">
                      Describe your vision
                    </Label>
                    <Input
                      id="ai-prompt"
                      value={aiCoverPrompt}
                      onChange={(e) => setAiCoverPrompt(e.target.value)}
                      placeholder="Dark cyberpunk cityscape with neon lights..."
                      disabled={uploading || scanning || isGeneratingCover}
                      className="h-9 sm:h-10 bg-background/50 border-neon-green/30 focus:border-neon-green/60 text-xs"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ai-model" className="text-xs font-medium text-foreground mb-1 sm:mb-2 block">
                      AI Model
                    </Label>
                    <select
                      id="ai-model"
                      value={selectedAIModel}
                      onChange={(e) => setSelectedAIModel(e.target.value)}
                      disabled={uploading || scanning || isGeneratingCover}
                      className="flex h-9 sm:h-10 w-full rounded-md border border-neon-green/30 bg-background/50 px-3 py-2 text-xs focus:border-neon-green/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="flux-schnell">⚡ FLUX Schnell - Fast & Cheap ($0.01)</option>
                      <option value="seedream-v4">🎨 Seedream 4.0 - High Quality 4K ($0.05)</option>
                    </select>
                  </div>
                </div>
                
                <Button
                  onClick={generateAICover}
                  disabled={!aiCoverPrompt.trim() || isGeneratingCover || uploading || scanning}
                  className="w-full h-9 sm:h-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 text-xs"
                >
                  {isGeneratingCover ? (
                    <>
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Generating with AI...</span>
                      <span className="sm:hidden">Generating...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 sm:w-4 sm:h-4 mr-2 bg-white rounded-full"></div>
                      Generate Cover
                    </>
                  )}
                </Button>

                {/* Generation Progress */}
                {isGeneratingCover && (
                  <div className="mt-4 p-4 border border-purple-500/20 rounded-lg bg-purple-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      <span className="text-sm font-medium text-purple-500">Generating AI Cover...</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This may take 30-60 seconds. Please don't close this page.
                    </p>
                  </div>
                )}

                {/* Generated Covers Grid */}
                {generatedCovers.length > 0 && (
                  <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-neon-green/20">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <p className="text-xs sm:text-sm font-medium text-foreground">Choose your favorite:</p>
                      <span className="text-xs text-muted-foreground bg-black/20 px-2 py-1 rounded-full self-start">
                        {generatedCovers.length} option{generatedCovers.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {generatedCovers.map((coverUrl, index) => (
                        <div
                          key={index}
                          className={`group relative cursor-pointer rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                            selectedGeneratedCover === coverUrl
                              ? 'border-neon-green ring-2 ring-neon-green/30 shadow-lg shadow-neon-green/20'
                              : 'border-border hover:border-neon-green/40 hover:shadow-md'
                          }`}
                          onClick={() => selectGeneratedCover(coverUrl)}
                        >
                          <img
                            src={coverUrl}
                            alt={`Generated cover ${index + 1}`}
                            className="w-full h-24 sm:h-32 object-contain bg-black/20 group-hover:scale-105 transition-transform duration-200"
                          />
                          {selectedGeneratedCover === coverUrl && (
                            <div className="absolute inset-0 bg-neon-green/20 flex items-center justify-center backdrop-blur-sm">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-neon-green rounded-full flex items-center justify-center shadow-lg">
                                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
                              </div>
                            </div>
                          )}
                          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title"
              disabled={uploading || scanning}
            />
          </div>

          <div>
            <Label htmlFor="artist">Artist</Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name"
              disabled={uploading || scanning}
            />
          </div>

          <div>
            <Label htmlFor="genre">Genre</Label>
            <Popover open={genreOpen} onOpenChange={setGenreOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="genre"
                  variant="outline"
                  role="combobox"
                  aria-expanded={genreOpen}
                  className="w-full justify-between font-normal"
                  disabled={uploading || scanning}
                >
                  {genre || "Select a genre..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search genres..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No genre found.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {MUSIC_GENRES.map((genreOption) => (
                        <CommandItem
                          key={genreOption}
                          value={genreOption}
                          onSelect={(currentValue) => {
                            setGenre(currentValue === genre ? "" : currentValue);
                            setGenreOpen(false);
                          }}
                        >
                          {genreOption}
                          <Check
                            className={cn(
                              "ml-auto h-4 w-4",
                              genre === genreOption ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your track..."
              disabled={uploading || scanning}
            />
          </div>

          <div>
            <Label htmlFor="ticker">Ticker Symbol *</Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g., BEAT, MUSIC"
              maxLength={10}
              disabled={uploading || scanning}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required: 2-10 characters, will be used as your song's token symbol
            </p>
          </div>

          <div>
            <Label htmlFor="ai-usage">AI Usage</Label>
            <select
              id="ai-usage"
              value={aiUsage}
              onChange={(e) => setAiUsage(e.target.value as 'none' | 'partial' | 'full')}
              disabled={uploading || scanning}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="none">No AI Used</option>
              <option value="partial">Partially AI Generated</option>
              <option value="full">Fully AI Generated</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Indicate if AI was used to create this track
            </p>
          </div>

          {/* NSFW Toggle */}
          <div className="flex items-center gap-3 p-4 rounded-lg border border-white/10 bg-black/20">
            <div className="flex items-center gap-2 flex-1">
              <Shield className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
              <div className="flex-1">
                <Label htmlFor="nsfw" className="font-mono text-sm font-semibold cursor-pointer">
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
              disabled={uploading || scanning}
              className="data-[state=checked]:bg-red-500"
            />
          </div>

          {/* Rights confirmation */}
          <div className="flex items-start gap-3 rounded-md border border-border p-3 bg-muted/30">
            <Checkbox id="confirm-rights" checked={confirmRights} onCheckedChange={(v) => setConfirmRights(Boolean(v))} />
            <label htmlFor="confirm-rights" className="text-xs leading-5 text-foreground">
              I confirm that I own the rights to this content or have obtained all necessary licenses and permissions to upload it to ROUGEE, and that the upload does not breach any contract to which I am a party. I agree to the
              <button type="button" onClick={() => navigate('/terms-of-service')} className="ml-1 underline text-primary hover:text-primary/80">
                Terms of Service
              </button>
              , including
              <button type="button" onClick={() => navigate('/terms-of-service#artist-terms')} className="mx-1 underline text-primary hover:text-primary/80">
                Section 5 (Artist Terms)
              </button>
              and
              <button type="button" onClick={() => navigate('/terms-of-service#dmca-policy')} className="mx-1 underline text-primary hover:text-primary/80">
                Section 11 (DMCA Policy)
              </button>
              .
            </label>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading || scanning || !audioFile || !address || slotsRemaining <= 0 || !confirmRights}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading to IPFS...
              </>
            ) : scanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning for copyright...
              </>
            ) : slotsRemaining <= 0 ? (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                No Slots Available
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload to IPFS
              </>
            )}
          </Button>

          {!address && (
            <p className="text-sm text-muted-foreground text-center">
              Connect your wallet to upload music
            </p>
          )}
        </div>
      </div>

      <AlertDialog open={copyrightWarning.show} onOpenChange={(open) => !open && setCopyrightWarning({ show: false, detectedInfo: null, violationCount: 0 })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Copyright Content Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="text-foreground">
                <p className="font-semibold mb-2">This audio appears to be copyrighted material:</p>
                {copyrightWarning.detectedInfo && (
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    {copyrightWarning.detectedInfo.title && (
                      <p><span className="font-medium">Title:</span> {copyrightWarning.detectedInfo.title}</p>
                    )}
                    {copyrightWarning.detectedInfo.artist && (
                      <p><span className="font-medium">Artist:</span> {copyrightWarning.detectedInfo.artist}</p>
                    )}
                    {copyrightWarning.detectedInfo.album && (
                      <p><span className="font-medium">Album:</span> {copyrightWarning.detectedInfo.album}</p>
                    )}
                    {copyrightWarning.detectedInfo.label && (
                      <p><span className="font-medium">Label:</span> {copyrightWarning.detectedInfo.label}</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <p className="text-sm font-medium text-destructive">⚠️ Platform Rules Violation</p>
                <p className="text-sm mt-1">Uploading copyrighted content without permission violates our platform rules.</p>
                {copyrightWarning.violationCount > 0 && (
                  <p className="text-sm mt-2 font-semibold">
                    Previous violations: {copyrightWarning.violationCount}
                  </p>
                )}
                {copyrightWarning.violationCount >= 2 && (
                  <p className="text-sm mt-2 text-destructive font-bold">
                    ⚠️ Warning: Multiple copyright violations may result in permanent ban!
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setAudioFile(null);
              setCopyrightWarning({ show: false, detectedInfo: null, violationCount: 0 });
            }}>
              Cancel Upload
            </AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithUpload} className="bg-destructive hover:bg-destructive/90">
              I Understand - Upload Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Cover Payment Modal */}
      <AICoverPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        model={selectedAIModel as 'flux-schnell' | 'seedream-v4'}
        prompt={aiCoverPrompt}
      />
      </div>
    </div>
  );
}