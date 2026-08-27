/**
 * Tab Walker - Content Script
 * Single command toggle for Tab Walker search overlay.
 * Centralized themeable CSS tokens with user CSS override layer.
 * Closes automatically if window loses focus.
 * Performs browser web search on Enter when no tabs match.
 * Draggable overlay card with viewport center-relative position memory.
 */

(function () {
  if (window.__tabWalkerInjected) return;
  window.__tabWalkerInjected = true;

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
      --tw-height-tab: 42px;
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
    .tw-tab {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--tw-height-tab);
      min-height: var(--tw-height-tab);
      flex-shrink: 0;
      padding: var(--tw-padding-tab);
      border-radius: var(--tw-radius-tab);
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
      transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
    }
    .tw-tab:hover {
      background-color: var(--tw-bg-tab-hover);
    }
    .tw-tab.tw-tab--selected {
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
    .tw-tab__text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--tw-font-size-base);
      font-weight: var(--tw-font-weight-medium);
      color: inherit;
    }
    .tw-tab__badge {
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
    }
    .tw-tab.tw-tab--selected .tw-tab__badge,
    .tw-tab:hover .tw-tab__badge {
      opacity: 1;
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
  searchInput.placeholder = 'Search open tabs...';

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

      chrome.runtime.sendMessage({
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
    if (tab.url) {
      try {
        const faviconUrl = new URL(`chrome-extension://${chrome.runtime.id}/_favicon/`);
        faviconUrl.searchParams.set('pageUrl', tab.url);
        faviconUrl.searchParams.set('size', '64');
        return faviconUrl.href;
      } catch (e) {}
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
      noResults.className = 'tw-no-results';
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
      tabEl.className = 'tw-tab' + (index === selectedIndex ? ' tw-tab--selected' : '');

      const infoEl = document.createElement('div');
      infoEl.className = 'tw-tab__info';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'tw-tab__icon-wrapper';

      const img = document.createElement('img');
      img.className = 'tw-tab__icon';
      img.src = getFaviconUrl(tab);
      img.onerror = () => { img.src = fallbackFaviconSvg; };

      iconWrapper.appendChild(img);

      const textEl = document.createElement('span');
      textEl.className = 'tw-tab__text';
      textEl.textContent = tab.title || tab.url || 'Untitled Tab';

      infoEl.appendChild(iconWrapper);
      infoEl.appendChild(textEl);

      const badgeEl = document.createElement('span');
      badgeEl.className = 'tw-tab__badge';
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
        children[i].classList.add('tw-tab--selected');
        children[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        children[i].classList.remove('tw-tab--selected');
      }
    }
  }

  function switchTab(tab) {
    if (!tab) return;
    closePopup();
    chrome.runtime.sendMessage({
      type: MessageType.SWITCH_TAB,
      selectedTab: tab
    });
  }

  function openPopup() {
    chrome.runtime.sendMessage({ type: MessageType.GET_MODEL }, (model) => {
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
        chrome.runtime.sendMessage({
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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  chrome.runtime.sendMessage({ type: MessageType.ContentScriptStarted });
})();
