/**
 * Tab Walker - Firefox Extension Content Script
 * Synchronously constructs Shadow DOM overlay with scrollable list & real-time search.
 * Closes automatically if window loses focus.
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
    TOGGLE_WALKER: 'TOGGLE_WALKER'
  };

  const fallbackFaviconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%234d5055" d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2ZM4 12H8.4C11.81 12.02 13.32 13.73 12.94 17.13H9.49V19.6C13.34 19.89 16.88 18.35 19.29 15.32C19.83 14.13 20.07 12.82 19.99 11.52C19.33 12.5 18.33 13 17 13C14.86 13 13.79 6.16 12.91 6.16C12.91 5.19 13.24 4.56 13.72 4.19C10.18 4.21 6.99 5.77 4.79 8.54C4.27 9.62 4 10.8 4 12Z"/></svg>`;

  // Create Host Element & Shadow DOM
  const host = document.createElement('div');
  host.id = 'tab-walker-host';
  const shadow = host.attachShadow({ mode: 'open' });

  // Attach CSS styles synchronously inside Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
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
    }
    :host(.is-open) {
      pointer-events: auto !important;
    }
    * {
      box-sizing: border-box;
    }
    .overlay {
      box-sizing: border-box;
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding-top: 18vh;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: rgba(0, 0, 0, 0.4);
      opacity: var(--popup-opacity, 1);
    }
    :host(.is-open) .overlay {
      display: flex !important;
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
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
      color: var(--card-color);
      width: var(--popup-width, 460px);
      max-width: 90vw;
      max-height: var(--popup-height, 500px);
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
      flex-shrink: 0;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      background: transparent;
    }
    .search-input {
      width: 100%;
      padding: 9px 12px;
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
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 6px 0;
      margin: 0;
      scroll-behavior: smooth;
    }
    .tab {
      display: flex;
      align-items: center;
      height: var(--tab-height, 42px);
      padding: 0 16px;
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
    .no-results {
      padding: 20px;
      text-align: center;
      opacity: 0.6;
      font-size: 14px;
    }
  `;

  // Synchronous DOM construction
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
  let filteredTabs = [];
  let selectedIndex = 0;
  let settings = {};
  let searchQuery = '';

  function getFaviconUrl(tab) {
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('about:') && !tab.favIconUrl.startsWith('moz-extension:')) {
      return tab.favIconUrl;
    }
    return fallbackFaviconSvg;
  }

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
      img.onerror = () => { img.src = fallbackFaviconSvg; };

      const textEl = document.createElement('div');
      textEl.className = 'tab__text';
      textEl.textContent = tab.title || tab.url || 'Untitled Tab';

      tabEl.appendChild(img);
      tabEl.appendChild(textEl);

      tabEl.addEventListener('click', (e) => {
        e.stopPropagation();
        switchTab(tab);
      });

      tabEl.addEventListener('mouseenter', () => {
        selectedIndex = index;
        highlightSelectedTab();
      });

      tabsList.appendChild(tabEl);
    });

    highlightSelectedTab();
  }

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

  function switchTab(tab) {
    if (!tab) return;
    closePopup();
    api.runtime.sendMessage({
      type: MessageType.SWITCH_TAB,
      selectedTab: tab
    });
  }

  function openPopup() {
    api.runtime.sendMessage({ type: MessageType.GET_MODEL }, (model) => {
      if (!model || !model.tabs) return;

      allTabs = model.tabs || [];
      settings = model.settings || {};

      card.className = 'card' + (settings.isDarkTheme ? ' card_dark' : '');
      host.style.setProperty('--popup-opacity', (settings.opacity || 100) / 100);
      host.style.setProperty('--popup-width', `${settings.popupWidth || 460}px`);
      host.style.setProperty('--popup-height', `${settings.windowHeight || 500}px`);

      searchQuery = '';
      searchInput.value = '';
      filteredTabs = allTabs.slice();

      selectedIndex = allTabs.length > 1 ? 1 : 0;

      host.classList.add('is-open');
      isOpen = true;

      renderTabs();

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
  }

  // Live search filtering
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    selectedIndex = 0;
    updateFilteredTabs();
  });

  // Keyboard navigation & selection
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (filteredTabs.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredTabs.length;
        highlightSelectedTab();
      }
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      if (filteredTabs.length > 0) {
        selectedIndex = (selectedIndex - 1 + filteredTabs.length) % filteredTabs.length;
        highlightSelectedTab();
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

  // Close when clicking outside card overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closePopup();
    }
  });

  // Close popup automatically if window loses focus or document becomes hidden
  window.addEventListener('blur', () => {
    if (isOpen) {
      closePopup();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isOpen) {
      closePopup();
    }
  });

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === MessageType.PING) {
      sendResponse('PONG');
      return;
    }

    if (message.type === MessageType.TOGGLE_WALKER) {
      if (!isOpen) {
        openPopup();
      } else {
        closePopup();
      }
    } else if (message.type === MessageType.CLOSE_POPUP) {
      closePopup();
    }
  });

  api.runtime.sendMessage({ type: MessageType.ContentScriptStarted });
})();
