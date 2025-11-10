import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, Loader2, Wallet, CreditCard } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { toast } from "@/hooks/use-toast";
import { useFundWallet } from "@privy-io/react-auth";
import xrgeLogo from "@/assets/tokens/xrge.png";
import ktaLogo from "@/assets/tokens/kta.png";
import type { Address } from "viem";

interface Song {
  cover_cid: string | null;
  ticker: string | null;
}

interface SongTradeFormProps {
  isConnected: boolean;
  song: Song | null;
  songTokenAddress: `0x${string}` | undefined;
  tradeMode: 'buy' | 'sell';
  setTradeMode: (mode: 'buy' | 'sell') => void;
  buyAmount: string;
  setBuyAmount: (amount: string) => void;
  sellAmount: string;
  setSellAmount: (amount: string) => void;
  paymentToken: 'XRGE' | 'ETH' | 'KTA' | 'USDC';
  setPaymentToken: (token: 'XRGE' | 'ETH' | 'KTA' | 'USDC') => void;
  userBalance: string | null;
  priceInXRGE: number | undefined;
  activeTradingSupply: number | undefined;
  xrgeEquivalent: string;
  buyQuote: string | undefined;
  buyQuoteLoading: boolean;
  sellQuote: string | undefined;
  sellQuoteLoading: boolean;
  wagmiAddress: Address | undefined;
  ethBalance: { formatted: string } | undefined;
  xrgeBalance: { formatted: string } | undefined;
  ktaBalance: { formatted: string } | undefined;
  usdcBalance: { formatted: string } | undefined;
  fullAddress: string | null;
  isProcessingBuy: boolean;
  isBuying: boolean;
  isSelling: boolean;
  isApproving: boolean;
  isSwapping: boolean;
  onBuy: () => void;
  onSell: () => void;
}

export default function SongTradeForm({
  isConnected,
  song,
  songTokenAddress,
  tradeMode,
  setTradeMode,
  buyAmount,
  setBuyAmount,
  sellAmount,
  setSellAmount,
  paymentToken,
  setPaymentToken,
  userBalance,
  priceInXRGE,
  activeTradingSupply,
  xrgeEquivalent,
  buyQuote,
  buyQuoteLoading,
  sellQuote,
  sellQuoteLoading,
  wagmiAddress,
  ethBalance,
  xrgeBalance,
  ktaBalance,
  usdcBalance,
  fullAddress,
  isProcessingBuy,
  isBuying,
  isSelling,
  isApproving,
  isSwapping,
  onBuy,
  onSell,
}: SongTradeFormProps) {
  const navigate = useNavigate();
  const { fundWallet } = useFundWallet();

  if (!isConnected) {
    return (
      <Card className="console-bg tech-border p-8 text-center">
        <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-mono font-bold mb-2">Connect Wallet to Trade</h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">
          You need to connect your wallet to buy or sell song tokens
        </p>
        <Button 
          variant="neon" 
          onClick={() => navigate('/')}
          className="font-mono"
        >
          CONNECT WALLET
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Buy/Sell Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-neon-green/30 p-1 bg-black/50 backdrop-blur-sm">
          <button
            onClick={() => setTradeMode('buy')}
            className={`
              px-6 md:px-8 py-2 md:py-3 rounded-lg font-mono text-sm md:text-base font-bold transition-all duration-300
              ${tradeMode === 'buy' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-lg shadow-green-500/30' 
                : 'text-white/60 hover:text-green-400 hover:bg-green-500/5'
              }
            `}
          >
            <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 inline mr-2" />
            BUY
          </button>
          <button
            onClick={() => setTradeMode('sell')}
            className={`
              px-6 md:px-8 py-2 md:py-3 rounded-lg font-mono text-sm md:text-base font-bold transition-all duration-300
              ${tradeMode === 'sell' 
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/30' 
                : 'text-white/60 hover:text-red-400 hover:bg-red-500/5'
              }
            `}
          >
            <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 inline mr-2" />
            SELL
          </button>
        </div>
      </div>

      {/* Buy Card */}
      {tradeMode === 'buy' && (
        <Card className="console-bg tech-border p-4 md:p-6">
          <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
            {song?.cover_cid ? (
              <Avatar className="h-5 w-5 md:h-6 md:w-6 border border-neon-green">
                <AvatarImage
                  src={getIPFSGatewayUrl(song.cover_cid)}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                  {song.ticker?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : null}
            BUY ${song?.ticker ? song.ticker.toUpperCase() : ''}
          </h3>

          <div className="space-y-3 md:space-y-4">
            {/* Transaction Guide - Only show when amount is entered */}
            {paymentToken && buyAmount && parseFloat(buyAmount) > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                <div className="font-mono text-xs space-y-2">
                  <div className="font-bold text-blue-400">💡 Transaction Guide:</div>
                  {paymentToken === "XRGE" && (
                    <div className="bg-green-500/10 p-2 rounded border border-green-500/20">
                      <div className="font-bold text-green-400">XRGE → Song</div>
                      <div>⚡ 1 transaction - Direct purchase</div>
                      <div>💰 No intermediate swaps needed</div>
                    </div>
                  )}
                  {paymentToken === "ETH" && (
                    <div className="bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                      <div className="font-bold text-yellow-400">ETH → Song</div>
                      <div>⚡ 2 transactions - ETH → XRGE → Song</div>
                      <div>💰 ETH swap + song purchase</div>
                    </div>
                  )}
                  {paymentToken === "USDC" && (
                    <div className="bg-orange-500/10 p-2 rounded border border-orange-500/20">
                      <div className="font-bold text-orange-400">USDC → Song</div>
                      <div>⚡ 3 transactions - USDC → XRGE → Song</div>
                      <div>💰 USDC approve + swap + song purchase</div>
                    </div>
                  )}
                  {paymentToken === "KTA" && (
                    <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20">
                      <div className="font-bold text-blue-400">KTA → Song</div>
                      <div>⚡ 5 transactions - KTA → XRGE → Song</div>
                      <div>💰 KTA reset + approve + swap + XRGE approve + song purchase</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Token Selector */}
            <div>
              <label className="text-xs md:text-sm font-mono text-muted-foreground mb-2 block">
                Pay with
              </label>
              <Select value={paymentToken} onValueChange={(value: any) => setPaymentToken(value)}>
                <SelectTrigger className="font-mono">
                  <SelectValue>
                    {paymentToken === 'ETH' && (
                      <div className="flex items-center gap-2">
                        <span>💎</span>
                        <span>ETH (Ethereum)</span>
                      </div>
                    )}
                    {paymentToken === 'XRGE' && (
                      <div className="flex items-center gap-2">
                        <img src={xrgeLogo} alt="XRGE" className="w-4 h-4" />
                        <span>XRGE (Recommended)</span>
                      </div>
                    )}
                    {paymentToken === 'KTA' && (
                      <div className="flex items-center gap-2">
                        <img src={ktaLogo} alt="KTA" className="w-4 h-4" />
                        <span>KTA</span>
                      </div>
                    )}
                    {paymentToken === 'USDC' && (
                      <div className="flex items-center gap-2">
                        <span>💵</span>
                        <span>USDC (Stablecoin)</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETH" className="font-mono">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span>💎</span>
                        <span>ETH</span>
                      </div>
                      {wagmiAddress && ethBalance && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {parseFloat(ethBalance.formatted).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="XRGE" className="font-mono">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <img src={xrgeLogo} alt="XRGE" className="w-4 h-4" />
                        <span>XRGE ⭐</span>
                      </div>
                      {wagmiAddress && xrgeBalance && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {parseFloat(xrgeBalance.formatted).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="KTA" className="font-mono">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <img src={ktaLogo} alt="KTA" className="w-4 h-4" />
                        <span>KTA</span>
                      </div>
                      {wagmiAddress && ktaBalance && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {parseFloat(ktaBalance.formatted).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="USDC" className="font-mono">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span>💵</span>
                        <span>USDC</span>
                      </div>
                      {wagmiAddress && usdcBalance && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {parseFloat(usdcBalance.formatted).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs md:text-sm font-mono text-muted-foreground">
                  Amount ({paymentToken})
                </label>
                {wagmiAddress && (
                  <span className="text-xs text-muted-foreground font-mono">
                    Balance: {
                      paymentToken === 'ETH' ? (ethBalance?.formatted ? parseFloat(ethBalance.formatted).toFixed(4) : '0') :
                      paymentToken === 'XRGE' ? (xrgeBalance?.formatted ? parseFloat(xrgeBalance.formatted).toFixed(2) : '0') :
                      paymentToken === 'KTA' ? (ktaBalance?.formatted ? parseFloat(ktaBalance.formatted).toFixed(2) : '0') :
                      (usdcBalance?.formatted ? parseFloat(usdcBalance.formatted).toFixed(2) : '0')
                    }
                  </span>
                )}
              </div>
              <Input
                type="number"
                placeholder="0.0"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="font-mono"
              />
              
              {/* Percentage Selector Buttons */}
              {wagmiAddress && (
                <div className="grid grid-cols-5 gap-1.5 mt-2">
                  {[
                    { label: '10%', value: 0.1 },
                    { label: '25%', value: 0.25 },
                    { label: '50%', value: 0.5 },
                    { label: '75%', value: 0.75 },
                    { label: 'MAX', value: 1 },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const balance = paymentToken === 'ETH' ? ethBalance :
                                      paymentToken === 'XRGE' ? xrgeBalance :
                                      paymentToken === 'KTA' ? ktaBalance :
                                      usdcBalance;
                        if (balance?.formatted) {
                          const amount = (parseFloat(balance.formatted) * option.value).toFixed(4);
                          setBuyAmount(amount);
                        }
                      }}
                      className="font-mono text-[10px] py-1 h-7 border-neon-green/30 hover:bg-neon-green/10 hover:border-neon-green/50"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="console-bg p-3 md:p-4 rounded-lg border border-border">
              {paymentToken !== 'XRGE' && buyAmount && parseFloat(buyAmount) > 0 && (
                <div className="flex justify-between text-xs md:text-sm font-mono mb-2 pb-2 border-b border-border">
                  <span className="text-muted-foreground">XRGE equivalent:</span>
                  <span className="text-blue-400 flex items-center gap-1">
                    <img src={xrgeLogo} alt="XRGE" className="w-3 h-3" />
                    ~{parseFloat(xrgeEquivalent).toFixed(4)} XRGE
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs md:text-sm font-mono mb-2">
                <span className="text-muted-foreground">You will receive:</span>
                <span className="text-foreground">
                  {buyQuoteLoading ? (
                    <Loader2 className="h-3 w-3 inline animate-spin" />
                  ) : (
                    `~${buyQuote ? parseFloat(buyQuote).toFixed(2) : "0"} tokens`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xs md:text-sm font-mono">
                <span className="text-muted-foreground">Price impact:</span>
                <span className="text-green-500">
                  {xrgeEquivalent && priceInXRGE && buyQuote && parseFloat(buyQuote) > 0 && activeTradingSupply ? (
                    (() => {
                      // Calculate market cap change: (new supply * final price) - (current supply * current price)
                      const newSupply = activeTradingSupply + parseFloat(buyQuote);
                      const avgPricePerToken = parseFloat(xrgeEquivalent) / parseFloat(buyQuote);
                      const currentMC = activeTradingSupply * priceInXRGE;
                      const newMC = newSupply * avgPricePerToken;
                      const mcImpact = ((newMC - currentMC) / currentMC) * 100;
                      return `~${mcImpact.toFixed(2)}%`;
                    })()
                  ) : (
                    "~0%"
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={onBuy} 
                className="w-full" 
                variant="neon" 
                size="sm"
                disabled={isProcessingBuy || isBuying || isApproving || isSwapping || !songTokenAddress}
              >
                {(isProcessingBuy || isBuying || isApproving || isSwapping) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isApproving || isSwapping ? "PROCESSING..." : isProcessingBuy || isBuying ? "BUYING..." : `BUY WITH ${paymentToken}`}
              </Button>

              {/* Apple Pay / Fiat Onramp Button */}
              <Button
                onClick={() => {
                  if (fullAddress) {
                    fundWallet({ address: fullAddress as `0x${string}` });
                    toast({
                      title: "Opening Fiat Onramp",
                      description: "Buy ETH with Apple Pay, then return to purchase song tokens!",
                    });
                  }
                }}
                className="w-full font-mono bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                size="sm"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                BUY ETH WITH APPLE PAY
              </Button>
            </div>

            {(paymentToken === 'KTA' || paymentToken === 'USDC') && (
              <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-mono text-center">
                💡 {paymentToken} purchase requires 3 steps: Approve → Swap to XRGE → Buy
              </div>
            )}

            <p className="text-xs text-muted-foreground font-mono text-center">
              {songTokenAddress ? '✅ Bonding curve active' : '⚠️ Song not deployed to bonding curve'}
            </p>
          </div>
        </Card>
      )}

      {/* Sell Card */}
      {tradeMode === 'sell' && (
        <Card className="console-bg tech-border p-4 md:p-6">
          <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
            {song?.cover_cid ? (
              <Avatar className="h-5 w-5 md:h-6 md:w-6 border border-neon-green">
                <AvatarImage
                  src={getIPFSGatewayUrl(song.cover_cid)}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                  {song.ticker?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : null}
            SELL ${song?.ticker ? song.ticker.toUpperCase() : ''}
          </h3>

          <div className="space-y-3 md:space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs md:text-sm font-mono text-muted-foreground">
                  Amount (${song?.ticker ? song.ticker.toUpperCase() : 'Tokens'})
                </label>
                {userBalance && parseFloat(userBalance) > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    Balance: {parseFloat(userBalance).toFixed(2)}
                  </span>
                )}
              </div>
              <Input
                type="number"
                placeholder="0.0"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="font-mono"
              />
              
              {/* Percentage Selector Buttons */}
              {userBalance && parseFloat(userBalance) > 0 && (
                <div className="grid grid-cols-5 gap-1.5 mt-2">
                  {[
                    { label: '10%', value: 0.1 },
                    { label: '25%', value: 0.25 },
                    { label: '50%', value: 0.5 },
                    { label: '75%', value: 0.75 },
                    { label: 'MAX', value: 1 },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const amount = (parseFloat(userBalance) * option.value).toFixed(4);
                        setSellAmount(amount);
                      }}
                      className="font-mono text-[10px] py-1 h-7 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="console-bg p-3 md:p-4 rounded-lg border border-border">
              <div className="flex justify-between text-xs md:text-sm font-mono mb-2">
                <span className="text-muted-foreground">You will receive:</span>
                <span className="text-foreground">
                  {sellQuoteLoading ? (
                    <Loader2 className="h-3 w-3 inline animate-spin" />
                  ) : (
                    `~${sellQuote ? parseFloat(sellQuote).toFixed(6) : "0"} XRGE`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xs md:text-sm font-mono">
                <span className="text-muted-foreground">Price impact:</span>
                <span className="text-red-500">
                  {sellAmount && priceInXRGE && sellQuote && parseFloat(sellAmount) > 0 && activeTradingSupply ? (
                    (() => {
                      // Calculate market cap change when selling
                      const newSupply = activeTradingSupply - parseFloat(sellAmount);
                      const avgPricePerToken = parseFloat(sellQuote) / parseFloat(sellAmount);
                      const currentMC = activeTradingSupply * priceInXRGE;
                      const newMC = newSupply > 0 ? newSupply * avgPricePerToken : 0;
                      const mcImpact = ((newMC - currentMC) / currentMC) * 100;
                      return `~${Math.abs(mcImpact).toFixed(2)}%`;
                    })()
                  ) : (
                    "~0%"
                  )}
                </span>
              </div>
            </div>

            <Button 
              onClick={onSell} 
              className="w-full" 
              variant="outline" 
              size="sm" 
              disabled={isSelling || isApproving || !songTokenAddress}
            >
              {(isSelling || isApproving) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isApproving ? "APPROVING..." : isSelling ? "SELLING..." : `SELL $${song?.ticker ? song.ticker.toUpperCase() : ''}`}
            </Button>

            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-mono text-center">
              💡 Selling requires 2 steps: Approve → Sell
            </div>

            <p className="text-xs text-muted-foreground font-mono text-center">
              {songTokenAddress ? '✅ Bonding curve active' : '⚠️ Song not deployed to bonding curve'}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

