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
import { setExistingNamesFromList, setCurrentPath, getCurrentPath, registerAutoRefresh, requestRefresh, isOperationAllowed, hasPathChanged, setCurrentPathWithRefresh } from '../state.js';
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
import { 
  initFilterSort, 
  applySortAndFilter, 
  resetSearch,
  isSearchActive,
  getSearchMode
} from './filterSort.js';

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
let rawItems = []; // Store raw items from API before filtering/sorting
let currentSearchMode = 'normal'; // 'normal', 'quick', or 'deep'

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
  
  // Initialize filter and sort module
  initFilterSort({
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    deepSearchBtn: document.getElementById('deepSearchBtn'),
    sortSelect: document.getElementById('sortSelect')
  });
  
  // Set up callback for filter/sort changes
  window.filterSortCallback = () => {
    applyFilterSortAndRender();
  };
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
    // Clear search before navigation
    resetSearch();
    setCurrentPathWithRefresh('');
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
      
      const targetPath = breadcrumbs.slice(0, index + 1).join('/');
      
      crumb.addEventListener('click', () => {
        // Clear search before navigation
        resetSearch();
        setCurrentPathWithRefresh(targetPath);
      });
      breadcrumbsEl.appendChild(crumb);
    });
  }

  if (upBtn) {
    upBtn.disabled = getCurrentPath() === '';
  }
}

/**
 * Apply filter/sort and render
 */
function applyFilterSortAndRender() {
  const result = applySortAndFilter(rawItems);
  const previousSearchMode = currentSearchMode;
  currentSearchMode = result.mode;
  
  // Clear selection when search mode changes
  if (previousSearchMode !== currentSearchMode) {
    clearSelection();
  }
  
  // Update upload controls based on search state
  updateUploadControlsState();
  
  // Update move button state based on search mode
  updateMoveButtonState();
  
  if (result.mode === 'deep') {
    renderDeepSearchResults(result.items, result.query);
  } else {
    renderNormalItems(result.items, result.mode, result.query);
  }
}

/**
 * Update upload controls (FAB and New Folder button) based on search state
 */
function updateUploadControlsState() {
  const fabUpload = document.getElementById('fabUpload');
  const newFolderBtn = document.getElementById('newFolderBtn');
  const searchActive = isSearchActive();
  
  if (fabUpload) {
    if (searchActive) {
      fabUpload.style.display = 'none';
    } else {
      fabUpload.style.display = '';
    }
  }
  
  if (newFolderBtn) {
    if (searchActive) {
      newFolderBtn.style.display = 'none';
    } else {
      newFolderBtn.style.display = '';
    }
  }
}

/**
 * Update Move button state based on search mode
 */
function updateMoveButtonState() {
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');
  
  if (!moveSelectedBtn) return;
  
  const searchMode = getSearchMode();
  const moveCheck = isOperationAllowed('move');
  
  if (searchMode === 'deep') {
    // Disable move in deep search mode
    moveSelectedBtn.disabled = true;
    moveSelectedBtn.title = 'Move not available in deep search';
    moveSelectedBtn.style.opacity = '0.5';
    moveSelectedBtn.style.cursor = 'not-allowed';
  } else if (!moveCheck.allowed) {
    // Disabled by server configuration
    moveSelectedBtn.disabled = true;
    moveSelectedBtn.title = moveCheck.reason;
    moveSelectedBtn.style.opacity = '0.5';
    moveSelectedBtn.style.cursor = 'not-allowed';
  } else {
    // Enabled
    moveSelectedBtn.disabled = false;
    moveSelectedBtn.title = 'Move selected items';
    moveSelectedBtn.style.opacity = '';
    moveSelectedBtn.style.cursor = '';
  }
}

/**
 * Render items in current view mode
 * @param {Array} items - File/folder items
 */
export function renderItems(items) {
  rawItems = items || [];
  applyFilterSortAndRender();
}

/**
 * Render normal items (not deep search results)
 * @param {Array} items - Processed items
 * @param {string} mode - 'normal' or 'quick'
 * @param {string} query - Search query
 */
function renderNormalItems(items, mode, query) {
  if (!fileListEl || !emptyStateEl) return;
  
  currentItems = items || [];
  fileListEl.innerHTML = '';
  
  setExistingNamesFromList(currentItems);
  
  // Update references in other modules
  updateTouchHandlerItems(currentItems);
  updateKeyboardShortcutItems(currentItems);
  updateItemActionsItems(currentItems);

  if (!currentItems || currentItems.length === 0) {
    if (mode === 'quick' && query) {
      showEmptySearchState(query);
    } else {
      emptyStateEl.style.display = 'flex';
    }
    return;
  }
  
  emptyStateEl.style.display = 'none';

  // Show search header for quick search
  if (mode === 'quick' && query) {
    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = `
      <div class="search-results-title">
        🔍 Search Results (${currentItems.length} items found)
      </div>
      <div class="search-results-info">
        Searching in: ${getCurrentPath() || 'Home'}
      </div>
    `;
    fileListEl.appendChild(header);
  }

  if (currentViewMode === VIEW_MODE_GRID) {
    renderGridView(currentItems);
  } else {
    renderListView(currentItems);
  }
}

/**
 * Render deep search results with paths
 * @param {Array} items - Search result items with path info
 * @param {string} query - Search query
 */
function renderDeepSearchResults(items, query) {
  if (!fileListEl || !emptyStateEl) return;
  
  currentItems = items || [];
  fileListEl.innerHTML = '';
  emptyStateEl.style.display = 'none';
  
  // Update references in other modules
  updateTouchHandlerItems(currentItems);
  updateKeyboardShortcutItems(currentItems);
  updateItemActionsItems(currentItems);
  
  if (!currentItems || currentItems.length === 0) {
    showEmptySearchState(query);
    return;
  }
  
  // Show search header
  const header = document.createElement('div');
  header.className = 'search-results-header';
  header.innerHTML = `
    <div class="search-results-title">
      🔍 Deep Search Results (${currentItems.length} items found)
    </div>
    <div class="search-results-info">
      Searched from: ${getCurrentPath() || 'Home'}
    </div>
  `;
  fileListEl.appendChild(header);
  
  // Render each result with path
  currentItems.forEach(item => {
    const resultItem = createDeepSearchResultItem(item);
    fileListEl.appendChild(resultItem);
  });
}

/**
 * Show empty search state
 * @param {string} query - Search query
 */
function showEmptySearchState(query) {
  if (!emptyStateEl) return;
  
  emptyStateEl.innerHTML = `
    <div class="empty-state-icon">🔍</div>
    <div class="empty-state-title">No items found</div>
    <div class="empty-state-description">
      No items match "${query}"
    </div>
  `;
  emptyStateEl.style.display = 'flex';
}

/**
 * Create deep search result item element
 * @param {Object} item - Item with path info
 * @returns {HTMLLIElement}
 */
function createDeepSearchResultItem(item) {
  const li = document.createElement('li');
  li.className = 'search-result-item';
  
  // Add data attributes for selection support
  li.dataset.name = item.name;
  li.dataset.type = item.type;
  
  // Apply selection state if item is selected
  if (isSelected(item.name)) {
    li.classList.add('selected');
  }
  
  // Icon
  const iconEl = createListIconElement(item.name, item.type);
  
  // Main info container
  const infoContainer = document.createElement('div');
  infoContainer.className = 'search-result-info';
  
  // Name - clickable for files
  const nameEl = document.createElement('div');
  nameEl.className = 'search-result-name';
  nameEl.textContent = item.name;
  
  // Make name clickable to download/open file or navigate to folder
  nameEl.style.cursor = 'pointer';
  nameEl.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Check if selection mode is active
    const selectedItems = getSelectedItems();
    if (selectedItems.size > 0) {
      // In selection mode, clicking name toggles selection
      const selected = isSelected(item.name);
      toggleItemSelection(item.name, !selected);
      return;
    }
    
    // Normal mode: open/download
    handleDeepSearchResultClick(item);
  });
  
  // Clickable breadcrumb path - opens parent directory
  const pathEl = document.createElement('div');
  pathEl.className = 'search-result-path';
  pathEl.innerHTML = createClickableBreadcrumb(item);
  
  // Metadata
  const metaEl = document.createElement('div');
  metaEl.className = 'search-result-meta';
  metaEl.textContent = createMetadataText(item);
  
  infoContainer.appendChild(nameEl);
  infoContainer.appendChild(pathEl);
  infoContainer.appendChild(metaEl);
  
  li.appendChild(iconEl);
  li.appendChild(infoContainer);
  
  // Add click handler for selection support
  li.addEventListener('click', (e) => {
    // Ctrl/Cmd+Click for multi-select
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const selected = isSelected(item.name);
      toggleItemSelection(item.name, !selected);
      return;
    }
    
    const selectedItems = getSelectedItems();
    
    // If ANY items are selected (selection mode is active)
    if (selectedItems.size > 0) {
      e.preventDefault();
      
      // If this item is already selected, deselect it
      if (isSelected(item.name)) {
        toggleItemSelection(item.name, false);
      } else {
        // Add this item to selection
        toggleItemSelection(item.name, true);
      }
    }
  });
  
  return li;
}

/**
 * Create clickable breadcrumb for search result
 * @param {Object} item - Item with breadcrumbs
 * @returns {string} - HTML string
 */
function createClickableBreadcrumb(item) {
  const parts = ['Home'];
  if (item.breadcrumbs && item.breadcrumbs.length > 0) {
    parts.push(...item.breadcrumbs);
  }
  
  return parts.map((part, index) => {
    const path = index === 0 ? '' : parts.slice(1, index + 1).join('/');
    return `<span class="breadcrumb-link" data-path="${path}">${part}</span>`;
  }).join(' › ');
}

/**
 * Handle deep search result click
 * @param {Object} item - Item with path info
 */
function handleDeepSearchResultClick(item) {
  if (item.type === 'dir') {
    // Open folder in new tab
    const url = `${window.location.origin}${window.location.pathname}#path=${encodeURIComponent(item.fullPath)}`;
    window.open(url, '_blank');
  } else {
    // Open/download file in new tab
    const downloadUrl = DOWNLOAD_BASE + 
      (item.displayPath ? `?path=${encodeURIComponent(item.displayPath)}&file=` : '?file=') + 
      encodeURIComponent(item.name);
    window.open(downloadUrl, '_blank');
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
    setCurrentPathWithRefresh(joinPath(getCurrentPath(), entry.name));
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
    
    // Reset search only if path changed (navigation), not on auto-refresh
    if (hasPathChanged()) {
      resetSearch();
    }
    
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
    
    // Reset search only if path changed (navigation), not on initial load
    if (hasPathChanged()) {
      resetSearch();
    }
    
    renderItems(resp.items || []);
  } catch (err) {
    showError(`Error loading items: ${err.message || err}`);
  } finally {
    setListLoading(false);
  }
}
