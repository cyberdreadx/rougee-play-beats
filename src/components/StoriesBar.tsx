import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StoryViewer from "./StoryViewer";
import { Plus, Lock } from "lucide-react";
import StoryUpload from "./StoryUpload";
import { useWallet } from "@/hooks/useWallet";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { toast } from "@/hooks/use-toast";
import { useReadContract } from "wagmi";
import { Address } from "viem";

const XRGE_TOKEN_ADDRESS = "0x147120faEC9277ec02d957584CFCD92B56A24317" as Address;

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

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

interface GroupedStories {
  [walletAddress: string]: Story[];
}

interface StoriesBarProps {
  hasXRGE?: boolean;
}

const StoriesBar = ({ hasXRGE }: StoriesBarProps) => {
  const navigate = useNavigate();
  const { fullAddress, isConnected } = useWallet();
  const [stories, setStories] = useState<GroupedStories>({});
  const [profiles, setProfiles] = useState<{ [key: string]: any }>({});
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Check XRGE balance internally if not provided via props
  const { data: xrgeBalance } = useReadContract({
    address: XRGE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: fullAddress ? [fullAddress as Address] : undefined,
    query: {
      enabled: !!fullAddress && isConnected && hasXRGE === undefined, // Only check if prop not provided
    },
  });

  // Use prop if provided, otherwise check balance
  const effectiveHasXRGE = hasXRGE !== undefined 
    ? hasXRGE 
    : (xrgeBalance ? Number(xrgeBalance) > 0 : false);

  const handleStoryUploadClick = () => {
    if (!effectiveHasXRGE) {
      toast({
        title: "XRGE Required",
        description: "You need to hold XRGE tokens to post stories",
        variant: "destructive",
      });
      return;
    }
    setShowUpload(true);
  };

  useEffect(() => {
    fetchStories();
  }, [fullAddress]);

  useEffect(() => {
    const channel = supabase
      .channel('stories-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => fetchStories())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stories' }, () => fetchStories())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStories = async () => {
    const { data, error } = await supabase
      .from("stories")
      .select("id, wallet_address, media_path, media_type, caption, created_at, expires_at, view_count, like_count")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching stories:", error);
      return;
    }

    // Group stories by wallet address
    const grouped: GroupedStories = {};
    const walletAddresses = new Set<string>();

    data?.forEach((story) => {
      if (!grouped[story.wallet_address]) {
        grouped[story.wallet_address] = [];
      }
      grouped[story.wallet_address].push(story);
      walletAddresses.add(story.wallet_address);
    });

    setStories(grouped);

    // Add current user's wallet to fetch their profile even if they have no stories
    if (fullAddress) {
      walletAddresses.add(fullAddress);
    }

    // Fetch profiles for these wallets
    if (walletAddresses.size > 0) {
      const { data: profileData } = await supabase
        .from("public_profiles")
        .select("*")
        .in("wallet_address", Array.from(walletAddresses));

      const profileMap: { [key: string]: any } = {};
      profileData?.forEach((profile) => {
        profileMap[profile.wallet_address] = profile;
      });
      setProfiles(profileMap);
    }
  };

  if (Object.keys(stories).length === 0 && !fullAddress) {
    return null;
  }

  return (
    <>
      <div className="w-full overflow-x-auto pb-4 mb-0">
        <div className="flex gap-4 px-4">
          {/* Current User's Story/Add Button */}
          {fullAddress && (
            <div className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0">
              <div
                onClick={() => {
                  const hasStories = stories[fullAddress!]?.length > 0;
                  hasStories ? setSelectedWallet(fullAddress!) : handleStoryUploadClick();
                }}
                className="relative w-16 h-16"
              >
                <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-tr from-neon-green/50 via-primary/50 to-neon-green/50">
                  <div className="w-full h-full rounded-full bg-background p-[2px]">
                    <div className="w-full h-full rounded-full overflow-hidden relative">
                      {stories[fullAddress]?.length > 0 ? (
                        stories[fullAddress][0].media_type.startsWith('image') ? (
                          <img 
                            src={supabase.storage.from('stories').getPublicUrl(stories[fullAddress][0].media_path).data.publicUrl}
                            alt="Story preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="relative w-full h-full">
                            <video 
                              src={supabase.storage.from('stories').getPublicUrl(stories[fullAddress][0].media_path).data.publicUrl}
                              className="w-full h-full object-cover pointer-events-none"
                              playsInline
                              autoPlay
                              muted
                              loop
                              preload="metadata"
                              crossOrigin="anonymous"
                            />
                          </div>
                        )
                      ) : (
                        <Avatar className="w-full h-full">
                          <AvatarImage
                            src={
                              profiles[fullAddress]?.avatar_cid
                                ? getIPFSGatewayUrl(profiles[fullAddress].avatar_cid, undefined, true)
                                : undefined
                            }
                          />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {profiles[fullAddress]?.display_name?.[0]?.toUpperCase() ||
                              fullAddress.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                </div>
                {/* Plus Badge */}
                <div
                  className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center z-10 ${
                    effectiveHasXRGE ? 'bg-neon-green' : 'bg-yellow-500'
                  }`}
                  onClick={(e) => { e.stopPropagation(); handleStoryUploadClick(); }}
                  aria-label="Add story"
                  role="button"
                  title={effectiveHasXRGE ? "Add story" : "XRGE required to post stories"}
                >
                  {effectiveHasXRGE ? (
                    <Plus className="w-3 h-3 text-background" />
                  ) : (
                    <Lock className="w-3 h-3 text-background" />
                  )}
                </div>
              </div>
              <span className="text-xs font-mono">Your Story</span>
            </div>
          )}

          {/* Other Users' Stories */}
          {Object.entries(stories)
            .filter(([walletAddress]) => walletAddress !== fullAddress)
            .map(([walletAddress, userStories]) => {
            const profile = profiles[walletAddress];
            const hasUnviewed = true; // Could track viewed stories in localStorage
            
            return (
              <div
                key={walletAddress}
                className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0"
                onClick={() => setSelectedWallet(walletAddress)}
              >
                <div
                  className={`w-16 h-16 rounded-full p-[2px] ${
                    hasUnviewed
                      ? "bg-gradient-to-tr from-neon-green via-primary to-neon-green"
                      : "bg-border"
                  }`}
                >
                  <div className="w-full h-full rounded-full bg-background p-[2px]">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      {userStories[0].media_type.startsWith('image') ? (
                        <img 
                          src={supabase.storage.from('stories').getPublicUrl(userStories[0].media_path).data.publicUrl}
                          alt="Story preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="relative w-full h-full">
                          <video 
                            src={supabase.storage.from('stories').getPublicUrl(userStories[0].media_path).data.publicUrl}
                            className="w-full h-full object-cover pointer-events-none"
                            playsInline
                            autoPlay
                            muted
                            loop
                            preload="metadata"
                            crossOrigin="anonymous"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span 
                  className="text-xs font-mono max-w-[80px] truncate cursor-pointer hover:text-neon-green transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/artist/${walletAddress}`);
                  }}
                >
                  {profile?.display_name ||
                    `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedWallet && (
        <StoryViewer
          stories={stories[selectedWallet]}
          profile={profiles[selectedWallet]}
          onClose={() => setSelectedWallet(null)}
          allStories={stories}
          profiles={profiles}
          currentWallet={selectedWallet}
        />
      )}

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowUpload(false)} />
          <div className="relative z-10">
            <StoryUpload onUploaded={() => {
              setShowUpload(false);
              fetchStories();
              if (fullAddress) setSelectedWallet(fullAddress);
            }} />
          </div>
        </div>
      )}
    </>
  );
};

export default StoriesBar;