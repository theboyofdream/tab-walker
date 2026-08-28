# Tab Walker — Search & Omnibox Engine

Tab Walker features an Omnibox-style search engine that aggregates and ranks items from four distinct sources: Open Tabs, Direct URL/Web Search Suggestions, Browser History, and Bookmarks.

## Search Hierarchy & Priority

Search results are scored and categorized into four strict priority tiers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Omnibox Results Hierarchy                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. OPEN TABS           (TAB)          Base Score: 10,000+                   │
│    - Currently open tabs sorted by match score & MRU order                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. SEARCH SUGGESTIONS  (NAVIGATE)     Base Score: 7,500                     │
│                        (SEARCH)       Base Score: 7,000                     │
│    - Direct URL navigation (if input matches URL pattern)                   │
│    - Persistent web search ("Search the web for ...")                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. BROWSER HISTORY     (HISTORY)      Base Score: 4,000+                    │
│    - Recent/frequently visited browser history                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. BOOKMARKS           (BOOKMARK)     Base Score: 1,000+                    │
│    - Browser bookmark matches                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

When a search query is entered:
- Matching **Open Tabs** always appear at the top.
- **Search Suggestions** (Direct URL navigation or persistent Web Search) appear immediately below open tabs.
- Matching **Browser History** entries appear third.
- Matching **Bookmarks** appear fourth.

*Note: When the input field is empty (query is blank), Tab Walker displays all open tabs in MRU order (index `0` is active tab, index `1` is previous tab).*

## Scoring & Ranking Algorithm

Item scoring is computed by `calculateScore(title, url, rawQuery, queryTerms, itemType, indexOrTime)`:

### 1. Multi-Word Matching Requirement
Queries are split into lowercase terms (`queryTerms`). An item matches only if **every** query term is found in either the title or the URL. If any term is missing, the item receives a score of `0` and is excluded.

### 2. Match Score Boosts
Matching items receive additive score boosts based on match quality:
- **Exact Title Match**: `+600`
- **Title Prefix Match**: `+450`
- **Exact URL Match** (or domain match): `+500`
- **URL Substring Match**: `+300`
- **Word Boundary Match**: `+100` per title match, `+50` per URL match.

### 3. Tier Base Scores
- **Open Tabs (`TAB`)**: `10000 - (mruIndex * 3) + matchScore`
  *(MRU position acts as an automatic tie-breaker for tabs with identical match quality).*
- **Direct URL (`NAVIGATE`)**: `7500`
  *(Triggered when `isUrlLike(rawQuery)` is true, e.g. `github.com`, `http://...`, `localhost:3000`).*
- **Web Search (`SEARCH`)**: `7000`
  *(Persistent item: `Search the web for "<query>"`).*
- **History (`HISTORY`)**: `4000 + matchScore`
- **Bookmarks (`BOOKMARK`)**: `1000 + matchScore`

### 4. Deduplication
To keep the search list clean, URLs are normalized using `normalizeUrl(url)` (stripping `http://`, `https://`, `www.`, and trailing slashes). History and bookmark results whose normalized URL matches an already open tab are automatically filtered out.

## Highlighting Implementation

Text highlighting is rendered safely in the Shadow DOM via `renderHighlightText(text, queryTerms)`:
- Computes matching character ranges across query terms.
- Merges overlapping ranges.
- Constructs standard DOM text nodes and `<mark class="tw-highlight">` elements without `innerHTML` string concatenation, eliminating XSS risks.

## Performance & Execution Lifecycle

1. **Instant Local Filtering (0ms)**: As the user types into `<input class="tw-search-input">`, open tabs are scored instantly client-side. The UI renders local tabs along with search/navigate suggestions immediately.
2. **Debounced Async Queries (80ms)**: Content script sends a debounced `SEARCH_OMNIBOX` message to background service worker.
3. **Sequence Guard**: Each query increments `currentSearchSeq`. When background history/bookmark responses return, responses from outdated search sequences are discarded.
