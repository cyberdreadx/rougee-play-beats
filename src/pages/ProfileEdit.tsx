import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NetworkInfo from "@/components/NetworkInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { CoverCropModal } from "@/components/CoverCropModal";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useWallet } from "@/hooks/useWallet";
import { usePrivyWagmi } from "@/hooks/usePrivyWagmi";
import { Upload, ExternalLink, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { supabase } from "@/integrations/supabase/client";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { UploadSlotsCard } from "@/components/UploadSlotsCard";
import { UploadSlotsBadge } from "@/components/UploadSlotsBadge";
import { XRGETierBadge } from "@/components/XRGETierBadge";

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady, createWallet, isCreatingWallet, authenticateWallet } = useWallet();
  const { profile, loading, updating, updateProfile } = useCurrentUserProfile();
  const { getAuthHeaders } = usePrivyToken();
  
  // Ensure Privy wallet is synced with wagmi (fixes mobile/PWA issues)
  const { isConnected: wagmiConnected, forceRetry } = usePrivyWagmi();

  const [displayName, setDisplayName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artistTicker, setArtistTicker] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isArtist, setIsArtist] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [verificationMessage, setVerificationMessage] = useState("");
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
  const [showCoverCrop, setShowCoverCrop] = useState(false);
  const [tempCoverUrl, setTempCoverUrl] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    // Only redirect if Privy is ready and user is not connected
    if (isPrivyReady && !isConnected) {
      navigate("/");
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to edit your profile",
        variant: "destructive",
      });
    }
  }, [isConnected, isPrivyReady, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setArtistName(profile.artist_name || "");
      setArtistTicker(profile.artist_ticker || "");
      setBio(profile.bio || "");
      setEmail(profile.email || "");
      setEmailNotifications(profile.email_notifications ?? true);
      setTwitter(profile.social_links?.twitter || "");
      setInstagram(profile.social_links?.instagram || "");
      setWebsite(profile.social_links?.website || "");
      setIsArtist(!!profile.artist_name);
      if (profile.avatar_cid) {
        setAvatarPreview(getIPFSGatewayUrl(profile.avatar_cid));
      }
      if (profile.cover_cid) {
        setCoverPreview(getIPFSGatewayUrl(profile.cover_cid));
      }
      
      // Check verification status
      if (profile.verified) {
        setVerificationStatus('approved');
      } else if (fullAddress) {
        checkVerificationRequest();
      }
    }
  }, [profile, fullAddress]);

  const checkVerificationRequest = async () => {
    if (!fullAddress) return;
    
    try {
      const { data } = await supabase
        .from('verification_requests')
        .select('status')
        .eq('wallet_address', fullAddress)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setVerificationStatus(data.status as 'pending' | 'approved' | 'rejected');
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  const handleRequestVerification = async () => {
    if (!fullAddress || !isArtist) return;
    
    setRequestingVerification(true);
    try {
      const { error } = await supabase.functions.invoke('request-verification-simple', {
        body: { 
          message: verificationMessage,
          wallet_address: fullAddress
        },
      });

      if (error) throw error;

      setVerificationStatus('pending');
      toast({
        title: "Verification Requested",
        description: "Your request has been submitted for review",
      });
    } catch (error: any) {
      console.error('Error requesting verification:', error);
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit verification request",
        variant: "destructive",
      });
    } finally {
      setRequestingVerification(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Avatar must be less than 10MB",
          variant: "destructive",
        });
        return;
      }
      // Show crop modal
      const url = URL.createObjectURL(file);
      setTempAvatarUrl(url);
      setShowAvatarCrop(true);
    }
  };

  const handleAvatarCropComplete = (croppedBlob: Blob) => {
    // Convert blob to file
    const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
    setAvatarFile(croppedFile);
    setAvatarPreview(URL.createObjectURL(croppedBlob));
    setShowAvatarCrop(false);
    if (tempAvatarUrl) {
      URL.revokeObjectURL(tempAvatarUrl);
      setTempAvatarUrl(null);
    }
  };

  const handleAvatarCropCancel = () => {
    setShowAvatarCrop(false);
    if (tempAvatarUrl) {
      URL.revokeObjectURL(tempAvatarUrl);
      setTempAvatarUrl(null);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Cover photo must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      // Create preview and show crop modal
      const url = URL.createObjectURL(file);
      setTempCoverUrl(url);
      setShowCoverCrop(true);
    }
  };

  const handleCoverCropComplete = (croppedBlob: Blob) => {
    // Convert blob to file
    const croppedFile = new File([croppedBlob], 'cover.jpg', { type: 'image/jpeg' });
    setCoverFile(croppedFile);
    setCoverPreview(URL.createObjectURL(croppedBlob));
    setShowCoverCrop(false);
    if (tempCoverUrl) {
      URL.revokeObjectURL(tempCoverUrl);
      setTempCoverUrl(null);
    }
  };

  const handleCoverCropCancel = () => {
    setShowCoverCrop(false);
    if (tempCoverUrl) {
      URL.revokeObjectURL(tempCoverUrl);
      setTempCoverUrl(null);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const debugInfo = {
      fullAddress,
      isConnected,
      isPrivyReady,
      wagmiConnected,
      hasPrivyWagmi: !!usePrivyWagmi
    };
    
    console.log('🔍 ProfileEdit handleSubmit debug:', debugInfo);
    
    // Show debug info in UI for mobile/PWA users
    if (!fullAddress) {
      setShowDebugPanel(true);
    }

    if (!fullAddress) {
      console.error('❌ Wallet not connected - fullAddress is:', fullAddress);
      
      // Try to wait a bit and check again (in case of timing issues)
      if (isConnected && isPrivyReady) {
        console.log('⏳ Wallet appears connected but address not available, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-check after delay
        if (!fullAddress) {
          console.error('❌ Still no address after delay');
          toast({
            title: "Wallet connection issue",
            description: "Please try refreshing the page and connecting again",
            variant: "destructive",
          });
          return;
        }
      } else {
        toast({
          title: "Wallet not connected",
          description: "Please connect your wallet",
          variant: "destructive",
        });
        return;
      }
    }

    if (isArtist && !artistName.trim()) {
      toast({
        title: "Artist name required",
        description: "Please enter your artist name",
        variant: "destructive",
      });
      return;
    }

    if (!isArtist && !displayName.trim()) {
      toast({
        title: "Display name required",
        description: "Please enter your display name",
        variant: "destructive",
      });
      return;
    }

    // Validate email format if provided
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("wallet_address", fullAddress);
    formData.append("display_name", isArtist ? artistName.trim() : displayName.trim());
    if (isArtist) {
      formData.append("artist_name", artistName.trim());
      // Only allow setting ticker once. Do NOT send ticker if it already exists.
      if (!profile?.artist_ticker && artistTicker.trim()) {
        formData.append("artist_ticker", artistTicker.trim().toUpperCase());
      }
    }
    formData.append("bio", bio.trim());
    formData.append("email", email.trim());
    formData.append("email_notifications", emailNotifications.toString());
    formData.append("social_links", JSON.stringify({ twitter, instagram, website }));

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }
    if (coverFile) {
      formData.append("cover", coverFile);
    }

    const success = await updateProfile(formData);
    if (success) {
      if (isArtist && fullAddress) {
        navigate(`/artist/${fullAddress}`);
      } else {
        navigate("/");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NetworkInfo />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Debug Panel for Mobile/PWA */}
        {showDebugPanel && (
          <div className="console-bg tech-border rounded-lg p-4 space-y-2">
            <h3 className="font-mono font-bold text-sm text-neon-green">🔍 Wallet Debug Info</h3>
            <div className="space-y-1 text-xs font-mono">
              <div>Full Address: <span className={fullAddress ? 'text-green-400' : 'text-red-400'}>{fullAddress || 'undefined'}</span></div>
              <div>Privy Connected: <span className={isConnected ? 'text-green-400' : 'text-red-400'}>{isConnected ? 'true' : 'false'}</span></div>
              <div>Privy Ready: <span className={isPrivyReady ? 'text-green-400' : 'text-red-400'}>{isPrivyReady ? 'true' : 'false'}</span></div>
              <div>Wagmi Connected: <span className={wagmiConnected ? 'text-green-400' : 'text-red-400'}>{wagmiConnected ? 'true' : 'false'}</span></div>
              <div>Has PrivyWagmi: <span className="text-blue-400">true</span></div>
            </div>
            {!fullAddress && (
              <div className="space-y-2">
                <div className="text-xs text-yellow-400 font-mono">
                  ⚠️ No wallet address detected.
                </div>
                {isCreatingWallet && (
                  <div className="text-xs text-blue-400 font-mono">
                    🔧 Creating embedded wallet...
                  </div>
                )}
                {!isCreatingWallet && (
                  <div className="text-xs text-muted-foreground font-mono">
                    Embedded wallets should be created automatically. If not, try the button below.
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebugPanel(false)}
                className="font-mono text-xs"
              >
                Hide Debug
              </Button>
              {!fullAddress && (
                <>
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={() => createWallet()}
                    disabled={isCreatingWallet}
                    className="font-mono text-xs"
                  >
                    {isCreatingWallet ? 'Creating...' : 'Create Wallet'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => authenticateWallet()}
                    className="font-mono text-xs"
                  >
                    Authenticate Wallet
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => forceRetry()}
                className="font-mono text-xs"
              >
                Retry Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="font-mono text-xs"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        )}

        {/* Upload Slots - Show for artists */}
        {isArtist && <UploadSlotsCard />}

        {showAvatarCrop && tempAvatarUrl && (
          <AvatarCropModal
            imageUrl={tempAvatarUrl}
            onComplete={handleAvatarCropComplete}
            onCancel={handleAvatarCropCancel}
          />
        )}

        {showCoverCrop && tempCoverUrl && (
          <CoverCropModal
            imageUrl={tempCoverUrl}
            onComplete={handleCoverCropComplete}
            onCancel={handleCoverCropCancel}
          />
        )}

        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-mono font-bold neon-text">
              {profile ? "EDIT PROFILE" : "CREATE PROFILE"}
            </h1>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="font-mono text-xs"
              >
                {showDebugPanel ? 'Hide' : 'Debug'}
              </Button>
              <XRGETierBadge walletAddress={fullAddress} showBalance size="lg" />
            </div>
          </div>
        </div>

        <Card className="console-bg tech-border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Type Toggle */}
            <div className="space-y-2">
              <Label className="font-mono">Profile Type</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={!isArtist ? "neon" : "outline"}
                  onClick={() => setIsArtist(false)}
                  disabled={!!profile?.artist_name}
                >
                  Listener
                </Button>
                <Button
                  type="button"
                  variant={isArtist ? "neon" : "outline"}
                  onClick={() => setIsArtist(true)}
                  disabled={!!profile?.artist_name}
                >
                  Artist
                </Button>
              </div>
              {profile?.artist_name && (
                <p className="text-xs text-yellow-500 font-mono">
                  ⚠️ Profile type cannot be changed once set as artist
                </p>
              )}
            </div>
            {/* Cover Photo */}
            <div className="space-y-2">
              <Label htmlFor="cover" className="font-mono">Cover Photo (1920x480, max 5MB)</Label>
              <div className="relative">
                <div 
                  className="relative h-48 w-full rounded tech-border overflow-hidden bg-gradient-to-br from-primary/20 to-background group"
                  style={coverPreview ? {
                    backgroundImage: `url(${coverPreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  } : undefined}
                >
                  {!coverPreview && (
                    <>
                      <input
                        id="cover"
                        type="file"
                        accept="image/*"
                        onChange={handleCoverChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="absolute inset-0 bg-black/50 group-hover:bg-black/70 transition-colors flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-neon-green mx-auto mb-2" />
                          <p className="text-sm font-mono text-neon-green">Click to upload cover photo</p>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {coverPreview && (
                    <>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                        <div className="text-white font-mono text-sm bg-black/60 px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to change cover photo
                        </div>
                      </div>
                      <input
                        id="cover"
                        type="file"
                        accept="image/*"
                        onChange={handleCoverChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('cover')?.click()}
                        className="absolute top-2 right-2 z-20 text-xs"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Change
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 1920x480px. Will be cropped to fit if needed.
                </p>
              </div>
            </div>

            {/* Avatar */}
            <div className="space-y-2">
              <Label htmlFor="avatar" className="font-mono">Avatar (512x512, max 10MB)</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24 border-2 border-neon-green cursor-pointer">
                  <AvatarImage src={avatarPreview || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xl">
                    {((isArtist ? artistName : displayName) || "??").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("avatar")?.click()}
                  className="font-mono"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Avatar
                </Button>
              </div>
            </div>

            {/* Display Name / Artist Name */}
            {!isArtist ? (
              <div className="space-y-2">
                <Label htmlFor="display-name" className="font-mono">Display Name *</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  required
                />
              </div>
            ) : (
              <>
                {/* Artist Name */}
                <div className="space-y-2">
                  <Label htmlFor="artist-name" className="font-mono">Artist Name *</Label>
                  <Input
                    id="artist-name"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="Your artist name"
                    required
                  />
                </div>

                {/* Artist Ticker */}
                <div className="space-y-2">
                  <Label htmlFor="artist-ticker" className="font-mono">
                    Artist Ticker (3-10 chars, A-Z 0-9 only)
                  </Label>
                  <div className="flex gap-2">
                    <span className="text-neon-green font-mono text-lg">$</span>
                    <Input
                      id="artist-ticker"
                      value={artistTicker}
                      onChange={(e) => setArtistTicker(e.target.value.toUpperCase())}
                      placeholder="ARTIST"
                      maxLength={10}
                      pattern="[A-Z0-9]{3,10}"
                      disabled={!!profile?.artist_ticker}
                      readOnly={!!profile?.artist_ticker}
                    />
                  </div>
                  {profile?.artist_ticker && (
                    <p className="text-xs text-yellow-500 font-mono">
                      ⚠️ Ticker cannot be changed once claimed
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="font-mono">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell fans about yourself..."
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground font-mono text-right">
                {bio.length}/500
              </p>
            </div>

            {/* Email & Notifications */}
            <div className="space-y-4">
              <h3 className="font-mono font-bold text-neon-green">Email & Notifications</h3>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono">
                  Email (For promotional updates & notifications)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
                <p className="text-xs text-muted-foreground font-mono">
                  Optional - Only used to send you updates about your profile and platform news
                </p>
              </div>

              {email.trim() && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="email-notifications"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-4 w-4 rounded border-neon-green/30 bg-background"
                  />
                  <Label htmlFor="email-notifications" className="font-mono cursor-pointer">
                    I want to receive promotional emails and updates
                  </Label>
                </div>
              )}
            </div>

            {/* Verification Section for Artists */}
            {isArtist && (
              <Card className="p-4 bg-primary/5 border-neon-green/30">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-neon-green" />
                    <h3 className="font-mono font-bold text-neon-green">Verification Status</h3>
                  </div>
                  
                  {verificationStatus === 'approved' ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-neon-green text-black">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        VERIFIED
                      </Badge>
                      <p className="text-sm font-mono text-muted-foreground">
                        Your account is verified
                      </p>
                    </div>
                  ) : verificationStatus === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        PENDING REVIEW
                      </Badge>
                      <p className="text-sm font-mono text-muted-foreground">
                        Your request is being reviewed by admins
                      </p>
                    </div>
                  ) : verificationStatus === 'rejected' ? (
                    <div>
                      <Badge variant="destructive">REJECTED</Badge>
                      <p className="text-sm font-mono text-muted-foreground mt-2">
                        Your previous request was not approved. You can submit a new request.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-mono text-muted-foreground">
                        Get a blue checkmark to show your authenticity
                      </p>
                      <Textarea
                        value={verificationMessage}
                        onChange={(e) => setVerificationMessage(e.target.value)}
                        placeholder="Why should you be verified? Include links to your social profiles, music platforms, etc."
                        rows={3}
                        maxLength={500}
                      />
                      <Button
                        type="button"
                        onClick={handleRequestVerification}
                        disabled={!verificationMessage.trim() || requestingVerification}
                        variant="outline"
                        size="sm"
                      >
                        {requestingVerification ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Request Verification'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Social Links */}
            <div className="space-y-4">
              <h3 className="font-mono font-bold text-neon-green">Social Links (Optional)</h3>
              
              <div className="space-y-2">
                <Label htmlFor="twitter" className="font-mono">Twitter/X</Label>
                <Input
                  id="twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram" className="font-mono">Instagram</Label>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="font-mono">Website</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                variant="neon"
                disabled={updating}
                className="flex-1"
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    UPLOADING TO IPFS...
                  </>
                ) : (
                  "SAVE PROFILE"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
              >
                CANCEL
              </Button>
            </div>

            {profile?.profile_metadata_cid && (
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <a
                  href={getIPFSGatewayUrl(profile.profile_metadata_cid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neon-green transition-colors"
                >
                  View on IPFS
                </a>
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ProfileEdit;
