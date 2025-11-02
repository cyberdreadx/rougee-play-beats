import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, AlertTriangle, Music, Trash2, ExternalLink, CheckCircle2, XCircle,
  Users, BarChart3, Shield, MessageSquare, Eye, Ban, Activity, TrendingUp
} from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePrivy } from '@privy-io/react-auth';

interface SongReport {
  id: string;
  song_id: string;
  wallet_address: string;
  report_type: "copyright" | "hate_speech" | "other";
  description: string | null;
  created_at: string;
  songs: {
    title: string;
    artist: string | null;
    cover_cid: string | null;
  };
}

interface VerificationRequest {
  id: string;
  wallet_address: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  admin_notes: string | null;
  requested_at: string;
  profiles: {
    artist_name: string | null;
    display_name: string | null;
    avatar_cid: string | null;
  } | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { getAccessToken } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<SongReport[]>([]);
  const [deletingReports, setDeletingReports] = useState<Set<string>>(new Set());
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  
  // Analytics state
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSongs: 0,
    totalPlays: 0,
    totalPosts: 0,
    verifiedArtists: 0,
    pendingReports: 0
  });
  
  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  
  // Content management state
  const [songs, setSongs] = useState<any[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [updatingAiUsage, setUpdatingAiUsage] = useState<Set<string>>(new Set());
  
  // Security monitoring state
  const [ipLogs, setIpLogs] = useState<any[]>([]);
  const [suspiciousActivity, setSuspiciousActivity] = useState<any[]>([]);

  useEffect(() => {
    if (isPrivyReady) {
      checkAdminAccess();
    }
  }, [fullAddress, isPrivyReady]);

  const checkAdminAccess = async () => {
    // Wait for Privy to be ready
    if (!isPrivyReady) return;
    
    try {
      if (!isConnected || !fullAddress) {
        toast({
          title: "Access Denied",
          description: "Please connect your wallet",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      const walletLower = fullAddress.toLowerCase();
      const { data: isAdminResp, error } = await supabase
        .rpc('is_admin', { check_wallet: walletLower });

      if (error || !isAdminResp) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchAllData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchReports(),
      fetchVerificationRequests(),
      fetchUsers(),
      fetchSongs(),
      fetchFeedPosts(),
      fetchIPLogs(),
      fetchSuspiciousActivity()
    ]);
  };

  const fetchStats = async () => {
    try {
      const [usersRes, songsRes, feedRes, verifiedRes, reportsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('songs').select('id, play_count', { count: 'exact' }),
        supabase.from('feed_posts').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verified', true),
        supabase.from('song_reports').select('id', { count: 'exact', head: true })
      ]);

      const totalPlays = songsRes.data?.reduce((sum, song) => sum + (song.play_count || 0), 0) || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalSongs: songsRes.count || 0,
        totalPlays,
        totalPosts: feedRes.count || 0,
        verifiedArtists: verifiedRes.count || 0,
        pendingReports: reportsRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSongs(data || []);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const fetchFeedPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFeedPosts(data || []);
    } catch (error) {
      console.error('Error fetching feed posts:', error);
    }
  };

  const fetchIPLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_ip_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setIpLogs(data || []);
    } catch (error) {
      console.error('Error fetching IP logs:', error);
    }
  };

  const fetchSuspiciousActivity = async () => {
    try {
      // Find IPs with multiple wallet addresses
      const { data, error } = await supabase
        .rpc('get_wallets_by_ip', { check_ip: '0.0.0.0' });

      if (error) throw error;
      
      // Get IPs with 3+ wallets
      const suspicious = ipLogs.reduce((acc: any[], log) => {
        const existing = acc.find(item => item.ip_address === log.ip_address);
        if (existing) {
          if (!existing.wallets.includes(log.wallet_address)) {
            existing.wallets.push(log.wallet_address);
            existing.count++;
          }
        } else {
          acc.push({
            ip_address: log.ip_address,
            wallets: [log.wallet_address],
            count: 1,
            country: log.country
          });
        }
        return acc;
      }, []).filter(item => item.count >= 3);

      setSuspiciousActivity(suspicious);
    } catch (error) {
      console.error('Error fetching suspicious activity:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("song_reports")
        .select(`
          *,
          songs (
            title,
            artist,
            cover_cid
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSong = async (songId: string, reportId: string) => {
    if (!confirm("Are you sure you want to delete this song? This action cannot be undone.")) {
      return;
    }

    setDeletingReports(new Set(deletingReports).add(reportId));

    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('admin-delete-song', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { songId },
      });

      if (error) throw error;

      toast({
        title: "Song Deleted",
        description: "The reported song has been removed",
      });

      fetchReports();
    } catch (error) {
      console.error("Error deleting song:", error);
      toast({
        title: "Error",
        description: "Failed to delete song",
        variant: "destructive",
      });
    } finally {
      const newSet = new Set(deletingReports);
      newSet.delete(reportId);
      setDeletingReports(newSet);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('admin-delete-report', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { reportId },
      });

      if (error) throw error;

      toast({
        title: "Report Dismissed",
        description: "The report has been removed",
      });

      setReports(reports.filter(r => r.id !== reportId));
    } catch (error) {
      console.error("Error dismissing report:", error);
      toast({
        title: "Error",
        description: "Failed to dismiss report",
        variant: "destructive",
      });
    }
  };

  const fetchVerificationRequests = async () => {
    try {
      if (!fullAddress) {
        console.warn('⚠️ No wallet address available for fetching verification requests');
        return;
      }
      
      console.log('🔍 Fetching verification requests for admin:', fullAddress);
      
      const token = await getAccessToken();
      console.log('✅ Got access token, invoking edge function...');
      
      const { data, error } = await supabase.functions.invoke('admin-get-verification-requests', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-privy-token': token,
          'x-wallet-address': fullAddress.toLowerCase(),
        },
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      console.log('✅ Verification requests response:', data);
      
      const requestsData = (data as any)?.data ?? (Array.isArray(data) ? data : []);
      console.log('📋 Parsed verification requests:', requestsData);
      
      setVerificationRequests(requestsData);
    } catch (error) {
      console.error('❌ Error fetching verification requests:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      toast({
        title: "Error",
        description: `Failed to load verification requests: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleVerificationDecision = async (requestId: string, walletAddress: string, approved: boolean) => {
    setProcessingRequests(new Set(processingRequests).add(requestId));
    
    try {
      console.log('Processing verification decision:', { requestId, walletAddress, approved });
      
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('admin-process-verification', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-privy-token': token,
          'x-wallet-address': fullAddress.toLowerCase(),
        },
        body: { 
          requestId, 
          action: approved ? 'approve' : 'reject',
          adminNotes: adminNotes[requestId] || null
        },
      });

      if (error) throw error;

      toast({
        title: approved ? "Request Approved" : "Request Rejected",
        description: approved 
          ? "User has been verified successfully"
          : "Verification request has been rejected",
      });

      await fetchAllData();
    } catch (error) {
      console.error('Error processing verification:', error);
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      });
    } finally {
      const newSet = new Set(processingRequests);
      newSet.delete(requestId);
      setProcessingRequests(newSet);
    }
  };

  const handleUpdateAiUsage = async (songId: string, aiUsage: 'none' | 'partial' | 'full') => {
    setUpdatingAiUsage(new Set(updatingAiUsage).add(songId));

    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('admin-update-song-ai-usage', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-wallet-address': fullAddress.toLowerCase(),
        },
        body: { songId, aiUsage },
      });

      if (error) throw error;

      toast({
        title: "AI Usage Updated",
        description: `Song AI label updated to: ${aiUsage}`,
      });

      // Update local state
      setSongs(songs.map(song => 
        song.id === songId ? { ...song, ai_usage: aiUsage } : song
      ));
    } catch (error) {
      console.error('Error updating AI usage:', error);
      toast({
        title: "Error",
        description: "Failed to update AI usage",
        variant: "destructive",
      });
    } finally {
      const newSet = new Set(updatingAiUsage);
      newSet.delete(songId);
      setUpdatingAiUsage(newSet);
    }
  };

  const getReportTypeBadge = (type: string) => {
    const variants = {
      copyright: "destructive",
      hate_speech: "destructive",
      other: "secondary",
    } as const;

    return (
      <Badge variant={variants[type as keyof typeof variants] || "secondary"}>
        {type.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const groupedReports = {
    copyright: reports.filter(r => r.report_type === "copyright"),
    hate_speech: reports.filter(r => r.report_type === "hate_speech"),
    other: reports.filter(r => r.report_type === "other"),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center gap-2 md:gap-3 mb-6 md:mb-8">
          <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-neon-green" />
          <h1 className="text-2xl md:text-3xl font-mono font-bold neon-text">ADMIN PANEL</h1>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full grid grid-cols-4 md:grid-cols-8 gap-1 mb-4 md:mb-6 bg-black/40 p-1 rounded-lg overflow-x-auto">
            <TabsTrigger value="dashboard" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">DASHBOARD</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">REPORTS ({reports.length})</span>
              <span className="sm:hidden">{reports.length}</span>
            </TabsTrigger>
            <TabsTrigger value="verification" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">VERIFY ({verificationRequests.filter(r => r.status === 'pending').length})</span>
              <span className="sm:hidden">{verificationRequests.filter(r => r.status === 'pending').length}</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">USERS ({users.length})</span>
              <span className="sm:hidden">{users.length}</span>
            </TabsTrigger>
            <TabsTrigger value="songs" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <Music className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">SONGS ({songs.length})</span>
              <span className="sm:hidden">{songs.length}</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">POSTS ({feedPosts.length})</span>
              <span className="sm:hidden">{feedPosts.length}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <Shield className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">SECURITY</span>
              <span className="sm:hidden">Sec</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 md:px-3 whitespace-nowrap">
              <Activity className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">ACTIVITY</span>
              <span className="sm:hidden">Act</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Card className="console-bg tech-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL USERS</p>
                    <p className="text-3xl font-mono font-bold neon-text">{stats.totalUsers}</p>
                  </div>
                  <Users className="h-12 w-12 text-neon-green opacity-50" />
                </div>
              </Card>

              <Card className="console-bg tech-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL SONGS</p>
                    <p className="text-3xl font-mono font-bold neon-text">{stats.totalSongs}</p>
                  </div>
                  <Music className="h-12 w-12 text-neon-green opacity-50" />
                </div>
              </Card>

              <Card className="console-bg tech-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL PLAYS</p>
                    <p className="text-3xl font-mono font-bold neon-text">{stats.totalPlays.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-12 w-12 text-neon-green opacity-50" />
                </div>
              </Card>

              <Card className="console-bg tech-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL POSTS</p>
                    <p className="text-3xl font-mono font-bold neon-text">{stats.totalPosts}</p>
                  </div>
                  <MessageSquare className="h-12 w-12 text-neon-green opacity-50" />
                </div>
              </Card>

              <Card className="console-bg tech-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">VERIFIED ARTISTS</p>
                    <p className="text-3xl font-mono font-bold neon-text">{stats.verifiedArtists}</p>
                  </div>
                  <CheckCircle2 className="h-12 w-12 text-neon-green opacity-50" />
                </div>
              </Card>

              <Card className="console-bg tech-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-1">PENDING REPORTS</p>
                    <p className="text-3xl font-mono font-bold neon-text">{stats.pendingReports}</p>
                  </div>
                  <AlertTriangle className="h-12 w-12 text-neon-green opacity-50" />
                </div>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="console-bg tech-border p-6">
              <h3 className="font-mono font-bold text-lg mb-4 neon-text">RECENT ACTIVITY</h3>
              <div className="space-y-3">
                {ipLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-background/50 rounded border border-border">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-neon-green" />
                      <div className="font-mono text-sm">
                        <p className="text-foreground">{log.wallet_address?.slice(0, 10)}...</p>
                        <p className="text-muted-foreground text-xs">{log.action} • {log.ip_address}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="console-bg tech-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">WALLET</TableHead>
                    <TableHead className="font-mono">ARTIST NAME</TableHead>
                    <TableHead className="font-mono">ROLE</TableHead>
                    <TableHead className="font-mono">VERIFIED</TableHead>
                    <TableHead className="font-mono">SONGS</TableHead>
                    <TableHead className="font-mono">PLAYS</TableHead>
                    <TableHead className="font-mono">JOINED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-xs">
                        {user.wallet_address?.slice(0, 8)}...{user.wallet_address?.slice(-6)}
                      </TableCell>
                      <TableCell className="font-mono">{user.artist_name || user.display_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {user.role?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.verified ? (
                          <CheckCircle2 className="h-4 w-4 text-neon-green" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{user.total_songs || 0}</TableCell>
                      <TableCell className="font-mono">{user.total_plays || 0}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Songs Tab */}
          <TabsContent value="songs">
            <Card className="console-bg tech-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">TITLE</TableHead>
                    <TableHead className="font-mono">ARTIST</TableHead>
                    <TableHead className="font-mono">GENRE</TableHead>
                    <TableHead className="font-mono">AI USAGE</TableHead>
                    <TableHead className="font-mono">PLAYS</TableHead>
                    <TableHead className="font-mono">UPLOADED</TableHead>
                    <TableHead className="font-mono">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {songs.map((song) => (
                    <TableRow key={song.id}>
                      <TableCell className="font-mono font-medium">{song.title}</TableCell>
                      <TableCell className="font-mono">{song.artist || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {song.genre || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          value={song.ai_usage || 'none'}
                          onChange={(e) => handleUpdateAiUsage(song.id, e.target.value as 'none' | 'partial' | 'full')}
                          disabled={updatingAiUsage.has(song.id)}
                          className="h-8 w-28 rounded border border-border bg-background px-2 text-xs font-mono disabled:opacity-50"
                        >
                          <option value="none">No AI</option>
                          <option value="partial">Partial</option>
                          <option value="full">Full AI</option>
                        </select>
                      </TableCell>
                      <TableCell className="font-mono">{song.play_count || 0}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(song.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/song/${song.id}`)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts">
            <div className="space-y-4">
              {feedPosts.map((post) => (
                <Card key={post.id} className="console-bg tech-border p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-mono text-xs text-muted-foreground mb-2">
                        {post.wallet_address?.slice(0, 10)}...
                      </p>
                      <p className="font-mono mb-3">{post.content_text}</p>
                      <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                        <span>❤️ {post.like_count}</span>
                        <span>💬 {post.comment_count}</span>
                        <span>{new Date(post.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="console-bg tech-border p-6 mb-6">
              <h3 className="font-mono font-bold text-lg mb-4 neon-text flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                SUSPICIOUS ACTIVITY
              </h3>
              <div className="space-y-3">
                {suspiciousActivity.map((activity, idx) => (
                  <div key={idx} className="p-4 bg-destructive/10 border border-destructive/50 rounded">
                    <div className="font-mono text-sm">
                      <p className="text-foreground font-bold mb-2">
                        IP: {activity.ip_address} ({activity.country || 'Unknown'})
                      </p>
                      <p className="text-muted-foreground mb-2">
                        {activity.count} wallet addresses detected:
                      </p>
                      <div className="space-y-1">
                        {activity.wallets.map((wallet: string, i: number) => (
                          <p key={i} className="text-xs text-foreground/80">
                            {wallet}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {suspiciousActivity.length === 0 && (
                  <p className="text-center font-mono text-muted-foreground py-8">
                    No suspicious activity detected
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity">
            <Card className="console-bg tech-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">WALLET</TableHead>
                    <TableHead className="font-mono">ACTION</TableHead>
                    <TableHead className="font-mono">IP ADDRESS</TableHead>
                    <TableHead className="font-mono">LOCATION</TableHead>
                    <TableHead className="font-mono">TIMESTAMP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {log.wallet_address?.slice(0, 8)}...{log.wallet_address?.slice(-6)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ip_address}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.city && log.country ? `${log.city}, ${log.country}` : log.country || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <ReportsList 
              reports={reports}
              onDeleteSong={handleDeleteSong}
              onDismissReport={handleDismissReport}
              deletingReports={deletingReports}
              getReportTypeBadge={getReportTypeBadge}
            />
          </TabsContent>

          <TabsContent value="verification">
            <VerificationRequests
              requests={verificationRequests.filter(r => r.status === 'pending')}
              onApprove={(id, wallet) => handleVerificationDecision(id, wallet, true)}
              onReject={(id, wallet) => handleVerificationDecision(id, wallet, false)}
              processingRequests={processingRequests}
              adminNotes={adminNotes}
              setAdminNotes={setAdminNotes}
            />
          </TabsContent>

          <TabsContent value="all">
            <ReportsList 
              reports={reports}
              onDeleteSong={handleDeleteSong}
              onDismissReport={handleDismissReport}
              deletingReports={deletingReports}
              getReportTypeBadge={getReportTypeBadge}
            />
          </TabsContent>

          <TabsContent value="copyright">
            <ReportsList 
              reports={groupedReports.copyright}
              onDeleteSong={handleDeleteSong}
              onDismissReport={handleDismissReport}
              deletingReports={deletingReports}
              getReportTypeBadge={getReportTypeBadge}
            />
          </TabsContent>

          <TabsContent value="hate_speech">
            <ReportsList 
              reports={groupedReports.hate_speech}
              onDeleteSong={handleDeleteSong}
              onDismissReport={handleDismissReport}
              deletingReports={deletingReports}
              getReportTypeBadge={getReportTypeBadge}
            />
          </TabsContent>

          <TabsContent value="other">
            <ReportsList 
              reports={groupedReports.other}
              onDeleteSong={handleDeleteSong}
              onDismissReport={handleDismissReport}
              deletingReports={deletingReports}
              getReportTypeBadge={getReportTypeBadge}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

interface ReportsListProps {
  reports: SongReport[];
  onDeleteSong: (songId: string, reportId: string) => void;
  onDismissReport: (reportId: string) => void;
  deletingReports: Set<string>;
  getReportTypeBadge: (type: string) => JSX.Element;
}

const ReportsList = ({ 
  reports, 
  onDeleteSong, 
  onDismissReport, 
  deletingReports,
  getReportTypeBadge 
}: ReportsListProps) => {
  const navigate = useNavigate();

  if (reports.length === 0) {
    return (
      <Card className="console-bg tech-border p-8 text-center">
        <p className="font-mono text-muted-foreground">No reports in this category</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => {
        const coverUrl = report.songs.cover_cid 
          ? getIPFSGatewayUrl(report.songs.cover_cid) 
          : null;

        return (
          <Card key={report.id} className="console-bg tech-border p-6">
            <div className="flex items-start gap-4">
              {/* Song Cover */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded tech-border overflow-hidden bg-primary/20">
                  {coverUrl ? (
                    <img 
                      src={coverUrl} 
                      alt={report.songs.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="h-8 w-8 text-neon-green" />
                    </div>
                  )}
                </div>
              </div>

              {/* Report Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 className="font-mono font-bold text-lg mb-1">
                      {report.songs.title}
                    </h3>
                    <p className="text-sm font-mono text-muted-foreground mb-2">
                      by {report.songs.artist || "Unknown Artist"}
                    </p>
                  </div>
                  {getReportTypeBadge(report.report_type)}
                </div>

                <div className="space-y-2 text-sm font-mono">
                  <p className="text-muted-foreground">
                    Reported by: <span className="text-foreground">{report.wallet_address.slice(0, 8)}...</span>
                  </p>
                  <p className="text-muted-foreground">
                    Date: <span className="text-foreground">{new Date(report.created_at).toLocaleString()}</span>
                  </p>
                  {report.description && (
                    <div className="mt-3 p-3 bg-background/50 rounded border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Description:</p>
                      <p className="text-sm">{report.description}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/song/${report.song_id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    VIEW SONG
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteSong(report.song_id, report.id)}
                    disabled={deletingReports.has(report.id)}
                  >
                    {deletingReports.has(report.id) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    DELETE SONG
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismissReport(report.id)}
                  >
                    DISMISS REPORT
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

interface VerificationRequestsProps {
  requests: VerificationRequest[];
  onApprove: (id: string, walletAddress: string) => void;
  onReject: (id: string, walletAddress: string) => void;
  processingRequests: Set<string>;
  adminNotes: Record<string, string>;
  setAdminNotes: (notes: Record<string, string>) => void;
}

const VerificationRequests = ({
  requests,
  onApprove,
  onReject,
  processingRequests,
  adminNotes,
  setAdminNotes
}: VerificationRequestsProps) => {
  if (requests.length === 0) {
    return (
      <Card className="console-bg tech-border p-8 text-center">
        <p className="font-mono text-muted-foreground">No pending verification requests</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const avatarUrl = request.profiles?.avatar_cid 
          ? getIPFSGatewayUrl(request.profiles.avatar_cid) 
          : null;
        const displayName = request.profiles?.artist_name || request.profiles?.display_name || 'Unknown';

        return (
          <Card key={request.id} className="console-bg tech-border p-6">
            <div className="flex items-start gap-4">
              {/* Artist Avatar */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full tech-border overflow-hidden bg-primary/20">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono text-neon-green">
                      {displayName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Request Details */}
              <div className="flex-1 min-w-0">
                <div className="mb-3">
                  <h3 className="font-mono font-bold text-lg mb-1">{displayName}</h3>
                  <p className="text-sm font-mono text-muted-foreground">
                    {request.wallet_address}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    Requested: {new Date(request.requested_at).toLocaleString()}
                  </p>
                </div>

                {request.message && (
                  <div className="mb-4 p-3 bg-background/50 rounded border border-border">
                    <p className="text-xs text-muted-foreground mb-1 font-mono">Message:</p>
                    <p className="text-sm font-mono">{request.message}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Admin Notes (optional)</Label>
                    <Textarea
                      value={adminNotes[request.id] || ''}
                      onChange={(e) => setAdminNotes({ ...adminNotes, [request.id]: e.target.value })}
                      placeholder="Add internal notes about this decision..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(request.id, request.wallet_address)}
                      disabled={processingRequests.has(request.id)}
                      className="bg-neon-green text-black hover:bg-neon-green/80"
                    >
                      {processingRequests.has(request.id) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      APPROVE
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onReject(request.id, request.wallet_address)}
                      disabled={processingRequests.has(request.id)}
                    >
                      {processingRequests.has(request.id) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      REJECT
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default Admin;
