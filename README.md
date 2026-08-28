# Tab Walker

Tab Walker is a browser extension for Google Chrome and Mozilla Firefox that provides an in-page tab switcher and search overlay. It lists open tabs in Most Recently Used (MRU) order and searches tabs, browser history, bookmarks, and the web.

## Features

- **In-Page Overlay**: Press `Alt+Y` to open the search switcher over the current page.
- **MRU Tab List**: Keeps track of recently activated tabs across open windows.
- **Unified Search**: Filters open tabs instantly and searches history and bookmarks.
- **Draggable Card**: Drag the header to reposition the search box. Card position persists across sessions.
- **Theme & Sizing Settings**: Supports Light/Dark themes, adjustable dimensions, font size, icon size, overlay opacity, and custom CSS.
- **Shadow DOM**: Renders inside a Shadow DOM (`#tab-walker-host`) to prevent host-page CSS from breaking the overlay layout.
- **Cross-Browser**: Supports Chrome (Manifest V3) and Firefox (WebExtensions).

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Extension components, state management, and message protocol.
- [SEARCH.md](docs/SEARCH.md) — Search scoring, priority tiers, matching logic, and highlighting.
- [CUSTOMIZATION.md](docs/CUSTOMIZATION.md) — Settings options, CSS classes, and style customization examples.

## Project Structure

```text
tab-walker/
├── chrome-extension/         # Chrome extension
│   ├── background.js         # Service worker (MRU tab order, history/bookmark search)
│   ├── content.js            # Content script (Shadow DOM overlay UI)
│   ├── manifest.json         # Extension manifest
│   ├── icons/                # Toolbar icons
│   └── settings/             # Options popup (HTML, JS, CSS)
├── firefox-extension/        # Firefox extension
│   ├── background.js         # Background script
│   ├── content.js            # Content script (Shadow DOM overlay UI)
│   ├── manifest.json         # Extension manifest
│   ├── icons/                # Toolbar icons
│   └── settings/             # Options popup (HTML, JS, CSS)
└── docs/                     # Technical documentation
    ├── ARCHITECTURE.md
    ├── SEARCH.md
    └── CUSTOMIZATION.md
```

## Installation

### Google Chrome (or Chromium)

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `chrome-extension` directory.

### Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `firefox-extension/manifest.json`.

## Keyboard Shortcuts & Controls

- **`Alt+Y`**: Toggle overlay switcher.
- **`ArrowUp` / `ArrowDown`**: Move selection in the result list.
- **`Enter`**: Activate the selected item or execute web search.
- **`Escape`**: Clears text if input is not empty; closes overlay if input is empty.
- **Click Overlay Backdrop**: Closes the overlay.
- **Drag Header**: Repositions the search card.
