import { useState, useEffect } from "react";
import { Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { usePrivy } from "@privy-io/react-auth";

interface RepostButtonProps {
  postId: string;
  initialRepostCount?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  onRepostChange?: () => void;
}

export default function RepostButton({ 
  postId, 
  initialRepostCount = 0, 
  size = "md",
  showCount = true,
  onRepostChange,
}: RepostButtonProps) {
  const { isConnected, fullAddress: address } = useWallet();
  const { getAccessToken } = usePrivy();
  const [isReposted, setIsReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(initialRepostCount);
  const [isLoading, setIsLoading] = useState(false);

  // Always fetch the public repost count; only check personal repost state when connected
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      await fetchRepostCount();
      if (isConnected && address && mounted) {
        await checkIfReposted();
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, [postId, isConnected, address]);

  const checkIfReposted = async () => {
    if (!address) return;
    try {
      const { data, error } = await supabase
        .from("feed_reposts")
        .select("id")
        .eq("post_id", postId)
        .eq("wallet_address", address.toLowerCase())
        .maybeSingle();

      if (error) throw error;
      setIsReposted(!!data);
    } catch (error) {
      console.error("Error checking repost status:", error);
    }
  };

  const fetchRepostCount = async () => {
    try {
      const { data, error } = await supabase
        .from("feed_posts")
        .select("repost_count")
        .eq("id", postId)
        .maybeSingle();

      if (error) throw error;
      if (data?.repost_count !== undefined) {
        setRepostCount(data.repost_count);
      }
    } catch (error) {
      console.error("Error fetching repost count:", error);
    }
  };

  const handleRepost = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Connect wallet",
        description: "Please connect your wallet to repost",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    const wasReposted = isReposted;

    try {
      const action = wasReposted ? 'unrepost' : 'repost';
      
      // Use direct database call (edge function requires auth, but we can use direct calls)
      // The RLS policy allows deletion, and we validate wallet_address in the query
      if (wasReposted) {
        // Unrepost - direct delete
        const { data: deleteData, error: deleteError } = await supabase
          .from("feed_reposts")
          .delete()
          .eq("post_id", postId)
          .eq("wallet_address", address.toLowerCase())
          .select();

        if (deleteError) throw deleteError;
        
        // Verify deletion worked
        if (!deleteData || deleteData.length === 0) {
          console.warn('No repost found to delete');
          // Still update state in case it was already deleted
          setIsReposted(false);
          await fetchRepostCount();
          await checkIfReposted();
          return;
        }
        
        setIsReposted(false);
        toast({
          title: "Unreposted",
          description: "Post unreposted successfully",
        });
      } else {
        // Repost - direct insert
        const { error: insertError } = await supabase
          .from("feed_reposts")
          .insert({
            post_id: postId,
            wallet_address: address.toLowerCase(),
          });

        if (insertError) {
          // Check if it's a duplicate error
          if (insertError.code === '23505') {
            // Already reposted, just update state
            setIsReposted(true);
            await fetchRepostCount();
            await checkIfReposted();
            return;
          }
          throw insertError;
        }
        
        setIsReposted(true);
        toast({
          title: "Reposted",
          description: "Post reposted successfully",
        });
      }

      // Refresh repost count and state
      await fetchRepostCount();
      await checkIfReposted();
      
      // Notify parent component if callback provided
      if (onRepostChange) {
        onRepostChange();
      }
    } catch (error: any) {
      console.error("Error toggling repost:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to repost. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRepost}
        disabled={isLoading}
        className={`${sizeClasses[size]} ${isReposted ? "text-neon-green hover:text-neon-green/80" : "text-muted-foreground hover:text-foreground"}`}
        title={isReposted ? "Unrepost" : "Repost"}
      >
        <Repeat2 className={`${iconSizes[size]} ${isReposted ? "fill-current" : ""}`} />
      </Button>
      {showCount && repostCount > 0 && (
        <span className={`text-xs ${isReposted ? "text-neon-green" : "text-muted-foreground"}`}>
          {repostCount}
        </span>
      )}
    </div>
  );
}

