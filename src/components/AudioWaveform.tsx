import { useEffect, useRef, useState } from 'react';
import { getIPFSGatewayUrl } from '@/lib/ipfs';

interface AudioWaveformProps {
  audioCid: string;
  className?: string;
  height?: number;
  color?: string;
  backgroundColor?: string;
  showProgress?: boolean;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
}

export const AudioWaveform = ({
  audioCid,
  className = "",
  height = 60,
  color = "#00ff9f",
  backgroundColor = "rgba(0, 0, 0, 0.3)",
  showProgress = false,
  currentTime = 0,
  duration = 0,
  onSeek
}: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load and analyze audio to generate waveform data
  useEffect(() => {
    const loadAudio = async () => {
      if (!audioCid) return;

      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `waveform_${audioCid}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setWaveformData(parsed);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse cached waveform:', e);
            localStorage.removeItem(cacheKey);
          }
        }

        const audioUrl = getIPFSGatewayUrl(audioCid);
        const audio = new Audio(audioUrl);
        
        // Wait for audio to be ready
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', resolve);
          audio.addEventListener('error', reject);
          audio.load();
        });

        // Create audio context for analysis
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        try {
          // Try to load the audio file as an ArrayBuffer for proper analysis
          const response = await fetch(audioUrl, {
            mode: 'cors',
            credentials: 'omit'
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          
          // Decode the audio data
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Extract the actual waveform data from the audio buffer
          const channelData = audioBuffer.getChannelData(0); // Get first channel
          const samples = Math.floor(audioBuffer.duration * 20); // 20 samples per second
          const waveform: number[] = [];
          
          // Sample the audio data to create waveform
          for (let i = 0; i < samples; i++) {
            const start = Math.floor((i / samples) * channelData.length);
            const end = Math.floor(((i + 1) / samples) * channelData.length);
            
            // Calculate RMS (Root Mean Square) for this sample
            let sum = 0;
            for (let j = start; j < end && j < channelData.length; j++) {
              sum += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sum / (end - start));
            
            // Convert to 0-1 range and add some visual enhancement
            const amplitude = Math.min(1, Math.abs(rms) * 2);
            waveform.push(amplitude);
          }
          
          setWaveformData(waveform);
          setLoading(false);
          
          // Cache the waveform data
          try {
            localStorage.setItem(cacheKey, JSON.stringify(waveform));
          } catch (e) {
            console.warn('Failed to cache waveform:', e);
          }
          
          // Cleanup
          audioContext.close();
          
        } catch (corsError) {
          console.warn('CORS blocked audio analysis, using fallback waveform:', corsError);
          
          // Fallback: Generate a realistic waveform pattern based on song duration
          const fallbackWaveform = generateFallbackWaveform(audio.duration || 180);
          setWaveformData(fallbackWaveform);
          setLoading(false);
          
          // Cache the fallback waveform
          try {
            localStorage.setItem(cacheKey, JSON.stringify(fallbackWaveform));
          } catch (e) {
            console.warn('Failed to cache fallback waveform:', e);
          }
          
          // Cleanup
          audioContext.close();
        }
      } catch (err) {
        console.error('Error loading audio for waveform:', err);
        // Fallback: generate a simple waveform pattern
        const fallbackWaveform = generateFallbackWaveform(180); // 3 minutes default
        setWaveformData(fallbackWaveform);
        setLoading(false);
        
        // Cache the error fallback waveform
        try {
          localStorage.setItem(cacheKey, JSON.stringify(fallbackWaveform));
        } catch (e) {
          console.warn('Failed to cache error fallback waveform:', e);
        }
      }
    };

    loadAudio();
  }, [audioCid]);

  // Fallback waveform generation (only used if audio analysis fails)
  const generateFallbackWaveform = (duration: number): number[] => {
    const samples = Math.floor(duration * 20);
    const waveform: number[] = [];
    
    // Use a seed based on duration to make patterns consistent for same song
    const seed = Math.floor(duration * 1000) % 10000;
    
    for (let i = 0; i < samples; i++) {
      const progress = i / samples;
      
      // Create a more realistic waveform pattern
      let amplitude = 0;
      
      // Intro (quieter with fade in)
      if (progress < 0.1) {
        amplitude = (0.2 + Math.sin(progress * Math.PI * 20) * 0.1) * (progress * 10);
      }
      // Build up
      else if (progress < 0.2) {
        amplitude = 0.3 + (progress - 0.1) * 2 + Math.sin(progress * Math.PI * 12) * 0.2;
      }
      // Main content (varied with realistic patterns)
      else if (progress < 0.8) {
        // Base amplitude with variation
        amplitude = 0.5 + Math.sin(progress * Math.PI * 8) * 0.3;
        
        // Add rhythmic patterns
        const rhythm = Math.sin(progress * Math.PI * 16) * 0.2;
        amplitude += rhythm;
        
        // Add verse drops (quieter sections)
        if (Math.sin(progress * Math.PI * 6) < -0.6) {
          amplitude *= 0.4;
        }
        
        // Add chorus peaks (louder sections)
        if (Math.sin(progress * Math.PI * 4) > 0.7) {
          amplitude *= 1.3;
        }
        
        // Add some variation based on seed for uniqueness
        const seedVariation = Math.sin((progress + seed / 1000) * Math.PI * 24) * 0.1;
        amplitude += seedVariation;
      }
      // Outro (fade out)
      else {
        const baseAmplitude = 0.5 + Math.sin(progress * Math.PI * 8) * 0.3;
        const fadeOut = 1 - (progress - 0.8) * 5;
        amplitude = baseAmplitude * Math.max(0, fadeOut);
      }
      
      // Add some natural variation
      amplitude += (Math.random() - 0.5) * 0.15;
      
      // Ensure amplitude is within bounds
      amplitude = Math.max(0.05, Math.min(1, amplitude));
      
      waveform.push(amplitude);
    }
    
    return waveform;
  };

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const barWidth = width / waveformData.length;
    const progress = duration > 0 ? currentTime / duration : 0;

    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth;
      const barHeight = amplitude * height * 0.8;
      const y = centerY - barHeight / 2;

      // Different colors for played vs unplayed
      if (showProgress && index / waveformData.length < progress) {
        ctx.fillStyle = color;
      } else {
        ctx.fillStyle = `${color}60`; // More transparent for unplayed
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });

    // Draw progress line
    if (showProgress && progress > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progress * width, 0);
      ctx.lineTo(progress * width, height);
      ctx.stroke();
    }
  }, [waveformData, currentTime, duration, showProgress, color, backgroundColor]);

  // Handle click to seek
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !duration) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const progress = x / rect.width;
    const seekTime = progress * duration;
    
    onSeek(seekTime);
  };

  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-xs text-muted-foreground font-mono">
          Loading waveform...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-xs text-red-400 font-mono">
          {error}
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`cursor-pointer ${className}`}
      style={{ height, width: '100%' }}
      onClick={handleClick}
    />
  );
};
