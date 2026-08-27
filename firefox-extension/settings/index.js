/**
 * Tab Walker - Firefox Extension Settings Script
 * Synchronizes options UI with browser.storage.local.
 * Implements Stepped Capsule Slider and Craft Toggle Switch controls with dual theme support.
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

const defaultSettings = {
  isDarkTheme: false,
  popupWidth: 460,
  windowHeight: 500,
  tabHeight: 42,
  fontSize: 15,
  iconSize: 20,
  opacity: 100,
  isSwitchingToPreviouslyUsedTab: true,
  position: null
};

const fields = [
  'isDarkTheme',
  'popupWidth',
  'windowHeight',
  'tabHeight',
  'fontSize',
  'iconSize',
  'opacity',
  'isSwitchingToPreviouslyUsedTab'
];

const sliderIds = ['popupWidth', 'windowHeight', 'tabHeight', 'fontSize', 'iconSize', 'opacity'];
const toggleIds = ['isDarkTheme', 'isSwitchingToPreviouslyUsedTab'];

const form = document.getElementById('settings-form');
const resetBtn = document.getElementById('reset-btn');
const saveStatus = document.getElementById('save-status');

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-theme');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.setAttribute('data-theme', 'light');
  }
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
      el.value = current[field];
    }
  });

  applyTheme(current.isDarkTheme);
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
    } else {
      settings[field] = Number(el.value);
    }
  });

  applyTheme(settings.isDarkTheme);
  updateAllCapsuleSliders(settings);
  await api.storage.local.set({ settings });
  showSaveStatus();
}

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
  if (el && !sliderIds.includes(field) && !toggleIds.includes(field)) {
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
