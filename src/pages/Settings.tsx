import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { Settings as SettingsIcon, User, Music, Check, Filter, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePrivy } from "@privy-io/react-auth";

type AiFilter = 'all' | 'no-ai' | 'partial';

const Settings = () => {
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { profile, loading: profileLoading } = useCurrentUserProfile();
  const { getAccessToken } = usePrivy();
  
  // Audio/Music Settings
  const [aiFilter, setAiFilter] = useState<AiFilter>('all');
  const [savingAudioSettings, setSavingAudioSettings] = useState(false);
  
  // Profile Settings
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (isPrivyReady && !isConnected) {
      navigate("/");
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to access settings",
        variant: "destructive",
      });
      return;
    }

    // Load AI filter from localStorage
    const savedAiFilter = localStorage.getItem('audioPlayer_aiFilter');
    if (savedAiFilter && (savedAiFilter === 'all' || savedAiFilter === 'no-ai' || savedAiFilter === 'partial' || savedAiFilter === 'no-ai-partial')) {
      // Migrate old 'no-ai-partial' to 'partial'
      const migratedFilter = savedAiFilter === 'no-ai-partial' ? 'partial' : savedAiFilter;
      setAiFilter(migratedFilter as AiFilter);
      if (savedAiFilter === 'no-ai-partial') {
        localStorage.setItem('audioPlayer_aiFilter', 'partial');
      }
    }
  }, [isConnected, isPrivyReady, navigate]);

  const handleAiFilterChange = async (newFilter: AiFilter) => {
    setAiFilter(newFilter);
    localStorage.setItem('audioPlayer_aiFilter', newFilter);
    
    setSavingAudioSettings(true);
    try {
      // Save to localStorage (already done above)
      // Could also save to user preferences in database if needed
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
      
      toast({
        title: "Settings saved",
        description: "Audio preferences updated successfully",
      });
    } catch (error) {
      console.error("Error saving audio settings:", error);
      toast({
        title: "Error",
        description: "Failed to save audio settings",
        variant: "destructive",
      });
    } finally {
      setSavingAudioSettings(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 text-neon-green" />
          <h1 className="text-2xl md:text-3xl font-bold font-mono uppercase tracking-wider text-neon-green">
            Settings
          </h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground font-mono">
          Manage your profile and audio preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8 bg-black/60 backdrop-blur-xl border border-neon-green/20 shadow-[0_0_20px_rgba(0,255,159,0.15)] p-1 rounded-lg">
          <TabsTrigger 
            value="profile" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-neon-green/20 data-[state=active]:to-emerald-500/20 data-[state=active]:text-neon-green data-[state=active]:shadow-[0_0_15px_rgba(0,255,159,0.5)] data-[state=active]:border data-[state=active]:border-neon-green/50 data-[state=inactive]:text-white/50 data-[state=inactive]:hover:text-white/80 transition-all duration-300 font-mono font-bold uppercase"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="audio" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-neon-green/20 data-[state=active]:to-emerald-500/20 data-[state=active]:text-neon-green data-[state=active]:shadow-[0_0_15px_rgba(0,255,159,0.5)] data-[state=active]:border data-[state=active]:border-neon-green/50 data-[state=inactive]:text-white/50 data-[state=inactive]:hover:text-white/80 transition-all duration-300 font-mono font-bold uppercase"
          >
            <Music className="w-4 h-4 mr-2" />
            Audio / Music
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-4 md:space-y-6">
          <Card className="p-4 md:p-6 bg-black/60 backdrop-blur-xl border border-neon-green/20 shadow-[0_0_20px_rgba(0,255,159,0.15)]">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <User className="w-5 h-5 md:w-6 md:h-6 text-neon-green" />
              <h2 className="text-lg md:text-xl font-bold font-mono uppercase text-neon-green">
                Profile Settings
              </h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 font-mono">
              Manage your public profile information and preferences.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-black/40 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-neon-green/10">
                    <Shield className="w-4 h-4 md:w-5 md:h-5 text-neon-green" />
                  </div>
                  <div>
                    <Label className="text-sm md:text-base font-mono font-semibold text-white">
                      Edit Profile
                    </Label>
                    <p className="text-xs md:text-sm text-muted-foreground font-mono">
                      Update your display name, bio, and social links
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/profile/edit")}
                  className="px-3 md:px-4 py-2 rounded-lg bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green/30 hover:shadow-[0_0_10px_rgba(0,255,159,0.4)] transition-all font-mono text-xs md:text-sm uppercase"
                >
                  Edit
                </button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Audio/Music Settings */}
        <TabsContent value="audio" className="space-y-4 md:space-y-6">
          <Card className="p-4 md:p-6 bg-black/60 backdrop-blur-xl border border-neon-green/20 shadow-[0_0_20px_rgba(0,255,159,0.15)]">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <Music className="w-5 h-5 md:w-6 md:h-6 text-neon-green" />
              <h2 className="text-lg md:text-xl font-bold font-mono uppercase text-neon-green">
                Audio / Music Settings
              </h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 font-mono">
              Control how music plays and what content you want to hear.
            </p>

            {/* AI Filter Settings */}
            <div className="space-y-4 md:space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <Filter className="w-4 h-4 md:w-5 md:h-5 text-neon-green/70" />
                  <Label className="text-sm md:text-base font-mono font-semibold text-white">
                    AI Usage Filter
                  </Label>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 font-mono">
                  Choose what types of songs play in auto-play mode:
                </p>
                <div className="space-y-2 md:space-y-3">
                  <label className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-black/40 border border-white/10 cursor-pointer group transition-all hover:border-neon-green/30 hover:bg-black/60">
                    <div className={`relative w-5 h-5 rounded border-2 transition-all duration-300 flex-shrink-0 ${
                      aiFilter === 'all' 
                        ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]' 
                        : 'bg-black/40 border-white/20 group-hover:border-neon-green/40'
                    }`}>
                      {aiFilter === 'all' && (
                        <Check className="absolute inset-0 w-full h-full p-0.5 text-neon-green" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`font-mono text-sm md:text-base uppercase tracking-wider transition-colors block ${
                        aiFilter === 'all' ? 'text-neon-green font-semibold' : 'text-white/70 group-hover:text-white'
                      }`}>
                        ALL
                      </span>
                      <span className="text-xs md:text-sm text-muted-foreground font-mono">
                        Play all songs regardless of AI usage
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="aiFilter"
                      checked={aiFilter === 'all'}
                      onChange={() => handleAiFilterChange('all')}
                      className="sr-only"
                    />
                  </label>
                  <label className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-black/40 border border-white/10 cursor-pointer group transition-all hover:border-neon-green/30 hover:bg-black/60">
                    <div className={`relative w-5 h-5 rounded border-2 transition-all duration-300 flex-shrink-0 ${
                      aiFilter === 'partial' 
                        ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]' 
                        : 'bg-black/40 border-white/20 group-hover:border-neon-green/40'
                    }`}>
                      {aiFilter === 'partial' && (
                        <Check className="absolute inset-0 w-full h-full p-0.5 text-neon-green" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`font-mono text-sm md:text-base uppercase tracking-wider transition-colors block ${
                        aiFilter === 'partial' ? 'text-neon-green font-semibold' : 'text-white/70 group-hover:text-white'
                      }`}>
                        PARTIAL AI
                      </span>
                      <span className="text-xs md:text-sm text-muted-foreground font-mono">
                        Play songs with partial AI usage only
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="aiFilter"
                      checked={aiFilter === 'partial'}
                      onChange={() => handleAiFilterChange('partial')}
                      className="sr-only"
                    />
                  </label>
                  <label className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-black/40 border border-white/10 cursor-pointer group transition-all hover:border-neon-green/30 hover:bg-black/60">
                    <div className={`relative w-5 h-5 rounded border-2 transition-all duration-300 flex-shrink-0 ${
                      aiFilter === 'no-ai' 
                        ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]' 
                        : 'bg-black/40 border-white/20 group-hover:border-neon-green/40'
                    }`}>
                      {aiFilter === 'no-ai' && (
                        <Check className="absolute inset-0 w-full h-full p-0.5 text-neon-green" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`font-mono text-sm md:text-base uppercase tracking-wider transition-colors block ${
                        aiFilter === 'no-ai' ? 'text-neon-green font-semibold' : 'text-white/70 group-hover:text-white'
                      }`}>
                        NO AI ONLY
                      </span>
                      <span className="text-xs md:text-sm text-muted-foreground font-mono">
                        Only play songs with no AI usage
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="aiFilter"
                      checked={aiFilter === 'no-ai'}
                      onChange={() => handleAiFilterChange('no-ai')}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
