/**
 * Tab Walker - Firefox Extension Content Script
 * Omnibox-style search overlay supporting open tabs, history, bookmarks, web search, and direct URL navigation.
 * Centralized themeable CSS tokens with user CSS override layer.
 * Closes automatically if window loses focus.
 * Draggable overlay card with viewport center-relative position memory.
 */

(function () {
  if (window.__tabWalkerInjected) return;
  window.__tabWalkerInjected = true;

  const api = typeof browser !== 'undefined' ? browser : chrome;

  const MessageType = {
    PING: 'PING',
    ContentScriptStarted: 'ContentScriptStarted',
    SWITCH_TAB: 'SWITCH_TAB',
    GET_MODEL: 'GET_MODEL',
    CLOSE_POPUP: 'CLOSE_POPUP',
    TOGGLE_WALKER: 'TOGGLE_WALKER',
    SEARCH_WEB: 'SEARCH_WEB',
    SEARCH_OMNIBOX: 'SEARCH_OMNIBOX',
    NAVIGATE_URL: 'NAVIGATE_URL',
    SAVE_POSITION: 'SAVE_POSITION'
  };

  const fallbackFaviconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%234d5055" d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2ZM4 12H8.4C11.81 12.02 13.32 13.73 12.94 17.13H9.49V19.6C13.34 19.89 16.88 18.35 19.29 15.32C19.83 14.13 20.07 12.82 19.99 11.52C19.33 12.5 18.33 13 17 13C14.86 13 13.79 6.16 12.91 6.16C12.91 5.19 13.24 4.56 13.72 4.19C10.18 4.21 6.99 5.77 4.79 8.54C4.27 9.62 4 10.8 4 12Z"/></svg>`;
  const searchIconSvgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%2394a3b8" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
  const bookmarkIconSvgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23f59e0b" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;
  const historyIconSvgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%233b82f6" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>`;
  const navigateIconSvgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%2310b981" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;

  // Create Host Element & Shadow DOM
  const host = document.createElement('div');
  host.id = 'tab-walker-host';
  const shadow = host.attachShadow({ mode: 'open' });

  // Attach Built-in Theme Stylesheet synchronously inside Shadow DOM
  const themeStyle = document.createElement('style');
  themeStyle.id = 'tw-theme-style';
  themeStyle.textContent = `
    :host {
      all: initial !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      display: block !important;

      /* Global Theme Tokens - Typography */
      --tw-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif;
      --tw-font-size-base: 15px;
      --tw-font-size-search: 14px;
      --tw-font-size-badge: 11.5px;
      --tw-font-weight-normal: 400;
      --tw-font-weight-medium: 500;
      --tw-letter-spacing: -0.01em;

      /* Global Theme Tokens - Spacing */
      --tw-padding-card: 12px 12px 10px 12px;
      --tw-padding-tab: 0 16px;
      --tw-padding-search: 0 12px 0 34px;
      --tw-margin-search: 0 0 8px 0;
      --tw-gap-tabs: 2px;
      --tw-padding-tabs-list: 2px 0;

      /* Global Theme Tokens - Radius */
      --tw-radius-card: 14px;
      --tw-radius-search: 8px;
      --tw-radius-tab: 8px;
      --tw-radius-badge: 4px;
      --tw-radius-icon: 3px;
      --tw-radius-scrollbar: 2px;

      /* Global Theme Tokens - Sizing */
      --tw-width-card: 460px;
      --tw-max-height-card: 500px;
      --tw-height-search: 38px;
      --tw-height-tab: 46px;
      --tw-size-icon: 20px;
      --tw-size-search-icon: 14px;
      --tw-width-scrollbar: 4px;
      --tw-opacity-overlay: 1;
    }
    :host(.is-open) {
      pointer-events: auto !important;
    }
    * {
      box-sizing: border-box;
    }
    .tw-overlay {
      box-sizing: border-box;
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding-top: 18vh;
      width: 100%;
      height: 100%;
      font-family: var(--tw-font-family);
      letter-spacing: var(--tw-letter-spacing);
      background: rgba(0, 0, 0, 0.4);
      opacity: var(--tw-opacity-overlay);
    }
    :host(.is-open) .tw-overlay {
      display: flex !important;
    }

    /* Light Theme (Default) Tokens */
    .tw-card {
      --tw-bg-card: #FFFFFF;
      --tw-border-card: rgba(0, 0, 0, 0.08);
      --tw-color-card: #334155;
      --tw-shadow-card: 0 20px 40px -12px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
      --tw-bg-search: #F1F3F5;
      --tw-color-search: #0F172A;
      --tw-placeholder-search: #94A3B8;
      --tw-border-search: rgba(0, 0, 0, 0.06);
      --tw-border-search-focus: rgba(79, 86, 233, 0.4);
      --tw-glow-search-focus: 0 0 0 2px rgba(79, 86, 233, 0.12);
      --tw-icon-search: #94A3B8;
      --tw-bg-tab-selected: #F1F3F9;
      --tw-border-tab-selected: rgba(0, 0, 0, 0.04);
      --tw-color-tab-selected: #0F172A;
      --tw-bg-tab-hover: #F8FAFC;
      --tw-color-text-secondary: #94A3B8;
      --tw-bg-badge: rgba(0, 0, 0, 0.04);
      --tw-color-badge: #64748B;
      --tw-border-badge: rgba(0, 0, 0, 0.06);
      --tw-thumb-scrollbar: rgba(0, 0, 0, 0.15);

      background: var(--tw-bg-card);
      border-radius: var(--tw-radius-card);
      border: 1px solid var(--tw-border-card);
      box-shadow: var(--tw-shadow-card);
      color: var(--tw-color-card);
      width: var(--tw-width-card);
      max-width: 90vw;
      max-height: var(--tw-max-height-card);
      padding: var(--tw-padding-card);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    /* Dark Theme Tokens */
    .tw-card.tw-card--dark {
      --tw-bg-card: #111215;
      --tw-border-card: rgba(255, 255, 255, 0.08);
      --tw-color-card: #C4C7D0;
      --tw-shadow-card: 0 24px 48px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      --tw-bg-search: rgba(255, 255, 255, 0.04);
      --tw-color-search: #FFFFFF;
      --tw-placeholder-search: #5C606E;
      --tw-border-search: rgba(255, 255, 255, 0.06);
      --tw-border-search-focus: rgba(79, 86, 233, 0.5);
      --tw-glow-search-focus: 0 0 0 2px rgba(79, 86, 233, 0.15);
      --tw-icon-search: #5C606E;
      --tw-bg-tab-selected: rgba(255, 255, 255, 0.06);
      --tw-border-tab-selected: rgba(255, 255, 255, 0.05);
      --tw-color-tab-selected: #FFFFFF;
      --tw-bg-tab-hover: rgba(255, 255, 255, 0.03);
      --tw-color-text-secondary: #5C606E;
      --tw-bg-badge: rgba(255, 255, 255, 0.06);
      --tw-color-badge: #8C909F;
      --tw-border-badge: rgba(255, 255, 255, 0.08);
      --tw-thumb-scrollbar: rgba(255, 255, 255, 0.15);
    }

    .tw-search-container {
      position: relative;
      flex-shrink: 0;
      width: 100%;
      margin: var(--tw-margin-search);
      cursor: grab;
    }
    .tw-search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: var(--tw-size-search-icon);
      height: var(--tw-size-search-icon);
      fill: var(--tw-icon-search);
      pointer-events: none;
      transition: fill 0.15s ease;
    }
    .tw-search-input {
      width: 100%;
      height: var(--tw-height-search);
      padding: var(--tw-padding-search);
      font-size: var(--tw-font-size-search);
      font-family: inherit;
      border: 1px solid var(--tw-border-search);
      border-radius: var(--tw-radius-search);
      background: var(--tw-bg-search);
      color: var(--tw-color-search);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
      cursor: text;
    }
    .tw-search-input::placeholder {
      color: var(--tw-placeholder-search);
    }
    .tw-search-input:focus {
      border-color: var(--tw-border-search-focus);
      box-shadow: var(--tw-glow-search-focus);
    }
    .tw-tabs-list {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: var(--tw-gap-tabs);
      padding: var(--tw-padding-tabs-list);
      margin: 0;
      scroll-behavior: smooth;
    }
    .tw-tabs-list::-webkit-scrollbar {
      width: var(--tw-width-scrollbar);
    }
    .tw-tabs-list::-webkit-scrollbar-track {
      background: transparent;
    }
    .tw-tabs-list::-webkit-scrollbar-thumb {
      background: var(--tw-thumb-scrollbar);
      border-radius: var(--tw-radius-scrollbar);
    }
    .tw-tab, .result {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: var(--tw-height-tab);
      flex-shrink: 0;
      padding: 6px 14px;
      border-radius: var(--tw-radius-tab);
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
      transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
    }
    .tw-tab:hover, .result:hover {
      background-color: var(--tw-bg-tab-hover);
    }
    .tw-tab.tw-tab--selected, .result.result-selected {
      background-color: var(--tw-bg-tab-selected);
      border-color: var(--tw-border-tab-selected);
      color: var(--tw-color-tab-selected);
    }
    .tw-tab__info {
      display: flex;
      align-items: center;
      min-width: 0;
      flex: 1;
      margin-right: 12px;
    }
    .tw-tab__icon-wrapper {
      width: var(--tw-size-icon);
      height: var(--tw-size-icon);
      border-radius: var(--tw-radius-icon);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 12px;
      overflow: hidden;
    }
    .tw-tab__icon {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .result-title, .tw-tab__text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--tw-font-size-base);
      font-weight: var(--tw-font-weight-medium);
      color: inherit;
    }
    .result-url {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11.5px;
      color: var(--tw-color-text-secondary);
      line-height: 1.2;
      margin-top: 1px;
    }
    .result-type, .tw-tab__badge {
      font-size: var(--tw-font-size-badge);
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace;
      font-variant-numeric: tabular-nums;
      padding: 2px 6px;
      border-radius: var(--tw-radius-badge);
      background: var(--tw-bg-badge);
      color: var(--tw-color-badge);
      border: 1px solid var(--tw-border-badge);
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.1s ease;
      text-transform: uppercase;
    }
    .tw-tab.tw-tab--selected .result-type,
    .tw-tab.tw-tab--selected .tw-tab__badge,
    .tw-tab:hover .result-type,
    .tw-tab:hover .tw-tab__badge,
    .result.result-selected .result-type,
    .result:hover .result-type {
      opacity: 1;
    }
    mark.tw-highlight {
      background: rgba(79, 86, 233, 0.25);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }
    .tw-no-results {
      padding: 24px 16px;
      text-align: center;
      color: var(--tw-color-text-secondary);
      font-size: 14px;
      line-height: 1.5;
    }
  `;

  // Attach User CSS Layer stylesheet inside Shadow DOM (loads AFTER built-in stylesheet)
  const userStyle = document.createElement('style');
  userStyle.id = 'tw-user-style';
  userStyle.textContent = '';

  // Synchronous DOM construction with stable semantic class names
  const overlay = document.createElement('div');
  overlay.className = 'tw-overlay';

  const card = document.createElement('div');
  card.className = 'tw-card';

  const searchContainer = document.createElement('div');
  searchContainer.className = 'tw-search-container';

  const searchIconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  searchIconSvg.setAttribute('class', 'tw-search-icon');
  searchIconSvg.setAttribute('viewBox', '0 0 24 24');
  searchIconSvg.setAttribute('width', '14');
  searchIconSvg.setAttribute('height', '14');

  const searchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  searchPath.setAttribute('d', 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z');
  searchIconSvg.appendChild(searchPath);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'tw-search-input';
  searchInput.placeholder = 'Search tabs, history, bookmarks, or web...';

  searchContainer.appendChild(searchIconSvg);
  searchContainer.appendChild(searchInput);

  const tabsList = document.createElement('div');
  tabsList.className = 'tw-tabs-list';

  card.appendChild(searchContainer);
  card.appendChild(tabsList);
  overlay.appendChild(card);

  shadow.appendChild(themeStyle);
  shadow.appendChild(userStyle);
  shadow.appendChild(overlay);

  function attachHost() {
    if (document.documentElement) {
      document.documentElement.appendChild(host);
    } else if (document.body) {
      document.body.appendChild(host);
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        (document.documentElement || document.body).appendChild(host);
      });
    }
  }
  attachHost();

  // State Management
  let isOpen = false;
  let allTabs = [];
  let filteredResults = [];
  let selectedIndex = 0;
  let settings = {};
  let searchQuery = '';
  let searchDebounceTimer = null;
  let currentSearchSeq = 0;

  // Dragging state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  searchContainer.addEventListener('mousedown', (e) => {
    if (e.target === searchInput) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = card.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    searchContainer.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const newLeft = Math.max(10, Math.min(window.innerWidth - card.offsetWidth - 10, initialLeft + deltaX));
    const newTop = Math.max(10, Math.min(window.innerHeight - 80, initialTop + deltaY));

    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'flex-start';
    overlay.style.paddingTop = '0';

    card.style.position = 'absolute';
    card.style.left = `${newLeft}px`;
    card.style.top = `${newTop}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      searchContainer.style.cursor = 'grab';

      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;

      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      const posOffset = {
        offsetX: Math.round(cardCenterX - viewportCenterX),
        offsetY: Math.round(cardCenterY - viewportCenterY)
      };

      settings.position = posOffset;

      api.runtime.sendMessage({
        type: MessageType.SAVE_POSITION,
        position: posOffset
      });
    }
  });

  function applyCardPosition() {
    if (settings.position && typeof settings.position.offsetX === 'number' && typeof settings.position.offsetY === 'number') {
      overlay.style.alignItems = 'flex-start';
      overlay.style.justifyContent = 'flex-start';
      overlay.style.paddingTop = '0';

      const cardWidth = card.offsetWidth || settings.popupWidth || 460;
      const cardHeight = card.offsetHeight || 300;

      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      let targetLeft = viewportCenterX + settings.position.offsetX - (cardWidth / 2);
      let targetTop = viewportCenterY + settings.position.offsetY - (cardHeight / 2);

      targetLeft = Math.max(10, Math.min(window.innerWidth - cardWidth - 10, targetLeft));
      targetTop = Math.max(10, Math.min(window.innerHeight - 80, targetTop));

      card.style.position = 'absolute';
      card.style.left = `${Math.round(targetLeft)}px`;
      card.style.top = `${Math.round(targetTop)}px`;
    } else {
      overlay.style.alignItems = 'flex-start';
      overlay.style.justifyContent = 'center';
      overlay.style.paddingTop = '18vh';

      card.style.position = 'relative';
      card.style.left = 'auto';
      card.style.top = 'auto';
    }
  }

  window.addEventListener('resize', () => {
    if (isOpen) {
      applyCardPosition();
    }
  });

  function getFaviconUrl(item) {
    if (item.favIconUrl && !item.favIconUrl.startsWith('chrome://') && !item.favIconUrl.startsWith('about:')) {
      return item.favIconUrl;
    }
    return null;
  }

  function normalizeUrl(url) {
    if (!url) return '';
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }

  function isUrlLike(query) {
    const q = query.trim().toLowerCase();
    if (/^https?:\/\//.test(q)) return true;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(q) && q.includes('.')) return true;
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(q)) return true;
    return false;
  }

  function calculateScore(title, url, rawQuery, queryTerms, itemType, indexOrTime) {
    const t = (title || '').toLowerCase();
    const u = (url || '').toLowerCase();
    const q = rawQuery.toLowerCase();

    let matchScore = 0;
    let allTermsMatch = true;

    for (const term of queryTerms) {
      const inTitle = t.includes(term);
      const inUrl = u.includes(term);
      if (!inTitle && !inUrl) {
        allTermsMatch = false;
        break;
      }
    }

    if (!allTermsMatch) return 0;

    // Exact or prefix matches get substantial boost
    if (t === q) matchScore += 600;
    else if (t.startsWith(q)) matchScore += 450;

    if (u === q || u.replace(/^https?:\/\/(www\.)?/, '') === q) matchScore += 500;
    else if (u.includes(q)) matchScore += 300;

    queryTerms.forEach(term => {
      if (t.includes(term)) matchScore += 100;
      if (u.includes(term)) matchScore += 50;
    });

    let baseScore = 0;
    if (itemType === 'TAB') {
      baseScore = 10000 - (indexOrTime * 3); // 1. Tabs
    } else if (itemType === 'HISTORY') {
      baseScore = 4000; // 3. History
    } else if (itemType === 'BOOKMARK') {
      baseScore = 1000; // 4. Bookmarks
    }

    return baseScore + matchScore;
  }

  function renderHighlightText(text, queryTerms) {
    if (!queryTerms || queryTerms.length === 0 || !text) {
      return document.createTextNode(text || '');
    }

    const fragment = document.createDocumentFragment();
    const lowerText = text.toLowerCase();
    const ranges = [];

    queryTerms.forEach(term => {
      if (!term) return;
      let pos = 0;
      while ((pos = lowerText.indexOf(term, pos)) !== -1) {
        ranges.push({ start: pos, end: pos + term.length });
        pos += term.length;
      }
    });

    if (ranges.length === 0) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    ranges.sort((a, b) => a.start - b.start);
    const merged = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      const curr = ranges[i];
      if (curr.start <= last.end) {
        last.end = Math.max(last.end, curr.end);
      } else {
        merged.push(curr);
      }
    }

    let lastIdx = 0;
    merged.forEach(r => {
      if (r.start > lastIdx) {
        fragment.appendChild(document.createTextNode(text.substring(lastIdx, r.start)));
      }
      const mark = document.createElement('mark');
      mark.className = 'tw-highlight';
      mark.textContent = text.substring(r.start, r.end);
      fragment.appendChild(mark);
      lastIdx = r.end;
    });

    if (lastIdx < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
    }

    return fragment;
  }

  function updateOmniboxSearch() {
    const rawQuery = searchQuery.trim();
    const queryTerms = rawQuery ? rawQuery.toLowerCase().split(/\s+/).filter(Boolean) : [];
    currentSearchSeq++;
    const thisSeq = currentSearchSeq;

    if (!rawQuery) {
      filteredResults = allTabs.map((tab, idx) => ({
        itemType: 'TAB',
        title: tab.title || tab.url || 'Untitled Tab',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl || '',
        tab: tab,
        score: 1000 - idx
      }));
      selectedIndex = allTabs.length > 1 ? 1 : 0;
      renderResults(queryTerms);
      return;
    }

    // 1. Instant local tab scoring
    const openTabUrls = new Set();
    const tabResults = [];

    allTabs.forEach((tab, mruIdx) => {
      const normUrl = normalizeUrl(tab.url);
      if (normUrl) openTabUrls.add(normUrl);

      const score = calculateScore(tab.title, tab.url, rawQuery, queryTerms, 'TAB', mruIdx);
      if (score > 0) {
        tabResults.push({
          itemType: 'TAB',
          title: tab.title || tab.url || 'Untitled Tab',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl || '',
          tab: tab,
          score: score
        });
      }
    });

    // 2. Direct URL navigation item & Persistent web search suggestion (2. Search Suggestions)
    const extraResults = [];
    if (isUrlLike(rawQuery)) {
      const targetUrl = /^https?:\/\//i.test(rawQuery) ? rawQuery : `https://${rawQuery}`;
      extraResults.push({
        itemType: 'NAVIGATE',
        title: `Navigate to ${rawQuery}`,
        url: targetUrl,
        score: 7500
      });
    }

    extraResults.push({
      itemType: 'SEARCH',
      title: `Search the web for "${rawQuery}"`,
      url: rawQuery,
      query: rawQuery,
      score: 7000
    });

    // Immediate initial render with local tabs + navigation/search
    const combinedInitial = [...extraResults, ...tabResults].sort((a, b) => b.score - a.score);
    filteredResults = combinedInitial;
    selectedIndex = 0;
    renderResults(queryTerms);

    // 4. Debounced history & bookmarks background query
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    searchDebounceTimer = setTimeout(() => {
      api.runtime.sendMessage({
        type: MessageType.SEARCH_OMNIBOX,
        query: rawQuery
      }, (response) => {
        if (thisSeq !== currentSearchSeq || !isOpen) return;
        if (!response) return;

        const historyItems = response.history || [];
        const bookmarkItems = response.bookmarks || [];

        const historyResults = [];
        const bookmarkResults = [];

        bookmarkItems.forEach(b => {
          const norm = normalizeUrl(b.url);
          if (norm && openTabUrls.has(norm)) return; // Skip duplicate open tabs

          const score = calculateScore(b.title, b.url, rawQuery, queryTerms, 'BOOKMARK', 0);
          if (score > 0) {
            bookmarkResults.push({
              itemType: 'BOOKMARK',
              title: b.title || b.url || 'Bookmark',
              url: b.url || '',
              favIconUrl: '',
              score: score
            });
          }
        });

        historyItems.forEach(h => {
          const norm = normalizeUrl(h.url);
          if (norm && openTabUrls.has(norm)) return; // Skip duplicate open tabs

          const score = calculateScore(h.title, h.url, rawQuery, queryTerms, 'HISTORY', h.lastVisitTime);
          if (score > 0) {
            historyResults.push({
              itemType: 'HISTORY',
              title: h.title || h.url || 'History Entry',
              url: h.url || '',
              favIconUrl: '',
              score: score
            });
          }
        });

        const merged = [...extraResults, ...tabResults, ...bookmarkResults, ...historyResults]
          .sort((a, b) => b.score - a.score);

        filteredResults = merged;
        if (selectedIndex >= filteredResults.length) {
          selectedIndex = Math.max(0, filteredResults.length - 1);
        }
        renderResults(queryTerms);
      });
    }, 80);
  }

  function renderResults(queryTerms = []) {
    tabsList.innerHTML = '';

    if (filteredResults.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'tw-no-results';
      noResults.textContent = searchQuery ? `No matching items for "${searchQuery}"` : 'No open tabs';
      tabsList.appendChild(noResults);
      return;
    }

    filteredResults.forEach((item, index) => {
      const itemEl = document.createElement('div');
      const typeClass = `result-${item.itemType.toLowerCase()}`;
      itemEl.className = `tw-tab result ${typeClass}` + (index === selectedIndex ? ' tw-tab--selected result-selected' : '');

      const infoEl = document.createElement('div');
      infoEl.className = 'tw-tab__info';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'tw-tab__icon-wrapper';

      const img = document.createElement('img');
      img.className = 'tw-tab__icon';

      const customFavicon = getFaviconUrl(item);
      if (item.itemType === 'SEARCH') {
        img.src = searchIconSvgData;
      } else if (item.itemType === 'NAVIGATE') {
        img.src = navigateIconSvgData;
      } else if (customFavicon) {
        img.src = customFavicon;
      } else if (item.itemType === 'BOOKMARK') {
        img.src = bookmarkIconSvgData;
      } else if (item.itemType === 'HISTORY') {
        img.src = historyIconSvgData;
      } else {
        img.src = fallbackFaviconSvg;
      }

      img.onerror = () => {
        if (item.itemType === 'SEARCH') img.src = searchIconSvgData;
        else if (item.itemType === 'NAVIGATE') img.src = navigateIconSvgData;
        else if (item.itemType === 'BOOKMARK') img.src = bookmarkIconSvgData;
        else if (item.itemType === 'HISTORY') img.src = historyIconSvgData;
        else img.src = fallbackFaviconSvg;
      };

      iconWrapper.appendChild(img);

      const textContainer = document.createElement('div');
      textContainer.className = 'tw-tab__text-wrapper';
      textContainer.style.display = 'flex';
      textContainer.style.flexDirection = 'column';
      textContainer.style.minWidth = '0';
      textContainer.style.flex = '1';

      const titleEl = document.createElement('span');
      titleEl.className = 'tw-tab__text result-title';
      titleEl.appendChild(renderHighlightText(item.title || item.url || '', queryTerms));
      textContainer.appendChild(titleEl);

      if (item.url && item.itemType !== 'SEARCH') {
        const urlEl = document.createElement('span');
        urlEl.className = 'result-url';
        urlEl.appendChild(renderHighlightText(item.url, queryTerms));
        textContainer.appendChild(urlEl);
      }

      infoEl.appendChild(iconWrapper);
      infoEl.appendChild(textContainer);

      const badgeEl = document.createElement('span');
      badgeEl.className = 'tw-tab__badge result-type';
      badgeEl.textContent = item.itemType;

      itemEl.appendChild(infoEl);
      itemEl.appendChild(badgeEl);

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        activateResult(item);
      });

      itemEl.addEventListener('mouseenter', () => {
        selectedIndex = index;
        highlightSelectedResult();
      });

      tabsList.appendChild(itemEl);
    });

    highlightSelectedResult();
  }

  function highlightSelectedResult() {
    const children = tabsList.children;
    for (let i = 0; i < children.length; i++) {
      if (i === selectedIndex) {
        children[i].classList.add('tw-tab--selected', 'result-selected');
        children[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        children[i].classList.remove('tw-tab--selected', 'result-selected');
      }
    }
  }

  function activateResult(item) {
    if (!item) return;
    closePopup();

    if (item.itemType === 'TAB' && item.tab) {
      api.runtime.sendMessage({
        type: MessageType.SWITCH_TAB,
        selectedTab: item.tab
      });
    } else if (item.itemType === 'NAVIGATE' || item.itemType === 'BOOKMARK' || item.itemType === 'HISTORY') {
      api.runtime.sendMessage({
        type: MessageType.NAVIGATE_URL,
        url: item.url
      });
    } else if (item.itemType === 'SEARCH') {
      api.runtime.sendMessage({
        type: MessageType.SEARCH_WEB,
        query: item.query
      });
    }
  }

  function openPopup() {
    api.runtime.sendMessage({ type: MessageType.GET_MODEL }, (model) => {
      if (!model || !model.tabs) return;

      allTabs = model.tabs || [];
      settings = model.settings || {};

      card.className = 'tw-card' + (settings.isDarkTheme ? ' tw-card--dark' : ' tw-card--light');
      host.style.setProperty('--tw-opacity-overlay', (settings.opacity || 100) / 100);
      host.style.setProperty('--tw-width-card', `${settings.popupWidth || 460}px`);
      host.style.setProperty('--tw-max-height-card', `${settings.windowHeight || 500}px`);

      host.style.setProperty('--tw-height-tab', `${settings.tabHeight || 42}px`);
      if (settings.fontSize) {
        host.style.setProperty('--tw-font-size-base', `${settings.fontSize}px`);
      }
      if (settings.iconSize) {
        host.style.setProperty('--tw-size-icon', `${settings.iconSize}px`);
      }

      // User CSS Override Layer
      userStyle.textContent = settings.customCss || '';

      searchQuery = '';
      searchInput.value = '';

      host.classList.add('is-open');
      isOpen = true;

      updateOmniboxSearch();
      applyCardPosition();

      setTimeout(() => {
        searchInput.focus();
      }, 20);
    });
  }

  function closePopup() {
    isOpen = false;
    host.classList.remove('is-open');
    searchQuery = '';
    searchInput.value = '';
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  }

  // Keyboard navigation & search input listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    selectedIndex = 0;
    updateOmniboxSearch();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closePopup();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closePopup();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredResults.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredResults.length;
        highlightSelectedResult();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredResults.length > 0) {
        selectedIndex = (selectedIndex - 1 + filteredResults.length) % filteredResults.length;
        highlightSelectedResult();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredResults.length > 0 && filteredResults[selectedIndex]) {
        activateResult(filteredResults[selectedIndex]);
      } else if (searchQuery.trim().length > 0) {
        closePopup();
        api.runtime.sendMessage({
          type: MessageType.SEARCH_WEB,
          query: searchQuery.trim()
        });
      }
    }
  }, true);

  // Auto-hide when window loses focus or document becomes hidden
  window.addEventListener('blur', () => {
    if (isOpen) closePopup();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isOpen) closePopup();
  });

  // Message listener from background script
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageType.PING) {
      sendResponse({ status: 'ok' });
      return true;
    }
    if (message.type === MessageType.TOGGLE_WALKER) {
      if (isOpen) {
        closePopup();
      } else {
        openPopup();
      }
      sendResponse({ status: 'ok' });
      return true;
    }
    if (message.type === MessageType.CLOSE_POPUP) {
      closePopup();
      sendResponse({ status: 'ok' });
      return true;
    }
  });

  // Notify background script that content script is ready
  api.runtime.sendMessage({ type: MessageType.ContentScriptStarted });
})();
