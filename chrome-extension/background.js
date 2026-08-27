/**
 * Tab Walker - Background Service Worker
 * Manages tab registry in Most Recently Used (MRU) order and single command shortcut.
 */

const MessageType = {
  PING: 'PING',
  ContentScriptStarted: 'ContentScriptStarted',
  SWITCH_TAB: 'SWITCH_TAB',
  GET_MODEL: 'GET_MODEL',
  CLOSE_POPUP: 'CLOSE_POPUP',
  TOGGLE_WALKER: 'TOGGLE_WALKER'
};

const defaultSettings = {
  isDarkTheme: false,
  popupWidth: 460,
  tabHeight: 42,
  fontSize: 15,
  iconSize: 20,
  opacity: 100
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
  return /^(chrome|chrome-extension|view-source:|about:)/.test(url) ||
         url.startsWith('https://chrome.google.com/webstore') ||
         url.startsWith('https://chromewebstore.google.com');
}

function saveTabOrder() {
  chrome.storage.local.set({ tabs: mruTabs });
}

async function initializeTabRegistry() {
  const [allWindows, storageData] = await Promise.all([
    chrome.windows.getAll({ populate: true }),
    chrome.storage.local.get('tabs')
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
        let zoomFactor = 1;
        try {
          if (sender.tab && sender.tab.id) {
            zoomFactor = await chrome.tabs.getZoom(sender.tab.id);
          }
        } catch (e) {}
        sendResponse({
          tabs: mruTabs.slice(),
          settings: defaultSettings,
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
  }
});

registryReadyPromise = initializeTabRegistry();
