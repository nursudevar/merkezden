# Favicon Configuration Guide

## Overview

This project uses a standardized favicon setup that works consistently across all browsers (Chrome, Safari, Edge, Yandex, etc.).

## Source of Truth

The **single source of truth** for the favicon is:
- **Location**: `src/app/favicon.ico`
- **Format**: PNG image (1024x1024 pixels) with `.ico` extension
- **Next.js App Router**: Automatically serves this file at `/favicon.ico`

## How It Works

### Next.js App Router Icon Handling

In Next.js 13+ with App Router, icon files placed in the `app/` directory are automatically:
- Detected and served at the root path
- Referenced in the HTML `<head>` automatically
- Cached appropriately by browsers

### Icon Files Structure

```
src/app/
  └── favicon.ico          # Main favicon (served at /favicon.ico)

public/
  ├── apple-icon.png       # Apple touch icon for iOS/macOS Safari (180x180)
  └── icon.png             # Standard icon for modern browsers (512x512)
```

### Metadata Configuration

The icon configuration is defined in `src/app/layout.tsx` using Next.js metadata API:

```typescript
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};
```

## Browser Support

### Chrome / Edge / Yandex
- Uses `/favicon.ico` (classic favicon)
- Falls back to `/icon.png` for modern formats

### Safari (macOS / iOS)
- Uses `/apple-icon.png` for home screen icons and bookmarks
- Uses `/favicon.ico` for tab icons
- **Note**: Safari aggressively caches icons. If you see an old icon:
  1. Hard refresh: `Cmd+Shift+R` (macOS) or `Ctrl+Shift+R` (Windows)
  2. Clear Safari cache: Safari → Preferences → Advanced → Show Develop menu → Empty Caches
  3. Or use private browsing to test

### Other Browsers
- Firefox, Opera, etc. use `/favicon.ico` or `/icon.png`

## How to Update the Favicon

### Step 1: Replace the Source File

Replace `src/app/favicon.ico` with your new icon file. The file should be:
- **Format**: PNG or ICO
- **Recommended size**: 1024x1024 pixels (or larger, square)
- **Name**: Keep it as `favicon.ico` (even if it's a PNG)

### Step 2: Update Derived Icons (Optional but Recommended)

For best cross-browser support, also update:

1. **Apple Touch Icon** (`public/apple-icon.png`):
   - Size: 180x180 pixels
   - Format: PNG
   - Used by Safari on iOS/macOS for home screen icons

2. **Standard Icon** (`public/icon.png`):
   - Size: 512x512 pixels (or larger)
   - Format: PNG
   - Used by modern browsers

You can use image editing tools or online converters to create these sizes from your source favicon.

### Step 3: Clear Browser Cache

After updating:
1. **Chrome/Edge**: Hard refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`)
2. **Safari**: Clear cache (see above) or use private browsing
3. **Other browsers**: Clear cache or hard refresh

### Step 4: Verify

1. Check `/favicon.ico` directly in browser: `http://localhost:3000/favicon.ico`
2. Check `/apple-icon.png`: `http://localhost:3000/apple-icon.png`
3. Check `/icon.png`: `http://localhost:3000/icon.png`
4. View page source and verify `<link rel="icon">` tags are present

## Troubleshooting

### Safari Shows Old Icon

Safari caches icons aggressively. Solutions:
1. **Hard refresh**: `Cmd+Shift+R`
2. **Clear Safari cache**: Safari → Develop → Empty Caches
3. **Private browsing**: Test in a new private window
4. **Add cache-busting query**: Temporarily add `?v=2` to icon URLs in metadata

### Icon Not Updating in Any Browser

1. **Check file location**: Ensure `src/app/favicon.ico` exists
2. **Check metadata**: Verify `layout.tsx` has correct icon configuration
3. **Restart dev server**: `npm run dev`
4. **Clear Next.js cache**: Delete `.next` folder and restart
5. **Check file format**: Ensure the file is a valid image

### Icon Looks Blurry

- Use higher resolution source (1024x1024 or larger)
- Ensure `apple-icon.png` is exactly 180x180 pixels
- Use PNG format for better quality (ICO can be lossy)

## File Locations Summary

| File | Location | Served At | Purpose |
|------|----------|-----------|---------|
| Main favicon | `src/app/favicon.ico` | `/favicon.ico` | Classic browsers, tab icons |
| Apple icon | `public/apple-icon.png` | `/apple-icon.png` | Safari iOS/macOS home screen |
| Standard icon | `public/icon.png` | `/icon.png` | Modern browsers, PWA |

## Notes

- Next.js automatically handles `app/favicon.ico` - no manual `<link>` tags needed
- The metadata configuration in `layout.tsx` provides additional icon formats for better compatibility
- All icon files should be square (1:1 aspect ratio)
- For best results, use PNG format even if named `.ico`

