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
 * @param {string} itemId
 * @param {boolean} selected
 */
export function toggleItemSelection(itemId, selected) {
  if (selected) {
    selectedItems.add(itemId);
  } else {
    selectedItems.delete(itemId);
  }
  updateSelectionUI();
}

/**
 * Select all items
 * @param {Array} items - All items to select
 */
export function selectAll(items) {
  items.forEach(item => {
    // Use fullPath for deep search items, name for normal items
    selectedItems.add(item.fullPath || item.name);
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
 * @param {string} itemId
 * @returns {boolean}
 */
export function isSelected(itemId) {
  return selectedItems.has(itemId);
}

/**
 * Update selection bar visibility/content and visual selection state of items
 */
function updateSelectionUI() {
  // Update selection bar
  if (selectionBar && selectionInfo) {
    const count = selectedItems.size;
    
    if (count > 0) {
      selectionBar.classList.add('visible');
      selectionInfo.textContent = `${count} item${count === 1 ? '' : 's'} selected`;
    } else {
      selectionBar.classList.remove('visible');
    }
  }
  
  // Update visual selection state of all items in the DOM based on dataset.id (or fallback to name)
  const allItems = document.querySelectorAll('.file-card, .file-list-item, .search-result-item');
  
  allItems.forEach(item => {
    const itemId = item.dataset.id || item.dataset.name;
    if (itemId) {
      if (selectedItems.has(itemId)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    }
  });
}
