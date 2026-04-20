/**
 * @file public/assets/js/ui/list.js
 * @module UI/List
 *
 * @description
 * Main controller for the file list UI component. This module is responsible for:
 * 1. Rendering file items in Grid or List view.
 * 2. Managing view state (Grid vs List) and persistence.
 * 3. Handling user interactions via Event Delegation (clicks, double-clicks, right-clicks).
 * 4. Integrating with other UI subsystems (Selection, Context Menu, Search, Filter/Sort).
 * 5. Managing Loading states and Empty states.
 *
 * Key Architecture Pattern:
 * - **Event Delegation**: Instead of binding listeners to thousands of individual file items,
 *   a single listener on the parent container (#fileList) handles all item interactions.
 *   This significantly improves performance and memory usage for large directories.
 */

import {
  DOWNLOAD_BASE,
  VIEW_MODE_GRID,
  VIEW_MODE_LIST,
  VIEW_MODE_STORAGE_KEY,
  ACTIVE_CLASS
} from '../constants.js';
import { joinPath } from '../utils.js';
import { list as apiList } from '../nanocloudClient.js';
import {
  setExistingNamesFromList,
  setCurrentPath,
  getCurrentPath,
  registerAutoRefresh,
  requestRefresh,
  isOperationAllowed,
  hasPathChanged,
  setCurrentPathWithRefresh
} from '../state.js';
import { showError } from './toast.js';
import {
  createFileIconElement,
  createListIconElement
} from './fileIcons.js';
import { formatBytes, formatDate } from '../utils.js';

import {
  initSelection,
  getSelectedItems,
  clearSelection,
  toggleItemSelection,
  isSelected,
  selectAll,
  deselectAll,
  setPivot,
  getPivot,
  selectRange
} from './selection.js';
import { initContextMenu, showContextMenu, hideContextMenu } from './contextMenu.js';
import { updateInputHandlerItems } from './inputHandlers.js';
import {
  deleteItem,
  deleteSelectedItems,
  renameSelectedItem,
  moveSelectedItems,
  shareSelectedItem,
  updateItemActionsItems
} from './itemActions.js';
import {
  initFilterSort,
  applySortAndFilter,
  resetSearch,
  isSearchActive,
  getSearchMode,
  setFilterSortCallback,
} from './filterSort.js';

/**
 * Escape a string for safe insertion into HTML text content or attribute values.
 * Prevents XSS when server-provided strings (filenames, paths) are interpolated
 * into innerHTML templates.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



/** @type {HTMLElement|null} Container for file items (UL/DIV) */
let fileListEl = null;
/** @type {HTMLElement|null} Empty state placeholder */
let emptyStateEl = null;
/** @type {HTMLElement|null} Breadcrumbs navigation container */
let breadcrumbsEl = null;
/** @type {HTMLElement|null} Refresh button element */
let refreshBtn = null;
/** @type {HTMLElement|null} Text displaying storage usage */
let storageTextEl = null;
/** @type {HTMLElement|null} Visual bar for storage usage */
let storageBarEl = null;
/** @type {HTMLElement|null} Loading spinner container */
let listLoadingEl = null;
/** @type {HTMLElement|null} "Up" navigation button */
let upBtn = null;
/** @type {HTMLElement|null} Grid view toggle button */
let gridViewBtn = null;
/** @type {HTMLElement|null} List view toggle button */
let listViewBtn = null;

// Application State
let currentViewMode = VIEW_MODE_LIST; // Default to list view
let currentItems = [];                // Currently rendered items (filtered/sorted)
let rawItems = [];                    // Raw items from API before filtering
let currentSearchMode = 'normal';     // 'normal', 'quick', or 'deep'

/**
 * Initialize the List UI module.
 * Sets up DOM references, event listeners, and integrates with other modules.
 *
 * @param {Object} refs - Map of DOM elements required by this module
 * @param {HTMLElement} [refs.fileListEl] - Main list container
 * @param {HTMLElement} [refs.emptyStateEl] - Empty state container
 * @param {HTMLElement} [refs.breadcrumbsEl] - Breadcrumbs container
 * @param {HTMLElement} [refs.refreshBtn] - Refresh button
 * @param {HTMLElement} [refs.storageTextEl] - Storage text
 * @param {HTMLElement} [refs.storageBarEl] - Storage bar
 * @param {HTMLElement} [refs.listLoadingEl] - Loading indicator
 * @param {HTMLElement} [refs.upBtn] - Up button
 */
export function initList(refs) {
  fileListEl    = refs.fileListEl    || null;
  emptyStateEl  = refs.emptyStateEl  || null;
  breadcrumbsEl = refs.breadcrumbsEl || null;
  refreshBtn    = refs.refreshBtn    || null;
  storageTextEl = refs.storageTextEl || null;
  storageBarEl  = refs.storageBarEl  || null;
  listLoadingEl = refs.listLoadingEl || null;
  upBtn         = refs.upBtn         || null;

  // Get additional UI elements directly
  gridViewBtn = document.getElementById('gridViewBtn');
  listViewBtn = document.getElementById('listViewBtn');

  // Load saved view preference first (localStorage)
  loadViewPreference();

  // Setup view toggle handlers (Grid/List)
  setupViewToggle();

  // Initialize Selection Module integration
  initSelection({
    selectionBar: document.getElementById('selectionBar'),
    selectionInfo: document.getElementById('selectionInfo')
  });

  // NOTE: Touch handlers and keyboard shortcuts are initialized by main.js
  // via initInputHandlers(). list.js only needs to keep the items reference
  // in sync via updateInputHandlerItems() after each render.

  // Setup Selection Bar buttons (Select All, Delete, etc.)
  setupSelectionButtons();

  // Register Auto-Refresh callback
  registerAutoRefresh((requestId, targetPath) => fetchAndRenderListWithTracking(requestId, targetPath));

  // Initialize Filter/Sort/Search module
  initFilterSort({
    searchInput:        document.getElementById('searchInput'),
    clearSearchBtn:     document.getElementById('clearSearchBtn'),
    deepSearchCheckbox: document.getElementById('deepSearchCheckbox'),
    gridViewBtn:        document.getElementById('gridViewBtn'),
    listViewBtn:        document.getElementById('listViewBtn')
  });

  // Wire the filter/sort change callback without using window globals.
  // filterSort.js calls this whenever the user changes search query or sort mode.
  setFilterSortCallback(() => {
    applyFilterSortAndRender();
  });

  // Initialize Context Menu module
  initContextMenu();

  // Setup Event Delegation for Desktop
  if (fileListEl) {
    // Prevent browser text-selection when Shift+Click is used for range selection
    fileListEl.addEventListener('mousedown', (e) => {
      if (e.shiftKey) e.preventDefault();
    });
    // Handle right-click context menu
    fileListEl.addEventListener('contextmenu', handleContextMenu);
    // Handle all item clicks (navigation, selection, actions)
    fileListEl.addEventListener('click', handleListClick);
  }
}

/**
 * Expose handleItemClick so main.js can pass it as a callback to initInputHandlers().
 * buildContextMenuItems is exported directly on its function declaration below.
 */
export { handleItemClick };

/**
 * Handle list item interactions via Event Delegation.
 * Using a single listener on the parent container avoids attaching thousands of listeners
 * to individual items, significantly improving performance.
 *
 * Handles:
 * 1. Delete button clicks (stop propagation, delete item)
 * 2. Breadcrumb links in Deep Search (navigation)
 * 3. Shift+Click range selection
 * 4. Ctrl/Cmd+Click multi-selection
 * 5. Selection-mode toggle (when items already selected)
 * 6. Item navigation/download (plain click)
 *
 * @param {MouseEvent} event - The click event
 */
function handleListClick(event) {
  // 1. Handle Delete Button Click
  const deleteBtn = event.target.closest('.btn-danger');
  if (deleteBtn) {
    event.stopPropagation();
    const itemEl = deleteBtn.closest('.file-card, .file-list-item, .search-result-item');
    if (itemEl) {
      const itemId = itemEl.dataset.id || itemEl.dataset.name;
      const item = currentItems.find(i => (i.fullPath || i.name) === itemId);
      if (item) {
        deleteItem(item);
      }
    }
    return;
  }

  // 2. Handle Breadcrumb Links (Deep Search Results)
  const breadcrumbLink = event.target.closest('.breadcrumb-link');
  if (breadcrumbLink) {
    event.stopPropagation();
    const path = breadcrumbLink.dataset.path;
    if (path !== undefined) {
      deselectAll();
      resetSearch();
      setCurrentPathWithRefresh(path);
    }
    return;
  }

  // 3. Handle General Item Interaction
  const itemEl = event.target.closest('.file-card, .file-list-item, .search-result-item');
  if (!itemEl) return;

  // Ignore clicks inside other buttons that weren't handled above
  if (event.target.closest('button') && !event.target.closest('.btn-danger')) return;

  const itemId = itemEl.dataset.id || itemEl.dataset.name;
  if (!itemId) return;

  const entry = currentItems.find(i => (i.fullPath || i.name) === itemId);
  if (!entry) return;

  // ── Shift+Click: range selection ──────────────────────────────────────────
  if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    const pivot = getPivot();
    if (pivot) {
      selectRange(currentItems, pivot, itemId);
    } else {
      // No pivot yet — treat this click as the start of a range
      toggleItemSelection(itemId, true);
      setPivot(itemId);
    }
    return;
  }

  // ── Ctrl/Cmd+Click: toggle individual item ────────────────────────────────
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const alreadySelected = isSelected(itemId);
    toggleItemSelection(itemId, !alreadySelected);
    // Update pivot so the next Shift+Click anchors from here
    setPivot(itemId);
    return;
  }

  // ── Selection Mode: any items already selected ────────────────────────────
  const selectedItems = getSelectedItems();
  if (selectedItems.size > 0) {
    event.preventDefault();
    if (isSelected(itemId)) {
      toggleItemSelection(itemId, false);
      itemEl.classList.remove('selected');
    } else {
      toggleItemSelection(itemId, true);
      itemEl.classList.add('selected');
      setPivot(itemId);
    }
    return;
  }

  // ── Deep Search Result ────────────────────────────────────────────────────
  const isDeepSearch = itemEl.classList.contains('search-result-item');
  if (isDeepSearch) {
    if (event.target.closest('.search-result-name')) {
      handleDeepSearchResultClick(entry);
    }
  } else {
    // ── Normal Item: plain click → navigate / download ────────────────────
    setPivot(itemId);
    handleItemClick(entry);
  }
}

/**
 * Handle right-click context menu via Event Delegation.
 *
 * Behavior:
 * - Right-clicking an unselected item: show menu for that item WITHOUT selecting it.
 * - Right-clicking a selected item: keep selection, show menu for all selected items.
 *
 * @param {MouseEvent} event
 */
function handleContextMenu(event) {
  const target = event.target.closest('.file-card, .file-list-item, .search-result-item');
  if (!target) return;

  event.preventDefault();
  event.stopPropagation();

  const itemId = target.dataset.id || target.dataset.name;
  if (!itemId) return;

  const item = currentItems.find(i => (i.fullPath || i.name) === itemId);
  if (!item) return;

  if (!isSelected(itemId)) {
    // Right-clicking unselected item: temporary highlight
    target.classList.add('context-active');
    const menuItems = buildContextMenuItems(item);
    showContextMenu(event.clientX, event.clientY, menuItems, () => {
      target.classList.remove('context-active');
    });
  } else {
    // Right-clicking selected item: use selection-based menu
    const menuItems = buildContextMenuItems();
    showContextMenu(event.clientX, event.clientY, menuItems);
  }
}

/**
 * Construct the context menu configuration array based on current selection.
 * Checks permissions (read-only, etc.) and item types.
 *
 * @param {Object} [contextItem] - Optional specific item (when right-clicking unselected item)
 * @returns {Array<Object>} Array of menu item objects
 */
export function buildContextMenuItems(contextItem = null) {
  let selectedCount, firstItem, isSingleSelection, isFolder;

  if (contextItem) {
    selectedCount    = 1;
    firstItem        = contextItem;
    isSingleSelection = true;
    isFolder         = contextItem.type === 'dir';
  } else {
    const selectedItems = getSelectedItems();
    selectedCount    = selectedItems.size;
    const selectedIds = Array.from(selectedItems);
    firstItem        = currentItems.find(i => selectedIds.includes(i.fullPath || i.name));
    isSingleSelection = selectedCount === 1;
    isFolder         = firstItem && firstItem.type === 'dir';
  }

  const items = [];

  // Action: Open (Single Folder)
  if (isSingleSelection && isFolder) {
    items.push({
      label: 'Open',
      icon: '📂',
      action: () => {
        handleItemClick(firstItem);
        deselectAll();
      }
    });
  }

  // Action: Download (Single File)
  if (isSingleSelection && !isFolder) {
    items.push({
      label: 'Download',
      icon: '⬇️',
      action: () => {
        handleItemClick(firstItem);
        deselectAll();
      }
    });
  }

  // Action: Share (Single Item only)
  if (isSingleSelection) {
    items.push({
      label: 'Share',
      icon: '🔗',
      action: async () => {
        if (contextItem) {
          await shareSelectedItem(contextItem);
        } else {
          await shareSelectedItem();
        }
        deselectAll();
      }
    });
  }

  // Separator
  if (items.length > 0) {
    items.push({ separator: true });
  }

  // Action: Rename (Single Item, if allowed)
  const renameCheck = isOperationAllowed('rename');
  if (isSingleSelection) {
    items.push({
      label: 'Rename',
      icon: '✏️',
      action: contextItem ? () => renameSelectedItem(contextItem) : renameSelectedItem,
      disabled: !renameCheck.allowed
    });
  }

  // Action: Move (If allowed, disabled in Deep Search)
  const moveCheck  = isOperationAllowed('move');
  const searchMode = getSearchMode();
  items.push({
    label: selectedCount > 1 ? `Move ${selectedCount} items` : 'Move',
    icon: '📁',
    action: contextItem ? () => moveSelectedItems([contextItem]) : moveSelectedItems,
    disabled: !moveCheck.allowed || searchMode === 'deep'
  });

  // Separator
  items.push({ separator: true });

  // Action: Delete (If allowed)
  const deleteCheck = isOperationAllowed('delete');
  items.push({
    label: selectedCount > 1 ? `Delete ${selectedCount} items` : 'Delete',
    icon: '🗑️',
    action: contextItem ? () => deleteSelectedItems([contextItem]) : deleteSelectedItems,
    disabled: !deleteCheck.allowed,
    danger: true
  });

  return items;
}

/**
 * Setup listeners for the Selection Bar buttons (top action bar).
 */
function setupSelectionButtons() {
  const selectAllBtn    = document.getElementById('selectAllBtn');
  const deselectAllBtn  = document.getElementById('deselectAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const renameSelectedBtn = document.getElementById('renameSelectedBtn');
  const moveSelectedBtn   = document.getElementById('moveSelectedBtn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      hideContextMenu();
      selectAll(currentItems);
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      hideContextMenu();
      deselectAll();
    });
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      hideContextMenu();
      deleteSelectedItems();
    });
  }

  if (renameSelectedBtn) {
    renameSelectedBtn.addEventListener('click', () => {
      hideContextMenu();
      renameSelectedItem();
    });
  }

  if (moveSelectedBtn) {
    moveSelectedBtn.addEventListener('click', () => {
      hideContextMenu();
      moveSelectedItems();
    });
  }
}

/**
 * Update the enabled/disabled state of Selection Bar buttons based on
 * current server permissions (e.g., Read-Only mode).
 */
export function updateSelectionButtonStates() {
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const renameSelectedBtn = document.getElementById('renameSelectedBtn');
  const moveSelectedBtn   = document.getElementById('moveSelectedBtn');

  const deleteCheck = isOperationAllowed('delete');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = !deleteCheck.allowed;
    deleteSelectedBtn.title = deleteCheck.allowed ? 'Delete selected items' : deleteCheck.reason;
    deleteSelectedBtn.classList.toggle('btn--disabled', !deleteCheck.allowed);
  }

  const renameCheck = isOperationAllowed('rename');
  if (renameSelectedBtn) {
    renameSelectedBtn.disabled = !renameCheck.allowed;
    renameSelectedBtn.title = renameCheck.allowed ? 'Rename selected item' : renameCheck.reason;
    renameSelectedBtn.classList.toggle('btn--disabled', !renameCheck.allowed);
  }

  const moveCheck = isOperationAllowed('move');
  if (moveSelectedBtn) {
    moveSelectedBtn.disabled = !moveCheck.allowed;
    moveSelectedBtn.title = moveCheck.allowed ? 'Move selected items' : moveCheck.reason;
    moveSelectedBtn.classList.toggle('btn--disabled', !moveCheck.allowed);
  }
}

/**
 * Setup listeners for Grid/List view toggle buttons.
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
 * Switch the current view mode and re-render the list.
 * Persists the choice to localStorage.
 *
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
 * Load the saved view preference from localStorage on startup.
 */
function loadViewPreference() {
  const savedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (savedMode === VIEW_MODE_LIST || savedMode === VIEW_MODE_GRID) {
    switchView(savedMode);
  }
}

/**
 * Toggle the main list loading indicator (spinner).
 * Also updates the refresh button state.
 *
 * @param {boolean} isLoading
 */
export function setListLoading(isLoading) {
  if (refreshBtn) {
    refreshBtn.disabled = !!isLoading;
    const spinner = refreshBtn.querySelector('.refresh-spinner');
    const label   = refreshBtn.querySelector('.refresh-label');

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
 * Update the storage usage meter in the UI.
 *
 * @param {Object} storage - Storage info from API
 */
export function updateStorage(storage) {
  if (!storage || !storageTextEl || !storageBarEl) return;

  const total   = storage.totalBytes  ?? 0;
  const free    = storage.freeBytes   ?? 0;
  const used    = storage.usedBytes   ?? Math.max(0, total - free);
  const percent = storage.usedPercent ?? (total > 0 ? (used / total) * 100 : 0);

  storageTextEl.textContent = `Used ${formatBytes(used)} of ${formatBytes(total)}`;

  const pct = Math.max(0, Math.min(100, percent));
  storageBarEl.style.width = pct.toFixed(1) + '%';
  storageBarEl.classList.remove('bar-green', 'bar-orange', 'bar-red');

  if (pct < 60)       storageBarEl.classList.add('bar-green');
  else if (pct < 85)  storageBarEl.classList.add('bar-orange');
  else                storageBarEl.classList.add('bar-red');
}

/**
 * Render the breadcrumb navigation based on current path segments.
 *
 * @param {string[]} breadcrumbs - Array of path segments
 */
export function updateBreadcrumbs(breadcrumbs) {
  if (!breadcrumbsEl) return;

  breadcrumbsEl.innerHTML = '';

  // Root/Home Crumb
  const rootCrumb = document.createElement('span');
  rootCrumb.className = 'crumb';
  rootCrumb.textContent = 'Home';
  rootCrumb.addEventListener('click', () => {
    deselectAll();
    resetSearch();
    setCurrentPathWithRefresh('');
  });
  breadcrumbsEl.appendChild(rootCrumb);

  // Path Segments
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
        deselectAll();
        resetSearch();
        setCurrentPathWithRefresh(targetPath);
      });
      breadcrumbsEl.appendChild(crumb);
    });
  }

  // Update Up Button state
  if (upBtn) {
    upBtn.disabled = getCurrentPath() === '';
  }
}

/**
 * Apply current filter and sort criteria to raw items, then render the result.
 */
function applyFilterSortAndRender() {
  const result = applySortAndFilter(rawItems);
  const previousSearchMode = currentSearchMode;
  currentSearchMode = result.mode;

  if (previousSearchMode !== currentSearchMode) {
    clearSelection();
  }

  updateUploadControlsState();
  updateMoveButtonState();

  if (result.mode === 'deep') {
    renderDeepSearchResults(result.items, result.query);
  } else {
    renderNormalItems(result.items, result.mode, result.query);
  }
}

/**
 * Toggle visibility of Upload/New Folder buttons during search.
 */
function updateUploadControlsState() {
  const fabUpload   = document.getElementById('fabUpload');
  const newFolderBtn = document.getElementById('newFolderBtn');
  const searchActive = isSearchActive();

  if (fabUpload) {
    fabUpload.style.display = searchActive ? 'none' : '';
  }
  if (newFolderBtn) {
    newFolderBtn.style.display = searchActive ? 'none' : '';
  }
}

/**
 * Disable the "Move" button during Deep Search.
 */
function updateMoveButtonState() {
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');
  if (!moveSelectedBtn) return;

  const searchMode = getSearchMode();
  const moveCheck  = isOperationAllowed('move');

  if (searchMode === 'deep') {
    moveSelectedBtn.disabled = true;
    moveSelectedBtn.title    = 'Move not available in deep search';
    moveSelectedBtn.classList.add('btn--disabled');
  } else if (!moveCheck.allowed) {
    moveSelectedBtn.disabled = true;
    moveSelectedBtn.title    = moveCheck.reason;
    moveSelectedBtn.classList.add('btn--disabled');
  } else {
    moveSelectedBtn.disabled = false;
    moveSelectedBtn.title    = 'Move selected items';
    moveSelectedBtn.classList.remove('btn--disabled');
  }
}

/**
 * Main render entry point. Stores raw items and triggers filter/sort pipeline.
 * @param {Array} items - List of file objects
 */
export function renderItems(items) {
  rawItems = items || [];
  applyFilterSortAndRender();
}

/**
 * Render items for standard view (Grid/List) or Quick Search.
 */
function renderNormalItems(items, mode, query) {
  if (!fileListEl || !emptyStateEl) return;

  currentItems = items || [];
  fileListEl.innerHTML = '';

  setExistingNamesFromList(currentItems);

  // Sync items reference in inputHandlers
  updateInputHandlerItems(currentItems);
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

  // Render Search Header for Quick Search
  if (mode === 'quick' && query) {
    const header = document.createElement('div');
    header.className = 'search-results-header';

    const content = document.createElement('div');
    content.className = 'search-results-content';

    const title = document.createElement('div');
    title.className = 'search-results-title';
    // textContent is safe — no HTML injection possible.
    title.textContent = `🔍 Search Results (${currentItems.length} items found)`;

    const info = document.createElement('div');
    info.className = 'search-results-info';
    info.textContent = `Searching in: ${getCurrentPath() || 'Home'}`;

    content.appendChild(title);
    content.appendChild(info);

    const exitBtn = document.createElement('button');
    exitBtn.className = 'btn btn-secondary';
    exitBtn.textContent = '✕ Clear Search';
    exitBtn.addEventListener('click', () => {
      resetSearch();
      applyFilterSortAndRender();
    });

    header.appendChild(content);
    header.appendChild(exitBtn);
    fileListEl.appendChild(header);
  }

  if (currentViewMode === VIEW_MODE_GRID) {
    renderGridView(currentItems);
  } else {
    renderListView(currentItems);
  }
}

/**
 * Render items for Deep Search (recursive search results).
 */
function renderDeepSearchResults(items, query) {
  if (!fileListEl || !emptyStateEl) return;

  currentItems = items || [];
  fileListEl.innerHTML = '';
  emptyStateEl.style.display = 'none';

  // Sync items reference in inputHandlers
  updateInputHandlerItems(currentItems);
  updateItemActionsItems(currentItems);

  if (!currentItems || currentItems.length === 0) {
    showEmptySearchState(query);
    return;
  }

  const header = document.createElement('div');
  header.className = 'search-results-header';

  const content = document.createElement('div');
  content.className = 'search-results-content';

  const title = document.createElement('div');
  title.className = 'search-results-title';
  title.textContent = `🔍 Deep Search Results (${currentItems.length} items found)`;

  const info = document.createElement('div');
  info.className = 'search-results-info';
  info.textContent = `Searched from: ${getCurrentPath() || 'Home'}`;

  content.appendChild(title);
  content.appendChild(info);

  const exitBtn = document.createElement('button');
  exitBtn.className = 'btn btn-secondary';
  exitBtn.textContent = '✕ Clear Search';
  exitBtn.addEventListener('click', () => {
    resetSearch();
    applyFilterSortAndRender();
  });

  header.appendChild(content);
  header.appendChild(exitBtn);
  fileListEl.appendChild(header);

  currentItems.forEach(item => {
    const resultItem = createDeepSearchResultItem(item);
    fileListEl.appendChild(resultItem);
  });
}

/**
 * Render empty state for search queries.
 */
function showEmptySearchState(query) {
  if (!emptyStateEl) return;

  emptyStateEl.innerHTML = `
    <div class="empty-state-icon">🔍</div>
    <div class="empty-state-title">No items found</div>
    <div class="empty-state-description">
      No items match "${query}"
    </div>
    <button class="btn btn-secondary" id="emptyStateClearBtn" style="margin-top: var(--space-4);">
      ✕ Clear Search
    </button>
  `;
  emptyStateEl.style.display = 'flex';

  const clearBtn = emptyStateEl.querySelector('#emptyStateClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      resetSearch();
      applyFilterSortAndRender();
    });
  }
}

/**
 * Create a specialized DOM element for Deep Search results.
 */
function createDeepSearchResultItem(item) {
  const li = document.createElement('li');
  li.className = 'search-result-item';

  const itemId = item.fullPath || item.name;
  li.dataset.name = item.name;
  li.dataset.id   = itemId;
  li.dataset.type = item.type;

  if (isSelected(itemId)) {
    li.classList.add('selected');
  }

  const iconEl = createListIconElement(item.name, item.type);

  const infoContainer = document.createElement('div');
  infoContainer.className = 'search-result-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'search-result-name';
  nameEl.textContent = item.name;
  nameEl.style.cursor = 'pointer';

  const pathEl = document.createElement('div');
  pathEl.className = 'search-result-path';
  pathEl.innerHTML = createClickableBreadcrumb(item);

  const metaEl = document.createElement('div');
  metaEl.className = 'search-result-meta';
  metaEl.textContent = createMetadataText(item);

  infoContainer.appendChild(nameEl);
  infoContainer.appendChild(pathEl);
  infoContainer.appendChild(metaEl);

  li.appendChild(iconEl);
  li.appendChild(infoContainer);

  return li;
}

/**
 * Generate HTML for clickable breadcrumbs in search results.
 * Both the path attribute value and the visible text are HTML-escaped to prevent
 * XSS if a server-provided folder name contains HTML metacharacters.
 */
function createClickableBreadcrumb(item) {
  const parts = ['Home'];
  if (item.breadcrumbs && item.breadcrumbs.length > 0) {
    parts.push(...item.breadcrumbs);
  }

  return parts.map((part, index) => {
    const path = index === 0 ? '' : parts.slice(1, index + 1).join('/');
    return `<span class="breadcrumb-link" data-path="${escHtml(path)}">${escHtml(part)}</span>`;
  }).join(' › ');
}

/**
 * Handle navigation when a Deep Search result name is clicked.
 */
function handleDeepSearchResultClick(item) {
  if (item.type === 'dir') {
    const url = `${window.location.origin}${window.location.pathname}#path=${encodeURIComponent(item.fullPath)}`;
    window.open(url, '_blank');
  } else {
    const downloadUrl = DOWNLOAD_BASE +
      (item.displayPath ? `?path=${encodeURIComponent(item.displayPath)}&file=` : '?file=') +
      encodeURIComponent(item.name);
    window.open(downloadUrl, '_blank');
  }
}

/**
 * Configuration mapping for Grid vs List rendering.
 */
const VIEW_CONFIG = {
  grid: {
    itemClass:   'file-card',
    nameClass:   'file-name',
    metaClass:   'file-meta',
    actionsClass: 'file-actions',
    iconFn:      createFileIconElement,
    wrapInfo:    false
  },
  list: {
    itemClass:   'file-list-item',
    nameClass:   'file-list-name',
    metaClass:   'file-list-meta',
    actionsClass: 'file-list-actions',
    iconFn:      createListIconElement,
    wrapInfo:    true
  }
};

/**
 * Helper: Format metadata text (size, date, count) for an item.
 */
function createMetadataText(entry) {
  if (entry.type === 'dir') {
    const countText = entry.count != null ? `${entry.count} items` : '';
    const timeText  = entry.mtime != null ? formatDate(entry.mtime) : '';
    return [countText, timeText].filter(Boolean).join(' • ');
  } else {
    const sizeText = entry.size  != null ? formatBytes(entry.size) : '';
    const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
    return [sizeText, timeText].filter(Boolean).join(' • ');
  }
}

/**
 * Create a delete button element for an item.
 */
function createDeleteButton(entry) {
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.innerHTML = '🗑️';

  const check = isOperationAllowed('delete');
  if (!check.allowed) {
    deleteBtn.disabled = true;
    deleteBtn.title    = check.reason;
    deleteBtn.classList.add('btn--disabled');
  } else {
    deleteBtn.title = 'Delete';
  }

  return deleteBtn;
}

/**
 * Render a single standard item (Grid or List view).
 */
function renderItem(entry, viewMode) {
  const config = VIEW_CONFIG[viewMode];

  const li = document.createElement('li');
  li.className = config.itemClass;

  const itemId = entry.name;
  li.dataset.name = entry.name;
  li.dataset.id   = itemId;
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

  if (config.wrapInfo) {
    const infoEl = document.createElement('div');
    infoEl.className = 'file-info';
    infoEl.appendChild(nameEl);
    infoEl.appendChild(metaEl);

    li.appendChild(iconEl);
    li.appendChild(infoEl);
    li.appendChild(actionsEl);
  } else {
    li.appendChild(iconEl);
    li.appendChild(nameEl);
    li.appendChild(metaEl);
    li.appendChild(actionsEl);
  }

  if (isSelected(entry.name)) {
    li.classList.add('selected');
  }

  return li;
}

/**
 * Render loop for Grid View.
 */
function renderGridView(items) {
  fileListEl.className = 'file-grid';
  items.forEach(entry => {
    fileListEl.appendChild(renderItem(entry, 'grid'));
  });
}

/**
 * Render loop for List View.
 */
function renderListView(items) {
  fileListEl.className = 'file-list';
  items.forEach(entry => {
    fileListEl.appendChild(renderItem(entry, 'list'));
  });
}

/**
 * Handle standard item click action (Navigate or Download/Open).
 * Also pushes a history entry so the browser back button navigates up.
 *
 * @param {Object} entry
 */
function handleItemClick(entry) {
  // Always clear selection when performing a primary action
  deselectAll();

  if (entry.type === 'dir') {
    const newPath = joinPath(getCurrentPath(), entry.name);
    // Push history state so browser back / swipe-back navigates up.
    // Use the clean base URL — path is stored in state only, not in the URL bar.
    history.pushState({ path: newPath }, '', window.location.pathname);
    setCurrentPathWithRefresh(newPath);
  } else {
    const path = typeof entry.displayPath !== 'undefined' ? entry.displayPath : getCurrentPath();
    const downloadUrl = DOWNLOAD_BASE +
      (path ? `?path=${encodeURIComponent(path)}&file=` : '?file=') +
      encodeURIComponent(entry.name);
    window.open(downloadUrl, '_blank');
  }
}

/**
 * Auto-refresh callback wrapper.
 */
async function fetchAndRenderListWithTracking(requestId, targetPath) {
  setListLoading(true);
  try {
    const pathToFetch = (typeof targetPath === 'string') ? targetPath : getCurrentPath();
    const resp = await apiList(pathToFetch);
    if (!resp.success) throw new Error(resp.message || 'Failed to load items');

    setCurrentPath(resp.path || pathToFetch);
    updateBreadcrumbs(resp.breadcrumbs || []);
    updateStorage(resp.storage);

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
 * Public API: Triggers a fresh fetch and render of the current path.
 */
export async function fetchAndRenderList() {
  setListLoading(true);
  try {
    const resp = await apiList(getCurrentPath());
    if (!resp.success) throw new Error(resp.message || 'Failed to load items');

    setCurrentPath(resp.path || '');
    updateBreadcrumbs(resp.breadcrumbs || []);
    updateStorage(resp.storage);

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
