import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { XRGE_TIERS } from "@/hooks/useXRGETier";
import { ArrowLeft, Trophy } from "lucide-react";

export default function Tiers() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 font-mono"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-mono font-bold neon-text">XRGE TIERS</h1>
          </div>
          
          <p className="text-muted-foreground font-mono">
            Hold XRGE tokens to unlock exclusive benefits and status badges
          </p>
        </div>

        {/* Tiers Grid */}
        <div className="space-y-4">
          {XRGE_TIERS.map((tier, index) => (
            <Card
              key={tier.name}
              className={`
                console-bg tech-border p-6 transition-all duration-300
                ${tier.borderColor} hover:scale-[1.02]
              `}
            >
              <div className="flex items-start gap-4">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                    {tier.icon}
                  </div>
                </div>

                {/* Tier Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={`text-xl font-bold font-mono ${tier.color}`}>
                      {tier.name}
                    </h3>
                    {index === 0 && (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-500 font-mono">
                        HIGHEST
                      </span>
                    )}
                  </div>

                  {/* Requirement */}
                  <div className="mb-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      Requirement:
                    </span>
                    <span className={`text-lg font-bold font-mono ml-2 ${tier.color}`}>
                      {tier.minAmount >= 1_000_000
                        ? `${(tier.minAmount / 1_000_000).toLocaleString()}M+ XRGE`
                        : `${tier.minAmount.toLocaleString()}+ XRGE`}
                    </span>
                  </div>

                  {/* Benefits */}
                  <div>
                    <span className="text-sm font-mono text-muted-foreground mb-2 block">
                      Benefits:
                    </span>
                    <ul className="space-y-1">
                      {tier.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <span className={tier.color}>✓</span>
                          <span className="font-mono">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* How to Get XRGE */}
        <Card className="console-bg tech-border p-6 mt-8">
          <h3 className="text-xl font-bold font-mono neon-text mb-4">
            How to Get XRGE
          </h3>
          <div className="space-y-3 text-sm font-mono">
            <p>1. Connect your wallet to ROUGEE</p>
            <p>2. Go to the <span className="text-neon-green">Swap</span> page</p>
            <p>3. Buy XRGE tokens with ETH or other tokens</p>
            <p>4. Your tier badge will update automatically based on your balance</p>
          </div>
          <Button
            onClick={() => navigate('/swap')}
            className="w-full mt-4 font-mono bg-neon-green hover:bg-neon-green/90 text-background"
          >
            Buy XRGE Now
          </Button>
        </Card>

        {/* FAQ */}
        <Card className="console-bg tech-border p-6 mt-4">
          <h3 className="text-xl font-bold font-mono neon-text mb-4">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4 text-sm font-mono">
            <div>
              <p className="font-bold text-neon-green mb-1">Q: How often do badges update?</p>
              <p className="text-muted-foreground">A: Badges check your on-chain XRGE balance every 2 minutes automatically.</p>
            </div>
            <div>
              <p className="font-bold text-neon-green mb-1">Q: Do I need to hold XRGE forever?</p>
              <p className="text-muted-foreground">A: Yes, your tier is based on your current balance. If you sell XRGE, your tier will adjust.</p>
            </div>
            <div>
              <p className="font-bold text-neon-green mb-1">Q: What if I have 0 XRGE?</p>
              <p className="text-muted-foreground">A: You still get 20 free upload slots. Holding XRGE unlocks unlimited uploads at 1M+.</p>
            </div>
            <div>
              <p className="font-bold text-neon-green mb-1">Q: Where does my badge appear?</p>
              <p className="text-muted-foreground">A: Your badge shows on your profile, feed posts, comments, and artist pages.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

