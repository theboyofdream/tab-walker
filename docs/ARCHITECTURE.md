# Architecture

Tab Walker consists of three main components: a background script, an in-page content script, and an options popup page.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Browser Environment                              │
│                                                                             │
│  ┌──────────────────────────────┐        ┌──────────────────────────────┐  │
│  │   Background Script          │        │    Content Script            │  │
│  │   (background.js)            │        │    (content.js)              │  │
│  │                              │        │                              │  │
│  │  - MRU tab array             │        │  - Shadow DOM overlay        │  │
│  │  - Window & tab listeners    │◄──────►│  - Instant tab search        │  │
│  │  - History/bookmark search   │Message │  - Debounced history search  │  │
│  │  - Storage synchronization   │Protocol│  - Key navigation & drag     │  │
│  └──────────────┬───────────────┘        └──────────────────────────────┘  │
│                 │                                                           │
│                 │ storage.local                                             │
│                 ▼                                                           │
│  ┌──────────────────────────────┐                                           │
│  │   Settings Popup             │                                           │
│  │   (settings/index.js)        │                                           │
│  │                              │                                           │
│  │  - Settings sliders          │                                           │
│  │  - Theme & MRU toggles       │                                           │
│  │  - Custom CSS input          │                                           │
│  └──────────────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Background Script (`background.js`)

Manages extension state and calls browser extension APIs.

- **MRU Tab List**: Maintains an in-memory array (`mruTabs`) sorted by most recently used tab order across windows. Persists tab IDs to `chrome.storage.local`.
- **Event Listeners**:
  - `chrome.windows.onFocusChanged`: Updates active tab state when switching windows. Sends `CLOSE_POPUP` when window focus is lost.
  - `chrome.tabs.onActivated`: Updates active tab order in the MRU array.
  - `chrome.tabs.onCreated`, `chrome.tabs.onUpdated`, `chrome.tabs.onRemoved`: Keeps the MRU list in sync as tabs open, update, or close. If `isSwitchingToPreviouslyUsedTab` is enabled, closing the active tab switches to the previous MRU tab.
  - `chrome.commands.onCommand`: Listens for `toggle-walker` (`Alt+Y`) and sends `TOGGLE_WALKER` to the active tab.
- **Script Injection**: If sending `TOGGLE_WALKER` fails, attempts to inject `content.js` dynamically via `chrome.scripting.executeScript`.
- **History & Bookmark Search**: Responds to `SEARCH_OMNIBOX` messages by calling `chrome.history.search` and `chrome.bookmarks.search`.

### 2. Content Script (`content.js`)

Renders and handles the overlay UI inside web pages.

- **Shadow DOM**: Creates `#tab-walker-host` and attaches a Shadow DOM root. Styles, DOM structure, and custom user CSS reside inside the shadow root to prevent page CSS interference.
- **Draggable Card**: Dragging the search container header moves the card. Saves viewport-relative offsets (`offsetX`, `offsetY`) to settings via `SAVE_POSITION`.
- **Search & Scoring**: Filters open tabs locally on input. Sends a debounced `SEARCH_OMNIBOX` message (80ms) to request history and bookmark matches from the background script.
- **Event Handling**:
  - `Escape`: Clears text if input is non-empty; closes overlay if input is empty.
  - `blur` on search input: Catches focus loss and triggers text clear or close behavior.
  - Overlay click: Clicking outside the card closes the overlay.
  - `visibilitychange`: Hides overlay when document tab becomes hidden.

### 3. Settings Popup (`settings/`)

Loaded from the extension toolbar action popup.

- **Storage**: Reads and writes settings directly to `chrome.storage.local`.
- **Controls**: Dimension sliders, theme toggles, MRU tab close toggle, and custom CSS text area.
- **Toolbar Icon**: Changing `isDarkTheme` updates the extension toolbar icon between light and dark variants.

## Message Protocol

| Message Type | Sender | Recipient | Payload | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `PING` | Background | Content | None | Verifies content script responsiveness. |
| `ContentScriptStarted` | Content | Background | None | Signals that content script has loaded. |
| `GET_MODEL` | Content | Background | None | Retrieves tabs array and settings. |
| `TOGGLE_WALKER` | Background | Content | None | Toggles overlay visibility. |
| `CLOSE_POPUP` | Background | Content | None | Closes overlay. |
| `SWITCH_TAB` | Content | Background | `{ selectedTab }` | Activates tab via `chrome.tabs.update`. |
| `SEARCH_WEB` | Content | Background | `{ query }` | Executes web search. |
| `SEARCH_OMNIBOX` | Content | Background | `{ query }` | Requests history and bookmark search results. |
| `NAVIGATE_URL` | Content | Background | `{ url }` | Navigates active tab to URL. |
| `SAVE_POSITION` | Content | Background | `{ position }` | Saves card position offset. |
| `GetSettings` | Settings | Background | None | Retrieves settings object. |
| `SetSettings` | Settings | Background | `{ settings }` | Saves settings object. |

## Cross-Browser Differences

- **Chrome (`chrome-extension/`)**: Uses Manifest V3 background service worker and Chrome `_favicon/` API.
- **Firefox (`firefox-extension/`)**: Uses Manifest V3 WebExtensions background scripts and standard browser APIs.
