# Tab Walker — System Architecture

Tab Walker is structured as a decoupled browser extension consisting of three primary execution contexts: Background Service Worker (`background.js`), In-Page Content Script (`content.js`), and Options Settings Popup (`settings/index.html`, `index.js`).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Browser Environment                              │
│                                                                             │
│  ┌──────────────────────────────┐        ┌──────────────────────────────┐  │
│  │   Background Worker          │        │    Content Script            │  │
│  │   (background.js)            │        │    (content.js)              │  │
│  │                              │        │                              │  │
│  │  - MRU Tab Registry Array    │        │  - Host Element & Shadow DOM │  │
│  │  - Window & Tab Listeners    │        │  - Draggable Overlay Card    │  │
│  │  - History/Bookmarks Search  │◄──────►│  - Instant Local Tab Search  │  │
│  │  - Storage Sync              │Message │  - Debounced Async Query     │  │
│  │  - Scripting Auto-Inject     │Protocol│  - Keyboard Navigation       │  │
│  └──────────────┬───────────────┘        └──────────────────────────────┘  │
│                 │                                                           │
│                 │ storage.local                                             │
│                 ▼                                                           │
│  ┌──────────────────────────────┐                                           │
│  │   Settings Popup UI          │                                           │
│  │   (settings/index.js)        │                                           │
│  │                              │                                           │
│  │  - Capsule Dimension Sliders │                                           │
│  │  - Theme Toggle Switches     │                                           │
│  │  - Custom CSS Override Area  │                                           │
│  └──────────────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Background Service Worker (`background.js`)

The background service worker acts as the central state manager and browser API gateway.

- **MRU Tab Registry**: Maintains an in-memory array (`mruTabs`) sorted by Most Recently Used order across all open windows. Tab order is persisted to `chrome.storage.local.get('tabs')`.
- **Event Listeners**:
  - `chrome.windows.onFocusChanged`: Updates tab active state when switching windows. Sends `CLOSE_POPUP` message when focus is lost.
  - `chrome.tabs.onActivated`: Updates active tab index in MRU list.
  - `chrome.tabs.onCreated`, `chrome.tabs.onUpdated`, `chrome.tabs.onRemoved`: Synchronizes registry when tabs open, load, or close. If `isSwitchingToPreviouslyUsedTab` is enabled, closing the active tab activates the top MRU tab.
  - `chrome.commands.onCommand`: Listens for `toggle-walker` (`Alt+Y`). Sends `TOGGLE_WALKER` message to the active tab.
- **Scripting Auto-Injection**: If sending `TOGGLE_WALKER` fails (e.g. tab was loaded before extension update), background script uses `chrome.scripting.executeScript` to dynamically inject `content.js` into the active tab on demand.
- **API Proxy**: Executes `chrome.history.search` and `chrome.bookmarks.search` asynchronously upon receiving `SEARCH_OMNIBOX` message and returns sanitized results.

### 2. In-Page Content Script (`content.js`)

The content script renders the interactive overlay UI inside target web pages.

- **Shadow DOM Encapsulation**: Creates `#tab-walker-host` and attaches an open Shadow DOM root. All UI elements, built-in CSS tokens, and user CSS overrides exist strictly within the shadow root to prevent page style contamination.
- **Draggable Card with Position Memory**: The overlay card is draggable via the search input container header. Card movement calculates center-relative viewport offsets (`offsetX`, `offsetY`) and saves them via `SAVE_POSITION` to settings.
- **Interactive Search Engine**:
  - **Local Scoring**: Filters `allTabs` immediately (0ms latency).
  - **Async Enrichment**: Sends debounced `SEARCH_OMNIBOX` message (80ms delay) to background worker for history & bookmarks. Uses sequence tracking (`currentSearchSeq`) to discard outdated responses.
- **Event Dispatching**:
  - `Escape`: Progressive clear search query if text exists, or close overlay if input is empty.
  - Backdrop Click: Clicking on `.tw-overlay` outside `.tw-card` closes the overlay.
  - Window Blur / Visibility Change: Automatically hides overlay when switching windows or hiding tab document.

### 3. Settings Options UI (`settings/`)

The options page is loaded via `action.default_popup`.

- **Settings Storage**: Loads and saves settings directly from `chrome.storage.local.get('settings')`.
- **Interactive Controls**:
  - Stepped Capsule Sliders (`popupWidth`, `windowHeight`, `tabHeight`, `fontSize`, `iconSize`, `opacity`).
  - Craft Toggle Switches (`isDarkTheme`, `isSwitchingToPreviouslyUsedTab`).
  - Custom CSS Textarea (`customCss`).
- **Dynamic Icon Updates**: Updating `isDarkTheme` automatically calls `updateActionIcon()` in background worker to switch toolbar icon paths between light and dark variants (`icon16.png` vs `icon-light16.png`).

## Message Protocol

All communication between extension components uses `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` with structured message objects containing a `type` string from `MessageType`:

| Message Type | Sender | Recipient | Payload | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `PING` | Background | Content | None | Health check to verify content script injection. |
| `ContentScriptStarted` | Content | Background | None | Notifies background script that content script is initialized. |
| `GET_MODEL` | Content | Background | None | Fetches `mruTabs`, `settings`, and zoom factor from background. |
| `TOGGLE_WALKER` | Background | Content | None | Toggles overlay visibility (`is-open` class). |
| `CLOSE_POPUP` | Background | Content | None | Forces overlay to close. |
| `SWITCH_TAB` | Content | Background | `{ selectedTab }` | Activates target tab via `chrome.tabs.update`. |
| `SEARCH_WEB` | Content | Background | `{ query }` | Executes web search via `chrome.search.query` or Google search URL. |
| `SEARCH_OMNIBOX` | Content | Background | `{ query }` | Queries browser history and bookmarks matching query. |
| `NAVIGATE_URL` | Content | Background | `{ url }` | Navigates active tab to direct URL via `chrome.tabs.update`. |
| `SAVE_POSITION` | Content | Background | `{ position }` | Persists center-relative card offset to settings. |
| `GetSettings` | Settings UI | Background | None | Retrieves current settings object. |
| `SetSettings` | Settings UI | Background | `{ settings }` | Overwrites settings object and updates action icon. |

## Cross-Browser Compatibility

- **Chrome (`chrome-extension/`)**: Operates on Manifest V3 with background service worker (`background.service_worker`) and Chrome `_favicon/` API.
- **Firefox (`firefox-extension/`)**: Operates on Manifest V3 WebExtensions (`background.scripts`) with `browser` API polyfill (`const api = typeof browser !== 'undefined' ? browser : chrome;`) and `browser_specific_settings.gecko`.
