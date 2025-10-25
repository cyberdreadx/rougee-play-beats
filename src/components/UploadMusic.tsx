import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
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
  const { fullAddress: address } = useWallet();
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
  const [aiUsage, setAiUsage] = useState<'none' | 'partial' | 'full'>('none');
  const [confirmRights, setConfirmRights] = useState(false);
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
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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

    // Scan for copyright - block upload if scan fails
    if (address) {
      await scanForCopyright(file);
      // If scan failed, clear the file
      if (!file) {
        setAudioFile(null);
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
      }
      formData.append('metadata', JSON.stringify({
        title: title || audioFile.name,
        artist,
        genre,
        description,
        ticker,
        aiUsage
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
        {/* Upload Slots Card */}
        <UploadSlotsCard />

        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Music className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Launch Music on ROUGEE</h2>
          </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cover-art">Cover Art (Optional)</Label>
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
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <>
                    <Music className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Drop your CD cover here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, WEBP up to <span className="font-semibold text-yellow-500">20MB</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="audio-file">Audio File *</Label>
            <Input
              id="audio-file"
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              disabled={uploading || scanning}
            />
            <p className="text-xs text-muted-foreground mt-1">
              MP3, WAV, M4A, OGG up to <span className="font-semibold text-yellow-500">50MB</span>
            </p>
            {scanning && (
              <p className="text-sm text-yellow-500 mt-1 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning for copyright...
              </p>
            )}
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
            <Label htmlFor="ticker">Ticker Symbol</Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g., BEAT, MUSIC"
              maxLength={10}
              disabled={uploading || scanning}
            />
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

          {/* Rights confirmation */}
          <div className="flex items-start gap-3 rounded-md border border-border p-3 bg-muted/30">
            <Checkbox id="confirm-rights" checked={confirmRights} onCheckedChange={(v) => setConfirmRights(Boolean(v))} />
            <label htmlFor="confirm-rights" className="text-sm leading-6 text-foreground">
              I confirm that I own the rights to this content or have obtained all necessary licenses and permissions to upload it to ROUGEE PLAY, and that the upload does not breach any contract to which I am a party. I agree to the
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
                Upload to IPFS ({slotsRemaining} slots left)
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
      </div>
    </div>
  );
}