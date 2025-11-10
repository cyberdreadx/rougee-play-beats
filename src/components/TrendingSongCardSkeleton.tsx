import { memo } from "react";

export const SongCardSkeleton = memo(() => (
  <div className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded bg-white/10 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
      </div>
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    </div>
    <div className="h-24 bg-white/5 rounded-lg animate-pulse" />
    <div className="flex items-center gap-3">
      <div className="h-3 bg-white/10 rounded w-12 animate-pulse" />
      <div className="h-3 bg-white/10 rounded w-16 animate-pulse" />
      <div className="h-3 bg-white/10 rounded w-20 animate-pulse" />
    </div>
  </div>
));
SongCardSkeleton.displayName = 'SongCardSkeleton';

