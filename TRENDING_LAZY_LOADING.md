# Trending Page Lazy Loading Implementation

## Problem
The Trending page was loading all 50 songs at once on initial page load, which:
- Slowed down initial page render
- Loaded images and data that users might never see
- Created unnecessary network requests
- Impacted performance on slower connections

## Solution
Implemented **infinite scroll with lazy loading** - starting with 5 songs and loading 5 more as the user scrolls.

## Implementation Details

### Changes Made

#### 1. Added Visible Count State
```typescript
const [visibleCount, setVisibleCount] = useState(5); // Start with 5 items visible
```

#### 2. Updated Display Logic
```typescript
const displayedSongs = useMemo(() => {
  const limited = displayLimit ? sortedSongs.slice(0, displayLimit) : sortedSongs;
  // Only show visibleCount items for lazy loading
  return limited.slice(0, visibleCount);
}, [sortedSongs, displayLimit, visibleCount]);
```

#### 3. Infinite Scroll Handler
```typescript
useEffect(() => {
  const handleScroll = () => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    
    // When user scrolls to 80% of the page, load 5 more items
    if (scrollPosition >= pageHeight * 0.8) {
      const totalAvailable = displayLimit ? Math.min(sortedSongs.length, displayLimit) : sortedSongs.length;
      if (visibleCount < totalAvailable) {
        setVisibleCount(prev => Math.min(prev + 5, totalAvailable));
      }
    }
  };

  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [visibleCount, sortedSongs.length, displayLimit]);
```

#### 4. Reset on Filter Changes
```typescript
useEffect(() => {
  setVisibleCount(5); // Reset to 5 items when filters change
}, [displayLimit, sortField, sortDirection, searchQuery]);
```

#### 5. Loading Indicators
Added "Loading more..." indicators in both desktop (table) and mobile (cards) views:

**Desktop Table:**
```tsx
{!loading && visibleCount < totalAvailable && (
  <TableRow>
    <TableCell colSpan={9} className="text-center py-4">
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading more songs...</span>
      </div>
    </TableCell>
  </TableRow>
)}
```

**Mobile Cards:**
```tsx
{!loading && visibleCount < totalAvailable && (
  <div className="text-center py-4">
    <div className="flex items-center justify-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading more...</span>
    </div>
  </div>
)}
```

## Performance Benefits

### Before
- ❌ Loaded all 50 songs immediately
- ❌ Rendered 50 rows/cards on initial load
- ❌ Fetched all 50 album covers at once
- ❌ Loaded all trading data for 50 songs
- ❌ Slower initial page load

### After
- ✅ Loads only 5 songs initially (90% reduction)
- ✅ Renders 5 rows/cards on initial load
- ✅ Fetches only 5 album covers initially
- ✅ Loads trading data for 5 songs only
- ✅ Much faster initial page load
- ✅ Seamless loading as user scrolls
- ✅ Only loads data that users actually view

## User Experience

### Scroll Behavior
1. **Page loads** → Shows 5 songs immediately
2. **User scrolls to 80%** → Automatically loads 5 more songs
3. **Loading indicator** → Shows "Loading more..." while fetching
4. **Seamless transition** → New songs appear smoothly
5. **Continues** → Loads 5 more every time user reaches 80%

### Edge Cases Handled
- ✅ Resets to 5 items when changing filters (TOP 20, TOP 50, ALL)
- ✅ Resets to 5 items when changing sort order
- ✅ Resets to 5 items when searching
- ✅ Works on both desktop (table) and mobile (cards) views
- ✅ Doesn't load more if all songs are already displayed

## Technical Notes

### Load Trigger Point
- **80% scroll position** chosen for optimal UX
- Users see "Loading more..." briefly before running out of content
- Prevents jarring "end of page" experience

### Batch Size
- **5 songs per batch** for quick loading
- Small enough to load fast
- Large enough to reduce frequency of loads
- Can be adjusted if needed

### Performance Monitoring
To monitor performance improvement:
```javascript
// Before: 50 components + 50 images + 50 price queries
// After: 5 components + 5 images + 5 price queries (initial load)
```

## Future Enhancements
- [ ] Add virtualization for very large lists (100+ songs)
- [ ] Implement predictive prefetching based on scroll velocity
- [ ] Add "Load More" button as fallback for users who prefer clicking
- [ ] Track analytics on how many songs users actually view
- [ ] Optimize trading data loading to batch requests

## Related Files
- `src/pages/Trending.tsx` - Main implementation
- `src/hooks/useSong24hData.ts` - Trading data (already has caching)
- `src/components/SongPriceSparkline.tsx` - Price charts (load on demand)

## Testing Checklist
- [x] Initial load shows 5 songs
- [x] Scrolling to 80% loads 5 more
- [x] Loading indicator appears
- [x] Works on desktop table view
- [x] Works on mobile card view
- [x] Resets on filter change
- [x] Resets on sort change
- [x] Resets on search
- [x] Stops loading when all songs displayed

