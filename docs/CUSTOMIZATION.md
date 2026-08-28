# Customization & Styling

Tab Walker provides visual settings in the options page and supports custom CSS overrides inside the Shadow DOM root.

## Settings Options

Settings are accessed via the extension popup (`settings/index.html`) and saved to `chrome.storage.local`.

| Setting Field | Control Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isDarkTheme` | Toggle Switch | `false` | Switches between Light and Dark mode. Updates extension toolbar icon. |
| `popupWidth` | Range Slider | `460px` | Overlay card width (`300px` to `800px`, step `25px`). |
| `windowHeight` | Range Slider | `500px` | Overlay card max height (`200px` to `900px`, step `25px`). |
| `tabHeight` | Range Slider | `42px` | Row minimum height (`28px` to `60px`, step `2px`). |
| `fontSize` | Range Slider | `15px` | Item title font size (`12px` to `22px`, step `1px`). |
| `iconSize` | Range Slider | `20px` | Favicon and type icon size (`14px` to `32px`, step `2px`). |
| `opacity` | Range Slider | `100%` | Backdrop overlay opacity (`50%` to `100%`, step `5%`). |
| `isSwitchingToPreviouslyUsedTab` | Toggle Switch | `true` | When active tab closes, activates the most recently used (MRU) tab. |
| `customCss` | Text Area | `""` | CSS rules appended to the `<style id="tw-user-style">` element in the Shadow DOM. |

## Shadow DOM & CSS Classes

The overlay UI renders inside `#tab-walker-host` Shadow DOM. Rules in `customCss` are injected after built-in styles.

Semantic CSS classes available for styling:

| Class Name | Element Description |
| :--- | :--- |
| `.result` | Result row container (alias for `.tw-tab`). |
| `.result-tab` | Row representing an open tab. |
| `.result-search` | Row representing web search execution. |
| `.result-navigate` | Row representing direct URL navigation. |
| `.result-history` | Row representing a history item. |
| `.result-bookmark` | Row representing a bookmark item. |
| `.result-selected` | Class applied to the currently selected row. |
| `.result-title` | Title text element (`<span class="result-title">`). |
| `.result-url` | Subtitle URL element (`<span class="result-url">`). |
| `.result-type` | Type badge label (`TAB`, `SEARCH`, `NAVIGATE`, `HISTORY`, `BOOKMARK`). |
| `mark.tw-highlight` | Highlighted matching query text. |

## Custom CSS Examples

Enter these rules in the **Custom CSS Overrides** box in Tab Walker Settings:

### Custom Accent Color

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

### Result Type Badge Colors

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

### Always-Visible Badges

```css
.result-type {
  opacity: 0.8 !important;
}
```

### Compact View

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
  display: none !important;
}
```
