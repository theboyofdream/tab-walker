/**
 * Tab Walker - Firefox Extension Background Script
 * Manages tab registry in Most Recently Used (MRU) order and single command shortcut.
 * Dynamically updates action icon based on theme setting.
 */

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
  SAVE_POSITION: 'SAVE_POSITION',
  GetSettings: 'GetSettings',
  SetSettings: 'SetSettings',
  SYSTEM_THEME_CHANGED: 'SYSTEM_THEME_CHANGED'
};

const defaultSettings = {
  theme: 'system',
  isDarkTheme: false,
  scale: 1,
  popupWidth: 460,
  windowHeight: 500,
  tabHeight: 42,
  fontSize: 15,
  iconSize: 20,
  opacity: 100,
  overlayBlur: 0,
  isSwitchingToPreviouslyUsedTab: true,
  customCss: '',
  position: null
};

let mruTabs = [];
let isWindowFocused = true;
let isSwitchingProgrammatically = false;
let registryReadyPromise = null;
let lastKnownSystemDark = false;

function updateActionIcon(theme, isDarkFallback) {
  let isDark = false;
  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'light') {
    isDark = false;
  } else if (theme === 'system' || !theme) {
    isDark = typeof isDarkFallback === 'boolean' ? isDarkFallback : lastKnownSystemDark;
  } else if (typeof isDarkFallback === 'boolean') {
    isDark = isDarkFallback;
  }
  const iconPrefix = isDark ? 'icon-light' : 'icon';
  const actionApi = api.action || api.browserAction;
  if (actionApi && typeof actionApi.setIcon === 'function') {
    actionApi.setIcon({
      path: {
        "16": `icons/${iconPrefix}16.png`,
        "32": `icons/${iconPrefix}32.png`,
        "48": `icons/${iconPrefix}48.png`,
        "128": `icons/${iconPrefix}128.png`
      }
    }).catch(() => {});
  }
}

function sanitizeTab(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    title: tab.title || '',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl || '',
    active: tab.active || false
  };
}

function isRestrictedUrl(url) {
  if (!url) return false;
  return /^(about:|moz-extension:|view-source:|chrome:)/.test(url);
}

async function getSettings() {
  const data = await api.storage.local.get('settings');
  return { ...defaultSettings, ...(data.settings || {}) };
}

async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await api.storage.local.set({ settings: updated });
  updateActionIcon(updated.theme, updated.isDarkTheme);
  return updated;
}

function saveTabOrder() {
  api.storage.local.set({ tabs: mruTabs });
}

async function initializeTabRegistry() {
  const [allWindows, storageData, settings] = await Promise.all([
    api.windows.getAll({ populate: true }),
    api.storage.local.get(['tabs', 'isSystemDark']),
    getSettings()
  ]);

  if (typeof storageData.isSystemDark === 'boolean') {
    lastKnownSystemDark = storageData.isSystemDark;
  }

  updateActionIcon(settings.theme, lastKnownSystemDark);

  const openTabsMap = new Map();
  for (const win of allWindows) {
    if (win.tabs) {
      for (const tab of win.tabs) {
        openTabsMap.set(tab.id, sanitizeTab(tab));
      }
    }
  }

  const savedTabs = storageData.tabs || [];
  const orderedTabs = [];

  for (const savedTab of savedTabs) {
    if (openTabsMap.has(savedTab.id)) {
      orderedTabs.push(openTabsMap.get(savedTab.id));
      openTabsMap.delete(savedTab.id);
    }
  }

  for (const remainingTab of openTabsMap.values()) {
    orderedTabs.push(remainingTab);
  }

  const activeIndex = orderedTabs.findIndex(t => t.active);
  if (activeIndex > 0) {
    const [activeTab] = orderedTabs.splice(activeIndex, 1);
    orderedTabs.unshift(activeTab);
  }

  mruTabs = orderedTabs;
  saveTabOrder();
}

function markTabAsActive(tabId) {
  const index = mruTabs.findIndex(t => t.id === tabId);
  if (index !== -1) {
    const [tab] = mruTabs.splice(index, 1);
    tab.active = true;
    mruTabs.unshift(tab);
  }
  for (let i = 1; i < mruTabs.length; i++) {
    mruTabs[i].active = false;
  }
  saveTabOrder();
}

function addOrUpdateTab(tab) {
  const sanitized = sanitizeTab(tab);
  const index = mruTabs.findIndex(t => t.id === tab.id);
  if (index !== -1) {
    mruTabs[index] = { ...mruTabs[index], ...sanitized };
  } else {
    if (sanitized.active) {
      mruTabs.unshift(sanitized);
    } else if (mruTabs.length > 0) {
      mruTabs.splice(1, 0, sanitized);
    } else {
      mruTabs.push(sanitized);
    }
  }
  saveTabOrder();
}

function removeTab(tabId) {
  mruTabs = mruTabs.filter(t => t.id !== tabId);
  saveTabOrder();
}

async function activateTab({ id, windowId }) {
  isSwitchingProgrammatically = true;
  try {
    await api.tabs.update(id, { active: true });
    if (isWindowFocused && windowId) {
      await api.windows.update(windowId, { focused: true });
    }
  } catch (err) {
    console.error(`Failed to activate tab ${id}:`, err);
  } finally {
    setTimeout(() => {
      isSwitchingProgrammatically = false;
    }, 150);
  }
}

async function getActiveTabInCurrentWindow() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function searchHistoryAndBookmarks(query) {
  const trimmed = (query || '').trim();
  let historyResults = [];
  let bookmarkResults = [];

  if (trimmed.length > 0) {
    const historyPromise = new Promise((resolve) => {
      if (api.history && typeof api.history.search === 'function') {
        api.history.search({ text: trimmed, maxResults: 30, startTime: 0 }, (results) => {
          if (api.runtime.lastError || !results) {
            resolve([]);
          } else {
            resolve(results.map(h => ({
              id: h.id,
              title: h.title || '',
              url: h.url || '',
              lastVisitTime: h.lastVisitTime || 0,
              visitCount: h.visitCount || 0
            })));
          }
        });
      } else {
        resolve([]);
      }
    });

    const bookmarkPromise = new Promise((resolve) => {
      if (api.bookmarks && typeof api.bookmarks.search === 'function') {
        api.bookmarks.search(trimmed, (results) => {
          if (api.runtime.lastError || !results) {
            resolve([]);
          } else {
            resolve(results.filter(b => b.url).slice(0, 30).map(b => ({
              id: b.id,
              title: b.title || '',
              url: b.url || ''
            })));
          }
        });
      } else {
        resolve([]);
      }
    });

    [historyResults, bookmarkResults] = await Promise.all([historyPromise, bookmarkPromise]);
  }

  return { history: historyResults, bookmarks: bookmarkResults };
}

async function navigateUrl(url) {
  const activeTab = await getActiveTabInCurrentWindow();
  if (activeTab && activeTab.id && !isRestrictedUrl(activeTab.url)) {
    await api.tabs.update(activeTab.id, { url });
  } else {
    await api.tabs.create({ url });
  }
}

api.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-walker') {
    await registryReadyPromise;
    const activeTab = await getActiveTabInCurrentWindow();
    if (!activeTab) return;

    const sanitized = sanitizeTab(activeTab);
    if (isRestrictedUrl(sanitized.url)) {
      const previouslyActive = mruTabs.find(t => !isRestrictedUrl(t.url) && t.id !== sanitized.id);
      if (previouslyActive) {
        await activateTab(previouslyActive);
      }
      return;
    }

    try {
      await api.tabs.sendMessage(sanitized.id, { type: MessageType.TOGGLE_WALKER });
    } catch (err) {
      if (api.scripting && typeof api.scripting.executeScript === 'function') {
        try {
          await api.scripting.executeScript({
            target: { tabId: sanitized.id },
            files: ['content.js']
          });
          await api.tabs.sendMessage(sanitized.id, { type: MessageType.TOGGLE_WALKER }).catch(() => {});
        } catch (e) {
          console.warn('Could not send message to active tab:', e);
        }
      } else {
        console.warn('Could not send message to active tab:', err);
      }
    }
  }
});

api.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === api.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    const activeTab = await getActiveTabInCurrentWindow();
    if (activeTab && activeTab.id) {
      api.tabs.sendMessage(activeTab.id, { type: MessageType.CLOSE_POPUP }).catch(() => {});
    }
    return;
  }
  isWindowFocused = true;
  const activeTab = await getActiveTabInCurrentWindow();
  if (activeTab) {
    markTabAsActive(activeTab.id);
  }
});

api.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isSwitchingProgrammatically) {
    markTabAsActive(activeInfo.tabId);
  }
});

api.tabs.onCreated.addListener((tab) => {
  addOrUpdateTab(tab);
});

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    addOrUpdateTab(tab);
  }
});

api.tabs.onRemoved.addListener(async (tabId) => {
  removeTab(tabId);
  const settings = await getSettings();
  if (settings.isSwitchingToPreviouslyUsedTab && mruTabs.length > 0) {
    const nextToActivate = mruTabs[0];
    if (nextToActivate) {
      await activateTab(nextToActivate);
    }
  }
});

api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue || {};
    updateActionIcon(newSettings.theme, newSettings.isDarkTheme);
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !message.type) {
    return;
  }

  switch (message.type) {
    case MessageType.ContentScriptStarted: {
      if (typeof message.isSystemDark === 'boolean') {
        lastKnownSystemDark = message.isSystemDark;
        api.storage.local.set({ isSystemDark: message.isSystemDark });
        (async () => {
          const settings = await getSettings();
          if (settings.theme === 'system' || !settings.theme) {
            updateActionIcon('system', lastKnownSystemDark);
          }
        })();
      }
      if (sender.tab) {
        addOrUpdateTab(sender.tab);
      }
      break;
    }
    case MessageType.SYSTEM_THEME_CHANGED: {
      if (typeof message.isDark === 'boolean') {
        lastKnownSystemDark = message.isDark;
        api.storage.local.set({ isSystemDark: message.isDark });
        (async () => {
          const settings = await getSettings();
          if (settings.theme === 'system' || !settings.theme) {
            updateActionIcon('system', lastKnownSystemDark);
          }
        })();
      }
      break;
    }
    case MessageType.GET_MODEL: {
      if (typeof message.isSystemDark === 'boolean') {
        lastKnownSystemDark = message.isSystemDark;
        api.storage.local.set({ isSystemDark: message.isSystemDark });
      }
      (async () => {
        await registryReadyPromise;
        const settings = await getSettings();
        if (settings.theme === 'system' || !settings.theme) {
          updateActionIcon('system', lastKnownSystemDark);
        }
        sendResponse({
          tabs: mruTabs.slice(),
          settings,
          zoomFactor: 1
        });
      })();
      return true;
    }
    case MessageType.SWITCH_TAB: {
      if (message.selectedTab) {
        activateTab(message.selectedTab);
      }
      break;
    }
    case MessageType.SEARCH_WEB: {
      if (message.query) {
        if (api.search && api.search.search) {
          api.search.search({
            query: message.query
          });
        } else {
          api.tabs.create({
            url: `https://www.google.com/search?q=${encodeURIComponent(message.query)}`
          });
        }
      }
      break;
    }
    case MessageType.SEARCH_OMNIBOX: {
      (async () => {
        const { query } = message;
        const results = await searchHistoryAndBookmarks(query);
        sendResponse(results);
      })();
      return true;
    }
    case MessageType.NAVIGATE_URL: {
      if (message.url) {
        navigateUrl(message.url);
      }
      break;
    }
    case MessageType.SAVE_POSITION: {
      if (message.position) {
        updateSettings({ position: message.position });
      }
      break;
    }
    case MessageType.GetSettings: {
      (async () => {
        const settings = await getSettings();
        sendResponse(settings);
      })();
      return true;
    }
    case MessageType.SetSettings: {
      (async () => {
        const updated = await updateSettings(message.settings || {});
        sendResponse(updated);
      })();
      return true;
    }
  }
});

registryReadyPromise = initializeTabRegistry();
