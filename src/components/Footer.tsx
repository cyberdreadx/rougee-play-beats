import { useNavigate } from "react-router-dom";
import { Music, Github, MessageCircle } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

const Footer = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: "Discover", path: "/" },
      { name: "Upload Music", path: "/upload" },
      { name: "Become Artist", path: "/become-artist" },
      { name: "Wallet", path: "/wallet" },
    ],
    resources: [
      { name: "How It Works", path: "/how-it-works" },
      { name: "Whitepaper", path: "/whitepaper" },
      { name: "Documentation", href: "https://rougee-web3.gitbook.io/rougee-web3-documentation/" },
      { name: "Support", href: "https://discord.gg/Vumf5tcMTp" },
      { name: "Terms", path: "/terms-of-service" },
    ],
    community: [
      { name: "X", href: "https://x.com/rougeenetwork", icon: FaXTwitter },
      { name: "Discord", href: "https://discord.gg/Vumf5tcMTp", icon: MessageCircle },
      { name: "GitHub", href: "https://github.com/cyberdreadx/rougee-play-beats", icon: Github },
    ],
  };

  return (
    <footer className="w-full mt-16 border-t border-neon-green/20 glass">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Music className="h-4 w-4 text-neon-green" />
              <h3 className="text-sm font-bold neon-text font-mono">
                ROUGEE
              </h3>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mb-3">
              Decentralized blockchain music platform. Own your music, trade artist tokens.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-mono font-semibold text-foreground mb-3 text-xs">
              PRODUCT
            </h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-[10px] text-muted-foreground hover:text-neon-green transition-colors font-mono"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-mono font-semibold text-foreground mb-3 text-xs">
              RESOURCES
            </h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  {'path' in link ? (
                    <button
                      onClick={() => navigate(link.path)}
                      className="text-[10px] text-muted-foreground hover:text-neon-green transition-colors font-mono"
                    >
                      {link.name}
                    </button>
                  ) : (
                    <a
                      href={link.href}
                      target={link.href?.startsWith('http') ? '_blank' : undefined}
                      rel={link.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-[10px] text-muted-foreground hover:text-neon-green transition-colors font-mono"
                    >
                      {link.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h4 className="font-mono font-semibold text-foreground mb-3 text-xs">
              COMMUNITY
            </h4>
            <div className="flex flex-col space-y-3">
              {footerLinks.community.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-neon-green transition-colors font-mono group"
                  >
                    <Icon className="h-3 w-3 group-hover:scale-110 transition-transform" />
                    {link.name}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-neon-green/10 flex flex-col md:flex-row justify-between items-center gap-3 max-w-6xl mx-auto">
          <p className="text-[10px] text-muted-foreground font-mono text-center md:text-left">
            © {currentYear} ROUGEE. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
            <button onClick={() => navigate("/privacy-policy")} className="hover:text-neon-green transition-colors">
              Privacy Policy
            </button>
            <span>|</span>
            <button onClick={() => navigate("/terms-of-service")} className="hover:text-neon-green transition-colors">
              Terms of Service
            </button>
            <span>|</span>
            <button onClick={() => navigate("/cookie-policy")} className="hover:text-neon-green transition-colors">
              Cookie Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
