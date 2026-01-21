// ui/keyboardShortcuts.js
// Keyboard shortcuts for file operations

import { selectAll, deselectAll, getSelectedItems } from './selection.js';

let currentItems = [];
let onDeleteCallback = null;
let onRenameCallback = null;

/**
 * Initialize keyboard shortcuts
 * @param {Array} items - Current items array
 * @param {Function} onDelete - Callback for delete action
 * @param {Function} onRename - Callback for rename action
 */
export function initKeyboardShortcuts(items, onDelete, onRename) {
  currentItems = items;
  onDeleteCallback = onDelete;
  onRenameCallback = onRename;
  
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Update current items reference
 * @param {Array} items - Updated items array
 */
export function updateKeyboardShortcutItems(items) {
  currentItems = items;
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event
 */
function handleKeyboardShortcuts(event) {
  // Only handle shortcuts when not in input fields
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }
  
  const selectedItems = getSelectedItems();
  
  switch (event.key) {
    case 'a':
    case 'A':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        selectAll(currentItems);
      }
      break;
    case 'Escape':
      deselectAll();
      break;
    case 'Delete':
    case 'Backspace':
      if (selectedItems.size > 0) {
        event.preventDefault();
        if (onDeleteCallback) {
          onDeleteCallback();
        }
      }
      break;
    case 'F2':
      if (selectedItems.size === 1) {
        event.preventDefault();
        if (onRenameCallback) {
          onRenameCallback();
        }
      }
      break;
  }
}

/**
 * Cleanup keyboard shortcuts
 */
export function cleanupKeyboardShortcuts() {
  document.removeEventListener('keydown', handleKeyboardShortcuts);
}
