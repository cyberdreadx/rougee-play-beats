import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Play, Pause, Share2, Check, Download, Edit, Lock, Loader2 } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import LikeButton from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { AiBadge } from "@/components/AiBadge";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  description?: string | null;
  download_enabled?: boolean | null;
  download_type?: string | null;
  download_price_usdc?: number | null;
  ai_usage?: string | null;
}

interface SongTradeHeaderProps {
  song: Song;
  currentSong: Song | null;
  isPlaying: boolean;
  playSong: (song: Song) => void;
  fullAddress: string | null;
  userBalance: string | null;
  sharing: boolean;
  copied: boolean;
  downloading: boolean;
  onShare: () => void;
  onDownload: () => void;
}

// Component that connects waveform to audio state
const AudioWaveformWithState = ({ songId, audioCid }: { songId: string; audioCid: string }) => {
  const audioState = useAudioStateForSong(songId);
  
  return (
    <AudioWaveform
      audioCid={audioCid}
      height={40}
      color="#00ff9f"
      backgroundColor="rgba(0, 0, 0, 0.2)"
      className="rounded border border-neon-green/20"
      showProgress={audioState.isCurrentSong && audioState.isPlaying}
      currentTime={audioState.currentTime}
      duration={audioState.duration}
      onSeek={(time) => {
        // Handle seeking - this would need to be connected to the audio player
        console.log('Seek to:', time);
      }}
    />
  );
};

export default function SongTradeHeader({
  song,
  currentSong,
  isPlaying,
  playSong,
  fullAddress,
  userBalance,
  sharing,
  copied,
  downloading,
  onShare,
  onDownload,
}: SongTradeHeaderProps) {
  const navigate = useNavigate();

  return (
    <Card className="console-bg tech-border p-4 md:p-6 lg:col-span-2 relative overflow-hidden">
      {/* Background Cover Image with Fade - Use song album art */}
      <div 
        className="absolute inset-0 z-0"
        style={song.cover_cid ? {
          backgroundImage: `url(${getIPFSGatewayUrl(song.cover_cid)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : undefined}
      >
        {song.cover_cid && (
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background/95" />
        )}
      </div>
      <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6 relative z-10">
        <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 border-2 border-neon-green shrink-0 shadow-2xl">
          <AvatarImage
            src={song.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : undefined}
            className="object-cover"
          />
          <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-2xl md:text-3xl">
            {song.title.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => playSong(song)}
          className="h-12 w-12 rounded-full bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40"
          aria-label="Play or Pause"
        >
          {currentSong?.id === song.id && isPlaying ? (
            <Pause className="w-6 h-6 text-neon-green" />
          ) : (
            <Play className="w-6 h-6 text-neon-green" />
          )}
        </Button>

        <div className="flex-1 w-full min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold neon-text mb-1 md:mb-2 truncate flex items-center gap-2">
            <span className="truncate">{song.title}</span>
            <AiBadge aiUsage={song.ai_usage || undefined} size="md" />
          </h1>
          <button 
            onClick={() => navigate(`/artist/${song.wallet_address}`)}
            className="text-sm sm:text-base md:text-lg text-white font-mono mb-2 truncate hover:text-neon-green transition-colors duration-200 underline-offset-4 hover:underline"
          >
            By {song.artist || "Unknown Artist"}
          </button>
          {song.description && (
            <p className="text-xs sm:text-sm text-white/90 font-mono mb-3 md:mb-4 line-clamp-2 bg-black/20 px-2 py-1 rounded backdrop-blur-sm">
              {song.description}
            </p>
          )}
          
          {/* Audio Waveform */}
          {song.audio_cid && (
            <div className="mb-3 md:mb-4">
              <AudioWaveformWithState songId={song.id} audioCid={song.audio_cid} />
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-2">
            <LikeButton songId={song.id} size="sm" />
            <ReportButton songId={song.id} />
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="font-mono"
              disabled={sharing}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              {copied ? 'COPIED' : 'SHARE'}
            </Button>
            {song.download_enabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDownload}
                className="font-mono"
                disabled={downloading || !song.audio_cid}
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    DOWNLOADING...
                  </>
                ) : (
                  <>
                    {song.download_type === 'holders_only' && (!userBalance || parseFloat(userBalance) === 0) ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {song.download_type === 'purchase_usdc' ? `DOWNLOAD ($${song.download_price_usdc || 0})` : 
                     song.download_type === 'holders_only' && (!userBalance || parseFloat(userBalance) === 0) ? 'LOCKED' :
                     'DOWNLOAD'}
                  </>
                )}
              </Button>
            )}
            {song.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/song/${song.id}/edit`)}
                className="font-mono"
              >
                <Edit className="h-4 w-4 mr-2" />
                EDIT
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

