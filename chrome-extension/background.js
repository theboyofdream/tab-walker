/**
 * Tab Walker - Background Service Worker
 * Manages tab registry in Most Recently Used (MRU) order and single command shortcut.
 * Dynamically updates action icon based on theme setting.
 */

const MessageType = {
  PING: 'PING',
  ContentScriptStarted: 'ContentScriptStarted',
  SWITCH_TAB: 'SWITCH_TAB',
  GET_MODEL: 'GET_MODEL',
  CLOSE_POPUP: 'CLOSE_POPUP',
  TOGGLE_WALKER: 'TOGGLE_WALKER',
  SEARCH_WEB: 'SEARCH_WEB',
  SAVE_POSITION: 'SAVE_POSITION',
  GetSettings: 'GetSettings',
  SetSettings: 'SetSettings'
};

const defaultSettings = {
  isDarkTheme: false,
  popupWidth: 460,
  windowHeight: 500,
  tabHeight: 42,
  fontSize: 15,
  iconSize: 20,
  opacity: 100,
  isSwitchingToPreviouslyUsedTab: true,
  customCss: '',
  position: null
};

let mruTabs = [];
let isWindowFocused = true;
let isSwitchingProgrammatically = false;
let registryReadyPromise = null;

function updateActionIcon(isDarkTheme) {
  const iconPrefix = isDarkTheme ? 'icon-light' : 'icon';
  const actionApi = chrome.action || (typeof browser !== 'undefined' && browser.action);
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
  return /^(chrome|chrome-extension|view-source:|about:)/.test(url) ||
         url.startsWith('https://chrome.google.com/webstore') ||
         url.startsWith('https://chromewebstore.google.com');
}

async function getSettings() {
  const data = await chrome.storage.local.get('settings');
  return { ...defaultSettings, ...(data.settings || {}) };
}

async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await chrome.storage.local.set({ settings: updated });
  updateActionIcon(updated.isDarkTheme);
  return updated;
}

function saveTabOrder() {
  chrome.storage.local.set({ tabs: mruTabs });
}

async function initializeTabRegistry() {
  const [allWindows, storageData, settings] = await Promise.all([
    chrome.windows.getAll({ populate: true }),
    chrome.storage.local.get('tabs'),
    getSettings()
  ]);

  updateActionIcon(settings.isDarkTheme);

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
    await chrome.tabs.update(id, { active: true });
    if (isWindowFocused && windowId) {
      await chrome.windows.update(windowId, { focused: true });
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Single command: toggle-walker (Alt+Y)
chrome.commands.onCommand.addListener(async (command) => {
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
      await chrome.tabs.sendMessage(sanitized.id, { type: MessageType.TOGGLE_WALKER });
    } catch (err) {
      console.warn('Could not send message to active tab:', err);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    const activeTab = await getActiveTabInCurrentWindow();
    if (activeTab && activeTab.id) {
      try {
        chrome.tabs.sendMessage(activeTab.id, { type: MessageType.CLOSE_POPUP });
      } catch (e) {}
    }
    return;
  }
  isWindowFocused = true;
  const activeTab = await getActiveTabInCurrentWindow();
  if (activeTab) {
    markTabAsActive(activeTab.id);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isSwitchingProgrammatically) {
    markTabAsActive(activeInfo.tabId);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  addOrUpdateTab(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    addOrUpdateTab(tab);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  removeTab(tabId);
  const settings = await getSettings();
  if (settings.isSwitchingToPreviouslyUsedTab && mruTabs.length > 0) {
    const nextToActivate = mruTabs[0];
    if (nextToActivate) {
      await activateTab(nextToActivate);
    }
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue || {};
    updateActionIcon(newSettings.isDarkTheme);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !message.type) {
    return;
  }

  switch (message.type) {
    case MessageType.ContentScriptStarted: {
      if (sender.tab) {
        addOrUpdateTab(sender.tab);
      }
      break;
    }
    case MessageType.GET_MODEL: {
      (async () => {
        await registryReadyPromise;
        const settings = await getSettings();
        let zoomFactor = 1;
        try {
          if (sender.tab && sender.tab.id) {
            zoomFactor = await chrome.tabs.getZoom(sender.tab.id);
          }
        } catch (e) {}
        sendResponse({
          tabs: mruTabs.slice(),
          settings,
          zoomFactor
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
        if (chrome.search && chrome.search.query) {
          chrome.search.query({
            text: message.query,
            disposition: 'NEW_TAB'
          });
        } else {
          chrome.tabs.create({
            url: `https://www.google.com/search?q=${encodeURIComponent(message.query)}`
          });
        }
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
