import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { usePrivyToken } from '@/hooks/usePrivyToken';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, CircleCheckBig } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import { XRGETierBadge } from '@/components/XRGETierBadge';

interface SongComment {
  id: string;
  wallet_address: string;
  comment_text: string;
  created_at: string;
  user_name: string | null;
  profiles?: {
    artist_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
}

interface SongCommentsProps {
  songId: string;
  onCommentCountChange?: (count: number) => void;
}

export const SongComments = ({ songId, onCommentCountChange }: SongCommentsProps) => {
  const navigate = useNavigate();
  const { fullAddress, isConnected } = useWallet();
  const { getAuthHeaders } = usePrivyToken();
  const [comments, setComments] = useState<SongComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const onCommentCountChangeRef = useRef(onCommentCountChange);
  const lastCountRef = useRef<number>(0);

  // Update ref when callback changes
  useEffect(() => {
    onCommentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select('*')
        .eq('song_id', songId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately (case-insensitive matching)
      const walletAddresses = [...new Set(commentsData?.map(c => c.wallet_address) || [])];
      let profilesData: { wallet_address: string; artist_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, avatar_cid, verified')
          .or(orFilter);
        profilesData = data || [];
      }

      // Merge data
      const commentsWithProfiles = commentsData?.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === comment.wallet_address?.toLowerCase()) || null
      })) || [];

      setComments(commentsWithProfiles as SongComment[]);
      
      // Only update comment count if it actually changed
      const newCount = commentsWithProfiles.length;
      if (newCount !== lastCountRef.current && onCommentCountChangeRef.current) {
        lastCountRef.current = newCount;
        // Use setTimeout to batch updates and prevent infinite loops
        setTimeout(() => {
          onCommentCountChangeRef.current?.(newCount);
        }, 0);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    loadComments();
    
    // Subscribe to real-time comment updates
    const channel = supabase
      .channel(`comments:${songId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `song_id=eq.${songId}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [songId, loadComments]);


  const handleSubmitComment = async () => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to comment',
        variant: 'destructive',
      });
      return;
    }

    if (!commentText.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter a comment',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Use edge function to add comment (bypasses RLS)
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('add-song-comment', {
        headers,
        body: {
          songId,
          commentText: commentText.trim(),
          walletAddress: fullAddress,
        },
      });

      if (error) throw error;

      setCommentText('');
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added',
      });
      
      // Reload comments to show the new one
      await loadComments();
    } catch (error: any) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date().getTime();
    const postTime = new Date(dateString).getTime();
    const diffMs = now - postTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comments List */}
      {comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">
              {/* Avatar */}
              <div 
                className="flex-shrink-0 cursor-pointer"
                onClick={() => navigate(`/artist/${comment.wallet_address}`)}
              >
                {comment.profiles?.avatar_cid ? (
                  <img
                    src={getIPFSGatewayUrl(comment.profiles.avatar_cid)}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary text-xs">
                      {comment.profiles?.artist_name?.[0] || '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Comment Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <p 
                    className="text-sm font-semibold cursor-pointer hover:text-neon-green transition-colors"
                    onClick={() => navigate(`/artist/${comment.wallet_address}`)}
                  >
                    {comment.profiles?.artist_name || `${comment.wallet_address.slice(0, 6)}...${comment.wallet_address.slice(-4)}`}
                  </p>
                  {comment.profiles?.verified && (
                    <CircleCheckBig className="h-3 w-3 text-blue-500 flex-shrink-0" aria-label="Verified artist" />
                  )}
                  <XRGETierBadge walletAddress={comment.wallet_address} size="sm" />
                </div>
                <p className="text-sm text-muted-foreground break-words">
                  {comment.comment_text}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(comment.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No comments yet. Be the first to comment!
        </p>
      )}

      {/* Add Comment Input */}
      {isConnected ? (
        <div className="flex gap-2 pt-2 border-t border-primary/10">
          <Input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            className="flex-1"
            disabled={submitting}
          />
          <Button
            onClick={handleSubmitComment}
            disabled={submitting || !commentText.trim()}
            size="sm"
            className="px-3"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2 border-t border-primary/10">
          Connect your wallet to comment
        </p>
      )}
    </div>
  );
};

