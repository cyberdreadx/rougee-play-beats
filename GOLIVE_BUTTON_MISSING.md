# GO LIVE Button Missing - Quick Fix

## Where to Find GO LIVE Button

### On Desktop (>768px width):
- Should be in the **left sidebar**
- Below "MY PROFILE"
- Highlighted with special styling

### On Mobile (<768px width):
- Click the **"Menu" button** (hamburger icon) in the bottom nav bar
- The sidebar will slide out from the right
- "GO LIVE" should be in that menu

## Quick Debug Steps

1. **Check if you're on mobile view**
   - Open browser DevTools (F12)
   - Check console for these logs:
     ```javascript
     console.log('Profile:', profile);
     console.log('Is Artist:', isArtist);
     console.log('Has artist name:', profile?.artist_name);
     ```

2. **Try refreshing the page**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - This ensures the latest code is loaded

3. **Check if profile loaded**
   - Open browser console (F12)
   - Type: `localStorage.getItem('supabase.auth.token')`
   - If null, you're not logged in properly

4. **Try navigating directly**
   - Go to: `http://localhost:8080/go-live`
   - If it works, the button is just hidden
   - If it redirects you away, there's a permission issue

## If Still Missing

The button visibility depends on:
```typescript
isArtist || profile?.verified || profile?.artist_name
```

One of these must be true:
- ✅ `isArtist` = true (you have an artist profile)
- ✅ `profile?.verified` = true (you're verified)
- ✅ `profile?.artist_name` exists (you have an artist name set)

Check your profile in the database:
1. Go to Supabase Dashboard
2. Open `profiles` table
3. Find your wallet address
4. Check the `artist_name` column - should have a value

## Temporary Direct Access

While debugging, you can always go directly to:
```
http://localhost:8080/go-live
```

Just type it in your browser's address bar!

