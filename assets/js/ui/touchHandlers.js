// ui/touchHandlers.js
// Mobile touch handlers for press-and-hold selection

import { toggleItemSelection, getSelectedItems } from './selection.js';

// Touch state
let touchTimer = null;
let touchStartItem = null;
let longPressTriggered = false;
const LONG_PRESS_DURATION = 500; // milliseconds

let currentItems = [];
let onItemClickCallback = null;

/**
 * Initialize touch handlers for mobile
 * @param {HTMLElement} fileListEl - File list container element
 * @param {Array} items - Current items array
 * @param {Function} onItemClick - Callback for item click
 */
export function initTouchHandlers(fileListEl, items, onItemClick) {
  if (!fileListEl) return;
  
  currentItems = items;
  onItemClickCallback = onItemClick;
  
  // Only setup on mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   window.matchMedia('(max-width: 768px)').matches;
  
  if (!isMobile) return;
  
  fileListEl.addEventListener('touchstart', handleTouchStart, { passive: false });
  fileListEl.addEventListener('touchend', handleTouchEnd, { passive: false });
  fileListEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  fileListEl.addEventListener('touchcancel', handleTouchCancel, { passive: false });
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
  const target = event.target.closest('.file-card, .file-list-item');
  if (!target || event.touches.length > 1) return;
  
  // Don't prevent default here - allow scrolling to work
  // We'll only prevent default if long press is triggered
  
  touchStartItem = target;
  longPressTriggered = false;
  const itemName = target.dataset.name;
  
  touchTimer = setTimeout(() => {
    longPressTriggered = true;
    const selectedItems = getSelectedItems();
    const isSelected = selectedItems.has(itemName);
    toggleItemSelection(itemName, !isSelected);
    
    target.classList.add('selecting');
    setTimeout(() => target.classList.remove('selecting'), 600);
    
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
  const wasLongPress = longPressTriggered;
  
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
      const itemName = touchStartItem.dataset.name;
      const entry = currentItems.find(item => item.name === itemName);
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
