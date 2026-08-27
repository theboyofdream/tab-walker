/**
 * Popup Tab Switcher - Content Script
 * Displays an isolated Shadow DOM overlay tab switcher with MRU order,
 * scrollable tab list, and real-time title/URL search.
 */

(function () {
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

  const fallbackFaviconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%234d5055" d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2ZM4 12H8.4C11.81 12.02 13.32 13.73 12.94 17.13H9.49V19.6C13.34 19.89 16.88 18.35 19.29 15.32C19.83 14.13 20.07 12.82 19.99 11.52C19.33 12.5 18.33 13 17 13C14.86 13 13.79 12.08 13.79 10.25H10.04C9.77 7.52 10.72 6.16 12.91 6.16C12.91 5.19 13.24 4.56 13.72 4.19C10.18 4.21 6.99 5.77 4.79 8.54C4.27 9.62 4 10.8 4 12Z"/></svg>`;

  // Create Host & Shadow DOM
  const host = document.createElement('div');
  host.id = 'popup-tab-switcher-host';
  const shadow = host.attachShadow({ mode: 'open' });

  // Attach CSS stylesheet from overlay.css
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('overlay.css');
  shadow.appendChild(link);

  // Template container
  const container = document.createElement('div');
  shadow.appendChild(container);

  let card, searchInput, tabsList;
  let isOpen = false;
  let allTabs = [];
  let filteredTabs = [];
  let selectedIndex = 0;
  let settings = {};
  let autoSwitchTimer = null;
  let searchQuery = '';

  // Load HTML template asynchronously
  fetch(chrome.runtime.getURL('overlay.html'))
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;
      card = shadow.querySelector('#card');
      searchInput = shadow.querySelector('#search-input');
      tabsList = shadow.querySelector('#tabs-list');

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          searchQuery = searchInput.value.toLowerCase().trim();
          selectedIndex = 0;
          updateFilteredTabs();
          if (autoSwitchTimer) {
            clearTimeout(autoSwitchTimer);
            autoSwitchTimer = null;
          }
        });
      }
    });

  document.documentElement.appendChild(host);

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
    if (!tabsList) return;
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
    if (!tabsList) return;
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
    chrome.runtime.sendMessage({
      type: MessageType.SWITCH_TAB,
      selectedTab: tab
    });
  }

  function resetAutoSwitchTimer() {
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    if (settings.autoSwitchingTimeout && settings.autoSwitchingTimeout > 0 && !searchQuery) {
      autoSwitchTimer = setTimeout(() => {
        if (isOpen && filteredTabs[selectedIndex]) {
          switchTab(filteredTabs[selectedIndex]);
        }
      }, settings.autoSwitchingTimeout);
    }
  }

  async function openPopup(initialIncrement = 1) {
    chrome.runtime.sendMessage({ type: MessageType.GET_MODEL }, (model) => {
      if (!model || !model.tabs) return;

      allTabs = model.tabs || [];
      settings = model.settings || {};

      if (card) {
        card.className = 'card' + (settings.isDarkTheme ? ' card_dark' : '');
      }

      host.style.setProperty('--popup-opacity', (settings.opacity || 100) / 100);
      host.style.setProperty('--popup-width', `${settings.popupWidth || 460}px`);
      host.style.setProperty('--tab-height', `${settings.tabHeight || 42}px`);
      host.style.setProperty('--font-size', `${settings.fontSize || 15}px`);
      host.style.setProperty('--icon-size', `${settings.iconSize || 20}px`);
      host.style.setProperty('--time-auto-switch-timeout', `${settings.autoSwitchingTimeout || 1000}ms`);

      searchQuery = '';
      if (searchInput) searchInput.value = '';
      filteredTabs = allTabs.slice();

      if (allTabs.length > 1) {
        selectedIndex = (initialIncrement > 0 ? 1 : allTabs.length - 1) % allTabs.length;
      } else {
        selectedIndex = 0;
      }

      host.style.display = 'block';
      isOpen = true;

      renderTabs();

      setTimeout(() => {
        if (searchInput) searchInput.focus();
      }, 20);

      resetAutoSwitchTimer();
    });
  }

  function closePopup() {
    isOpen = false;
    host.style.display = 'none';
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
  }

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

  window.addEventListener('keyup', (e) => {
    if (!isOpen) return;
    if ((e.key === 'Alt' || !e.altKey) && !searchQuery) {
      if (filteredTabs[selectedIndex]) {
        switchTab(filteredTabs[selectedIndex]);
      }
    }
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
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

  chrome.runtime.sendMessage({ type: MessageType.ContentScriptStarted });
})();
