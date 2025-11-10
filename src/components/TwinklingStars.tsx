import { useMemo } from "react";

interface TwinklingStarsProps {
  count?: number;
  className?: string;
  colors?: string[];
  minSize?: number;
  maxSize?: number;
}

const TwinklingStars = ({ 
  count = 20, 
  className = "",
  colors = ['#87CEEB', '#FFB6C1', '#FFFFFF'], // baby blue, baby pink, white
  minSize = 1,
  maxSize = 3
}: TwinklingStarsProps) => {
  // Generate random star positions - memoized to prevent regeneration on every render
  const stars = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 3, // Slower twinkling: 4-7 seconds
      color: colors[Math.floor(Math.random() * colors.length)],
      size: minSize + Math.random() * (maxSize - minSize),
    })), [count, colors, minSize, maxSize]
  );

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full animate-twinkle"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: star.color,
            boxShadow: `0 0 ${star.size * 1.5}px ${star.color}`,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
};

export default TwinklingStars;

