# Search Engine

Tab Walker ranks and displays results from open tabs, search suggestions, browser history, and bookmarks.

## Result Order & Priority

Search results are scored and categorized into four tiers:

1. **Open Tabs (`TAB`)**: Base score starts at `10,000`. Sorted by match score and MRU index.
2. **Search Suggestions**:
   - Direct URL Navigation (`NAVIGATE`): Base score `7,500` if query resembles a URL.
   - Web Search (`SEARCH`): Base score `7,000` for web search execution.
3. **Browser History (`HISTORY`)**: Base score `4,000` + match score.
4. **Bookmarks (`BOOKMARK`)**: Base score `1,000` + match score.

When the input is empty, Tab Walker displays all open tabs in MRU order.

## Scoring Algorithm

Scoring is computed by `calculateScore()`:

1. **Multi-Word Filter**: The search query is split into whitespace-delimited terms. Every term must match either the title or the URL. If any term is missing, the item score is `0`.
2. **Match Score Boosts**:
   - Exact Title Match: `+600`
   - Title Prefix Match: `+450`
   - Exact URL Match: `+500`
   - URL Substring Match: `+300`
   - Term Title Match: `+100` per term
   - Term URL Match: `+50` per term
3. **Tier Base Scores**:
   - `TAB`: `10,000 - (mruIndex * 3) + matchScore`
   - `NAVIGATE`: `7,500`
   - `SEARCH`: `7,000`
   - `HISTORY`: `4,000 + matchScore`
   - `BOOKMARK`: `1,000 + matchScore`
4. **Deduplication**: `normalizeUrl()` strips protocol, `www.`, and trailing slashes. History and bookmark entries matching an open tab URL are excluded.

## Text Highlighting

Matching query terms are highlighted in the UI using DOM text nodes and `<mark class="tw-highlight">` elements via `renderHighlightText()`. Overlapping match ranges are merged before creating nodes to avoid HTML string concatenation.

## Async Search Execution

1. **Immediate Filtering**: Open tabs are scored immediately on input.
2. **Debounced History/Bookmark Search**: After 80ms of typing inactivity, the content script sends a `SEARCH_OMNIBOX` message to the background script.
3. **Sequence Check**: Incrementing `currentSearchSeq` ensures out-of-order responses from older queries are ignored.
