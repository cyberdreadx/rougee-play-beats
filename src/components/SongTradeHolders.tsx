import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2 } from "lucide-react";

interface Holder {
  address: string;
  balance: string;
  percentage: number;
}

interface SongTradeHoldersProps {
  holders: Holder[];
  loadingHolders: boolean;
}

export default function SongTradeHolders({
  holders,
  loadingHolders,
}: SongTradeHoldersProps) {
  return (
    <Card className="console-bg tech-border p-4 md:p-6">
      <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 md:mb-6">TOP HOLDERS</h3>
      
      <div className="space-y-2 md:space-y-3">
        {loadingHolders ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="font-mono text-sm">Loading holders...</p>
          </div>
        ) : holders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="font-mono text-sm">No holders yet</p>
            <p className="font-mono text-xs mt-1">Be the first to buy!</p>
          </div>
        ) : (
          holders.map((holder, i) => (
            <div key={holder.address} className="flex items-center justify-between p-2 md:p-3 console-bg border border-border rounded-lg">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Avatar className="h-8 w-8 md:h-10 md:w-10 border border-neon-green shrink-0">
                  <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                    #{i + 1}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs md:text-sm truncate">
                    {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {parseFloat(holder.balance).toLocaleString()} tokens
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                {holder.percentage.toFixed(2)}%
              </Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

