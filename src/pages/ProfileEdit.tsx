import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import NetworkInfo from "@/components/NetworkInfo";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useWallet } from "@/hooks/useWallet";
import { Upload, ExternalLink, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { supabase } from "@/integrations/supabase/client";

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { profile, loading, updating, updateProfile } = useCurrentUserProfile();

  const [displayName, setDisplayName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artistTicker, setArtistTicker] = useState("");
  const [bio, setBio] = useState("");
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState<number>(50); // 0-100 percentage
  const [isDragging, setIsDragging] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [verificationMessage, setVerificationMessage] = useState("");
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);

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
      // Load cover position from social_links if exists (default to center = 50%)
      const savedPosition = profile.social_links?.coverPosition;
      setCoverPosition(typeof savedPosition === 'number' ? savedPosition : 50);
      
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
      const { error } = await supabase
        .from('verification_requests')
        .insert({
          wallet_address: fullAddress,
          message: verificationMessage,
          status: 'pending'
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
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Avatar must be less than 2MB",
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
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setCoverPosition(50); // Reset to center on new upload
    }
  };

  const handleCoverDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    
    let y: number;
    if ('touches' in e) {
      // Touch event
      y = e.touches[0].clientY - rect.top;
    } else {
      // Mouse event
      y = e.clientY - rect.top;
    }
    
    const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setCoverPosition(percentage);
  };

  const handleCoverDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    handleCoverDrag(e);
  };

  const handleCoverDragEnd = (e?: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e?.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullAddress) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet",
        variant: "destructive",
      });
      return;
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

    const formData = new FormData();
    formData.append("wallet_address", fullAddress);
    formData.append("display_name", isArtist ? artistName.trim() : displayName.trim());
    if (isArtist) {
      formData.append("artist_name", artistName.trim());
      formData.append("artist_ticker", artistTicker.trim().toUpperCase());
    }
    formData.append("bio", bio.trim());
    formData.append("social_links", JSON.stringify({ twitter, instagram, website, coverPosition }));

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
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Navigation />
      <NetworkInfo />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {showAvatarCrop && tempAvatarUrl && (
          <AvatarCropModal
            imageUrl={tempAvatarUrl}
            onComplete={handleAvatarCropComplete}
            onCancel={handleAvatarCropCancel}
          />
        )}

        <h1 className="text-3xl font-mono font-bold neon-text mb-6">
          {profile ? "EDIT PROFILE" : "CREATE PROFILE"}
        </h1>

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
                  className={`relative h-48 w-full rounded tech-border overflow-hidden bg-gradient-to-br from-primary/20 to-background ${coverPreview ? 'cursor-move select-none' : 'cursor-pointer'} group`}
                  style={coverPreview ? {
                    backgroundImage: `url(${coverPreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: `center ${coverPosition}%`
                  } : undefined}
                  onMouseDown={coverPreview ? handleCoverDragStart : undefined}
                  onMouseMove={coverPreview ? handleCoverDrag : undefined}
                  onMouseUp={coverPreview ? handleCoverDragEnd : undefined}
                  onMouseLeave={coverPreview ? handleCoverDragEnd : undefined}
                  onTouchStart={coverPreview ? handleCoverDragStart : undefined}
                  onTouchMove={coverPreview ? handleCoverDrag : undefined}
                  onTouchEnd={coverPreview ? handleCoverDragEnd : undefined}
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
                        <Upload className="h-8 w-8 text-neon-green" />
                      </div>
                    </>
                  )}
                  
                  {coverPreview && (
                    <>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                        <div className={`text-white font-mono text-sm bg-black/60 px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDragging ? '!opacity-100' : ''}`}>
                          {isDragging ? 'Release to set' : 'Drag to adjust position'}
                        </div>
                      </div>
                      <input
                        id="cover"
                        type="file"
                        accept="image/*"
                        onChange={handleCoverChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('cover')?.click()}
                        className="absolute top-2 right-2 z-10 text-xs"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Change
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Avatar */}
            <div className="space-y-2">
              <Label htmlFor="avatar" className="font-mono">Avatar (512x512, max 2MB)</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24 border-2 border-neon-green cursor-pointer">
                  <AvatarImage src={avatarPreview || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xl">
                    {(isArtist ? artistName : displayName).substring(0, 2).toUpperCase() || "??"}
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
