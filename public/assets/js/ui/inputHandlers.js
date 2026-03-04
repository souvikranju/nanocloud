/**
 * @file public/assets/js/ui/inputHandlers.js
 * @module UI/InputHandlers
 *
 * @description
 * Single consolidated module for ALL keyboard shortcuts and touch/gesture handling.
 * Replaces the former keyboardShortcuts.js and touchHandlers.js, and absorbs the
 * inline keyboard block that previously lived in main.js.
 *
 * Initialization (called once from main.js after all modules are ready):
 *   initInputHandlers(config)
 *
 * Item list update (called from list.js after every render):
 *   updateInputHandlerItems(items)
 */

import { KEYBOARD_SHORTCUTS, LONG_PRESS_DURATION_MS } from '../constants.js';
import {
  selectAll,
  deselectAll,
  getSelectedItems,
  toggleItemSelection,
  isSelected,
  setPivot
} from './selection.js';
import { showContextMenu } from './contextMenu.js';

// =====================================
// MODULE STATE
// =====================================

/** Current rendered items array — kept in sync via updateInputHandlerItems() */
let currentItems = [];

/** Callbacks injected at init time */
let callbacks = {
  // Global / navigation
  onUpload: null,
  onRefresh: null,
  onHelp: null,
  onCloseModals: null,
  onNavigateUp: null,

  // Item actions
  onDelete: null,
  onRename: null,
  onMove: null,

  // Touch / click
  onItemClick: null,
  onMenuBuild: null,
};

// =====================================
// TOUCH STATE
// =====================================

let touchTimer = null;
let touchStartItem = null;
let longPressTriggered = false;
let lastTouchEndTime = 0;
let touchInitialized = false;

// =====================================
// PUBLIC API
// =====================================

/**
 * Initialize all input handlers (keyboard + touch).
 * Call once from main.js after all UI modules are ready.
 *
 * @param {Object} config
 * @param {Function} config.onUpload        - Open upload modal
 * @param {Function} config.onRefresh       - Trigger refresh
 * @param {Function} config.onHelp          - Open info/help modal
 * @param {Function} config.onCloseModals   - Close all open modals
 * @param {Function} config.onNavigateUp    - Navigate one directory up
 * @param {Function} config.onDelete        - Delete selected items
 * @param {Function} config.onRename        - Rename selected item
 * @param {Function} config.onMove          - Open move modal for selected items
 * @param {Function} config.onItemClick     - Handle item primary click (open/download)
 * @param {Function} config.onMenuBuild     - Build context menu items array
 * @param {HTMLElement} config.fileListEl   - File list container (for touch binding)
 */
export function initInputHandlers(config) {
  callbacks = { ...callbacks, ...config };

  // Register global keyboard listener
  document.addEventListener('keydown', handleKeyDown);

  // Register mouse back/forward button listener
  document.addEventListener('mousedown', handleMouseButtons);

  // Register touch handlers on the file list element
  if (config.fileListEl) {
    initTouchHandlers(config.fileListEl);
  }
}

/**
 * Update the current items reference after every render.
 * Called from list.js whenever the item list changes.
 *
 * @param {Array} items
 */
export function updateInputHandlerItems(items) {
  currentItems = items || [];
}

/**
 * Cleanup — removes all global listeners (useful for testing / teardown).
 */
export function cleanupInputHandlers() {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('mousedown', handleMouseButtons);
}

// =====================================
// KEYBOARD HANDLER
// =====================================

/**
 * Central keyboard shortcut dispatcher.
 * Handles both global shortcuts (upload, refresh, help) and
 * item-focused shortcuts (select, delete, rename, navigate, arrow keys).
 *
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  // Never intercept shortcuts while the user is typing in an input/textarea
  const tag = event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return;
  }

  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  const key = event.key;

  // ── Global shortcuts (no modifier required for F-keys) ──────────────────

  // Upload: Ctrl/Cmd + U
  if (ctrl && key === KEYBOARD_SHORTCUTS.UPLOAD) {
    event.preventDefault();
    callbacks.onUpload?.();
    return;
  }

  // Refresh: F5 or Ctrl/Cmd + R
  if (key === KEYBOARD_SHORTCUTS.REFRESH_ALT || (ctrl && key === KEYBOARD_SHORTCUTS.REFRESH)) {
    event.preventDefault();
    callbacks.onRefresh?.();
    return;
  }

  // Help / Info modal: F1
  if (key === KEYBOARD_SHORTCUTS.HELP) {
    event.preventDefault();
    callbacks.onHelp?.();
    return;
  }

  // Close modals / deselect: Escape
  if (key === KEYBOARD_SHORTCUTS.ESCAPE) {
    callbacks.onCloseModals?.();
    deselectAll();
    return;
  }

  // ── Item-focused shortcuts ───────────────────────────────────────────────

  const selected = getSelectedItems();

  // Select All: Ctrl/Cmd + A
  if (ctrl && key === KEYBOARD_SHORTCUTS.SELECT_ALL) {
    event.preventDefault();
    selectAll(currentItems);
    return;
  }

  // Delete key: always delete selected items (if any)
  if (key === KEYBOARD_SHORTCUTS.DELETE) {
    if (selected.size > 0) {
      event.preventDefault();
      callbacks.onDelete?.();
    }
    return;
  }

  // Backspace: always navigate up one directory (clears selection first).
  // Use Delete key to delete selected items.
  if (key === KEYBOARD_SHORTCUTS.NAVIGATE_UP) {
    event.preventDefault();
    callbacks.onNavigateUp?.();
    return;
  }

  // Rename: F2 (single selection only)
  if (key === KEYBOARD_SHORTCUTS.RENAME) {
    if (selected.size === 1) {
      event.preventDefault();
      callbacks.onRename?.();
    }
    return;
  }

}

// =====================================
// MOUSE BACK / FORWARD BUTTONS
// =====================================

/**
 * Handle mouse extra buttons:
 *   button 3 = browser Back  → navigate up
 *   button 4 = browser Forward → no-op (prevent default to avoid accidental navigation)
 *
 * @param {MouseEvent} event
 */
function handleMouseButtons(event) {
  if (event.button === 3) {
    event.preventDefault();
    callbacks.onNavigateUp?.();
  } else if (event.button === 4) {
    // Forward button — prevent default browser forward navigation
    // (we don't implement forward history in this app)
    event.preventDefault();
  }
}

// =====================================
// TOUCH HANDLERS (Long-press selection)
// =====================================

/**
 * Attach touch event listeners to the file list container.
 * Uses event delegation — a single set of listeners on the parent.
 *
 * @param {HTMLElement} fileListEl
 */
function initTouchHandlers(fileListEl) {
  if (touchInitialized) return;
  touchInitialized = true;

  fileListEl.addEventListener('touchstart',  handleTouchStart,  { passive: false });
  fileListEl.addEventListener('touchend',    handleTouchEnd,    { passive: false });
  fileListEl.addEventListener('touchmove',   handleTouchMove,   { passive: false });
  fileListEl.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  // Smart context-menu suppression:
  // Only suppress the native context menu if we are in (or just finished) a touch interaction.
  // This preserves right-click on hybrid/desktop devices.
  fileListEl.addEventListener('contextmenu', (e) => {
    const timeSinceLastTouch = Date.now() - lastTouchEndTime;
    const isTouchInteraction = touchStartItem !== null || timeSinceLastTouch < 500;
    if (isTouchInteraction) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

/**
 * Touch start — begin long-press timer.
 * @param {TouchEvent} event
 */
function handleTouchStart(event) {
  const target = event.target.closest('.file-card, .file-list-item, .search-result-item');
  if (!target || event.touches.length > 1) return;

  touchStartItem = target;
  longPressTriggered = false;

  const itemId = target.dataset.id || target.dataset.name;
  const wasSelectedAtStart = isSelected(itemId);

  // Capture touch coordinates immediately (they become invalid after the event)
  const touch = event.touches[0];
  const touchX = touch.clientX;
  const touchY = touch.clientY;

  // Visual feedback
  target.classList.add('selecting');

  touchTimer = setTimeout(() => {
    longPressTriggered = true;
    target.classList.remove('selecting');

    if (wasSelectedAtStart) {
      // Item was already selected → show context menu
      const menuY = Math.max(50, touchY - 50);
      if (callbacks.onMenuBuild) {
        const menuItems = callbacks.onMenuBuild();
        showContextMenu(touchX, menuY, menuItems);
      }
    } else {
      // Item was not selected → select it (enter selection mode)
      toggleItemSelection(itemId, true);
      setPivot(itemId);
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    touchTimer = null;
  }, LONG_PRESS_DURATION_MS);
}

/**
 * Touch end — fire click if it was a short tap (not a long press).
 * @param {TouchEvent} event
 */
function handleTouchEnd(event) {
  lastTouchEndTime = Date.now();
  const wasLongPress = longPressTriggered;

  if (wasLongPress) {
    event.preventDefault(); // Prevent ghost click after long press
  }

  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }

  if (touchStartItem) {
    touchStartItem.classList.remove('selecting');

    const selected = getSelectedItems();

    // Fire click only if:
    //   1. It was NOT a long press
    //   2. No items are currently selected (not in selection mode)
    if (!wasLongPress && selected.size === 0) {
      const itemId = touchStartItem.dataset.id || touchStartItem.dataset.name;
      const entry = currentItems.find(item => (item.fullPath || item.name) === itemId);
      if (entry && callbacks.onItemClick) {
        callbacks.onItemClick(entry);
      }
    }

    touchStartItem = null;
    longPressTriggered = false;
  }
}

/**
 * Touch move — cancel long-press timer (user is scrolling).
 * @param {TouchEvent} event
 */
function handleTouchMove(event) {
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
  if (touchStartItem) {
    touchStartItem.classList.remove('selecting');
    touchStartItem = null;
    longPressTriggered = false;
  }
}

/**
 * Touch cancel — clean up state.
 * @param {TouchEvent} event
 */
function handleTouchCancel(event) {
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
  if (touchStartItem) {
    touchStartItem.classList.remove('selecting');
    touchStartItem = null;
    longPressTriggered = false;
  }
}
