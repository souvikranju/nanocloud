// ui/list.js
// File list rendering with grid/list views
// Focused on rendering responsibilities only

import { 
  DOWNLOAD_BASE,
  VIEW_MODE_GRID,
  VIEW_MODE_LIST,
  VIEW_MODE_STORAGE_KEY,
  ACTIVE_CLASS
} from '../constants.js';
import { joinPath } from '../utils.js';
import { list as apiList } from '../nanocloudClient.js';
import { setExistingNamesFromList, setCurrentPath, getCurrentPath, registerAutoRefresh, requestRefresh, isOperationAllowed } from '../state.js';
import { showError } from './toast.js';
import { 
  createFileIconElement,
  createListIconElement,
  isViewableInBrowser
} from './fileIcons.js';
import { formatBytes, formatDate } from '../utils.js';

import { 
  initSelection,
  getSelectedItems,
  clearSelection,
  toggleItemSelection,
  isSelected,
  selectAll,
  deselectAll
} from './selection.js';
import { initTouchHandlers, updateTouchHandlerItems } from './touchHandlers.js';
import { initKeyboardShortcuts, updateKeyboardShortcutItems } from './keyboardShortcuts.js';
import { 
  deleteItem, 
  deleteSelectedItems, 
  renameSelectedItem, 
  moveSelectedItems,
  updateItemActionsItems
} from './itemActions.js';

// DOM References
/** @type {HTMLElement|null} */ let fileListEl = null;
/** @type {HTMLElement|null} */ let emptyStateEl = null;
/** @type {HTMLElement|null} */ let breadcrumbsEl = null;
/** @type {HTMLElement|null} */ let refreshBtn = null;
/** @type {HTMLElement|null} */ let storageTextEl = null;
/** @type {HTMLElement|null} */ let storageBarEl = null;
/** @type {HTMLElement|null} */ let listLoadingEl = null;
/** @type {HTMLElement|null} */ let upBtn = null;
/** @type {HTMLElement|null} */ let gridViewBtn = null;
/** @type {HTMLElement|null} */ let listViewBtn = null;

// State
let currentViewMode = VIEW_MODE_LIST; // Default to list view
let currentItems = [];

/**
 * Initialize DOM references for list UI
 * @param {Object} refs - DOM element references
 */
export function initList(refs) {
  fileListEl = refs.fileListEl || null;
  emptyStateEl = refs.emptyStateEl || null;
  breadcrumbsEl = refs.breadcrumbsEl || null;
  refreshBtn = refs.refreshBtn || null;
  storageTextEl = refs.storageTextEl || null;
  storageBarEl = refs.storageBarEl || null;
  listLoadingEl = refs.listLoadingEl || null;
  upBtn = refs.upBtn || null;
  
  // Get additional UI elements
  gridViewBtn = document.getElementById('gridViewBtn');
  listViewBtn = document.getElementById('listViewBtn');
  
  // Load saved view preference first
  loadViewPreference();
  
  // Setup view toggle handlers
  setupViewToggle();
  
  // Initialize new modules
  initSelection({
    selectionBar: document.getElementById('selectionBar'),
    selectionInfo: document.getElementById('selectionInfo')
  });
  
  initTouchHandlers(fileListEl, currentItems, handleItemClick);
  
  initKeyboardShortcuts(currentItems, deleteSelectedItems, renameSelectedItem);
  
  // Setup selection bar buttons
  setupSelectionButtons();
  
  // Register this module's fetchAndRenderList as the auto-refresh callback
  registerAutoRefresh((requestId) => fetchAndRenderListWithTracking(requestId));
}

/**
 * Setup selection bar buttons
 */
function setupSelectionButtons() {
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const renameSelectedBtn = document.getElementById('renameSelectedBtn');
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => selectAll(currentItems));
  }
  
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', deselectAll);
  }
  
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', deleteSelectedItems);
  }
  
  if (renameSelectedBtn) {
    renameSelectedBtn.addEventListener('click', renameSelectedItem);
  }
  
  if (moveSelectedBtn) {
    moveSelectedBtn.addEventListener('click', moveSelectedItems);
  }
}

/**
 * Update selection bar button states based on configuration
 */
export function updateSelectionButtonStates() {
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const renameSelectedBtn = document.getElementById('renameSelectedBtn');
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');
  
  // Check delete permission
  const deleteCheck = isOperationAllowed('delete');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = !deleteCheck.allowed;
    deleteSelectedBtn.title = deleteCheck.allowed ? 'Delete selected items' : deleteCheck.reason;
    if (!deleteCheck.allowed) {
      deleteSelectedBtn.style.opacity = '0.5';
      deleteSelectedBtn.style.cursor = 'not-allowed';
    }
  }
  
  // Check rename permission
  const renameCheck = isOperationAllowed('rename');
  if (renameSelectedBtn) {
    renameSelectedBtn.disabled = !renameCheck.allowed;
    renameSelectedBtn.title = renameCheck.allowed ? 'Rename selected item' : renameCheck.reason;
    if (!renameCheck.allowed) {
      renameSelectedBtn.style.opacity = '0.5';
      renameSelectedBtn.style.cursor = 'not-allowed';
    }
  }
  
  // Check move permission
  const moveCheck = isOperationAllowed('move');
  if (moveSelectedBtn) {
    moveSelectedBtn.disabled = !moveCheck.allowed;
    moveSelectedBtn.title = moveCheck.allowed ? 'Move selected items' : moveCheck.reason;
    if (!moveCheck.allowed) {
      moveSelectedBtn.style.opacity = '0.5';
      moveSelectedBtn.style.cursor = 'not-allowed';
    }
  }
}

/**
 * Setup view toggle functionality
 */
function setupViewToggle() {
  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!gridViewBtn.disabled) {
        switchView(VIEW_MODE_GRID);
      }
    }, true);
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!listViewBtn.disabled) {
        switchView(VIEW_MODE_LIST);
      }
    }, true);
  }
}

/**
 * Switch between grid and list view
 * @param {string} mode - VIEW_MODE_GRID or VIEW_MODE_LIST
 */
function switchView(mode) {
  if (mode === currentViewMode) return;
  
  currentViewMode = mode;
  
  if (gridViewBtn && listViewBtn) {
    gridViewBtn.classList.toggle(ACTIVE_CLASS, mode === VIEW_MODE_GRID);
    listViewBtn.classList.toggle(ACTIVE_CLASS, mode === VIEW_MODE_LIST);
  }
  
  if (fileListEl) {
    fileListEl.className = mode === VIEW_MODE_GRID ? 'file-grid' : 'file-list';
  }
  
  renderItems(currentItems);
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
}

/**
 * Load saved view preference
 */
function loadViewPreference() {
  const savedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (savedMode === VIEW_MODE_LIST || savedMode === VIEW_MODE_GRID) {
    switchView(savedMode);
  }
}

/**
 * Toggle loading state
 * @param {boolean} isLoading
 */
export function setListLoading(isLoading) {
  if (refreshBtn) {
    refreshBtn.disabled = !!isLoading;
    const spinner = refreshBtn.querySelector('.refresh-spinner');
    const label = refreshBtn.querySelector('.refresh-label');
    
    if (spinner && label) {
      if (isLoading) {
        spinner.classList.remove('hidden');
        label.classList.add('hidden');
      } else {
        spinner.classList.add('hidden');
        label.classList.remove('hidden');
      }
    }
  }
  
  if (listLoadingEl) {
    if (isLoading) {
      listLoadingEl.classList.remove('hidden');
    } else {
      listLoadingEl.classList.add('hidden');
    }
  }
}

/**
 * Update storage meter
 * @param {Object} storage - Storage information
 */
export function updateStorage(storage) {
  if (!storage || !storageTextEl || !storageBarEl) return;
  
  const total = storage.totalBytes ?? 0;
  const free = storage.freeBytes ?? 0;
  const used = storage.usedBytes ?? Math.max(0, total - free);
  const percent = storage.usedPercent ?? (total > 0 ? (used / total) * 100 : 0);

  storageTextEl.textContent = `Used ${formatBytes(used)} of ${formatBytes(total)}`;

  const pct = Math.max(0, Math.min(100, percent));
  storageBarEl.style.width = pct.toFixed(1) + '%';
  storageBarEl.classList.remove('bar-green', 'bar-orange', 'bar-red');
  
  if (pct < 60) storageBarEl.classList.add('bar-green');
  else if (pct < 85) storageBarEl.classList.add('bar-orange');
  else storageBarEl.classList.add('bar-red');
}

/**
 * Update breadcrumbs navigation
 * @param {string[]} breadcrumbs
 */
export function updateBreadcrumbs(breadcrumbs) {
  if (!breadcrumbsEl) return;
  
  breadcrumbsEl.innerHTML = '';

  const rootCrumb = document.createElement('span');
  rootCrumb.className = 'crumb';
  rootCrumb.textContent = 'Home';
  rootCrumb.addEventListener('click', () => {
    setCurrentPath('');
    requestRefresh();
  });
  breadcrumbsEl.appendChild(rootCrumb);

  if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
    breadcrumbs.forEach((seg, index) => {
      const sep = document.createElement('span');
      sep.className = 'path-sep';
      sep.textContent = ' / ';
      breadcrumbsEl.appendChild(sep);

      const crumb = document.createElement('span');
      crumb.className = 'crumb';
      crumb.textContent = seg;
      
      const currentPath = breadcrumbs.slice(0, index + 1).join('/');
      
      crumb.addEventListener('click', () => {
        setCurrentPath(currentPath);
        requestRefresh();
      });
      breadcrumbsEl.appendChild(crumb);
    });
  }

  if (upBtn) {
    upBtn.disabled = getCurrentPath() === '';
  }
}

/**
 * Render items in current view mode
 * @param {Array} items - File/folder items
 */
export function renderItems(items) {
  if (!fileListEl || !emptyStateEl) return;
  
  currentItems = items || [];
  fileListEl.innerHTML = '';
  
  // Don't clear selection on refresh - preserve user's selection
  // clearSelection();
  
  setExistingNamesFromList(currentItems);
  
  // Update references in other modules
  updateTouchHandlerItems(currentItems);
  updateKeyboardShortcutItems(currentItems);
  updateItemActionsItems(currentItems);

  if (!currentItems || currentItems.length === 0) {
    emptyStateEl.style.display = 'flex';
    return;
  }
  
  emptyStateEl.style.display = 'none';

  if (currentViewMode === VIEW_MODE_GRID) {
    renderGridView(currentItems);
  } else {
    renderListView(currentItems);
  }
}

/**
 * View configuration for grid and list modes
 */
const VIEW_CONFIG = {
  grid: {
    itemClass: 'file-card',
    nameClass: 'file-name',
    metaClass: 'file-meta',
    actionsClass: 'file-actions',
    iconFn: createFileIconElement,
    wrapInfo: false
  },
  list: {
    itemClass: 'file-list-item',
    nameClass: 'file-list-name',
    metaClass: 'file-list-meta',
    actionsClass: 'file-list-actions',
    iconFn: createListIconElement,
    wrapInfo: true
  }
};

/**
 * Create metadata text for an entry
 * @param {Object} entry
 * @returns {string}
 */
function createMetadataText(entry) {
  if (entry.type === 'dir') {
    const countText = entry.count != null ? `${entry.count} items` : '';
    const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
    return [countText, timeText].filter(Boolean).join(' • ');
  } else {
    const sizeText = entry.size != null ? formatBytes(entry.size) : '';
    const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
    return [sizeText, timeText].filter(Boolean).join(' • ');
  }
}

/**
 * Create delete button for an entry
 * @param {Object} entry
 * @returns {HTMLButtonElement}
 */
function createDeleteButton(entry) {
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.innerHTML = '🗑️';
  
  // Check if delete operation is allowed
  const check = isOperationAllowed('delete');
  if (!check.allowed) {
    deleteBtn.disabled = true;
    deleteBtn.title = check.reason;
    deleteBtn.style.opacity = '0.5';
    deleteBtn.style.cursor = 'not-allowed';
  } else {
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(entry);
    });
  }
  
  return deleteBtn;
}

/**
 * Attach click handler to item element
 * @param {HTMLElement} element
 * @param {Object} entry
 */
function attachItemClickHandler(element, entry) {
  element.addEventListener('click', (e) => {
    // Ctrl/Cmd+Click for multi-select
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const selected = isSelected(entry.name);
      toggleItemSelection(entry.name, !selected);
      element.classList.toggle('selected', !selected);
      return;
    }
    
    const selectedItems = getSelectedItems();
    
    // If ANY items are selected (selection mode is active)
    if (selectedItems.size > 0) {
      e.preventDefault();
      
      // If this item is already selected, deselect it
      if (isSelected(entry.name)) {
        toggleItemSelection(entry.name, false);
        element.classList.remove('selected');
      } else {
        // Add this item to selection
        toggleItemSelection(entry.name, true);
        element.classList.add('selected');
      }
      return;
    }
    
    // No items selected - normal click behavior (open/download)
    handleItemClick(entry);
  });
}

/**
 * Render a single item based on view mode
 * @param {Object} entry
 * @param {'grid'|'list'} viewMode
 * @returns {HTMLLIElement}
 */
function renderItem(entry, viewMode) {
  const config = VIEW_CONFIG[viewMode];
  
  const li = document.createElement('li');
  li.className = config.itemClass;
  li.dataset.name = entry.name;
  li.dataset.type = entry.type;
  
  const iconEl = config.iconFn(entry.name, entry.type);
  
  const nameEl = document.createElement('div');
  nameEl.className = config.nameClass;
  nameEl.textContent = entry.name;
  
  const metaEl = document.createElement('div');
  metaEl.className = config.metaClass;
  metaEl.textContent = createMetadataText(entry);
  
  const actionsEl = document.createElement('div');
  actionsEl.className = config.actionsClass;
  actionsEl.appendChild(createDeleteButton(entry));
  
  // Build DOM structure based on view mode
  if (config.wrapInfo) {
    // List view: wrap name and meta in info container
    const infoEl = document.createElement('div');
    infoEl.className = 'file-info';
    infoEl.appendChild(nameEl);
    infoEl.appendChild(metaEl);
    
    li.appendChild(iconEl);
    li.appendChild(infoEl);
    li.appendChild(actionsEl);
  } else {
    // Grid view: append directly
    li.appendChild(iconEl);
    li.appendChild(nameEl);
    li.appendChild(metaEl);
    li.appendChild(actionsEl);
  }
  
  // Apply selection state if item is selected
  if (isSelected(entry.name)) {
    li.classList.add('selected');
  }
  
  attachItemClickHandler(li, entry);
  
  return li;
}

/**
 * Render items in grid view
 * @param {Array} items
 */
function renderGridView(items) {
  fileListEl.className = 'file-grid';
  items.forEach(entry => {
    fileListEl.appendChild(renderItem(entry, 'grid'));
  });
}

/**
 * Render items in list view
 * @param {Array} items
 */
function renderListView(items) {
  fileListEl.className = 'file-list';
  items.forEach(entry => {
    fileListEl.appendChild(renderItem(entry, 'list'));
  });
}

/**
 * Handle item click (navigation or download)
 * @param {Object} entry
 */
function handleItemClick(entry) {
  if (entry.type === 'dir') {
    setCurrentPath(joinPath(getCurrentPath(), entry.name));
    requestRefresh();
  } else {
    const path = getCurrentPath();
    const downloadUrl = DOWNLOAD_BASE + (path ? (`?path=${encodeURIComponent(path)}&file=`) : ('?file=')) + encodeURIComponent(entry.name);
    console.log(downloadUrl);
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    if (isViewableInBrowser(entry.name)) {
      // Open viewable files in new tab
      link.target = '_blank';
    } else {
      // Force download for non-viewable files
      link.setAttribute('download', entry.name);
    }
    
    // Trigger the link click
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Request tracking version of fetchAndRenderList for auto-refresh
 * @param {number} requestId
 */
async function fetchAndRenderListWithTracking(requestId) {
  setListLoading(true);
  try {
    const resp = await apiList(getCurrentPath());
    if (!resp.success) throw new Error(resp.message || 'Failed to load items');
    
    setCurrentPath(resp.path || '');
    updateBreadcrumbs(resp.breadcrumbs || []);
    updateStorage(resp.storage);
    renderItems(resp.items || []);
  } catch (err) {
    showError(`Error loading items: ${err.message || err}`);
  } finally {
    setListLoading(false);
  }
}

/**
 * Fetch listing from server and render items
 */
export async function fetchAndRenderList() {
  setListLoading(true);
  try {
    const resp = await apiList(getCurrentPath());
    if (!resp.success) throw new Error(resp.message || 'Failed to load items');
    
    setCurrentPath(resp.path || '');
    updateBreadcrumbs(resp.breadcrumbs || []);
    updateStorage(resp.storage);
    renderItems(resp.items || []);
  } catch (err) {
    showError(`Error loading items: ${err.message || err}`);
  } finally {
    setListLoading(false);
  }
}
