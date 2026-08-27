/**
 * Tab Walker - Firefox Extension Content Script
 * Synchronously constructs Shadow DOM overlay with scrollable list & real-time search.
 * High-craft, dual-theme Command Palette UI inspired by Raycast & Linear.
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
    SAVE_POSITION: 'SAVE_POSITION'
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
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif;
      letter-spacing: -0.01em;
      background: rgba(0, 0, 0, 0.4);
      opacity: var(--popup-opacity, 1);
    }
    :host(.is-open) .overlay {
      display: flex !important;
    }
    .card {
      --card-bg: #FFFFFF;
      --card-border: rgba(0, 0, 0, 0.08);
      --card-color: #334155;
      --shadow-modal: 0 20px 40px -12px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
      --search-bg: #F1F3F5;
      --search-color: #0F172A;
      --search-placeholder: #94A3B8;
      --search-border: rgba(0, 0, 0, 0.06);
      --search-focus-border: rgba(79, 86, 233, 0.4);
      --search-focus-glow: 0 0 0 2px rgba(79, 86, 233, 0.12);
      --search-icon-color: #94A3B8;
      --tab-selected-bg: #F1F3F9;
      --tab-selected-border: rgba(0, 0, 0, 0.04);
      --tab-selected-color: #0F172A;
      --tab-hover-bg: #F8FAFC;
      --text-secondary: #94A3B8;
      --badge-bg: rgba(0, 0, 0, 0.04);
      --badge-color: #64748B;
      --badge-border: rgba(0, 0, 0, 0.06);
      --scrollbar-thumb: rgba(0, 0, 0, 0.15);

      background: var(--card-bg);
      border-radius: 14px;
      border: 1px solid var(--card-border);
      box-shadow: var(--shadow-modal);
      color: var(--card-color);
      width: var(--popup-width, 460px);
      max-width: 90vw;
      max-height: var(--popup-height, 500px);
      padding: 12px 12px 10px 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    .card.card_dark {
      --card-bg: #111215;
      --card-border: rgba(255, 255, 255, 0.08);
      --card-color: #C4C7D0;
      --shadow-modal: 0 24px 48px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      --search-bg: rgba(255, 255, 255, 0.04);
      --search-color: #FFFFFF;
      --search-placeholder: #5C606E;
      --search-border: rgba(255, 255, 255, 0.06);
      --search-focus-border: rgba(79, 86, 233, 0.5);
      --search-focus-glow: 0 0 0 2px rgba(79, 86, 233, 0.15);
      --search-icon-color: #5C606E;
      --tab-selected-bg: rgba(255, 255, 255, 0.06);
      --tab-selected-border: rgba(255, 255, 255, 0.05);
      --tab-selected-color: #FFFFFF;
      --tab-hover-bg: rgba(255, 255, 255, 0.03);
      --text-secondary: #5C606E;
      --badge-bg: rgba(255, 255, 255, 0.06);
      --badge-color: #8C909F;
      --badge-border: rgba(255, 255, 255, 0.08);
      --scrollbar-thumb: rgba(255, 255, 255, 0.15);
    }
    .search-container {
      position: relative;
      flex-shrink: 0;
      width: 100%;
      margin-bottom: 8px;
      cursor: grab;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      fill: var(--search-icon-color);
      pointer-events: none;
      transition: fill 0.15s ease;
    }
    .search-input {
      width: 100%;
      height: 36px;
      padding: 0 12px 0 34px;
      font-size: 13px;
      font-family: inherit;
      border: 1px solid var(--search-border);
      border-radius: 8px;
      background: var(--search-bg);
      color: var(--search-color);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
      cursor: text;
    }
    .search-input::placeholder {
      color: var(--search-placeholder);
    }
    .search-input:focus {
      border-color: var(--search-focus-border);
      box-shadow: var(--search-focus-glow);
    }
    .tabs-list {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 2px 0;
      margin: 0;
      scroll-behavior: smooth;
    }
    .tabs-list::-webkit-scrollbar {
      width: 4px;
    }
    .tabs-list::-webkit-scrollbar-track {
      background: transparent;
    }
    .tabs-list::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 2px;
    }
    .tab {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--tab-height, 38px);
      padding: 0 10px;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
      transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
    }
    .tab:hover {
      background-color: var(--tab-hover-bg);
    }
    .tab.tab_selected {
      background-color: var(--tab-selected-bg);
      border-color: var(--tab-selected-border);
      color: var(--tab-selected-color);
    }
    .tab__info {
      display: flex;
      align-items: center;
      min-width: 0;
      flex: 1;
      margin-right: 8px;
    }
    .tab__icon-wrapper {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 10px;
      overflow: hidden;
    }
    .tab__icon {
      width: var(--icon-size, 16px);
      height: var(--icon-size, 16px);
      object-fit: contain;
    }
    .tab__text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--font-size, 12.5px);
      font-weight: 500;
      color: inherit;
    }
    .tab__badge {
      font-size: 11px;
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace;
      font-variant-numeric: tabular-nums;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--badge-bg);
      color: var(--badge-color);
      border: 1px solid var(--badge-border);
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.1s ease;
    }
    .tab.tab_selected .tab__badge,
    .tab:hover .tab__badge {
      opacity: 1;
    }
    .no-results {
      padding: 24px 16px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 1.5;
    }
  `;

  // Synchronous DOM construction
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const card = document.createElement('div');
  card.className = 'card';

  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';

  const searchIconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  searchIconSvg.setAttribute('class', 'search-icon');
  searchIconSvg.setAttribute('viewBox', '0 0 24 24');
  searchIconSvg.setAttribute('width', '14');
  searchIconSvg.setAttribute('height', '14');

  const searchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  searchPath.setAttribute('d', 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z');
  searchIconSvg.appendChild(searchPath);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Search open tabs...';

  searchContainer.appendChild(searchIconSvg);
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

  function getFaviconUrl(tab) {
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
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
      if (searchQuery) {
        noResults.textContent = `No matching tabs. Press Enter to search web for "${searchQuery}"`;
      } else {
        noResults.textContent = 'No matching tabs found';
      }
      tabsList.appendChild(noResults);
      return;
    }

    filteredTabs.forEach((tab, index) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (index === selectedIndex ? ' tab_selected' : '');

      const infoEl = document.createElement('div');
      infoEl.className = 'tab__info';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'tab__icon-wrapper';

      const img = document.createElement('img');
      img.className = 'tab__icon';
      img.src = getFaviconUrl(tab);
      img.onerror = () => { img.src = fallbackFaviconSvg; };

      iconWrapper.appendChild(img);

      const textEl = document.createElement('span');
      textEl.className = 'tab__text';
      textEl.textContent = tab.title || tab.url || 'Untitled Tab';

      infoEl.appendChild(iconWrapper);
      infoEl.appendChild(textEl);

      const badgeEl = document.createElement('span');
      badgeEl.className = 'tab__badge';
      badgeEl.textContent = '↵ Jump';

      tabEl.appendChild(infoEl);
      tabEl.appendChild(badgeEl);

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

      if (settings.fontSize) {
        host.style.setProperty('--font-size', `${settings.fontSize}px`);
      }
      if (settings.iconSize) {
        host.style.setProperty('--icon-size', `${settings.iconSize}px`);
      }

      searchQuery = '';
      searchInput.value = '';
      filteredTabs = allTabs.slice();

      selectedIndex = allTabs.length > 1 ? 1 : 0;

      host.classList.add('is-open');
      isOpen = true;

      renderTabs();
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
  }

  // Keyboard navigation & search input listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    selectedIndex = 0;
    updateFilteredTabs();
  });

  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredTabs.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredTabs.length;
        highlightSelectedTab();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredTabs.length > 0) {
        selectedIndex = (selectedIndex - 1 + filteredTabs.length) % filteredTabs.length;
        highlightSelectedTab();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredTabs.length > 0 && filteredTabs[selectedIndex]) {
        switchTab(filteredTabs[selectedIndex]);
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
