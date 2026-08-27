/**
 * Tab Walker - Firefox Extension Background Script
 * Manages tab registry in Most Recently Used (MRU) order and single command shortcut.
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

const MessageType = {
  PING: 'PING',
  ContentScriptStarted: 'ContentScriptStarted',
  SWITCH_TAB: 'SWITCH_TAB',
  GET_MODEL: 'GET_MODEL',
  CLOSE_POPUP: 'CLOSE_POPUP',
  TOGGLE_WALKER: 'TOGGLE_WALKER',
  SAVE_POSITION: 'SAVE_POSITION',
  GetSettings: 'GetSettings',
  SetSettings: 'SetSettings'
};

const defaultSettings = {
  isDarkTheme: false,
  popupWidth: 460,
  windowHeight: 500,
  fontSize: 15,
  iconSize: 20,
  opacity: 100,
  isSwitchingToPreviouslyUsedTab: true,
  position: null
};

let mruTabs = [];
let isWindowFocused = true;
let isSwitchingProgrammatically = false;
let registryReadyPromise = null;

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
  return updated;
}

function saveTabOrder() {
  api.storage.local.set({ tabs: mruTabs });
}

async function initializeTabRegistry() {
  const [allWindows, storageData] = await Promise.all([
    api.windows.getAll({ populate: true }),
    api.storage.local.get('tabs')
  ]);

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
      console.warn('Could not send message to active tab:', err);
    }
  }
});

api.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === api.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    const activeTab = await getActiveTabInCurrentWindow();
    if (activeTab && activeTab.id) {
      try {
        api.tabs.sendMessage(activeTab.id, { type: MessageType.CLOSE_POPUP });
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

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
