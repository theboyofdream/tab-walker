/**
 * Tab Walker - Settings Script
 * Synchronizes options UI with chrome.storage.local.
 */

const defaultSettings = {
  isDarkTheme: false,
  popupWidth: 460,
  windowHeight: 500,
  fontSize: 15,
  iconSize: 20,
  opacity: 100,
  isSwitchingToPreviouslyUsedTab: true
};

const fields = [
  'isDarkTheme',
  'popupWidth',
  'windowHeight',
  'fontSize',
  'iconSize',
  'opacity',
  'isSwitchingToPreviouslyUsedTab'
];

const form = document.getElementById('settings-form');
const resetBtn = document.getElementById('reset-btn');
const saveStatus = document.getElementById('save-status');

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

function updateValueDisplays(settings) {
  ['popupWidth', 'windowHeight', 'fontSize', 'iconSize', 'opacity'].forEach(field => {
    const valEl = document.getElementById(`${field}-val`);
    if (valEl) {
      valEl.textContent = settings[field];
    }
  });
}

function showSaveStatus() {
  saveStatus.classList.add('show');
  setTimeout(() => {
    saveStatus.classList.remove('show');
  }, 1200);
}

async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const current = { ...defaultSettings, ...(data.settings || {}) };

  fields.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!current[field];
    } else {
      el.value = current[field];
    }
  });

  applyTheme(current.isDarkTheme);
  updateValueDisplays(current);
}

async function saveSettings() {
  const settings = {};
  fields.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    if (el.type === 'checkbox') {
      settings[field] = el.checked;
    } else {
      settings[field] = Number(el.value);
    }
  });

  applyTheme(settings.isDarkTheme);
  await chrome.storage.local.set({ settings });
  updateValueDisplays(settings);
  showSaveStatus();
}

fields.forEach(field => {
  const el = document.getElementById(field);
  if (el) {
    el.addEventListener('input', saveSettings);
    el.addEventListener('change', saveSettings);
  }
});

resetBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ settings: defaultSettings });
  await loadSettings();
  showSaveStatus();
});

loadSettings();
