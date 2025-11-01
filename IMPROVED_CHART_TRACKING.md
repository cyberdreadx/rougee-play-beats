# Improved Chart Tracking System

## Problem
Charts were fetching data directly from blockchain every 3 seconds, which is:
- **Slow** - Querying from 'earliest' to 'latest' takes time
- **Expensive** - Many RPC calls for each chart
- **Unreliable** - Can fail or timeout
- **Not scalable** - Gets worse as more trades happen

## Solution: Database-Backed Tracking

### Architecture

```
Trade Happens → Edge Function Indexes → Database Stores → Charts Query DB
     ↓                                              ↑
Blockchain Events                              Fast Queries
```

### Components Created

1. **Database Table** (`song_trades` table)
   - Stores all trade data indexed from blockchain
   - Fast queries with proper indexes
   - Real-time ready

2. **Edge Function** (`index-song-trade`)
   - Automatically indexes trades when they happen
   - Called after buy/sell transactions complete
   - One-time indexing per trade

3. **Database Hook** (`useSongTradesFromDB`)
   - Queries database instead of blockchain
   - Much faster (milliseconds vs seconds)
   - Only fetches recent trades (last 24h by default)
   - Auto-refreshes every 3 seconds

### Benefits

✅ **10-100x Faster** - Database queries are instant  
✅ **More Reliable** - No RPC timeouts or failures  
✅ **Scalable** - Works great even with thousands of trades  
✅ **Real-time** - Can use Supabase subscriptions for live updates  
✅ **Cost Effective** - Reduces RPC calls dramatically  
✅ **Better UX** - Charts load instantly with correct data  

### Migration Path

1. **Phase 1**: Keep blockchain queries as fallback
   - Use database when available
   - Fall back to blockchain if no data

2. **Phase 2**: Index existing trades
   - Backfill historical trades
   - Run one-time indexing job

3. **Phase 3**: Full migration
   - All charts use database
   - Only index new trades in real-time

### Usage

```typescript
// In components - use database hook
import { useSongTradesFromDB } from '@/hooks/useSongTradesFromDB';

const { trades, loading, refetch } = useSongTradesFromDB(
  tokenAddress,
  xrgeUsdPrice,
  24 // hours
);

// After trade completes - auto-index
import { useAutoIndexTrades } from '@/hooks/useSongBondingCurve';

const { indexTradeAfterSuccess } = useAutoIndexTrades();

// Call after successful buy/sell
await indexTradeAfterSuccess(txHash, tokenAddress, songId);
```

### Next Steps

1. Deploy migration to create `song_trades` table
2. Deploy edge function `index-song-trade`
3. Update components to use `useSongTradesFromDB`
4. Add auto-indexing after trades complete
5. Optionally: Backfill historical trades

