// ui/touchHandlers.js
// Mobile touch handlers for press-and-hold selection

import { toggleItemSelection, getSelectedItems, isSelected } from './selection.js';
import { showContextMenu } from './contextMenu.js';

// Touch state
let touchTimer = null;
let touchStartItem = null;
let longPressTriggered = false;
let lastTouchEndTime = 0;
const LONG_PRESS_DURATION = 500; // milliseconds

let currentItems = [];
let onItemClickCallback = null;
let menuBuilderCallback = null;
let isInitialized = false;

/**
 * Initialize touch handlers for mobile
 * @param {HTMLElement} fileListEl - File list container element
 * @param {Array} items - Current items array
 * @param {Function} onItemClick - Callback for item click
 * @param {Function} menuBuilder - Callback to build context menu items
 */
export function initTouchHandlers(fileListEl, items, onItemClick, menuBuilder) {
  if (!fileListEl) return;
  
  currentItems = items;
  onItemClickCallback = onItemClick;
  menuBuilderCallback = menuBuilder;
  
  if (isInitialized) return;
  isInitialized = true;
  
  // Initialize touch handlers on ALL devices to support hybrid/tablets
  // We use smart suppression to avoid breaking mouse right-click
  
  fileListEl.addEventListener('touchstart', handleTouchStart, { passive: false });
  fileListEl.addEventListener('touchend', handleTouchEnd, { passive: false });
  fileListEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  fileListEl.addEventListener('touchcancel', handleTouchCancel, { passive: false });
  
  // Smart context menu suppression
  // Only suppress if we are currently in a touch interaction or just finished one
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
 * Update current items reference
 * @param {Array} items - Updated items array
 */
export function updateTouchHandlerItems(items) {
  currentItems = items;
}

/**
 * Handle touch start for press-and-hold
 * @param {TouchEvent} event
 */
function handleTouchStart(event) {
  const target = event.target.closest('.file-card, .file-list-item, .search-result-item');
  if (!target || event.touches.length > 1) return;
  
  // Don't prevent default here - allow scrolling to work
  // We'll only prevent default if long press is triggered
  
  touchStartItem = target;
  longPressTriggered = false;
  const itemId = target.dataset.id || target.dataset.name;
  
  // Capture selection state at START to ensure consistent logic
  const wasSelectedAtStart = isSelected(itemId);
  
  // Capture touch coordinates IMMEDIATELY while they're still valid
  const touch = event.touches[0];
  const touchX = touch.clientX;
  const touchY = touch.clientY;
  
  // Add visual feedback immediately
  target.classList.add('selecting');
  
  // Capture selection state at START to ensure consistent logic
  const wasSelectedAtStart = isSelected(itemName);
  
  // Capture touch coordinates IMMEDIATELY while they're still valid
  const touch = event.touches[0];
  const touchX = touch.clientX;
  const touchY = touch.clientY;
  
  // Add visual feedback immediately
  target.classList.add('selecting');
  
  touchTimer = setTimeout(() => {
    longPressTriggered = true;
    
    // Remove visual feedback immediately when long-press triggers
    target.classList.remove('selecting');
    
    if (wasSelectedAtStart) {
      // State 2: Item was selected at start → Show Context Menu
      // Offset menu above touch point so it's visible (not hidden by finger)
      const menuY = Math.max(50, touchY - 50); // Keep at least 50px from top
      
      if (menuBuilderCallback) {
        const menuItems = menuBuilderCallback();
        showContextMenu(touchX, menuY, menuItems);
      }
    } else {
      // State 1: Item was not selected at start → Select it
      toggleItemSelection(itemId, true);
    }
    
    // Vibrate for feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    touchTimer = null;
  }, LONG_PRESS_DURATION);
}

/**
 * Handle touch end
 * @param {TouchEvent} event
 */
function handleTouchEnd(event) {
  lastTouchEndTime = Date.now();
  const wasLongPress = longPressTriggered;
  
  // If it was a long press, prevent default to stop ghost clicks
  if (wasLongPress) {
    event.preventDefault();
  }
  
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
  
  if (touchStartItem) {
    touchStartItem.classList.remove('selecting');
    
    const selectedItems = getSelectedItems();
    
    // Only trigger click if:
    // 1. It was NOT a long press
    // 2. No items are currently selected (not in selection mode)
    if (!wasLongPress && selectedItems.size === 0) {
      const itemId = touchStartItem.dataset.id || touchStartItem.dataset.name;
      const entry = currentItems.find(item => (item.fullPath || item.name) === itemId);
      if (entry && onItemClickCallback) {
        onItemClickCallback(entry);
      }
    }
    
    touchStartItem = null;
    longPressTriggered = false;
  }
}

/**
 * Handle touch move (cancel long press on scroll)
 * @param {TouchEvent} event
 */
function handleTouchMove(event) {
  // Cancel long press timer when user starts scrolling
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
 * Handle touch cancel
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
