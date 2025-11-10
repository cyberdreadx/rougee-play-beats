import { useState, useEffect, useRef, memo } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import { usePrivyToken } from "@/hooks/usePrivyToken";

interface LikeButtonProps {
  songId: string;
  initialLikeCount?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  entityType?: 'song' | 'post';
}

const LikeButtonComponent = function LikeButton({ 
  songId, 
  initialLikeCount = 0, 
  size = "md",
  showCount = true,
  entityType = 'song',
}: LikeButtonProps) {
  const { isConnected, fullAddress: address, connect } = useWallet();
  const { getAuthHeaders } = usePrivyToken();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track if we've already fetched to prevent duplicate calls
  const hasFetchedRef = useRef(false);
  const lastSongIdRef = useRef<string | null>(null);

  // Only fetch once per songId - prevent refetching on every render/scroll
  useEffect(() => {
    // Reset if songId changed
    if (lastSongIdRef.current !== songId) {
      hasFetchedRef.current = false;
      lastSongIdRef.current = songId;
      setLikeCount(initialLikeCount);
      setIsLiked(false);
    }
    
    // Only fetch if we haven't fetched this songId yet
    if (hasFetchedRef.current) return;
    
    let mounted = true;
    const currentSongId = songId;
    const currentAddress = address;
    const currentIsConnected = isConnected;
    
    const loadData = async () => {
      if (!mounted) return;
      
      // Double check we haven't already fetched for this songId
      if (lastSongIdRef.current !== currentSongId) return;
      hasFetchedRef.current = true;
      
      // Only fetch count if we don't have initialLikeCount
      if (!initialLikeCount || initialLikeCount === 0) {
        await fetchLikeCount();
      }
      
      // Only check if liked when connected
      if (currentIsConnected && currentAddress && mounted && lastSongIdRef.current === currentSongId) {
        await checkIfLiked();
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]); // Only depend on songId - don't refetch when address/connected changes

  const checkIfLiked = async () => {
    if (!address) return;
    
    // Prevent duplicate calls
    if (hasFetchedRef.current && lastSongIdRef.current === songId) {
      // Already checked for this song
      return;
    }

    try {
      const table = entityType === 'post' ? 'feed_likes' : 'song_likes';
      const idColumn = entityType === 'post' ? 'post_id' : 'song_id';

      const { data, error } = await (supabase as any)
        .from(table)
        .select('id')
        .eq('wallet_address', address)
        .eq(idColumn, songId)
        .maybeSingle();

      if (error) throw error;
      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const fetchLikeCount = async () => {
    // Skip if we already have a count from initialLikeCount
    if (initialLikeCount > 0) {
      setLikeCount(initialLikeCount);
      return;
    }
    
    // Prevent duplicate calls
    if (hasFetchedRef.current && lastSongIdRef.current === songId) {
      return;
    }
    
    try {
      const table = entityType === 'post' ? 'feed_likes' : 'song_likes';
      const idColumn = entityType === 'post' ? 'post_id' : 'song_id';

      const { count, error } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(idColumn, songId);

      if (error) throw error;
      setLikeCount(count || 0);
    } catch (error) {
      console.error('Error fetching like count:', error);
    }
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isConnected) {
      toast.error("Log in to like songs");
      connect();
      return;
    }

    if (!address) {
      toast.error("Setting up your wallet... please try again in a moment");
      return;
    }

    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      console.log('🔐 Auth headers obtained:', { hasAuth: !!headers.Authorization });
      
      const functionName = entityType === 'post' ? 'like-post' : 'like-song';
      const body = entityType === 'post' 
        ? { postId: songId, action: isLiked ? 'unlike' : 'like', walletAddress: address }
        : { songId, action: isLiked ? 'unlike' : 'like', walletAddress: address };

      console.log('📤 Calling edge function:', functionName, body);

      const { data, error } = await (supabase as any).functions.invoke(functionName, {
        headers,
        body,
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        console.error('Error details:', { message: error.message, context: error.context });
        
        // Try to parse the error response
        let errorData;
        try {
          errorData = await error.context?.json();
          console.error('📝 Server error response:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }

        // Check if it's an "already liked" error
        if (errorData?.alreadyLiked) {
          toast.info("You already liked this!");
          // Update local state to reflect already liked
          setIsLiked(true);
          return;
        }
        
        throw error;
      }

      console.log('✅ Edge function success:', data);
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);
    } catch (error: any) {
      console.error('Error toggling like:', error);
      toast.error(error.message || "Failed to update like");
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12"
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleLike}
        disabled={isLoading}
        className={`${sizeClasses[size]} rounded-full transition-all hover:scale-110 ${
          isLiked 
            ? 'bg-pink-500/20 hover:bg-pink-500/30 border-2 border-pink-500' 
            : 'bg-muted/50 hover:bg-muted border-2 border-transparent hover:border-pink-500/50'
        }`}
      >
        <Heart 
          size={iconSizes[size]}
          className={`transition-colors ${
            isLiked ? 'fill-pink-500 text-pink-500' : 'text-muted-foreground'
          }`}
        />
      </Button>
      {showCount && (
        <span className="font-mono text-sm text-muted-foreground min-w-[30px] text-right tabular-nums">
          {likeCount}
        </span>
      )}
    </div>
  );
};

// Memoize to prevent re-renders on scroll
export default memo(LikeButtonComponent, (prevProps, nextProps) => {
  // Only re-render if props actually changed
  return prevProps.songId === nextProps.songId &&
         prevProps.initialLikeCount === nextProps.initialLikeCount &&
         prevProps.size === nextProps.size &&
         prevProps.showCount === nextProps.showCount &&
         prevProps.entityType === nextProps.entityType;
});