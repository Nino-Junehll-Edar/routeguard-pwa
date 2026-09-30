# CSS Debugging Guide for RouteGuard PWA

## Current Status
- CSS files exist in `static/lib/styles/`:
  - base.css (635B)
  - tokens.css (1.7K)
  - map.css (16.5K)
- References in `src/app.html` are correct:
  ```html
  <link rel="stylesheet" href="/lib/styles/base.css" />
  <link rel="stylesheet" href="/lib/styles/tokens.css" />
  <link rel="stylesheet" href="/lib/styles/map.css" />
  ```
- SvelteKit serves the `static` directory at the root path by default
- No SSR errors currently (CSS links moved from layout to app.html)
- Updated base.css to set `html, body { height: 100%; }` to ensure full-height containers

## Why CSS Might Not Be Applying (404 Errors)
1. **Incorrect URL in browser**: Check the exact 404 URL in browser dev tools Network tab
2. **Cache or service worker**: Hard refresh (Ctrl+F5) or disable cache in dev tools
3. **Base path mismatch**: If running with a base path (e.g., `/myapp/`), CSS paths need adjustment
4. **File watching issue**: Dev server might not have picked up new static files (rare)
5. **Path typo**: Extra/missing characters in href (though we verified)

## Steps to Diagnose
1. Run `npm run dev` (you said you'll handle this)
2. Open browser dev tools → Network tab
3. Reload page and filter by CSS
4. Look for 404 requests to `/lib/styles/*.css`
5. Check the **Request URL** and compare to:
   - Expected: `http://localhost:5173/lib/styles/base.css` (port may vary)
   - Actual file location: `static\lib\styles\base.css`

## If You See 404 for:
- `/lib/styles/base.css` → Verify `static/lib/styles/base.css` exists
- `/lib/styles/tokens.css` → Verify `static\lib\styles\tokens.css` exists
- `/lib/styles/map.css` → Verify `static\lib\styles\map.css` exists

## If CSS Loads But No Styles Apply
1. Check if CSS rules are being overridden (dev tools Styles tab)
2. Verify CSS variables are defined (check `:root` and `[data-theme=dark]` in tokens.css)
3. Ensure no syntax errors in CSS files (dev tools will show warnings)
4. Confirm HTML elements have expected classes (e.g., `btn`, `field`, `input`)
5. For the map page specifically:
   - Check if the `.map-container` has the correct height and background color (from `--map-land`)
   - Check for JavaScript errors in the console (especially related to Leaflet or map initialization)
   - Ensure the map container is not being hidden by other elements

## If You See a White Screen on the Map Page
1. The `.map-container` background color is `--map-land` which is a light gray (`#EDF1F6` in light mode) that may appear white
2. Verify the Leaflet map is initializing correctly (check console for errors)
3. The Z.AI design for the map includes additional elements like the proto bar (`#proto`), error banner (`#errbox`), and phone view (`#view-phone`). These are not currently rendered in the map page. If you wish to see the full Z.AI map design, the map page HTML would need to be updated to include these elements.
4. However, the design system tokens and basic styling (buttons, fields, etc.) are being applied correctly as evidenced by the agency request screen.

## Quick Checks You Can Perform Now
1. Verify file casing: All files are lowercase (`base.css`, not `Base.css`)
2. Check for hidden characters in app.html (we've reviewed it)
3. Confirm static directory is at project root (not inside src/)