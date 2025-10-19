import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MessageCircle, Share2, Image as ImageIcon, Send, CheckCircle, Check, CircleCheckBig, Music, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import StoriesBar from '@/components/StoriesBar';
import LikeButton from '@/components/LikeButton';
import { usePrivy } from '@privy-io/react-auth';
import TaggedText from '@/components/TaggedText';
import TagAutocomplete from '@/components/TagAutocomplete';
import { XRGETierBadge } from '@/components/XRGETierBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SongComments } from '@/components/SongComments';
import { AiBadge } from '@/components/AiBadge';
interface FeedComment {
  id: string;
  wallet_address: string;
  comment_text: string;
  created_at: string;
  profiles?: {
    artist_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
}
interface FeedPost {
  id: string;
  wallet_address: string;
  content_text: string | null;
  media_cid: string | null;
  media_type: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  profiles?: {
    artist_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
}

interface SongPost {
  id: string;
  title: string;
  artist: string;
  wallet_address: string;
  cover_cid: string | null;
  ticker: string | null;
  token_address: string | null;
  created_at: string;
  ai_usage?: 'none' | 'partial' | 'full' | null;
  profiles?: {
    artist_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
}
export default function Feed() {
  const navigate = useNavigate();
  const {
    fullAddress,
    isConnected
  } = useWallet();
  const { getAccessToken } = usePrivy();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [songs, setSongs] = useState<SongPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [songsPage, setSongsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);
  const ITEMS_PER_PAGE = 5;
  const [posting, setPosting] = useState(false);
  const [contentText, setContentText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [expandedSongComments, setExpandedSongComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [songCommentCounts, setSongCommentCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    loadPosts();
    loadSongs();
    if (isConnected && fullAddress) {
      loadLikedPosts();
    }
  }, [isConnected, fullAddress]);

  // Prefetch next page in background when user scrolls near bottom
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      
      // When user is 80% down the page, prefetch next batch
      if (scrollPosition >= pageHeight * 0.8) {
        if (hasMorePosts && !loadingMorePosts && !loading) {
          loadPosts(true);
        }
        if (hasMoreSongs && !loadingMoreSongs && !loadingSongs) {
          loadSongs(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMorePosts, hasMoreSongs, loadingMorePosts, loadingMoreSongs, loading, loadingSongs]);
  const loadPosts = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMorePosts(true);
      } else {
        setLoading(true);
      }

      const page = loadMore ? postsPage + 1 : 1;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const {
        data: postsData,
        error
      } = await supabase
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Check if there are more posts
      const hasMore = postsData && postsData.length === ITEMS_PER_PAGE;
      setHasMorePosts(hasMore);

      // Fetch profiles separately (case-insensitive matching)
      const walletAddresses = [...new Set(postsData?.map(p => p.wallet_address) || [])];
      let profilesData: { wallet_address: string; artist_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, avatar_cid, verified')
          .or(orFilter);
        profilesData = data || [];
      }
      
      console.log('Profiles data:', profilesData);

      // Merge data (normalize addresses to lowercase)
      const postsWithProfiles = postsData?.map(post => ({
        ...post,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === post.wallet_address?.toLowerCase()) || null
      })) || [];

      if (loadMore) {
        setPosts(prev => [...prev, ...(postsWithProfiles as FeedPost[])]);
        setPostsPage(page);
      } else {
        setPosts(postsWithProfiles as FeedPost[]);
        setPostsPage(1);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast({
        title: 'Error loading feed',
        description: 'Failed to load posts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingMorePosts(false);
    }
  };

  const loadSongs = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMoreSongs(true);
      } else {
        setLoadingSongs(true);
      }

      const page = loadMore ? songsPage + 1 : 1;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data: songsData, error } = await supabase
        .from('songs')
        .select('id, title, artist, wallet_address, cover_cid, ticker, token_address, created_at, ai_usage')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Check if there are more songs
      const hasMore = songsData && songsData.length === ITEMS_PER_PAGE;
      setHasMoreSongs(hasMore);

      // Fetch profiles separately (case-insensitive matching)
      const walletAddresses = [...new Set(songsData?.map(s => s.wallet_address) || [])];
      let profilesData: { wallet_address: string; artist_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, avatar_cid, verified')
          .or(orFilter);
        profilesData = data || [];
      }

      // Merge data (normalize addresses to lowercase)
      const songsWithProfiles = songsData?.map(song => ({
        ...song,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === song.wallet_address?.toLowerCase()) || null
      })) || [];

      if (loadMore) {
        setSongs(prev => [...prev, ...(songsWithProfiles as SongPost[])]);
        setSongsPage(page);
      } else {
        setSongs(songsWithProfiles as SongPost[]);
        setSongsPage(1);
      }
    } catch (error) {
      console.error('Error loading songs:', error);
      toast({
        title: 'Error loading songs',
        description: 'Failed to load songs',
        variant: 'destructive'
      });
    } finally {
      setLoadingSongs(false);
      setLoadingMoreSongs(false);
    }
  };

  const loadLikedPosts = async () => {
    if (!fullAddress) return;
    try {
      const {
        data,
        error
      } = await supabase.from('feed_likes').select('post_id').eq('wallet_address', fullAddress);
      if (error) throw error;
      setLikedPosts(new Set(data?.map(like => like.post_id) || []));
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handlePost = async () => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to post',
        variant: 'destructive'
      });
      return;
    }
    if (!contentText && !mediaFile) {
      toast({
        title: 'Empty post',
        description: 'Please add text or media',
        variant: 'destructive'
      });
      return;
    }
    setPosting(true);
    try {
      const token = await getAccessToken();
      
      const formData = new FormData();
      if (contentText) formData.append('content_text', contentText);
      if (mediaFile) formData.append('media', mediaFile);
      if (fullAddress) formData.append('walletAddress', fullAddress);
      
      const response = await fetch('https://phybdsfwycygroebrsdx.supabase.co/functions/v1/create-feed-post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create post');
      }
      toast({
        title: 'Posted!',
        description: 'Your post was uploaded to IPFS and published'
      });
      setContentText('');
      setMediaFile(null);
      setMediaPreview(null);
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Post failed',
        description: error instanceof Error ? error.message : 'Failed to create post',
        variant: 'destructive'
      });
    } finally {
      setPosting(false);
    }
  };
  const toggleComments = async (postId: string) => {
    const isExpanded = expandedComments.has(postId);
    if (isExpanded) {
      setExpandedComments(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } else {
      setExpandedComments(prev => new Set(prev).add(postId));
      await loadComments(postId);
    }
  };

  const toggleSongComments = (songId: string) => {
    const isExpanded = expandedSongComments.has(songId);
    if (isExpanded) {
      setExpandedSongComments(prev => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    } else {
      setExpandedSongComments(prev => new Set(prev).add(songId));
    }
  };
  const loadComments = async (postId: string) => {
    try {
      const {
        data: commentsData,
        error
      } = await supabase.from('feed_comments').select('*').eq('post_id', postId).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Fetch profiles for comment authors (case-insensitive)
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
      
      console.log('Comment profiles data:', profilesData);
      const commentsWithProfiles = commentsData?.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === comment.wallet_address?.toLowerCase()) || null
      })) || [];
      setComments(prev => ({
        ...prev,
        [postId]: commentsWithProfiles as FeedComment[]
      }));

      // Sync the comment count with actual comments after loading
      setPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === postId 
            ? { ...p, comment_count: commentsData?.length || 0 }
            : p
        )
      );
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };
  const handleAddComment = async (postId: string) => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to comment',
        variant: 'destructive'
      });
      return;
    }
    const text = commentText[postId]?.trim();
    if (!text) return;
    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('add-comment', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          postId,
          commentText: text,
          walletAddress: fullAddress,
        },
      });
      if (error) throw error;
      setCommentText(prev => ({
        ...prev,
        [postId]: ''
      }));
      await loadComments(postId);
      loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Failed to add comment',
        variant: 'destructive'
      });
    }
  };
  const toggleLike = async (postId: string) => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to like posts',
        variant: 'destructive'
      });
      return;
    }
    const isLiked = likedPosts.has(postId);
    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('like-post', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { 
          postId, 
          action: isLiked ? 'unlike' : 'like' 
        },
      });
      
      if (error) throw error;

      if (isLiked) {
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        setLikedPosts(prev => new Set(prev).add(postId));
      }
      loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };
  const handleSharePost = async (post: FeedPost) => {
    const url = `https://rougee.app/feed#post-${post.id}`;
    const text = post.content_text ? post.content_text.slice(0, 140) : 'Check out this post on ROUGEE PLAY';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ROUGEE PLAY', text, url });
        toast({ title: 'Shared', description: 'Post shared successfully' });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedPostId(post.id);
        toast({ title: 'Link copied', description: 'Post link copied to clipboard' });
        setTimeout(() => setCopiedPostId(null), 1200);
      }
    } catch (_) {
      // ignore cancel
    }
  };
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  return <>
      <StoriesBar />
      <div className="min-h-screen bg-background pt-20 md:pt-32 pb-24 md:pb-32 px-0 md:px-4">
        <div className="w-full md:max-w-7xl md:mx-auto">
          <div className="text-center mb-6 md:mb-8 px-4">
            <h1 className="text-4xl font-bold mb-2 glitch-text">GLTCH Feed</h1>
            <p className="text-muted-foreground">Decentralized social feed on IPFS</p>
          </div>

          {/* Post Creator */}
          {isConnected && <Card className="relative z-50 p-4 md:p-6 space-y-4 bg-card/50 backdrop-blur-sm border-tech-border w-full md:max-w-2xl md:mx-auto mb-6 md:rounded-lg rounded-none border-x-0 md:border-x">
              <TagAutocomplete
                value={contentText}
                onChange={setContentText}
                placeholder="What's on your mind? Use $ to tag artists and songs..."
                className="min-h-[100px] resize-none w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />

              {mediaPreview && <div className="relative">
                  <img src={mediaPreview} alt="Preview" className="max-h-64 rounded-lg mx-auto" />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => {
              setMediaFile(null);
              setMediaPreview(null);
            }}>
                    Remove
                  </Button>
                </div>}

              <div className="flex gap-2">
                <Input type="file" accept="image/*,video/*" onChange={handleMediaChange} className="hidden" id="media-upload" />
                <label htmlFor="media-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Add Media
                    </span>
                  </Button>
                </label>

                <Button onClick={handlePost} disabled={posting || !contentText && !mediaFile} className="ml-auto">
                  <Send className="w-4 h-4 mr-2" />
                  {posting ? 'Posting to IPFS...' : 'Post'}
                </Button>
              </div>
            </Card>}

          {/* Feed with Tabs */}
          <Tabs defaultValue="posts" className="w-full md:max-w-2xl md:mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-6 mx-auto max-w-xs md:max-w-full md:mx-0 md:rounded-lg rounded-md">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="songs">Songs</TabsTrigger>
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-0 md:space-y-4">
              {loading ? <div className="text-center py-8 text-muted-foreground px-4">Loading feed...</div> : posts.length === 0 ? <div className="text-center py-8 text-muted-foreground px-4">
                  No posts yet. Be the first to post!
                </div> : posts.map(post => <Card key={post.id} className="p-4 bg-card/50 backdrop-blur-sm border-tech-border flex flex-col w-full md:rounded-lg rounded-none border-x-0 md:border-x border-b md:border-b mb-0 md:mb-4">
                  {/* Post Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/artist/${post.wallet_address}`)}
                    >
                      {post.profiles?.avatar_cid ? <img src={getIPFSGatewayUrl(post.profiles.avatar_cid)} alt="Avatar" loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary text-xs">
                            {post.profiles?.artist_name?.[0] || '?'}
                          </span>
                        </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p 
                          className="font-semibold text-sm cursor-pointer hover:text-neon-green transition-colors"
                          onClick={() => navigate(`/artist/${post.wallet_address}`)}
                        >
                          {post.profiles?.artist_name || `${post.wallet_address.slice(0, 6)}...${post.wallet_address.slice(-4)}`}
                        </p>
                        {post.profiles?.verified && (
                          <CircleCheckBig className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" aria-label="Verified artist" />
                        )}
                        <XRGETierBadge walletAddress={post.wallet_address} size="sm" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.content_text && (
                    <div className="mb-3 text-sm whitespace-pre-wrap line-clamp-6">
                      <TaggedText text={post.content_text} />
                    </div>
                  )}

                  {/* Post Media */}
                  {post.media_cid && <div className="mb-3 rounded-lg overflow-hidden">
                      {post.media_type === 'image' ? <img src={getIPFSGatewayUrl(post.media_cid)} alt="Post media" loading="lazy" decoding="async" className="w-full max-h-[600px] object-contain bg-black/5 rounded-lg" /> : post.media_type === 'video' ? <video src={getIPFSGatewayUrl(post.media_cid)} controls preload="metadata" className="w-full max-h-[600px] object-contain rounded-lg" /> : null}
                    </div>}

                  {/* Post Actions */}
                  <div className="flex items-center gap-4 pt-3 mt-auto border-t border-border">
                    <LikeButton songId={post.id} initialLikeCount={post.like_count} size="sm" showCount={true} entityType="post" />

                    <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      <span>{comments[post.id]?.length || post.comment_count || 0}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSharePost(post)}
                        title="Share"
                      >
                        {copiedPostId === post.id ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {expandedComments.has(post.id) && <div className="pt-4 mt-4 border-t border-border space-y-4">
                      {/* Add Comment */}
                      {isConnected && <div className="flex gap-2">
                          <Input placeholder="Add a comment..." value={commentText[post.id] || ''} onChange={e => setCommentText(prev => ({
                  ...prev,
                  [post.id]: e.target.value
                }))} onKeyPress={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(post.id);
                  }
                }} className="flex-1 text-base" />
                          <Button size="sm" onClick={() => handleAddComment(post.id)} disabled={!commentText[post.id]?.trim()}>
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>}

                      {/* Comments List */}
                      <div className="space-y-3">
                        {comments[post.id]?.map(comment => <div key={comment.id} className="flex gap-3">
                            <div 
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => navigate(`/artist/${comment.wallet_address}`)}
                            >
                              {comment.profiles?.avatar_cid ? <img src={getIPFSGatewayUrl(comment.profiles.avatar_cid)} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-primary text-xs">
                                    {comment.profiles?.artist_name?.[0] || '?'}
                                  </span>
                                </div>}
                            </div>
                            <div className="flex-1">
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
                              <div className="text-sm text-muted-foreground">
                                <TaggedText text={comment.comment_text} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimeAgo(comment.created_at)}
                              </p>
                        </div>
                      </div>)}
                  </div>
                </div>}
            </Card>)}

              {/* Load More Posts Button */}
              {!loading && posts.length > 0 && hasMorePosts && (
                <div className="flex justify-center py-4 px-4 md:px-0 md:pt-4">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      loadPosts(true);
                    }}
                    type="button"
                    disabled={loadingMorePosts}
                    variant="outline"
                    size="lg"
                    className="w-full md:max-w-md"
                  >
                    {loadingMorePosts ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Songs Tab */}
            <TabsContent value="songs" className="space-y-0 md:space-y-4">
              {loadingSongs ? (
                <div className="text-center py-8 text-muted-foreground px-4">Loading songs...</div>
              ) : songs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  No songs uploaded yet.
                </div>
              ) : (
                songs.map(song => (
                  <Card key={song.id} className="p-4 bg-card/50 backdrop-blur-sm border-tech-border w-full md:rounded-lg rounded-none border-x-0 md:border-x border-b md:border-b mb-0 md:mb-4">
                    {/* Song Post Header */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Artist Avatar */}
                      <div 
                        className="flex-shrink-0 cursor-pointer"
                        onClick={() => navigate(`/artist/${song.wallet_address}`)}
                      >
                        {song.profiles?.avatar_cid ? (
                          <img
                            src={getIPFSGatewayUrl(song.profiles.avatar_cid)}
                            alt="Avatar"
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary text-sm">
                              {song.profiles?.artist_name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Artist Name and Action */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <p 
                            className="font-semibold text-sm cursor-pointer hover:text-neon-green transition-colors"
                            onClick={() => navigate(`/artist/${song.wallet_address}`)}
                          >
                            {song.profiles?.artist_name || `${song.wallet_address.slice(0, 6)}...${song.wallet_address.slice(-4)}`}
                          </p>
                          {song.profiles?.verified && (
                            <CircleCheckBig className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" aria-label="Verified artist" />
                          )}
                          <XRGETierBadge walletAddress={song.wallet_address} size="sm" />
                          <span className="text-xs text-muted-foreground">posted a track</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(song.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Song Content */}
                    <div 
                      className="flex gap-3 mb-3 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
                    >
                      {/* Album Cover */}
                      {song.cover_cid ? (
                        <img
                          src={getIPFSGatewayUrl(song.cover_cid)}
                          alt={song.title}
                          loading="lazy"
                          decoding="async"
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Music className="w-8 h-8 text-primary" />
                        </div>
                      )}

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base mb-1 truncate flex items-center gap-2">
                          <span className="truncate">{song.title}</span>
                          <AiBadge aiUsage={song.ai_usage} size="sm" />
                        </h3>
                        <p className="text-sm text-muted-foreground mb-1">
                          {song.artist}
                        </p>
                        {song.ticker && (
                          <p className="text-xs text-neon-green font-mono">
                            ${song.ticker}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Song Actions */}
                    <div className="flex items-center gap-4 pt-3 border-t border-border">
                      <LikeButton 
                        songId={song.id} 
                        size="sm" 
                        showCount={true} 
                      />

                      <button 
                        onClick={() => toggleSongComments(song.id)} 
                        className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{songCommentCounts[song.id] || 0}</span>
                      </button>

                      {song.token_address && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/song/${song.id}`)}
                          className="ml-auto"
                        >
                          Trade
                        </Button>
                      )}
                    </div>

                    {/* Comments Section */}
                    {expandedSongComments.has(song.id) && (
                      <div className="mt-4 pt-4 border-t border-primary/10">
                        <SongComments 
                          songId={song.id} 
                          onCommentCountChange={(count) => {
                            setSongCommentCounts(prev => ({ ...prev, [song.id]: count }));
                          }}
                        />
                      </div>
                    )}
                  </Card>
                ))
              )}

              {/* Load More Songs Button */}
              {!loadingSongs && songs.length > 0 && hasMoreSongs && (
                <div className="flex justify-center py-4 px-4 md:px-0 md:pt-4">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      loadSongs(true);
                    }}
                    type="button"
                    disabled={loadingMoreSongs}
                    variant="outline"
                    size="lg"
                    className="w-full md:max-w-md"
                  >
                    {loadingMoreSongs ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>;
}