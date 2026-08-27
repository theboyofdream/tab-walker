/**
 * Popup Tab Switcher - Background Service Worker
 * Manages tab registry in Most Recently Used (MRU) order, tab focus events,
 * shortcut commands, and communication with content scripts.
 */

const MessageType = {
  ContentScriptStarted: 'ContentScriptStarted',
  ContentScriptStopped: 'ContentScriptStopped',
  SWITCH_TAB: 'SWITCH_TAB',
  DEMO_SETTINGS: 'DEMO_SETTINGS',
  GET_MODEL: 'GET_MODEL',
  SetSettings: 'SetSettings',
  GetSettings: 'GetSettings',
  CLOSE_POPUP: 'CLOSE_POPUP',
  SELECT_TAB: 'SELECT_TAB'
};

const defaultSettings = {
  textScrollDelay: 1000,
  textScrollSpeed: 1,
  autoSwitchingTimeout: 1000,
  numberOfTabsToShow: 7,
  isDarkTheme: false,
  popupWidth: 420,
  tabHeight: 40,
  fontSize: 16,
  iconSize: 24,
  opacity: 100,
  isSwitchingToPreviouslyUsedTab: true,
  isStayingOpen: false
};

// MRU Tab Registry (index 0 is most recently active tab)
let mruTabs = [];
let initializedTabIds = new Set();
let isWindowFocused = true;
let isSwitchingProgrammatically = false;

// Format tab object safely
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
  if (!url) return true;
  return /^(chrome|view-source:|https?:\/\/chrome\.google\.com|chrome-extension:)/.test(url);
}

// Settings storage helpers
async function getSettings() {
  const data = await chrome.storage.local.get('settings');
  return { ...defaultSettings, ...(data.settings || {}) };
}

async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

// Persist tab order to chrome.storage.local
function saveTabOrder() {
  chrome.storage.local.set({ tabs: mruTabs });
}

// Initialize tab list from Chrome windows/tabs & saved storage
async function initializeTabRegistry() {
  const [settings, allWindows, storageData] = await Promise.all([
    getSettings(),
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

  // Restore saved tabs order if they are currently open
  for (const savedTab of savedTabs) {
    if (openTabsMap.has(savedTab.id)) {
      orderedTabs.push(openTabsMap.get(savedTab.id));
      openTabsMap.delete(savedTab.id);
    }
  }

  // Append any remaining newly open tabs
  for (const remainingTab of openTabsMap.values()) {
    orderedTabs.push(remainingTab);
  }

  // Ensure active tab is placed at index 0 (top of MRU stack)
  const activeIndex = orderedTabs.findIndex(t => t.active);
  if (activeIndex > 0) {
    const [activeTab] = orderedTabs.splice(activeIndex, 1);
    orderedTabs.unshift(activeTab);
  }

  mruTabs = orderedTabs;
  saveTabOrder();
}

// Tab order mutators
function markTabAsActive(tabId) {
  const index = mruTabs.findIndex(t => t.id === tabId);
  if (index !== -1) {
    const [tab] = mruTabs.splice(index, 1);
    tab.active = true;
    mruTabs.unshift(tab);
  }
  // Reset active flag for other tabs
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
  initializedTabIds.delete(tabId);
  saveTabOrder();
}

// Activate tab programmatically
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
    isSwitchingProgrammatically = false;
  }
}

// Ensure content script is injected
async function ensureContentScriptInjected(tab) {
  if (initializedTabIds.has(tab.id)) {
    return true;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      files: ['content.js']
    });
    return true;
  } catch (err) {
    console.warn(`Could not inject content script into tab ${tab.id}:`, err);
    return false;
  }
}

// Get active tab in current window
async function getActiveTabInCurrentWindow() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Handle shortcut commands (Alt+Y / Alt+Shift+Y)
async function handleCommand(commandName) {
  const activeTab = await getActiveTabInCurrentWindow();
  if (!activeTab) return;

  const sanitized = sanitizeTab(activeTab);

  // Restricted page (chrome://, chrome extension store, etc.): switch directly to previous tab
  if (isRestrictedUrl(sanitized.url)) {
    const previouslyActive = mruTabs.find(t => !isRestrictedUrl(t.url) && t.id !== sanitized.id);
    if (previouslyActive) {
      await activateTab(previouslyActive);
    }
    return;
  }

  const injected = await ensureContentScriptInjected(sanitized);
  if (injected) {
    const increment = commandName === 'next' ? 1 : -1;
    try {
      await chrome.tabs.sendMessage(sanitized.id, {
        type: MessageType.SELECT_TAB,
        increment
      });
    } catch (err) {
      // If messaging fails, fallback to direct tab switch
      const previouslyActive = mruTabs.find(t => t.id !== sanitized.id);
      if (previouslyActive) {
        await activateTab(previouslyActive);
      }
    }
  } else {
    const previouslyActive = mruTabs.find(t => t.id !== sanitized.id);
    if (previouslyActive) {
      await activateTab(previouslyActive);
    }
  }
}

// Event Listeners for Chrome Tab events
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
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
    initializedTabIds.delete(tabId);
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

chrome.commands.onCommand.addListener((command) => {
  handleCommand(command);
});

// Runtime Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !message.type) {
    return;
  }

  switch (message.type) {
    case MessageType.ContentScriptStarted: {
      if (sender.tab) {
        initializedTabIds.add(sender.tab.id);
        addOrUpdateTab(sender.tab);
      }
      break;
    }
    case MessageType.ContentScriptStopped: {
      if (sender.tab) {
        initializedTabIds.delete(sender.tab.id);
      }
      break;
    }
    case MessageType.GET_MODEL: {
      (async () => {
        const settings = await getSettings();
        let zoomFactor = 1;
        try {
          if (sender.tab && sender.tab.id) {
            zoomFactor = await chrome.tabs.getZoom(sender.tab.id);
          }
        } catch (e) {
          // ignore zoom error
        }
        // Return all open tabs in MRU order (no limit)
        sendResponse({
          tabs: mruTabs.slice(),
          settings,
          zoomFactor
        });
      })();
      return true; // Keep sendResponse open for async response
    }
    case MessageType.SWITCH_TAB: {
      if (message.selectedTab) {
        activateTab(message.selectedTab);
      }
      break;
    }
    case MessageType.SetSettings: {
      (async () => {
        const updated = await updateSettings(message.settings || {});
        sendResponse(updated);
      })();
      return true;
    }
    case MessageType.GetSettings: {
      (async () => {
        const settings = await getSettings();
        sendResponse(settings);
      })();
      return true;
    }
    case MessageType.DEMO_SETTINGS: {
      (async () => {
        const activeTab = await getActiveTabInCurrentWindow();
        if (activeTab && !isRestrictedUrl(activeTab.url)) {
          await ensureContentScriptInjected(activeTab);
          chrome.tabs.sendMessage(activeTab.id, { type: MessageType.DEMO_SETTINGS });
        }
      })();
      break;
    }
  }
});

// Initial startup execution
initializeTabRegistry();
