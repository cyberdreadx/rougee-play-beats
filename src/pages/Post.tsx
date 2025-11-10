import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pause, Play, Share2, Check, Music, MessageCircle, Loader2, CircleCheckBig } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useWallet } from "@/hooks/useWallet";
import LikeButton from "@/components/LikeButton";
import TaggedText from "@/components/TaggedText";
import { XRGETierBadge } from "@/components/XRGETierBadge";

interface SongLite {
  id: string;
  title: string;
  artist: string | null;
  audio_cid: string | null;
  cover_cid: string | null;
}

interface FeedComment {
  id: string;
  wallet_address: string;
  comment_text: string;
  created_at: string;
  profiles?: { artist_name: string | null; avatar_cid: string | null } | null;
}

interface FeedPost {
  id: string;
  content_text: string | null;
  media_cid: string | null;
  wallet_address: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  songs?: SongLite | null;
  profiles?: { artist_name: string | null; avatar_cid: string | null; verified?: boolean | null } | null;
}

interface PostProps {
  playSong: (song: any) => void;
  currentSong: any;
  isPlaying: boolean;
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function PostPage({ playSong, currentSong, isPlaying }: PostProps) {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { fullAddress } = useWallet();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!postId) return;
      setLoading(true);
      try {
        const { data: p } = await supabase
          .from('feed_posts')
          .select(`id, content_text, media_cid, wallet_address, created_at, like_count, comment_count, songs ( id, title, artist, audio_cid, cover_cid )`)
          .eq('id', postId)
          .maybeSingle();
        if (p) {
          // fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_address, artist_name, avatar_cid, verified')
            .ilike('wallet_address', p.wallet_address)
            .maybeSingle();
          setPost({ ...(p as any), profiles: profile } as FeedPost);
        } else {
          setPost(null);
        }
        await loadComments(postId);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId]);

  const loadComments = async (pid: string) => {
    const { data: commentsData } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('post_id', pid)
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
    setComments(prev => ({ ...prev, [pid]: withProfiles }));
  };

  const handleAddComment = async () => {
    if (!post) return;
    const text = commentText[post.id]?.trim();
    if (!text) return;
    if (!fullAddress) return;
    await supabase.from('feed_comments').insert({
      post_id: post.id,
      wallet_address: fullAddress,
      comment_text: text,
    });
    setCommentText(prev => ({ ...prev, [post.id]: '' }));
    await loadComments(post.id);
  };

  const share = async () => {
    if (!post) return;
    const url = `https://rougee.app/post/${post.id}`;
    const text = post.content_text ? post.content_text.slice(0, 140) : 'Check out this post on ROUGEE';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ROUGEE', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading || !post ? (
          <Card className="p-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-center">
            <div className="flex items-center gap-2 justify-center text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading post...
            </div>
          </Card>
        ) : (
          <Card className="p-4 md:p-6 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl border border-white/10 rounded-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="cursor-pointer hover:scale-110 transition-transform duration-200 relative"
                onClick={() => navigate(`/artist/${post.wallet_address}`)}
              >
                {post.profiles?.avatar_cid ? (
                  <img src={getIPFSGatewayUrl(post.profiles.avatar_cid)} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-neon-green/20" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center border-2 border-neon-green/20">
                    <span className="text-neon-green text-base font-bold">{post.profiles?.artist_name?.[0] || '?'}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-base cursor-pointer hover:text-neon-green" onClick={() => navigate(`/artist/${post.wallet_address}`)}>
                    {post.profiles?.artist_name || `${post.wallet_address.slice(0, 6)}...${post.wallet_address.slice(-4)}`}
                  </p>
                  <XRGETierBadge walletAddress={post.wallet_address} size="sm" />
                  {post.profiles?.verified && <CircleCheckBig className="h-4 w-4 text-blue-500" />}
                </div>
                <p className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={share} title="Share">
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              </Button>
            </div>

            {/* Text (when not in post-it variant) */}
            {post.content_text && !(post.songs && !post.media_cid) && (
              <div className="mb-4 text-sm md:text-base whitespace-pre-wrap text-foreground/90 leading-relaxed">
                <TaggedText text={post.content_text} />
              </div>
            )}

            {/* Media + song overlay */}
            {post.media_cid && post.songs && (
              <div className="mb-4 rounded-xl overflow-hidden relative">
                <img src={getIPFSGatewayUrl(post.media_cid)} alt="Post media" className="w-full max-h-[600px] object-contain bg-black/10 rounded-xl" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <button
                    onClick={() => playSong({
                      id: post.songs!.id, title: post.songs!.title, artist: post.songs!.artist, audio_cid: post.songs!.audio_cid!, cover_cid: post.songs!.cover_cid, wallet_address: post.wallet_address
                    })}
                    className="pointer-events-auto bg-black/70 backdrop-blur-md hover:bg-black/90 transition-all duration-300 p-6 md:p-8 rounded-full border-2 border-white/20"
                  >
                    {currentSong?.id === post.songs!.id && isPlaying ? (
                      <Pause className="w-12 h-12 md:w-16 md:h-16 text-white" />
                    ) : (
                      <Play className="w-12 h-12 md:w-16 md:h-16 text-white ml-1" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Media only */}
            {post.media_cid && !post.songs && (
              <div className="mb-4 rounded-xl overflow-hidden relative">
                <img src={getIPFSGatewayUrl(post.media_cid)} alt="Post media" className="w-full max-h-[600px] object-contain bg-black/10 rounded-xl" />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 pt-3 mt-auto border-t border-border">
              <LikeButton songId={post.id} initialLikeCount={post.like_count} size="sm" showCount={true} entityType="post" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                <span>{comments[post.id]?.length || post.comment_count || 0}</span>
              </div>
            </div>

            {/* Comments */}
            <div className="pt-4 mt-4 border-t border-border space-y-4">
              {fullAddress && (
                <div className="flex gap-2">
                  <Input placeholder="Add a comment..." value={commentText[post.id] || ''} onChange={e => setCommentText(prev => ({
                    ...prev,
                    [post.id]: e.target.value
                  }))} onKeyPress={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }} className="flex-1 text-base" />
                  <Button size="sm" onClick={handleAddComment} disabled={!commentText[post.id]?.trim()}>
                    <Loader2 className="w-4 h-4 hidden" />
                    Send
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {comments[post.id]?.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate(`/artist/${comment.wallet_address}`)}>
                      {comment.profiles?.avatar_cid ? (
                        <img src={getIPFSGatewayUrl(comment.profiles.avatar_cid)} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary text-xs">{comment.profiles?.artist_name?.[0] || '?'}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-sm font-semibold cursor-pointer hover:text-neon-green" onClick={() => navigate(`/artist/${comment.wallet_address}`)}>
                          {comment.profiles?.artist_name || `${comment.wallet_address.slice(0, 6)}...${comment.wallet_address.slice(-4)}`}
                        </p>
                        <XRGETierBadge walletAddress={comment.wallet_address} size="sm" />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <TaggedText text={comment.comment_text} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(comment.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


