# RouteGuard PWA CSS & Design System Verification Steps

When you run `npm run dev`, please follow these verification steps to confirm the design system is working correctly.

## 🔍 Network Tab Verification
1. Open browser dev tools → Network tab
2. Reload the page
3. Filter by CSS
4. Verify all 3 CSS files load with status 200 (NO 404s):
   - `http://localhost:5173/lib/styles/base.css`
   - `http://localhost:5173/lib/styles/tokens.css`
   - `http://localhost:5173/lib/styles/map.css`
5. Check for any other 404 errors (JS files, icons, etc.)

## 🚨 Console Tab Verification
1. Open browser dev tools → Console tab
2. Reload the page
3. Look for ANY JavaScript errors, particularly:
   - Leaflet map initialization errors
   - Supabase client initialization errors
   - Auth store initialization errors
   - MapUtils function errors
   - Component initialization errors
   - TypeScript compilation errors

## 🎨 Design System Application Verification

### Agency Request Screen (KNOWN TO WORK)
Navigate to `/agency-request` and verify:
1. Buttons have correct primary styling:
   - Background: `var(--primary)`
   - Text color: white
   - Border radius: `var(--radius)`
2. Input fields have correct styling:
   - Border: `1.5px solid var(--border)`
   - Background: `var(--surface)`
   - Text color: `var(--ink)`
   - Border radius: `var(--radius)`
3. Error/success messages have appropriate background colors
4. Check computed styles in dev tools to confirm CSS variables from `tokens.css` are being applied

### Map Page (MAIN FOCUS)
Navigate to `/map` and verify:
1. **Container sizing:**
   - `.map-container` has `height: 100vh`
   - `.map-container` `background-color` matches `--map-land` token (light gray `#EDF1F6` in light mode)
2. **Leaflet map initialization:**
   - Map initializes without errors in console
   - User location marker appears and updates
3. **Hazard markers:**
   - Display with correct colors based on status:
     - Impassable: `var(--danger)` (red)
     - Partial: `var(--warning)` (orange)
     - Clear: `var(--success)` (green)
     - Uncertain: `var(--info)` (grey)
4. **Popup content (if any hazards exist):**
   - Properly escaped HTML (no XSS vulnerabilities)
   - Consistent typography using `var(--f)`

### Dark Theme Verification
1. Open dev tools → Application tab → Storage → Local Storage
2. OR add `[data-theme="dark"]` to the `<html>` element in dev tools
3. Verify colors switch to dark theme variants:
   - `--bg` becomes dark background
   - `--ink` becomes light text
   - `--primary` may adjust for dark mode contrast

## 📱 Responsive Verification
1. Toggle device toolbar in dev tools
2. Test mobile viewport (320px width)
3. Verify:
   - Layout adapts correctly
   - Menu navigation works
   - Forms are usable on touch screens
   - Map remains functional

## 🎯 Key Insight from Working Components
The agency request screen working correctly proves that:
1. Design system tokens are properly defined in `tokens.css`
2. `base.css` applies foundational styles
3. `map.css` enhancements for form fields are working
4. Svelte components (Button, Field, Icon) correctly use the design system
5. CSS loading mechanism via `src/app.html` is functional

## 🤔 If You See a "White" Map Screen
This is expected behavior because:
1. The `.map-container` background is `--map-land` (`#EDF1F6` light gray) which can appear white
2. The full Z.AI map UI structure (proto bar, error banner, phone view, etc.) isn't implemented yet
3. You're seeing the Leaflet map tiles over the light gray background

**Next steps after verification:**
1. Complete the map page with full Z.AI UI structure (proto bar, error banner, phone view, etc.)
2. Implement hazard verification workflow
3. Finish notification system (proximity alerts + verification prompts)
4. Enhance A* routing with real OSM data

Please run the dev server and report back what you find in the verification steps above.