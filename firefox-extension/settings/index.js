/**
 * Tab Walker - Firefox Extension Settings Script
 * Synchronizes options UI with browser.storage.local.
 * Implements Stepped Capsule Slider and Craft Toggle Switch controls with dual theme and custom CSS support.
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

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

const fields = [
  'theme',
  'popupWidth',
  'windowHeight',
  'tabHeight',
  'fontSize',
  'iconSize',
  'opacity',
  'overlayBlur',
  'isSwitchingToPreviouslyUsedTab',
  'customCss'
];

const sliderIds = ['popupWidth', 'windowHeight', 'tabHeight', 'fontSize', 'iconSize', 'opacity', 'overlayBlur'];
const toggleIds = ['isSwitchingToPreviouslyUsedTab'];

const form = document.getElementById('settings-form');
const resetBtn = document.getElementById('reset-btn');
const saveStatus = document.getElementById('save-status');

let currentThemeMode = 'system';

function updateThemeButtons(themeValue) {
  const currentTheme = themeValue || 'system';
  const themeInput = document.getElementById('theme');
  if (themeInput) {
    themeInput.value = currentTheme;
  }
  const buttons = document.querySelectorAll('.segmented-btn');
  buttons.forEach(btn => {
    const isSelected = btn.dataset.value === currentTheme;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });
}

function applyTheme(themeValue) {
  currentThemeMode = themeValue || 'system';
  let isDark = false;
  if (themeValue === 'dark') {
    isDark = true;
  } else if (themeValue === 'light') {
    isDark = false;
  } else {
    isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    document.body.classList.add('dark-theme');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.setAttribute('data-theme', 'light');
  }
}

if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    api.runtime.sendMessage({
      type: 'SYSTEM_THEME_CHANGED',
      isDark: e.matches
    }).catch(() => {});
    if (currentThemeMode === 'system') {
      applyTheme('system');
    }
  });
}

function updateToggleAria(toggleId, isChecked) {
  const el = document.getElementById(toggleId);
  if (el) {
    el.setAttribute('aria-checked', isChecked ? 'true' : 'false');
  }
}

function generateTicksForSlider(sliderId) {
  const input = document.getElementById(sliderId);
  const ticksContainer = document.getElementById(`${sliderId}-ticks`);
  if (!input || !ticksContainer) return;

  ticksContainer.innerHTML = '';
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;

  const totalSteps = Math.floor((max - min) / step);
  const displayStepCount = totalSteps > 10 ? Math.ceil(totalSteps / 5) : 1;

  for (let i = 0; i <= totalSteps; i += displayStepCount) {
    const tick = document.createElement('div');
    tick.className = 'tick-mark';
    ticksContainer.appendChild(tick);
  }
}

function updateCapsuleThumb(sliderId, value) {
  const input = document.getElementById(sliderId);
  const thumb = document.getElementById(`${sliderId}-thumb`);
  const fill = document.getElementById(`${sliderId}-fill`);
  const badge = document.getElementById(`${sliderId}-badge`);
  const group = input ? input.closest('.slider-group') : null;
  const unit = group ? group.dataset.unit || '' : '';

  if (!input || !thumb) return;

  const min = Number(input.min);
  const max = Number(input.max);
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  thumb.style.left = `calc(4px + ${pct * 100}% - ${pct * 14}px)`;

  if (fill) {
    fill.style.width = `calc(7px + ${pct * 100}% - ${pct * 14}px)`;
  }

  if (badge) {
    badge.textContent = `${value}${unit}`;
  }
}

function updateAllCapsuleSliders(settings) {
  sliderIds.forEach(id => {
    if (typeof settings[id] !== 'undefined') {
      updateCapsuleThumb(id, settings[id]);
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
  const data = await api.storage.local.get('settings');
  const current = { ...defaultSettings, ...(data.settings || {}) };

  fields.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!current[field];
      updateToggleAria(field, el.checked);
    } else {
      el.value = current[field] || '';
    }
  });

  const activeTheme = current.theme || (current.isDarkTheme ? 'dark' : 'system');
  updateThemeButtons(activeTheme);
  applyTheme(activeTheme);
  updateAllCapsuleSliders(current);
}

async function saveSettings() {
  const settings = {};
  fields.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    if (el.type === 'checkbox') {
      settings[field] = el.checked;
      updateToggleAria(field, el.checked);
    } else if (el.type === 'textarea') {
      settings[field] = el.value;
    } else if (sliderIds.includes(field)) {
      settings[field] = Number(el.value);
    } else {
      settings[field] = el.value;
    }
  });

  const isSystemDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  api.runtime.sendMessage({
    type: 'SYSTEM_THEME_CHANGED',
    isDark: isSystemDark
  }).catch(() => {});

  applyTheme(settings.theme);
  updateAllCapsuleSliders(settings);
  await api.storage.local.set({ settings });
  showSaveStatus();
}

// Initialize theme segmented control buttons
const themeButtons = document.querySelectorAll('.segmented-btn');
themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const selectedTheme = btn.dataset.value;
    updateThemeButtons(selectedTheme);
    saveSettings();
  });
});

// Initialize tick marks and input event listeners
sliderIds.forEach(id => {
  generateTicksForSlider(id);
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', () => {
      updateCapsuleThumb(id, Number(input.value));
      saveSettings();
    });
  }
});

toggleIds.forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('change', () => {
      updateToggleAria(id, input.checked);
      saveSettings();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        input.checked = !input.checked;
        updateToggleAria(id, input.checked);
        saveSettings();
      }
    });
  }
});

fields.forEach(field => {
  const el = document.getElementById(field);
  if (el && !sliderIds.includes(field) && !toggleIds.includes(field) && field !== 'theme') {
    el.addEventListener('input', saveSettings);
    el.addEventListener('change', saveSettings);
  }
});

resetBtn.addEventListener('click', async () => {
  await api.storage.local.set({ settings: defaultSettings });
  await loadSettings();
  showSaveStatus();
});

loadSettings();
