import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Rocket, Wallet, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import xrgeLogo from "@/assets/tokens/xrge.png";
import type { Address } from "viem";

interface Song {
  id: string;
  title: string;
  ticker?: string | null;
  wallet_address: string;
}

interface SongTradeStatsProps {
  song: Song | null;
  songTokenAddress: `0x${string}` | undefined;
  currentPrice: number | undefined;
  priceInXRGE: number | undefined;
  priceChange24h: number | null;
  volume24h: number;
  xrgeUsdPrice: number;
  userBalance: string | null;
  currentPriceAfterFee: number | undefined;
  hasRealisticData: boolean;
  marketCapUSD: number;
  realizedValueXRGE: number;
  activeTradingSupply: number | undefined;
  holderCount: number;
  loadingHolders: boolean;
  copiedAddress: boolean;
  fullAddress: string | null;
  isDeploying: boolean;
  isConfirming: boolean;
  onAddTokenToWallet: () => void;
  onCopyTokenAddress: () => void;
  onDeploy: () => void;
}

export default function SongTradeStats({
  song,
  songTokenAddress,
  currentPrice,
  priceInXRGE,
  priceChange24h,
  volume24h,
  xrgeUsdPrice,
  userBalance,
  currentPriceAfterFee,
  hasRealisticData,
  marketCapUSD,
  realizedValueXRGE,
  activeTradingSupply,
  holderCount,
  loadingHolders,
  copiedAddress,
  fullAddress,
  isDeploying,
  isConfirming,
  onAddTokenToWallet,
  onCopyTokenAddress,
  onDeploy,
}: SongTradeStatsProps) {
  return (
    <Card className="console-bg tech-border p-3 sm:p-4 md:p-6">
      {songTokenAddress && currentPrice !== undefined ? (
        <>
          <h3 className="text-sm sm:text-base md:text-lg font-mono font-bold neon-text mb-2 md:mb-3">CURRENT PRICE</h3>
          <div className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-neon-green mb-1 md:mb-2 break-all">
            {currentPrice ? (
              currentPrice < 0.01 ? 
                `$${currentPrice.toFixed(10).replace(/\.?0+$/, '')}` : 
                `$${currentPrice.toFixed(6)}`
            ) : '$0'}
          </div>
          <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-mono mb-2 break-words">
            per token {priceInXRGE && <span className="opacity-50">({priceInXRGE.toFixed(6)} XRGE)</span>}
          </p>
          
          {/* 24h Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3 md:mb-4">
            <div className="p-2 bg-background/50 border border-border rounded">
              <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-1">24h Change</div>
              {priceChange24h !== null ? (
                <div className={`font-mono font-semibold text-xs sm:text-sm flex items-center gap-1 ${priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                </div>
              ) : (
                <div className="text-muted-foreground font-mono text-xs">—</div>
              )}
            </div>
            <div className="p-2 bg-background/50 border border-border rounded">
              <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-1">Volume (24h)</div>
              <div className="font-mono font-semibold text-xs sm:text-sm">
                {volume24h > 0 ? (
                  <>
                    <div>${(volume24h * xrgeUsdPrice).toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                    <div className="text-[9px] text-muted-foreground">{volume24h.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE</div>
                  </>
                ) : (
                  <div className="text-muted-foreground">$0</div>
                )}
              </div>
            </div>
          </div>
          
          {userBalance && parseFloat(userBalance) > 0 && (
            <div className="mb-3 p-2 sm:p-3 bg-neon-green/10 border border-neon-green/30 rounded">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-1">Your Holdings</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-neon-green break-words">
                    {parseFloat(userBalance).toLocaleString(undefined, {maximumFractionDigits: 2})} {song?.ticker || 'tokens'}
                  </div>
                  {currentPriceAfterFee && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-1 break-words">
                      Value: ${(parseFloat(userBalance) * currentPriceAfterFee).toFixed(4)}
                      <span className="opacity-50 ml-1 text-[9px] sm:text-[10px]">(after 3% sell fee)</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onAddTokenToWallet}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs bg-neon-green/20 hover:bg-neon-green/30 text-neon-green rounded font-mono transition-colors shrink-0"
                  title="Add to wallet"
                >
                  <Wallet className="h-3 w-3" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </div>
              <button
                onClick={onCopyTokenAddress}
                className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1 text-[10px] sm:text-xs bg-black/20 hover:bg-black/30 text-muted-foreground rounded font-mono transition-colors overflow-hidden"
              >
                {copiedAddress ? (
                  <>
                    <Check className="h-3 w-3 shrink-0" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-full">{songTokenAddress}</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          {xrgeUsdPrice > 0 && (
            <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] sm:text-xs text-blue-400 font-mono flex items-center gap-2">
              <img src={xrgeLogo} alt="XRGE" className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span className="break-words">XRGE = ${xrgeUsdPrice < 0.0001 ? xrgeUsdPrice.toFixed(8) : xrgeUsdPrice.toFixed(6)} USD</span>
            </div>
          )}
          
          {!hasRealisticData && (
            <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] sm:text-xs text-yellow-500 font-mono">
              ⚠️ No trading activity yet - Make the first trade!
            </div>
          )}
          
          {songTokenAddress && !userBalance && (
            <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-blue-400 font-mono">Add token to wallet:</span>
                <button
                  onClick={onAddTokenToWallet}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded font-mono transition-colors"
                >
                  <Wallet className="h-3 w-3" />
                  Add to Wallet
                </button>
              </div>
              <button
                onClick={onCopyTokenAddress}
                className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs bg-black/20 hover:bg-black/30 text-muted-foreground rounded font-mono transition-colors"
              >
                {copiedAddress ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="truncate">{songTokenAddress}</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          <div className="space-y-2 text-xs md:text-sm font-mono">
            {hasRealisticData ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground" title="Market cap (current price × total supply)">Market Cap:</span>
                  <span className="text-neon-green font-semibold">
                    ${marketCapUSD < 1 ? marketCapUSD.toFixed(6) : marketCapUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
                  </span>
                </div>
                <div className="flex justify-between text-xs opacity-70">
                  <span className="text-muted-foreground" title="All-time XRGE spent on this token">Total Traded (XRGE):</span>
                  <span className="text-foreground">
                    {realizedValueXRGE.toLocaleString(undefined, {maximumFractionDigits: 4})} XRGE
                  </span>
                </div>
                {activeTradingSupply !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground" title="Number of tokens purchased from bonding curve">Tokens Sold:</span>
                    <span className="text-foreground">
                      {(990_000_000 - activeTradingSupply).toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground" title="Number of unique wallets holding this token">Holders:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-semibold">
                      {loadingHolders ? '...' : holderCount.toLocaleString()}
                    </span>
                    {songTokenAddress && (
                      <a
                        href={`https://basescan.org/token/${songTokenAddress}#balances`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-green hover:text-neon-green/80 transition-colors"
                        title="View holders on BaseScan"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market Cap:</span>
                  <span className="text-foreground opacity-60">
                    $0.00
                  </span>
                </div>
                {activeTradingSupply !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Starting Supply:</span>
                    <span className="text-foreground opacity-60">
                      {activeTradingSupply.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volume:</span>
                  <span className="text-foreground opacity-60">0 XRGE</span>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-base md:text-lg font-mono font-bold mb-2">Not Deployed Yet</h3>
          <p className="text-xs md:text-sm text-muted-foreground font-mono mb-4">
            {song?.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() 
              ? "Deploy this song to enable trading"
              : "This song hasn't been deployed to the bonding curve yet"}
          </p>
          {song?.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() && (
            <Button 
              onClick={onDeploy} 
              variant="neon" 
              size="sm"
              disabled={isDeploying || isConfirming}
              className="font-mono"
            >
              {isDeploying || isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isDeploying ? "DEPLOYING..." : "CONFIRMING..."}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  DEPLOY TO BONDING CURVE
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

