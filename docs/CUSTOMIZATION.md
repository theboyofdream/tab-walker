# Tab Walker — Customization & Styling Guide

Tab Walker provides comprehensive UI customization options through its popup options page and supports deep visual overrides via a custom CSS layer injected into its isolated Shadow DOM root.

## Settings Options

Settings are accessible by clicking the extension icon in your browser toolbar or opening `settings/index.html`. All options are auto-saved to `chrome.storage.local`.

| Setting Field | Control Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isDarkTheme` | Toggle Switch | `false` | Switches card theme between Light and Dark mode. Dynamically updates extension action icon between `icon16.png` and `icon-light16.png`. |
| `popupWidth` | Capsule Range | `460px` | Width of the overlay search card (range: `300px` to `800px`, step: `25px`). |
| `windowHeight` | Capsule Range | `500px` | Maximum height of the overlay search card (range: `200px` to `900px`, step: `25px`). |
| `tabHeight` | Capsule Range | `42px` | Minimum height of individual item rows in the list (range: `28px` to `60px`, step: `2px`). |
| `fontSize` | Capsule Range | `15px` | Base font size for item title text (range: `12px` to `22px`, step: `1px`). |
| `iconSize` | Capsule Range | `20px` | Favicon and result type icon size (range: `14px` to `32px`, step: `2px`). |
| `opacity` | Capsule Range | `100%` | Opacity of the background overlay backdrop (range: `50%` to `100%`, step: `5%`). |
| `isSwitchingToPreviouslyUsedTab` | Toggle Switch | `true` | When `true`, closing the active tab automatically focuses the most recently used (MRU) tab. |
| `customCss` | Textarea | `""` | User-defined CSS rules injected into the Shadow DOM root after built-in theme styles. |

## Shadow DOM & Semantic CSS Classes

The overlay UI lives inside an isolated Shadow DOM (`#tab-walker-host`). User CSS rules entered in the **Custom CSS Overrides** box are injected directly into `<style id="tw-user-style">` inside the shadow root.

You can target elements using the following stable semantic CSS classes:

| Class Name | Element Description |
| :--- | :--- |
| `.result` | Container element for any result row (alias for `.tw-tab`). |
| `.result-tab` | Result row representing an open tab. |
| `.result-search` | Result row representing persistent web search. |
| `.result-navigate` | Result row representing direct URL navigation. |
| `.result-history` | Result row representing a history entry. |
| `.result-bookmark` | Result row representing a bookmark entry. |
| `.result-selected` | Class added to the currently highlighted/selected item (keyboard navigation or mouse hover). |
| `.result-title` | Title text element (`<span class="tw-tab__text result-title">`). |
| `.result-url` | Subtitle URL text element (`<span class="result-url">`). |
| `.result-type` | Badge label element displaying `TAB`, `SEARCH`, `NAVIGATE`, `HISTORY`, or `BOOKMARK`. |
| `mark.tw-highlight` | Highlighted text range matching search query terms. |

## Custom CSS Examples

Copy and paste any of these examples into the **Custom CSS Overrides** box in Tab Walker Settings:

### 1. Custom Accent Colors

```css
.tw-card {
  --tw-border-search-focus: #8b5cf6;
  --tw-glow-search-focus: 0 0 0 2px rgba(139, 92, 246, 0.2);
  --tw-bg-tab-selected: rgba(139, 92, 246, 0.12);
  --tw-border-tab-selected: rgba(139, 92, 246, 0.3);
}

mark.tw-highlight {
  background: rgba(139, 92, 246, 0.3);
}
```

### 2. Distinct Badge Colors per Result Type

```css
.result-tab .result-type {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.2);
}

.result-history .result-type {
  background: rgba(168, 85, 247, 0.12);
  color: #a855f7;
  border-color: rgba(168, 85, 247, 0.2);
}

.result-bookmark .result-type {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.2);
}

.result-search .result-type,
.result-navigate .result-type {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.2);
}
```

### 3. Always Show Badges

By default, item badges are semi-transparent and become fully opaque when hovered or selected. To make badges visible at all times:

```css
.result-type {
  opacity: 0.8 !important;
}
```

### 4. Compact Ultra-Density View

```css
.tw-card {
  --tw-padding-card: 8px;
  --tw-height-search: 32px;
  --tw-height-tab: 34px;
}

.result {
  padding: 4px 10px !important;
}

.result-url {
  display: none !important; /* Hide URL subtitles for ultra-compact tab switching */
}
```
