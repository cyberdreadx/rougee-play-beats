import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useWallet } from "@/hooks/useWallet";
import { Compass, TrendingUp, User, Wallet, Upload, Radio, ArrowLeftRight, HelpCircle, Music, MessageSquare, Search, ChevronLeft, ChevronRight } from "lucide-react";
import MusicBars from "./MusicBars";
import { useState, useEffect } from "react";

interface NavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onSidebarToggle?: (collapsed: boolean) => void;
}

const Navigation = ({ activeTab = "DISCOVER", onTabChange }: NavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fullAddress } = useWallet();
  const { isArtist } = useCurrentUserProfile();
  
  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Update CSS variable when sidebar state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty(
        '--sidebar-width',
        isSidebarCollapsed ? '5rem' : '16rem'
      );
    }
  }, [isSidebarCollapsed]);
  
  // Mobile navigation scroll behavior
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only apply scroll behavior on mobile
      if (window.innerWidth >= 768) return;
      
      // Show nav when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY) {
        setIsMobileNavVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsMobileNavVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);
  
  // Desktop tabs - show all (How It Works moved to header)
  const desktopTabs = [
    { name: "TRENDING", path: "/", icon: TrendingUp },
    { name: "GLTCH FEED", path: "/feed", icon: Radio },
    { name: "DISCOVER", path: "/discover", icon: Compass },
    ...(isArtist 
      ? [{ name: "MY PROFILE", path: `/artist/${fullAddress}`, icon: User }]
      : [{ name: "BECOME ARTIST", path: "/become-artist", icon: User }]
    ),
    { name: "PLAYLISTS", path: "/playlists", icon: Music, comingSoon: true },
    { name: "MESSAGES", path: "/messages", icon: MessageSquare },
    { name: "WALLET", path: "/wallet", icon: Wallet },
    { name: "SWAP", path: "/swap", icon: ArrowLeftRight },
    { name: "UPLOAD", path: "/upload", icon: Upload },
  ];

  // Mobile tabs - SoundCloud/Spotify style with labels
  const mobileTabs = [
    { name: "Trending", path: "/", icon: TrendingUp },
    { name: "Feed", path: "/feed", icon: Radio },
    { name: "Discover", path: "/discover", icon: Compass },
    { name: "Swap", path: "/swap", icon: ArrowLeftRight },
    { name: "Wallet", path: "/wallet", icon: Wallet },
    { name: "Profile", path: isArtist ? `/artist/${fullAddress}` : "/profile/edit", icon: User },
  ];

  const handleTabClick = (tab: typeof desktopTabs[0]) => {
    // Don't navigate if coming soon
    if ((tab as any).comingSoon) {
      return;
    }
    
    if (tab.path !== "/" || location.pathname !== "/") {
      // Always navigate if going to a different path or if we're not on home page
      navigate(tab.path);
    } else {
      // Only use onTabChange if we're on home page and staying on home page
      onTabChange?.(tab.name);
    }
  };

  const isActive = (tab: typeof desktopTabs[0]) => {
    if (tab.path === "/feed") {
      return location.pathname === "/feed";
    }
    if (tab.path === "/discover") {
      return location.pathname === "/discover";
    }
    if (tab.path === "/upload") {
      return location.pathname === "/upload";
    }
    if (tab.path === "/become-artist") {
      return location.pathname === "/become-artist";
    }
    if (tab.path === "/wallet") {
      return location.pathname === "/wallet";
    }
    if (tab.path === "/swap") {
      return location.pathname === "/swap";
    }
    if (tab.path === "/playlists") {
      return location.pathname === "/playlists";
    }
    if (tab.path === "/messages") {
      return location.pathname === "/messages";
    }
    if (tab.path?.startsWith("/artist/")) {
      return location.pathname === tab.path;
    }
    // For home page (trending), show as active if we're on root
    if (location.pathname === "/") {
      return activeTab === tab.name;
    }
    // If we're not on home page, no home page tabs should be active
    return false;
  };

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <nav className={`hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-black/40 backdrop-blur-2xl border-r border-white/10 shadow-[4px_0_32px_0_rgba(0,255,159,0.1)] transition-all duration-300 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        {/* Logo/Header */}
        <div className="p-6 border-b border-white/10 relative">
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3">
                <MusicBars bars={4} className="text-neon-green/80" />
                <h1 className="font-mono font-bold text-xl text-neon-green tracking-wider">ROUGEE</h1>
              </div>
              <p className="text-[10px] font-mono text-white/50 mt-2 tracking-widest">DECENTRALIZED MUSIC</p>
            </>
          ) : (
            <div className="flex justify-center">
              <MusicBars bars={4} className="text-neon-green/80" />
            </div>
          )}
          
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 hover:border-neon-green/50 flex items-center justify-center text-white/70 hover:text-neon-green transition-all hover:scale-110 active:scale-95 shadow-lg"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {desktopTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            return (
              <button
                key={tab.name}
                onClick={() => handleTabClick(tab)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-sm transition-all duration-300 group relative
                  ${(tab as any).comingSoon
                    ? 'text-white/30 cursor-not-allowed border border-transparent opacity-50'
                    : active 
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20 font-bold' 
                    : 'text-white/70 hover:text-neon-green hover:bg-neon-green/5 active:bg-neon-green/10 hover:border-neon-green/20 active:scale-[0.98] border border-transparent'
                  }
                  ${isSidebarCollapsed ? 'justify-center' : ''}
                `}
                title={isSidebarCollapsed ? tab.name : undefined}
                disabled={(tab as any).comingSoon}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'drop-shadow-[0_0_8px_rgba(0,255,159,0.8)]' : ''}`} />
                {!isSidebarCollapsed && (
                  <>
                    <span className="truncate">{tab.name}</span>
                    {(tab as any).comingSoon && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        SOON
                      </span>
                    )}
                    {active && !(tab as any).comingSoon && (
                      <div className="ml-auto w-1 h-1 bg-neon-green rounded-full shadow-[0_0_8px_rgba(0,255,159,1)] animate-pulse" />
                    )}
                  </>
                )}
                {isSidebarCollapsed && active && !(tab as any).comingSoon && (
                  <div className="absolute right-1 top-1 w-1 h-1 bg-neon-green rounded-full shadow-[0_0_8px_rgba(0,255,159,1)] animate-pulse" />
                )}
                {isSidebarCollapsed && (tab as any).comingSoon && (
                  <div className="absolute -right-1 -top-1 w-3 h-3 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full flex items-center justify-center text-[8px]">
                    !
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer - Music Bars Animation */}
        <div className="p-4 border-t border-white/10">
          <div className="flex justify-center">
            <MusicBars bars={isSidebarCollapsed ? 3 : 5} className="text-neon-green/50" />
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Futuristic Cyber Style */}
      <nav 
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isMobileNavVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ 
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
          transform: isMobileNavVisible ? 'translateY(0) translateZ(0)' : 'translateY(100%) translateZ(0)',
          WebkitTransform: isMobileNavVisible ? 'translateY(0) translateZ(0)' : 'translateY(100%) translateZ(0)',
        }}
      >
        {/* Glowing top border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50" />
        
        {/* Main nav container */}
        <div className="relative bg-white/5 backdrop-blur-2xl border-t border-white/10">
          {/* Glow effect background */}
          <div className="absolute inset-0 bg-gradient-to-t from-neon-green/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative flex justify-around items-center px-3 py-2">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab);
              return (
                <button
                  key={tab.name}
                  className={`
                    relative flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-2xl transition-all duration-300 min-w-[56px] group
                    ${active 
                      ? 'text-neon-green scale-105' 
                      : 'text-white/50 hover:text-white/80 active:scale-95'
                    }
                  `}
                  onClick={() => handleTabClick(tab)}
                >
                  {/* Active indicator glow */}
                  {active && (
                    <>
                      <div className="absolute inset-0 bg-neon-green/10 rounded-2xl blur-md animate-pulse" />
                      <div className="absolute inset-0 bg-gradient-to-b from-neon-green/20 to-transparent rounded-2xl border border-neon-green/30" />
                    </>
                  )}
                  
                  {/* Hover glow effect */}
                  {!active && (
                    <div className="absolute inset-0 bg-neon-green/0 group-hover:bg-neon-green/5 rounded-2xl transition-all duration-300" />
                  )}
                  
                  {/* Icon with glow */}
                  <div className="relative">
                    <Icon className={`h-5 w-5 transition-all duration-300 ${
                      active 
                        ? 'drop-shadow-[0_0_12px_rgba(0,255,159,0.8)] animate-pulse' 
                        : 'group-hover:drop-shadow-[0_0_6px_rgba(0,255,159,0.3)]'
                    }`} />
                    {active && (
                      <div className="absolute inset-0 bg-neon-green/20 blur-xl rounded-full" />
                    )}
                  </div>
                  
                  {/* Label */}
                  <span className={`relative text-[8px] font-mono tracking-wider uppercase ${
                    active 
                      ? 'font-bold drop-shadow-[0_0_8px_rgba(0,255,159,0.6)]' 
                      : 'font-medium group-hover:text-neon-green/80'
                  }`}>
                    {tab.name}
                  </span>
                  
                  {/* Active dot indicator */}
                  {active && (
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-neon-green rounded-full shadow-[0_0_8px_rgba(0,255,159,1)] animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;