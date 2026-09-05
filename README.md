# Tab Walker

Tab Walker is a fast, keyboard-first browser extension for Google Chrome and Mozilla Firefox that provides an in-page tab switcher, omnibox search overlay, and window manager. It lists open tabs in Most Recently Used (MRU) order and searches across open tabs, browser history, bookmarks, and the web.

## Features

- **In-Page Overlay**: Press `Alt+Y` to toggle the fast search switcher overlay over any active page.
- **MRU Tab Navigation**: Access all open tabs sorted by most recently used order across all windows with an unlimited, smooth-scrolling list.
- **Unified Omnibox Search**: Real-time filtering for open tabs, plus debounced search across browser history, bookmarks, URL navigation, and web search.
- **System Theme & Dynamic Icons**: Follows your operating system's color scheme (`system` by default), with support for explicit `light` and `dark` themes and dynamic toolbar icon adaptation.
- **Overlay Scaling & Zoom**: Dynamically scale the overlay UI with `Ctrl +` / `Ctrl -` / `Ctrl 0` to fit your display preferences.
- **Backdrop Blur & Visual Polish**: Configurable backdrop blur (`0–20px`) and overlay opacity with a modern craft UI design system.
- **Focus Shielding**: Isolated event trapping stops host page keystroke hijacking on single-page apps (e.g. ChatGPT, Claude) while the overlay is open.
- **Draggable Card**: Drag the card header to reposition the search window. Position offsets persist across sessions.
- **Shadow DOM Isolation**: Renders inside `#tab-walker-host` Shadow DOM to prevent host-page CSS bleed or style conflicts.
- **Cross-Browser Parity**: Dual-extension builds supporting Chrome (Manifest V3) and Firefox (WebExtensions).

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Extension architecture, components, state management, and message protocol.
- [SEARCH.md](docs/SEARCH.md) — Search scoring, priority tiers, matching logic, and highlighting.
- [CUSTOMIZATION.md](docs/CUSTOMIZATION.md) — Settings options, design tokens, CSS classes, and style customization examples.

## Project Structure

```text
tab-walker/
├── chrome-extension/         # Chrome extension (Manifest V3)
│   ├── background.js         # Service worker (MRU tab order, history/bookmark search)
│   ├── content.js            # Content script (Shadow DOM overlay UI)
│   ├── manifest.json         # Extension manifest
│   ├── icons/                # Toolbar icons (light and dark variants)
│   └── settings/             # Settings popup (HTML, JS, CSS)
├── firefox-extension/        # Firefox extension (WebExtensions)
│   ├── background.js         # Background script
│   ├── content.js            # Content script (Shadow DOM overlay UI)
│   ├── manifest.json         # Extension manifest
│   ├── icons/                # Toolbar icons (light and dark variants)
│   └── settings/             # Settings popup (HTML, JS, CSS)
└── docs/                     # Technical documentation
    ├── ARCHITECTURE.md
    ├── SEARCH.md
    └── CUSTOMIZATION.md
```

## Installation

### Google Chrome (or Chromium)

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `chrome-extension` directory.

### Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `firefox-extension/manifest.json`.

## Keyboard Shortcuts & Controls

- **`Alt+Y`**: Toggle overlay switcher.
- **`ArrowUp` / `ArrowDown`**: Navigate up/down through result list.
- **`Enter`**: Activate selected tab, open history/bookmark, or execute web search.
- **`Escape`**: Clears search query if input has text; closes overlay if input is empty.
- **`Ctrl +` / `Ctrl =`**: Increase overlay scale (+5% per step).
- **`Ctrl -`**: Decrease overlay scale (-5% per step).
- **`Ctrl 0`**: Reset overlay scale to default (100%).
- **Click Overlay Backdrop**: Closes the overlay.
- **Drag Header**: Repositions the search card on the screen.
