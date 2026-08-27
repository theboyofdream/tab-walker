/**
 * Popup Tab Switcher - Content Script
 * Displays an isolated Shadow DOM overlay tab switcher with MRU order,
 * scrollable tab list, and real-time title/URL search.
 */

(function () {
  // Prevent duplicate injection
  if (window.__popupTabSwitcherInjected) return;
  window.__popupTabSwitcherInjected = true;

  const MessageType = {
    ContentScriptStarted: 'ContentScriptStarted',
    ContentScriptStopped: 'ContentScriptStopped',
    SWITCH_TAB: 'SWITCH_TAB',
    GET_MODEL: 'GET_MODEL',
    CLOSE_POPUP: 'CLOSE_POPUP',
    SELECT_TAB: 'SELECT_TAB',
    DEMO_SETTINGS: 'DEMO_SETTINGS'
  };

  // Default Fallback Favicon SVG
  const fallbackFaviconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%234d5055" d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2ZM4 12H8.4C11.81 12.02 13.32 13.73 12.94 17.13H9.49V19.6C13.34 19.89 16.88 18.35 19.29 15.32C19.83 14.13 20.07 12.82 19.99 11.52C19.33 12.5 18.33 13 17 13C14.86 13 13.79 12.08 13.79 10.25H10.04C9.77 7.52 10.72 6.16 12.91 6.16C12.91 5.19 13.24 4.56 13.72 4.19C10.18 4.21 6.99 5.77 4.79 8.54C4.27 9.62 4 10.8 4 12Z"/></svg>`;

  // Create Shadow Root container
  const host = document.createElement('div');
  host.id = 'popup-tab-switcher-host';
  const shadow = host.attachShadow({ mode: 'open' });

  // Add styles to Shadow Root
  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: none;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: auto;
    }
    * {
      box-sizing: border-box;
    }
    .overlay {
      all: initial;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: rgba(0, 0, 0, 0.2);
      opacity: var(--popup-opacity, 1);
    }
    .card {
      --card-color: #202124;
      --card-bg: #e4e7ea;
      --tab-selected-bg: #ffffff;
      --tab-hover-bg: #f1f2f5;
      --search-border: #ccc;
      --search-bg: #ffffff;

      background: var(--card-bg);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      color: var(--card-color);
      width: var(--popup-width, 460px);
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .card.card_dark {
      --card-color: #e9ebec;
      --card-bg: #252629;
      --tab-selected-bg: #35393c;
      --tab-hover-bg: #2e3133;
      --search-border: #444;
      --search-bg: #1e1f21;
    }
    .search-container {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .search-input {
      width: 100%;
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid var(--search-border);
      border-radius: 6px;
      background: var(--search-bg);
      color: var(--card-color);
      outline: none;
      transition: border-color 0.15s ease;
    }
    .search-input:focus {
      border-color: #448aff;
    }
    .tabs-list {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 4px 0;
      margin: 0;
      scroll-behavior: smooth;
    }
    .tab {
      display: flex;
      align-items: center;
      height: var(--tab-height, 42px);
      padding: 0 14px;
      cursor: pointer;
      position: relative;
      user-select: none;
      transition: background-color 0.1s ease;
    }
    .tab:hover {
      background-color: var(--tab-hover-bg);
    }
    .tab.tab_selected {
      background-color: var(--tab-selected-bg);
      font-weight: 600;
    }
    .tab__icon {
      width: var(--icon-size, 20px);
      height: var(--icon-size, 20px);
      margin-right: 12px;
      flex-shrink: 0;
      object-fit: contain;
      border-radius: 2px;
    }
    .tab__text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--font-size, 15px);
    }
    .tab__timeoutIndicator {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background-color: #448aff;
      width: 100%;
      animation: timeoutProgress var(--time-auto-switch-timeout, 1000ms) linear forwards;
    }
    @keyframes timeoutProgress {
      from { width: 0%; }
      to { width: 100%; }
    }
    .no-results {
      padding: 20px;
      text-align: center;
      opacity: 0.6;
      font-size: 14px;
    }
  `;

  // Main UI elements
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const card = document.createElement('div');
  card.className = 'card';

  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Search open tabs...';
  searchContainer.appendChild(searchInput);

  const tabsList = document.createElement('div');
  tabsList.className = 'tabs-list';

  card.appendChild(searchContainer);
  card.appendChild(tabsList);
  overlay.appendChild(card);

  shadow.appendChild(style);
  shadow.appendChild(overlay);
  document.documentElement.appendChild(host);

  // State Variables
  let isOpen = false;
  let allTabs = [];
  let filteredTabs = [];
  let selectedIndex = 0;
  let settings = {};
  let autoSwitchTimer = null;
  let searchQuery = '';

  // Get Favicon URL
  function getFaviconUrl(tab) {
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
      return tab.favIconUrl;
    }
    if (tab.url) {
      try {
        const faviconUrl = new URL(`chrome-extension://${chrome.runtime.id}/_favicon/`);
        faviconUrl.searchParams.set('pageUrl', tab.url);
        faviconUrl.searchParams.set('size', '64');
        return faviconUrl.href;
      } catch (e) {
        // Fallback
      }
    }
    return fallbackFaviconSvg;
  }

  // Filter tabs based on search query
  function updateFilteredTabs() {
    if (!searchQuery) {
      filteredTabs = allTabs.slice();
    } else {
      const q = searchQuery.toLowerCase();
      filteredTabs = allTabs.filter(tab =>
        (tab.title && tab.title.toLowerCase().includes(q)) ||
        (tab.url && tab.url.toLowerCase().includes(q))
      );
    }

    if (selectedIndex >= filteredTabs.length) {
      selectedIndex = Math.max(0, filteredTabs.length - 1);
    }
    renderTabs();
  }

  // Render tabs into UI list
  function renderTabs() {
    tabsList.innerHTML = '';

    if (filteredTabs.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.textContent = 'No matching tabs found';
      tabsList.appendChild(noResults);
      return;
    }

    filteredTabs.forEach((tab, index) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (index === selectedIndex ? ' tab_selected' : '');

      const img = document.createElement('img');
      img.className = 'tab__icon';
      img.src = getFaviconUrl(tab);
      img.onerror = () => {
        img.src = fallbackFaviconSvg;
      };

      const textEl = document.createElement('div');
      textEl.className = 'tab__text';
      textEl.textContent = tab.title || tab.url || 'Untitled Tab';

      tabEl.appendChild(img);
      tabEl.appendChild(textEl);

      // Mouse click selection
      tabEl.addEventListener('click', (e) => {
        e.stopPropagation();
        switchTab(tab);
      });

      // Hover selection
      tabEl.addEventListener('mouseenter', () => {
        selectedIndex = index;
        highlightSelectedTab();
      });

      tabsList.appendChild(tabEl);
    });

    highlightSelectedTab();
  }

  // Scroll selected tab into view & highlight
  function highlightSelectedTab() {
    const children = tabsList.children;
    for (let i = 0; i < children.length; i++) {
      if (i === selectedIndex) {
        children[i].classList.add('tab_selected');
        children[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        children[i].classList.remove('tab_selected');
      }
    }
  }

  // Switch to selected tab
  function switchTab(tab) {
    if (!tab) return;
    closePopup();
    chrome.runtime.sendMessage({
      type: MessageType.SWITCH_TAB,
      selectedTab: tab
    });
  }

  // Reset auto-switch timer
  function resetAutoSwitchTimer() {
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    // Only auto-switch if settings timeout > 0 and search query is empty
    if (settings.autoSwitchingTimeout && settings.autoSwitchingTimeout > 0 && !searchQuery) {
      autoSwitchTimer = setTimeout(() => {
        if (isOpen && filteredTabs[selectedIndex]) {
          switchTab(filteredTabs[selectedIndex]);
        }
      }, settings.autoSwitchingTimeout);
    }
  }

  // Open Popup Overlay
  async function openPopup(initialIncrement = 1) {
    chrome.runtime.sendMessage({ type: MessageType.GET_MODEL }, (model) => {
      if (!model || !model.tabs) return;

      allTabs = model.tabs || [];
      settings = model.settings || {};

      // Apply settings CSS variables
      card.className = 'card' + (settings.isDarkTheme ? ' card_dark' : '');
      host.style.setProperty('--popup-opacity', (settings.opacity || 100) / 100);
      host.style.setProperty('--popup-width', `${settings.popupWidth || 460}px`);
      host.style.setProperty('--tab-height', `${settings.tabHeight || 42}px`);
      host.style.setProperty('--font-size', `${settings.fontSize || 15}px`);
      host.style.setProperty('--icon-size', `${settings.iconSize || 20}px`);
      host.style.setProperty('--time-auto-switch-timeout', `${settings.autoSwitchingTimeout || 1000}ms`);

      searchQuery = '';
      searchInput.value = '';
      filteredTabs = allTabs.slice();

      // Initial tab selection (initialIncrement: 1 selects 2nd MRU tab, i.e. previously active tab)
      if (allTabs.length > 1) {
        selectedIndex = (initialIncrement > 0 ? 1 : allTabs.length - 1) % allTabs.length;
      } else {
        selectedIndex = 0;
      }

      host.style.display = 'block';
      isOpen = true;

      renderTabs();

      setTimeout(() => {
        searchInput.focus();
      }, 20);

      resetAutoSwitchTimer();
    });
  }

  // Close Popup Overlay
  function closePopup() {
    isOpen = false;
    host.style.display = 'none';
    searchQuery = '';
    searchInput.value = '';
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
  }

  // Search input change handler
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    selectedIndex = 0;
    updateFilteredTabs();
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
  });

  // Keyboard navigation & control listeners
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (filteredTabs.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredTabs.length;
        highlightSelectedTab();
        resetAutoSwitchTimer();
      }
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      if (filteredTabs.length > 0) {
        selectedIndex = (selectedIndex - 1 + filteredTabs.length) % filteredTabs.length;
        highlightSelectedTab();
        resetAutoSwitchTimer();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTabs[selectedIndex]) {
        switchTab(filteredTabs[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePopup();
    }
  }, true);

  // Keyup listener (Alt key release)
  window.addEventListener('keyup', (e) => {
    if (!isOpen) return;
    // When Alt key is released and no search query has been typed, switch immediately
    if ((e.key === 'Alt' || !e.altKey) && !searchQuery) {
      if (filteredTabs[selectedIndex]) {
        switchTab(filteredTabs[selectedIndex]);
      }
    }
  }, true);

  // Runtime Message Listener from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === MessageType.SELECT_TAB) {
      const increment = message.increment || 1;
      if (!isOpen) {
        openPopup(increment);
      } else {
        if (filteredTabs.length > 0) {
          selectedIndex = (selectedIndex + increment + filteredTabs.length) % filteredTabs.length;
          highlightSelectedTab();
          resetAutoSwitchTimer();
        }
      }
    } else if (message.type === MessageType.CLOSE_POPUP) {
      closePopup();
    } else if (message.type === MessageType.DEMO_SETTINGS) {
      openPopup(1);
    }
  });

  // Notify background script that content script is active
  chrome.runtime.sendMessage({ type: MessageType.ContentScriptStarted });
})();
