import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { X, ChevronLeft, ChevronRight, Heart, Eye, MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaggedText from "@/components/TaggedText";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";

interface Story {
  id: string;
  wallet_address: string;
  media_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  view_count?: number;
  like_count?: number;
}

interface StoryViewerProps {
  stories: Story[];
  profile: any;
  onClose: () => void;
  allStories: { [walletAddress: string]: Story[] };
  profiles: { [key: string]: any };
  currentWallet: string;
}

const StoryViewer = ({
  stories,
  profile,
  onClose,
  allStories,
  profiles,
  currentWallet,
}: StoryViewerProps) => {
  const navigate = useNavigate();
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentWalletAddress, setCurrentWalletAddress] = useState(currentWallet);
  const [progress, setProgress] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Array<{ id: string; wallet_address: string; comment_text: string; created_at: string; profiles?: { artist_name: string | null; avatar_cid: string | null } | null }>>([]);
  const [commentText, setCommentText] = useState("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { fullAddress } = useWallet();
  const { toast } = useToast();
  // Fallback viewer id so views count even when not logged in
  const viewerId = (() => {
    try {
      if (fullAddress) return fullAddress.toLowerCase();
      let anon = localStorage.getItem('story_viewer_id');
      if (!anon) {
        const gen = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        anon = gen;
        localStorage.setItem('story_viewer_id', anon);
      }
      return `anon:${anon}`;
    } catch {
      return `anon-${Date.now()}`;
    }
  })();
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<Array<{ wallet_address: string; profiles?: { artist_name: string | null; avatar_cid: string | null } | null }>>([]);

  const walletAddresses = useMemo(() => Object.keys(allStories), [allStories]);
  const currentWalletIndex = walletAddresses.indexOf(currentWalletAddress);
  const currentStories = allStories[currentWalletAddress] || [];
  const currentStory = currentStories[currentStoryIndex];
  const currentProfile = profiles[currentWalletAddress];
  
  // Defer close to avoid cross-tree setState warning
  const deferClose = useCallback(() => {
    try {
      // Defer to next animation frame so StoriesBar updates outside this render phase
      requestAnimationFrame(() => onClose());
    } catch {
      onClose();
    }
  }, [onClose]);

  // Load counts and comments when story changes
  useEffect(() => {
    // Reset local comment UI when changing stories to avoid cross-story bleed
    setComments([]);
    setCommentText("");
    const recordAndLoad = async () => {
      if (!currentStory) return;
      // load comments
      await loadComments(currentStory.id);

      // Always load persisted view count from DB
      try {
        const { count: initialCount } = await supabase
          .from('story_views')
          .select('id', { count: 'exact', head: true })
          .eq('story_id', currentStory.id);
        setViewCount(initialCount || 0);
      } catch {}

      try {
        // Check if already viewed
        const { data: existing } = await supabase
          .from('story_views')
          .select('id')
          .eq('story_id', currentStory.id)
          .eq('viewer_wallet_address', viewerId)
          .maybeSingle();
        if (!existing) {
          const { error } = await supabase
            .from('story_views')
            .insert({ story_id: currentStory.id, viewer_wallet_address: viewerId });
          if (!error) {
            const { count: afterCount } = await supabase
              .from('story_views')
              .select('id', { count: 'exact', head: true })
              .eq('story_id', currentStory.id);
            setViewCount(afterCount || 1);
          }
        }
      } catch {}
    };

    recordAndLoad();
  }, [currentStory?.id, fullAddress]);

  // Check if user liked current story and get like count
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!currentStory) return;
      // Has current user liked?
      if (fullAddress) {
        const { data } = await supabase
          .from('story_likes')
          .select('id')
          .eq('story_id', currentStory.id)
          .eq('wallet_address', fullAddress.toLowerCase())
          .maybeSingle();
        setHasLiked(!!data);
      } else {
        setHasLiked(false);
      }
      // Always fetch persisted like count
      const { count } = await supabase
        .from('story_likes')
        .select('id', { count: 'exact', head: true })
        .eq('story_id', currentStory.id);
      setLikeCount(count || 0);
    };

    checkLikeStatus();
  }, [currentStory?.id, fullAddress]);

  // Guard: if no stories or invalid index, close viewer
  useEffect(() => {
    if (!currentStories || currentStories.length === 0 || !currentStory) {
      deferClose();
    }
  }, [currentStories, currentStory, deferClose]);

  useEffect(() => {
    if (!currentStory) return;
    
    setProgress(0);
    setVideoDuration(null);
    
    const duration = currentStory.media_type === "video" 
      ? (videoDuration ? videoDuration * 1000 : 15000) 
      : 5000;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + 100 / (duration / 100);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStoryIndex, currentWalletAddress, videoDuration, currentStory]);

  const handleNext = () => {
    if (!currentStories || currentStories.length === 0) {
      onClose();
      return;
    }
    
    if (currentStoryIndex < currentStories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else if (currentWalletIndex < walletAddresses.length - 1) {
      setCurrentWalletAddress(walletAddresses[currentWalletIndex + 1]);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const loadComments = async (storyId: string) => {
    const { data: commentsData } = await supabase
      .from('story_comments')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true });
    const addrs = Array.from(new Set((commentsData || []).map(c => c.wallet_address)));
    let profiles: any[] = [];
    if (addrs.length) {
      const { data } = await supabase
        .from('profiles')
        .select('wallet_address, artist_name, avatar_cid')
        .in('wallet_address', addrs);
      profiles = data || [];
    }
    const withProfiles = (commentsData || []).map(c => ({
      ...c,
      profiles: profiles.find(p => p.wallet_address?.toLowerCase() === c.wallet_address?.toLowerCase()) || null,
    }));
    setComments(withProfiles as any);
  };

  const handleAddComment = async () => {
    if (!fullAddress || !currentStory) {
      toast({ title: 'Connect wallet', description: 'Please connect to comment', variant: 'destructive' });
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    await supabase
      .from('story_comments')
      .insert({ story_id: currentStory.id, wallet_address: fullAddress.toLowerCase(), comment_text: text });
    setCommentText("");
    await loadComments(currentStory.id);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentStory || !fullAddress) return;
    setDeletingCommentId(commentId);
    try {
      const { error } = await supabase
        .from('story_comments')
        .delete()
        .eq('id', commentId)
        .eq('wallet_address', fullAddress.toLowerCase());
      if (error) {
        toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      } else {
        // Optimistically remove from UI
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast({ title: 'Comment deleted' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete comment', variant: 'destructive' });
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Auto-pause video when comments drawer is open; resume when closed
  useEffect(() => {
    if (!currentStory || !videoRef.current || currentStory.media_type !== 'video') return;
    try {
      if (showComments) {
        videoRef.current.pause();
      } else {
        // Resume only if not at end
        if (videoRef.current.currentTime < (videoRef.current.duration || Infinity)) {
          void videoRef.current.play();
        }
      }
    } catch {}
  }, [showComments, currentStory]);

  const loadViewers = async (storyId: string) => {
    const { data: viewRows } = await supabase
      .from('story_views')
      .select('viewer_wallet_address')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })
      .limit(200);
    const addrs = Array.from(new Set((viewRows || []).map(v => v.viewer_wallet_address)));
    let profiles: any[] = [];
    if (addrs.length) {
      const { data } = await supabase
        .from('profiles')
        .select('wallet_address, artist_name, avatar_cid')
        .in('wallet_address', addrs);
      profiles = data || [];
    }
    const items = (viewRows || []).map(v => ({
      wallet_address: v.viewer_wallet_address,
      profiles: profiles.find(p => p.wallet_address?.toLowerCase() === v.viewer_wallet_address?.toLowerCase()) || null,
    }));
    setViewers(items as any);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handlePrevious = () => {
    if (!currentStories || currentStories.length === 0) {
      onClose();
      return;
    }
    
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentWalletIndex > 0) {
      const prevWallet = walletAddresses[currentWalletIndex - 1];
      const prevStories = allStories[prevWallet];
      if (prevStories && prevStories.length > 0) {
        setCurrentWalletAddress(prevWallet);
        setCurrentStoryIndex(prevStories.length - 1);
      } else {
        onClose();
      }
    }
  };

  const handleLike = async () => {
    if (!fullAddress) {
      toast({
        title: "Login required",
        description: "Please connect your wallet to like stories",
        variant: "destructive",
      });
      return;
    }

    try {
      if (hasLiked) {
        // Unlike
        await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', currentStory.id)
          .eq('wallet_address', fullAddress.toLowerCase());
        
        setHasLiked(false);
        // Refresh from DB to keep consistent
        const { count } = await supabase
          .from('story_likes')
          .select('id', { count: 'exact', head: true })
          .eq('story_id', currentStory.id);
        setLikeCount(count || 0);
      } else {
        // Like
        await supabase
          .from('story_likes')
          .insert({
            story_id: currentStory.id,
            wallet_address: fullAddress.toLowerCase()
          });
        
        setHasLiked(true);
        const { count } = await supabase
          .from('story_likes')
          .select('id', { count: 'exact', head: true })
          .eq('story_id', currentStory.id);
        setLikeCount(count || 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  // Early return if no valid story
  if (!currentStories || currentStories.length === 0 || !currentStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" style={{
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)'
    }}>
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10" style={{
        paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))'
      }}>
        {currentStories.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width: index === currentStoryIndex ? `${progress}%` : index < currentStoryIndex ? "100%" : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute left-4 right-4 flex items-center justify-between z-40 pointer-events-auto" style={{
        top: 'calc(1rem + env(safe-area-inset-top, 0px) + 0.5rem)'
      }}>
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            deferClose();
            navigate(`/artist/${currentWalletAddress}`);
          }}
        >
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarImage
              src={
                currentProfile?.avatar_cid
                  ? getIPFSGatewayUrl(currentProfile.avatar_cid, undefined, true)
                  : undefined
              }
            />
            <AvatarFallback className="bg-primary/20 text-white">
              {currentProfile?.display_name?.[0]?.toUpperCase() ||
                currentWalletAddress.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-semibold">
              {currentProfile?.display_name ||
                `${currentWalletAddress.slice(0, 6)}...${currentWalletAddress.slice(-4)}`}
            </p>
            <p className="text-white/70 text-sm">
              {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); deferClose(); }} 
          className="text-white bg-transparent hover:bg-black/20 rounded-full p-2 transition-all z-50"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Media */}
      <div className="relative w-full h-full flex items-center justify-center">
        {currentStory.media_type === "image" ? (
          <img
            src={supabase.storage.from('stories').getPublicUrl(currentStory.media_path).data.publicUrl}
            alt="Story"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el) {
                el.muted = isMuted;
              }
            }}
            src={supabase.storage.from('stories').getPublicUrl(currentStory.media_path).data.publicUrl}
            autoPlay
            playsInline
            controls={false}
            preload="metadata"
            className="max-h-full max-w-full object-contain"
            onEnded={handleNext}
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
            crossOrigin="anonymous"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
          />
        )}

        {/* Instagram-style mute button - top right, small and subtle */}
        {currentStory.media_type === "video" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="absolute top-20 right-4 bg-black/50 backdrop-blur-sm rounded-full p-2 text-white hover:bg-black/70 transition-all z-20"
            style={{
              top: 'calc(4rem + env(safe-area-inset-top, 0px))'
            }}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
        )}

        {/* Caption and Stats */}
        <div className="absolute bottom-20 left-0 right-0 px-8 z-30 pointer-events-auto">
          {currentStory.caption && (
            <p className="text-white text-lg font-medium bg-black/50 px-4 py-2 rounded-lg inline-block mb-4">
              {currentStory.caption}
            </p>
          )}
          
          {/* View, Like and Comment counts */}
          <div className="flex items-center gap-4 justify-center text-white">
            <div className="flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full">
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">{viewCount}</span>
            </div>
            <div className="flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full">
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-sm font-medium">{likeCount}</span>
            </div>
            <button
              className="flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full hover:bg-black/60"
              onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{comments.length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Like Button */}
      <div className="absolute bottom-32 right-8 z-20 pointer-events-auto">
        <button
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${hasLiked ? 'bg-red-500/20' : 'bg-black/30 hover:bg-black/50'}`}
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
        >
          <Heart 
            className={`w-6 h-6 ${hasLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
          />
        </button>
      </div>

      {/* Owner-only Viewers Button */}
      {currentProfile?.wallet_address?.toLowerCase?.() === fullAddress?.toLowerCase?.() && (
        <div className="absolute bottom-32 left-8 z-20">
          <button
            className="w-12 h-12 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 transition-all"
            onClick={(e) => { e.stopPropagation(); loadViewers(currentStory.id); setShowViewers(true); }}
          >
            <Eye className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Instagram-style Navigation - tap left/right to navigate */}
      <div className="absolute inset-0 flex z-10 pointer-events-auto">
        {/* Left tap zone - 1/3 of screen */}
        <div 
          className="w-1/3 cursor-pointer" 
          onClick={handlePrevious}
        />
        {/* Right tap zone - 2/3 of screen */}
        <div 
          className="flex-1 cursor-pointer" 
          onClick={handleNext}
        />
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-black/80 backdrop-blur-md border-t border-white/10 max-h-[55%] overflow-y-auto">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white/90 font-semibold">Comments</p>
              <button className="text-white/60 hover:text-white" onClick={() => setShowComments(false)}>Close</button>
            </div>
            {/* Add comment */}
            <div className="flex gap-2">
              <Input 
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {/* Comments list */}
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="cursor-pointer" onClick={() => { deferClose(); navigate(`/artist/${c.wallet_address}`); }}>
                    {c.profiles?.avatar_cid ? (
                      <img src={getIPFSGatewayUrl(c.profiles.avatar_cid)} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-xs">{c.profiles?.artist_name?.[0] || '?'}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-sm font-semibold cursor-pointer hover:text-neon-green" onClick={() => { deferClose(); navigate(`/artist/${c.wallet_address}`); }}>
                        {c.profiles?.artist_name || `${c.wallet_address.slice(0, 6)}...${c.wallet_address.slice(-4)}`}
                      </p>
                      {fullAddress && c.wallet_address?.toLowerCase() === fullAddress.toLowerCase() && (
                        <button
                          className="ml-auto text-white/60 hover:text-white disabled:opacity-50"
                          title="Delete comment"
                          disabled={deletingCommentId === c.id}
                          onClick={(e) => { e.stopPropagation(); handleDeleteComment(c.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-white/80">
                      <TaggedText text={c.comment_text} />
                    </div>
                    <p className="text-xs text-white/60 mt-1">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Viewers Drawer (owner only) */}
      {showViewers && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-black/80 backdrop-blur-md border-t border-white/10 max-h-[55%] overflow-y-auto">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white/90 font-semibold">Viewers</p>
              <button className="text-white/60 hover:text-white" onClick={() => setShowViewers(false)}>Close</button>
            </div>
            <div className="space-y-3">
              {viewers.length === 0 && <p className="text-white/60 text-sm">No viewers yet</p>}
              {viewers.map(v => (
                <div key={v.wallet_address} className="flex items-center gap-3">
                  {v.profiles?.avatar_cid ? (
                    <img src={getIPFSGatewayUrl(v.profiles.avatar_cid)} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary text-xs">{v.profiles?.artist_name?.[0] || v.wallet_address.slice(0,1)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white truncate text-sm">{v.profiles?.artist_name || `${v.wallet_address.slice(0,6)}...${v.wallet_address.slice(-4)}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryViewer;