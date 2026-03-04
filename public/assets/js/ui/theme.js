/**
 * theme.js
 * ─────────────────────────────────────────────────────────────
 * Theme management module for NanoCloud.
 *
 * Responsibilities:
 *  - Read the user's saved preference from localStorage
 *  - Fall back to the OS-level prefers-color-scheme when no
 *    manual preference has been saved
 *  - Apply the effective theme by setting data-theme on <html>
 *  - Listen for OS-level changes and auto-switch (only when the
 *    user has NOT set a manual override)
 *  - Wire the header toggle button
 *  - Expose initTheme(), toggleTheme(), and getTheme()
 *
 * Theme storage key: 'nanocloud-theme'
 * Possible values  : 'light' | 'dark' | null (= follow OS)
 *
 * To add a new theme in the future:
 *  1. Add a [data-theme="your-theme"] block in variables.css
 *  2. Add the new value to the VALID_THEMES set below
 *  3. Extend the toggle cycle in toggleTheme() if desired
 * ─────────────────────────────────────────────────────────────
 */

const STORAGE_KEY   = 'nanocloud-theme';
const THEME_ATTR    = 'data-theme';
const VALID_THEMES  = new Set(['light', 'dark']);

// ── Button icon / label maps ──────────────────────────────────
const TOGGLE_ICON  = { light: '🌙', dark: '☀️' };
const TOGGLE_TITLE = {
  light: 'Switch to Dark Mode',
  dark:  'Switch to Light Mode',
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Return the currently active theme ('light' | 'dark').
 * Reads the attribute that was already applied to <html>.
 */
export function getTheme() {
  return document.documentElement.getAttribute(THEME_ATTR) || _resolveTheme();
}

/**
 * Toggle between 'light' and 'dark', persist the choice, and
 * apply it immediately.
 */
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  _applyTheme(next);
}

/**
 * Initialise the theme system.
 * Call once from main.js after the DOM is ready.
 *
 * - Applies the correct theme (saved preference or OS default)
 * - Wires the toggle button (#themeToggleBtn)
 * - Listens for OS-level preference changes
 */
export function initTheme() {
  // Apply the resolved theme (the anti-FOUC inline script in
  // <head> already set the attribute, but we still call this to
  // ensure the button label is correct and the listener is set up)
  _applyTheme(_resolveTheme());

  // Wire the toggle button
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }

  // Auto-switch when the OS preference changes — but only when
  // the user has NOT saved a manual override
  _osMediaQuery().addEventListener('change', _handleOsChange);
}

// ─────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the effective theme:
 *   1. Saved manual preference (localStorage)
 *   2. OS preference (prefers-color-scheme)
 *   3. Default: 'light'
 */
function _resolveTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && VALID_THEMES.has(saved)) return saved;
  return _osMediaQuery().matches ? 'dark' : 'light';
}

/**
 * Apply a theme: set the attribute on <html> and update the
 * toggle button's icon and accessible label.
 */
function _applyTheme(theme) {
  document.documentElement.setAttribute(THEME_ATTR, theme);
  _updateToggleButton(theme);
}

/**
 * Update the toggle button's visual state to reflect the
 * currently active theme.
 */
function _updateToggleButton(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.textContent  = TOGGLE_ICON[theme]  ?? '🌙';
  btn.title        = TOGGLE_TITLE[theme] ?? 'Toggle theme';
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

/**
 * Handle an OS-level color-scheme change.
 * Only acts when the user has no saved manual preference.
 */
function _handleOsChange(e) {
  if (localStorage.getItem(STORAGE_KEY)) return; // manual override wins
  _applyTheme(e.matches ? 'dark' : 'light');
}

/** Convenience wrapper for the OS media query. */
function _osMediaQuery() {
  return window.matchMedia('(prefers-color-scheme: dark)');
}
