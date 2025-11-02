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
import { Switch } from "@/components/ui/switch";
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
import { usePrivy } from "@privy-io/react-auth";
import { UploadSlotsCard } from "@/components/UploadSlotsCard";
import { UploadSlotsBadge } from "@/components/UploadSlotsBadge";
import { XRGETierBadge } from "@/components/XRGETierBadge";
import { LockCodeKeypad } from "@/components/LockCodeKeypad";
import { useLockCode } from "@/hooks/useLockCode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady, createWallet, isCreatingWallet, authenticateWallet } = useWallet();
  const { profile, loading, updating, updateProfile } = useCurrentUserProfile();
  const { getAuthHeaders } = usePrivyToken();
  const { getAccessToken } = usePrivy();
  
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
  const [soundcloud, setSoundcloud] = useState("");
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
  
  // Lock code state
  const lockCodeHook = useLockCode();
  const { hasLockCode, setLockCode, removeLockCode, verifyLockCode, autoLockTimeoutMinutes, setAutoLockTimeout, requirePinAfterLogin, setRequirePinAfterLogin } = lockCodeHook;
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [showLockCodeSetup, setShowLockCodeSetup] = useState(false);
  const [showLockCodeRemove, setShowLockCodeRemove] = useState(false);
  const [lockCodeStep, setLockCodeStep] = useState<'enter' | 'confirm'>('enter');
  const [enteredCode, setEnteredCode] = useState("");
  const [lockCodeError, setLockCodeError] = useState("");

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
      setSoundcloud(profile.social_links?.soundcloud || "");
      setIsArtist(!!profile.artist_name);
      setAutoLockMinutes(autoLockTimeoutMinutes);
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
        .eq('wallet_address', fullAddress.toLowerCase())
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
      console.log('🔍 Requesting verification for:', fullAddress);
      
      // Get auth headers if available (apikey is handled automatically by supabase client)
      const headers = await getAuthHeaders().catch((err) => {
        console.warn('⚠️ Failed to get auth headers:', err);
        return {};
      });
      
      console.log('📤 Invoking edge function with headers:', {
        hasAuthorization: !!headers.Authorization,
        hasPrivyToken: !!headers['x-privy-token'],
        walletAddress: fullAddress.toLowerCase(),
        headers: Object.keys(headers),
      });
      
      const { data, error } = await supabase.functions.invoke('request-verification-simple', {
        headers: {
          ...headers,
          'x-wallet-address': fullAddress.toLowerCase(),
          'Content-Type': 'application/json',
        },
        body: { 
          message: verificationMessage || null,
          wallet_address: fullAddress.toLowerCase()
        },
      });
      
      console.log('📬 Edge function response:', { data, error, status: error?.context?.status });

      if (error) {
        console.error('❌ Supabase function error:', error);
        throw error;
      }
      
      // Check if response indicates an error
      if (data && typeof data === 'object' && 'error' in data) {
        console.error('❌ Function returned error:', data);
        throw new Error((data as any).error || 'Unknown error from verification function');
      }

      if (!data || (typeof data === 'object' && !('success' in data))) {
        console.warn('⚠️ Unexpected response format:', data);
      }

      setVerificationStatus('pending');
      setVerificationMessage('');
      toast({
        title: "Verification Requested",
        description: "Your request has been submitted for review",
      });
      
      // Refresh verification status
      checkVerificationRequest();
    } catch (error: any) {
      console.error('❌ Error requesting verification:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit verification request. Please try again.",
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
    
    

    if (!fullAddress) {
      console.error('❌ Wallet not connected - fullAddress is:', fullAddress);
      
      // Try to wait a bit and check again (in case of timing issues)
      if (isConnected && isPrivyReady) {
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

    if (isArtist && !profile?.artist_ticker && !artistTicker.trim()) {
      toast({
        title: "Artist ticker required",
        description: "Please enter your artist ticker symbol",
        variant: "destructive",
      });
      return;
    }

    if (isArtist && !profile?.artist_ticker && artistTicker.trim().length < 3) {
      toast({
        title: "Invalid ticker",
        description: "Artist ticker must be at least 3 characters",
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
    formData.append("social_links", JSON.stringify({ twitter, instagram, website, soundcloud }));

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
                    Artist Ticker * (3-10 chars, A-Z 0-9 only)
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
                      required={!profile?.artist_ticker}
                    />
                  </div>
                  {profile?.artist_ticker ? (
                    <p className="text-xs text-yellow-500 font-mono">
                      ⚠️ Ticker cannot be changed once claimed
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono">
                      Required: 3-10 characters, will be used as your artist token symbol
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

              <div className="space-y-2">
                <Label htmlFor="soundcloud" className="font-mono">SoundCloud</Label>
                <Input
                  id="soundcloud"
                  value={soundcloud}
                  onChange={(e) => setSoundcloud(e.target.value)}
                  placeholder="https://soundcloud.com/yourhandle"
                />
              </div>
            </div>

            {/* Lock Code Settings */}
            <div className="space-y-2 pt-6 border-t-2 border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Label className="font-mono text-lg text-yellow-500">Security Settings</Label>
                <span className="text-yellow-500">🔒</span>
              </div>
              <Card className="p-4 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-yellow-500/10 border-2 border-yellow-500/30 shadow-[0_4px_16px_0_rgba(234,179,8,0.2)]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-mono font-semibold text-yellow-500">Lock Code</h3>
                      <p className="text-xs text-yellow-500/80 font-mono">
                        {hasLockCode 
                          ? "A 4-digit lock code is enabled. You'll be asked to enter it after logging in."
                          : "Set a 4-digit code to protect your account after login."
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasLockCode ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowLockCodeRemove(true)}
                          className="font-mono"
                        >
                          Remove Code
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLockCodeStep('enter');
                            setEnteredCode("");
                            setLockCodeError("");
                            setShowLockCodeSetup(true);
                          }}
                          className="font-mono border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/20 hover:border-yellow-500"
                        >
                          Set Lock Code
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Lock Code Options */}
                  {hasLockCode && (
                    <>
                      {/* Require PIN After Login */}
                      <div className="pt-4 border-t border-yellow-500/20">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 flex-1">
                            <h4 className="font-mono font-semibold text-yellow-500/90 text-sm">Require PIN After Login</h4>
                            <p className="text-xs text-yellow-500/70 font-mono">
                              Require lock code immediately after logging in
                            </p>
                          </div>
                          <Switch
                            checked={requirePinAfterLogin}
                            onCheckedChange={(checked) => {
                              setRequirePinAfterLogin(checked);
                              toast({
                                title: "Setting updated",
                                description: checked 
                                  ? "Lock code will be required after login."
                                  : "Lock code will not be required after login (only when manually locked or after inactivity).",
                              });
                            }}
                            className="data-[state=checked]:bg-yellow-500"
                          />
                        </div>
                      </div>

                      {/* Auto-Lock Settings */}
                      <div className="pt-4 border-t border-yellow-500/20">
                        <div className="flex items-center justify-between mb-3">
                          <div className="space-y-1">
                            <h4 className="font-mono font-semibold text-yellow-500/90 text-sm">Auto-Lock Timer</h4>
                            <p className="text-xs text-yellow-500/70 font-mono">
                              Automatically lock the app after inactivity
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="1"
                              max="60"
                              value={autoLockMinutes}
                              onChange={(e) => {
                                const minutes = parseInt(e.target.value) || 1;
                                setAutoLockMinutes(Math.max(1, Math.min(60, minutes)));
                              }}
                              onBlur={() => {
                                if (autoLockMinutes >= 1 && autoLockMinutes <= 60) {
                                  setAutoLockTimeout(autoLockMinutes);
                                  toast({
                                    title: "Auto-lock updated",
                                    description: `App will auto-lock after ${autoLockMinutes} minute${autoLockMinutes !== 1 ? 's' : ''} of inactivity.`,
                                  });
                                }
                              }}
                              className="font-mono bg-background border-yellow-500/30 text-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <span className="text-xs text-yellow-500/70 font-mono whitespace-nowrap">minutes</span>
                        </div>
                        <p className="text-xs text-yellow-500/60 font-mono mt-2">
                          Current: {autoLockTimeoutMinutes} minute{autoLockTimeoutMinutes !== 1 ? 's' : ''} of inactivity
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>
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

        {/* Lock Code Setup Dialog */}
        <Dialog open={showLockCodeSetup} onOpenChange={setShowLockCodeSetup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-xl text-neon-green">
                {lockCodeStep === 'enter' ? 'Set Lock Code' : 'Confirm Lock Code'}
              </DialogTitle>
              <DialogDescription className="font-mono">
                {lockCodeStep === 'enter' 
                  ? 'Enter a 4-digit code to protect your account'
                  : 'Re-enter your code to confirm'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <LockCodeKeypad
                onComplete={(code) => {
                  if (lockCodeStep === 'enter') {
                    setEnteredCode(code);
                    setLockCodeStep('confirm');
                    setLockCodeError("");
                  } else {
                    if (code === enteredCode) {
                      const success = setLockCode(code);
                      if (success) {
                      setShowLockCodeSetup(false);
                      setLockCodeStep('enter');
                      setEnteredCode("");
                      setLockCodeError("");
                      toast({
                        title: "Lock code set",
                        description: "Your lock code has been saved successfully.",
                      });
                      } else {
                        setLockCodeError("Failed to save lock code. Please try again.");
                      }
                    } else {
                      setLockCodeError("Codes don't match. Please try again.");
                      setLockCodeStep('enter');
                      setEnteredCode("");
                      // Small delay before allowing next input
                      setTimeout(() => setLockCodeError(""), 2000);
                    }
                  }
                }}
                onCancel={() => {
                  setShowLockCodeSetup(false);
                  setLockCodeStep('enter');
                  setEnteredCode("");
                  setLockCodeError("");
                }}
                title={lockCodeStep === 'enter' ? 'Enter Lock Code' : 'Confirm Lock Code'}
                subtitle={lockCodeStep === 'enter' 
                  ? 'Enter your 4-digit code'
                  : 'Re-enter your code to confirm'
                }
                showCancel
                errorMessage={lockCodeError}
                resetKey={lockCodeStep} // Reset when step changes
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Lock Code Remove Dialog */}
        <Dialog open={showLockCodeRemove} onOpenChange={setShowLockCodeRemove}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-xl text-destructive">
                Remove Lock Code
              </DialogTitle>
              <DialogDescription className="font-mono">
                Enter your current lock code to remove it
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <LockCodeKeypad
                onComplete={(code) => {
                  // Verify current code before removing
                  if (verifyLockCode(code)) {
                    removeLockCode();
                    setShowLockCodeRemove(false);
                    setLockCodeError("");
                    toast({
                      title: "Lock code removed",
                      description: "Your lock code has been removed.",
                    });
                  } else {
                    setLockCodeError("Incorrect code. Please try again.");
                  }
                }}
                onCancel={() => {
                  setShowLockCodeRemove(false);
                  setLockCodeError("");
                }}
                title="Enter Current Code"
                subtitle="Enter your lock code to remove it"
                showCancel
                errorMessage={lockCodeError}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ProfileEdit;
