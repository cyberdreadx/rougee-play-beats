# Basescan API for Token Holders

## Problem
Tracking token holders from blockchain transfer logs is unreliable:
- Limited block range misses early transfers
- Complex balance arithmetic can have errors
- Database purchases may be incomplete
- Slow performance (many RPC calls)

## Solution
Use **Basescan API** (Base's block explorer) - they've already indexed all holders!

### Implementation

```typescript
// Basescan Token Holder List API
const basescanUrl = `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=1&offset=100&apikey=${apiKey}`;

const response = await fetch(basescanUrl);
const data = await response.json();

// Returns accurate holder list with balances
data.result.map(holder => ({
  address: holder.TokenHolderAddress,
  balance: holder.TokenHolderQuantity
}));
```

### API Details

**Endpoint**: `https://api.basescan.org/api`

**Parameters**:
- `module=token`
- `action=tokenholderlist` - Get holder list
- `contractaddress={tokenAddress}` - ERC-20 token address
- `page=1` - Pagination (start at 1)
- `offset=100` - Results per page (max 10,000)
- `apikey={key}` - API key (free tier works)

**Response**:
```json
{
  "status": "1",
  "message": "OK",
  "result": [
    {
      "TokenHolderAddress": "0xCeE9c18C...",
      "TokenHolderQuantity": "985460430000000000000000000"
    },
    {
      "TokenHolderAddress": "0x62f80730...",
      "TokenHolderQuantity": "10781461000000000000000000"
    }
  ]
}
```

### Benefits

**Before (Blockchain Tracking)**:
- ❌ Slow (multiple RPC calls)
- ❌ Incomplete (limited block range)
- ❌ Complex (balance arithmetic)
- ❌ Unreliable (misses holders)

**After (Basescan API)**:
- ✅ Fast (1 API call)
- ✅ Complete (all holders)
- ✅ Simple (pre-calculated balances)
- ✅ Accurate (professionally indexed)
- ✅ Free (no API key needed for basic usage)

### Getting an API Key

1. **Free Tier**: Use `YourApiKeyToken` or no key (rate limited)
2. **Sign Up**: [https://basescan.org/apis](https://basescan.org/apis)
3. **Free Plan**: 5 calls/second, 100k calls/day
4. **Cost**: $0 (free forever)

### Error Handling

The implementation includes fallback to blockchain query if Basescan fails:

```typescript
try {
  // Try Basescan API first
  const data = await fetch(basescanUrl);
  // Use Basescan data
} catch (error) {
  console.warn('Basescan failed, falling back to blockchain');
  // Fallback to transfer log tracking
}
```

### Alternative Endpoints

**Get Holder Count Only**:
```
https://api.basescan.org/api?module=token&action=tokenholdercount&contractaddress={address}&apikey={key}
```

**Get Top N Holders**:
```
https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress={address}&page=1&offset=10&apikey={key}
```

### Pagination

For tokens with >100 holders:

```typescript
// Get first 100
page=1&offset=100

// Get next 100
page=2&offset=100

// Get all (up to 10,000)
page=1&offset=10000
```

### Rate Limits

**Free Tier**:
- 5 requests/second
- 100,000 requests/day
- More than enough for most apps

**With API Key**:
- Recommended for production
- Same limits but tracked per key
- Better reliability

### Integration Notes

1. **Cache Results**: Holders don't change frequently
   - Cache for 30-60 seconds
   - Refresh on buy/sell events

2. **Combine with Database**: 
   - Use Basescan for accuracy
   - Use database for metadata (names, avatars)

3. **Error Recovery**:
   - Always have blockchain fallback
   - Log API failures for monitoring

### Documentation

- **Basescan Docs**: [https://docs.basescan.org/](https://docs.basescan.org/)
- **API Reference**: [https://docs.basescan.org/api-endpoints/tokens](https://docs.basescan.org/api-endpoints/tokens)
- **Etherscan Docs** (same API): [https://docs.etherscan.io/api-reference/endpoint/tokenholdercount](https://docs.etherscan.io/api-reference/endpoint/tokenholdercount)

### Testing

Check in browser console:
```javascript
fetch('https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=0x51e167afc1c2170755924bb79a4992918ff17600&page=1&offset=10')
  .then(r => r.json())
  .then(console.log)
```

Should return all 5 holders with accurate balances!

