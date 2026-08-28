# Tab Walker

Tab Walker is a high-performance browser extension for Google Chrome and Mozilla Firefox that enhances tab navigation and browser search with an in-page overlay card, Most Recently Used (MRU) tab ordering, multi-source Omnibox search, and deep UI customization.

## Features

- ⚡ **In-Page Overlay Switcher**: Triggered via `Alt+Y` shortcut inside any web page without leaving your current workflow.
- 🕒 **MRU Tab Ordering**: Tracks tab activation history across all open browser windows, keeping recently used tabs easily accessible.
- 🔎 **Multi-Source Omnibox Search**: Instant unified search across open tabs, persistent web search suggestions, browser history, and bookmarks.
- 🎯 **Draggable Overlay Card**: Drag the search card to any position on screen; card positions persist relative to the viewport center.
- 🎨 **Theme & Visual Customization**: Integrated Light/Dark themes, adjustable popup dimensions, font/icon sizing, opacity control, and custom user CSS overrides.
- 🛡️ **Shadow DOM Isolation**: The overlay is rendered inside a Shadow DOM (`#tab-walker-host`) to prevent web page styles from corrupting the extension UI.
- 🦊 **Cross-Browser Support**: Fully implemented for Chrome (Manifest V3 service worker) and Firefox.

## Documentation

Detailed topic documentation is available in the [`docs/`](docs/) directory:

- 🏗️ **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System component design, state management, scripting auto-injection, and message protocol reference.
- 🔎 **[SEARCH.md](docs/SEARCH.md)** — Omnibox search hierarchy priority, tier base scores, multi-word matching rules, and DOM highlighting.
- 🎨 **[CUSTOMIZATION.md](docs/CUSTOMIZATION.md)** — Options UI controls, Shadow DOM CSS token layer, semantic CSS class reference, and custom CSS code snippets.

## Project Structure

```text
tab-walker/
├── chrome-extension/         # Chrome Manifest V3 extension
│   ├── background.js         # Service worker (MRU tab state, history/bookmark search)
│   ├── content.js            # In-page Shadow DOM overlay & search UI
│   ├── manifest.json         # Extension manifest with permissions
│   ├── icons/                # Light and dark toolbar icons
│   └── settings/             # Options popup (HTML, JS, CSS)
├── firefox-extension/        # Firefox extension (Manifest V3 / WebExtensions)
│   ├── background.js         # Background script with browser polyfill
│   ├── content.js            # In-page Shadow DOM overlay & search UI
│   ├── manifest.json         # Extension manifest with gecko settings
│   ├── icons/                # Light and dark toolbar icons
│   └── settings/             # Options popup (HTML, JS, CSS)
└── docs/                     # Detailed topic documentation
    ├── ARCHITECTURE.md       # Architecture design & message protocol
    ├── SEARCH.md             # Omnibox search hierarchy & matching rules
    └── CUSTOMIZATION.md      # Styling guide and semantic CSS class reference
```

## Installation

### Google Chrome (or Chromium Browsers)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `chrome-extension` directory from this project.

### Mozilla Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `firefox-extension/manifest.json` from this project.

## Usage & Shortcuts

- **Toggle Overlay**: Press **`Alt+Y`** (or configured extension command shortcut).
- **Navigate Results**: Use **`ArrowUp`** / **`ArrowDown`** to move selection up and down.
- **Activate Result**: Press **`Enter`** (or click a result item) to switch tab, navigate to a history/bookmark item, or execute a web search.
- **Clear Search Input**: Press **`Escape`** when search input contains text to clear query and restore MRU tab list (popup stays open).
- **Close Window**: Press **`Escape`** when search input is empty or click anywhere on the overlay backdrop to close the window.
- **Settings Popup**: Click the extension icon in the toolbar to open the options UI for theme, dimensions, and custom CSS adjustments.
