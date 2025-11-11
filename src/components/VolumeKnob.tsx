import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VolumeKnobProps {
  value: number; // 0 to 1
  onChange: (value: number) => void;
  onMuteToggle?: () => void;
  isMuted?: boolean;
  className?: string;
}

export const VolumeKnob = ({ 
  value, 
  onChange, 
  onMuteToggle,
  isMuted = false,
  className 
}: VolumeKnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const size = 48; // Knob size in pixels
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Convert volume (0-1) to angle for display
  // Volume 0 = -135° (225°), Volume 1 = 135°
  const volumeToAngle = (vol: number) => {
    return -135 + (vol * 270);
  };
  
  const currentAngle = volumeToAngle(isMuted ? 0 : value);
  const offset = circumference - ((isMuted ? 0 : value) * circumference);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateVolumeFromEvent(e);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    updateVolumeFromEvent(e);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const updateVolumeFromEvent = (e: MouseEvent | React.MouseEvent) => {
    if (!knobRef.current) return;
    
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const x = e.clientX - centerX;
    const y = e.clientY - centerY;
    
    // Calculate angle from center (in degrees)
    // atan2 returns angle from -180° to 180°, with 0° pointing right (3 o'clock)
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    
    // Convert to 0-360 range (0° = right, 90° = bottom, 180° = left, 270° = top)
    if (angle < 0) angle += 360;
    
    // Our knob range: 225° (bottom-left, 0 volume) to 135° (top-left, max volume)
    // Going clockwise: 225° → 270° → 0° → 90° → 135° = 270° total
    
    let volume = 0;
    
    if (angle >= 225 && angle <= 360) {
      // From 225° to 360° (going clockwise from bottom-left)
      // This covers 0 to 0.5 volume (135 degrees)
      volume = (angle - 225) / 270;
    } else if (angle >= 0 && angle <= 135) {
      // From 0° to 135° (wrapping around from 360°)
      // This covers 0.5 to 1.0 volume (135 degrees)
      // At 0° we should have 0.5, at 135° we should have 1.0
      volume = (135 + angle) / 270;
    } else {
      // Between 135° and 225° - this is outside our knob range
      // Clamp to nearest edge
      if (angle < 180) {
        volume = 1; // Closer to 135° (max)
      } else {
        volume = 0; // Closer to 225° (min)
      }
    }
    
    // Ensure volume is between 0 and 1
    volume = Math.max(0, Math.min(1, volume));
    onChange(volume);
  };
  
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent) => handleMouseMove(e);
      const handleUp = () => handleMouseUp();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging]);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newVolume = Math.max(0, Math.min(1, (isMuted ? 0 : value) + delta));
    onChange(newVolume);
  };
  
  return (
    <div 
      className={cn("relative flex items-center justify-center", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minWidth: size, minHeight: size }}
    >
      <div
        ref={knobRef}
        className="relative cursor-pointer select-none"
        onMouseDown={(e) => {
          // If clicking on the icon area, toggle mute; otherwise start dragging
          const rect = knobRef.current?.getBoundingClientRect();
          if (rect) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.sqrt(
              Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
            );
            // If click is within 12px of center, toggle mute; otherwise drag
            if (distance < 12 && onMuteToggle) {
              onMuteToggle();
            } else {
              handleMouseDown(e);
            }
          } else {
            handleMouseDown(e);
          }
        }}
        onWheel={handleWheel}
        style={{ width: size, height: size }}
      >
        {/* SVG Circle Background */}
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Volume progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isMuted ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 255, 159, 0.8)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-150"
            style={{
              filter: isMuted ? 'none' : 'drop-shadow(0 0 4px rgba(0, 255, 159, 0.5))'
            }}
          />
        </svg>
        
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isMuted ? (
            <VolumeX 
              className={cn(
                "w-4 h-4 transition-colors",
                isHovered ? "text-muted-foreground" : "text-muted-foreground/60"
              )}
            />
          ) : (
            <Volume2 
              className={cn(
                "w-4 h-4 transition-colors",
                isHovered ? "text-neon-green" : "text-neon-green/70"
              )}
            />
          )}
        </div>
        
        {/* Volume indicator line */}
        {!isMuted && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `rotate(${currentAngle}deg)`,
              transformOrigin: 'center',
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-neon-green rounded-full"
              style={{
                transform: 'translateY(2px)',
                boxShadow: '0 0 4px rgba(0, 255, 159, 0.8)'
              }}
            />
          </div>
        )}
      </div>
      
      {/* Volume percentage tooltip on hover */}
      {isHovered && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-mono text-neon-green whitespace-nowrap pointer-events-none z-10">
          {Math.round((isMuted ? 0 : value) * 100)}%
        </div>
      )}
    </div>
  );
};

