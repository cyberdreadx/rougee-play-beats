import { Music, BarChart3, Zap, Sparkles } from "lucide-react";

interface TrendingHeroProps {
  songsCount: number;
  totalVolumeUSD: number;
  calculatingVolume: boolean;
  topGainerPercent: number;
  artistsCount: number;
}

const TrendingHero = ({ songsCount, totalVolumeUSD, calculatingVolume, topGainerPercent, artistsCount }: TrendingHeroProps) => {
  return (
    <div className="mb-6 md:mb-10 px-4 md:px-0">
      {/* Stunning Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/0 backdrop-blur-2xl p-6 md:p-8 mb-6 md:mb-10"
           style={{
             border: '1px solid rgba(255, 255, 255, 0.15)',
             boxShadow: `
               0 0 0 1px rgba(0, 255, 159, 0.1),
               0 8px 32px rgba(0, 255, 159, 0.15),
               0 16px 64px rgba(0, 255, 159, 0.1),
               inset 0 1px 0 rgba(255, 255, 255, 0.1),
               inset 0 -1px 0 rgba(0, 0, 0, 0.2)
             `
           }}>
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 via-transparent to-purple-500/5 opacity-50" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold font-mono neon-text mb-3 md:mb-4 text-center md:text-left">
            TRENDING NOW
          </h1>
          <p className="text-muted-foreground font-mono text-sm md:text-base text-center md:text-left mb-6 md:mb-8">
            Discover the hottest tracks and rising artists on the decentralized music platform
          </p>
          
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="group relative bg-gradient-to-br from-white/5 via-neon-green/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(0,255,159,0.3)] active:shadow-[0_0_10px_rgba(0,255,159,0.2)]"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.1)',
                   boxShadow: `
                     0 0 0 1px rgba(0, 255, 159, 0.05),
                     0 4px 16px rgba(0, 255, 159, 0.1),
                     0 8px 32px rgba(0, 255, 159, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(0, 255, 159, 0.3)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 255, 159, 0.2),
                     0 8px 32px rgba(0, 255, 159, 0.2),
                     0 16px 64px rgba(0, 255, 159, 0.25),
                     inset 0 1px 0 rgba(0, 255, 159, 0.2),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 255, 159, 0.05),
                     0 4px 16px rgba(0, 255, 159, 0.1),
                     0 8px 32px rgba(0, 255, 159, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `;
                 }}>
              <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-neon-green/10 rounded-full blur-2xl group-hover:bg-neon-green/20 transition-all" />
              <Music className="w-4 h-4 md:w-5 md:h-5 text-neon-green/70 mb-1 md:mb-2" />
              <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TOTAL SONGS</div>
              <div className="text-2xl md:text-3xl font-bold font-mono neon-text drop-shadow-[0_0_8px_rgba(0,255,159,0.6)]">{songsCount}</div>
            </div>
            <div className="group relative bg-gradient-to-br from-white/5 via-purple-500/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] active:shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.1)',
                   boxShadow: `
                     0 0 0 1px rgba(168, 85, 247, 0.05),
                     0 4px 16px rgba(168, 85, 247, 0.1),
                     0 8px 32px rgba(168, 85, 247, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(168, 85, 247, 0.3)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(168, 85, 247, 0.2),
                     0 8px 32px rgba(168, 85, 247, 0.2),
                     0 16px 64px rgba(168, 85, 247, 0.25),
                     inset 0 1px 0 rgba(168, 85, 247, 0.2),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(168, 85, 247, 0.05),
                     0 4px 16px rgba(168, 85, 247, 0.1),
                     0 8px 32px rgba(168, 85, 247, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `;
                 }}>
              <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-purple-400/70 mb-1 md:mb-2" />
              <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TOTAL VOLUME (24H)</div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                {calculatingVolume ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  `$${totalVolumeUSD > 0 ? totalVolumeUSD.toLocaleString(undefined, {maximumFractionDigits: 0}) : '0'}`
                )}
              </div>
            </div>
            <div className="group relative bg-gradient-to-br from-white/5 via-orange-500/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.1)',
                   boxShadow: `
                     0 0 0 1px rgba(249, 115, 22, 0.05),
                     0 4px 16px rgba(249, 115, 22, 0.1),
                     0 8px 32px rgba(249, 115, 22, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(249, 115, 22, 0.3)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(249, 115, 22, 0.2),
                     0 8px 32px rgba(249, 115, 22, 0.2),
                     0 16px 64px rgba(249, 115, 22, 0.25),
                     inset 0 1px 0 rgba(249, 115, 22, 0.2),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(249, 115, 22, 0.05),
                     0 4px 16px rgba(249, 115, 22, 0.1),
                     0 8px 32px rgba(249, 115, 22, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `;
                 }}>
              <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all" />
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-orange-400/70 mb-1 md:mb-2" />
              <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TOP GAINER</div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]">
                {topGainerPercent > 0 ? `+${topGainerPercent.toFixed(1)}%` : '0%'}
              </div>
            </div>
            <div className="group relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] active:shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.1)',
                   boxShadow: `
                     0 0 0 1px rgba(59, 130, 246, 0.05),
                     0 4px 16px rgba(59, 130, 246, 0.1),
                     0 8px 32px rgba(59, 130, 246, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(59, 130, 246, 0.3)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(59, 130, 246, 0.2),
                     0 8px 32px rgba(59, 130, 246, 0.2),
                     0 16px 64px rgba(59, 130, 246, 0.25),
                     inset 0 1px 0 rgba(59, 130, 246, 0.2),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(59, 130, 246, 0.05),
                     0 4px 16px rgba(59, 130, 246, 0.1),
                     0 8px 32px rgba(59, 130, 246, 0.05),
                     inset 0 1px 0 rgba(255, 255, 255, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                   `;
                 }}>
              <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-blue-400/70 mb-1 md:mb-2" />
              <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">ARTISTS</div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">{artistsCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingHero;

