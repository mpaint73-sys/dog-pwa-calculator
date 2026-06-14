const THEME_KEY = 'dogPaikaTheme';
const VALID_THEMES = ['light', 'dark', 'lavender', 'pistachio'];

const THEME_META = {
  light: { color: '#b8860b', statusBar: 'default' },
  dark: { color: '#0d0d0f', statusBar: 'black-translucent' },
  lavender: { color: '#8b6bae', statusBar: 'default' },
  pistachio: { color: '#6b9e5a', statusBar: 'default' },
};

function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && VALID_THEMES.includes(saved)) return saved;
  } catch { /* ignore */ }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme) {
  if (!VALID_THEMES.includes(theme)) theme = 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const meta = THEME_META[theme];
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = meta.color;
  const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBar) statusBar.content = meta.statusBar;
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.theme === theme);
    chip.setAttribute('aria-pressed', chip.dataset.theme === theme ? 'true' : 'false');
  });
}

function setTheme(theme) {
  if (!VALID_THEMES.includes(theme)) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* ignore */ }
  applyTheme(theme);
}

function initTheme() {
  applyTheme(getTheme());
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => setTheme(chip.dataset.theme));
  });
}

document.addEventListener('DOMContentLoaded', initTheme);
