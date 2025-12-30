// ui/selection.js
// Selection state management and UI updates

// Selection state
let selectedItems = new Set();
let selectionBar = null;
let selectionInfo = null;

/**
 * Initialize selection system
 * @param {Object} refs - DOM element references
 */
export function initSelection(refs) {
  selectionBar = refs.selectionBar || document.getElementById('selectionBar');
  selectionInfo = refs.selectionInfo || document.getElementById('selectionInfo');
}

/**
 * Get current selection
 * @returns {Set<string>}
 */
export function getSelectedItems() {
  return selectedItems;
}

/**
 * Clear all selections
 */
export function clearSelection() {
  selectedItems.clear();
  updateSelectionUI();
}

/**
 * Toggle item selection
 * @param {string} itemName
 * @param {boolean} selected
 */
export function toggleItemSelection(itemName, selected) {
  if (selected) {
    selectedItems.add(itemName);
  } else {
    selectedItems.delete(itemName);
  }
  updateSelectionUI();
}

/**
 * Select all items
 * @param {Array} items - All items to select
 */
export function selectAll(items) {
  items.forEach(item => {
    selectedItems.add(item.name);
  });
  updateSelectionUI();
}

/**
 * Deselect all items
 */
export function deselectAll() {
  selectedItems.clear();
  updateSelectionUI();
}

/**
 * Check if item is selected
 * @param {string} itemName
 * @returns {boolean}
 */
export function isSelected(itemName) {
  return selectedItems.has(itemName);
}

/**
 * Update selection bar visibility and content
 */
function updateSelectionUI() {
  if (!selectionBar || !selectionInfo) return;
  
  const count = selectedItems.size;
  
  if (count > 0) {
    selectionBar.classList.add('visible');
    selectionInfo.textContent = `${count} item${count === 1 ? '' : 's'} selected`;
  } else {
    selectionBar.classList.remove('visible');
  }
}
