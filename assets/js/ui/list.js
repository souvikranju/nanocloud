// ui/list.js
// Modern file list rendering with grid/list views, selection system, and enhanced UI
// Integrates with the new design system and file type icons

import { DOWNLOAD_BASE } from '../state.js';
import { joinPath } from '../utils.js';
import { list as apiList, deleteFile as apiDeleteFile, deleteDir as apiDeleteDir } from '../nanocloudClient.js';
import { setExistingNamesFromList, setCurrentPath, getCurrentPath, registerAutoRefresh, requestRefresh } from '../state.js';
import { showSuccess, showError, showWarning } from './toast.js';
import { 
  createFileIconElement, 
  createListIconElement, 
  isViewableInBrowser 
} from './fileIcons.js';
import { formatBytes, formatDate } from '../utils.js';

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
/** @type {HTMLElement|null} */ let selectionBar = null;
/** @type {HTMLElement|null} */ let selectionInfo = null;

// State
let currentViewMode = 'list'; // 'grid' or 'list' - default to list view
let selectedItems = new Set();
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
  selectionBar = document.getElementById('selectionBar');
  selectionInfo = document.getElementById('selectionInfo');
  
  // Load saved view preference first
  loadViewPreference();
  
  // Setup view toggle handlers
  setupViewToggle();
  
  // Setup selection handlers
  setupSelectionHandlers();
  
  // Register this module's fetchAndRenderList as the auto-refresh callback
  registerAutoRefresh((requestId) => fetchAndRenderListWithTracking(requestId));
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
        switchView('grid');
      }
    }, true); // Use capture phase
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!listViewBtn.disabled) {
        switchView('list');
      }
    }, true); // Use capture phase
  }
}

/**
 * Setup selection system handlers
 */
function setupSelectionHandlers() {
  // Selection bar buttons
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const renameSelectedBtn = document.getElementById('renameSelectedBtn');
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', selectAllItems);
  }
  
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', deselectAllItems);
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
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
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
  
  switch (event.key) {
    case 'a':
    case 'A':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        selectAllItems();
      }
      break;
    case 'Escape':
      deselectAllItems();
      break;
    case 'Delete':
    case 'Backspace':
      if (selectedItems.size > 0) {
        event.preventDefault();
        deleteSelectedItems();
      }
      break;
    case 'F2':
      if (selectedItems.size === 1) {
        event.preventDefault();
        renameSelectedItem();
      }
      break;
  }
}

/**
 * Switch between grid and list view
 * @param {'grid'|'list'} mode
 */
function switchView(mode) {
  if (mode === currentViewMode) return;
  
  currentViewMode = mode;
  
  // Update button states
  if (gridViewBtn && listViewBtn) {
    gridViewBtn.classList.toggle('active', mode === 'grid');
    listViewBtn.classList.toggle('active', mode === 'list');
  }
  
  // Update file list classes
  if (fileListEl) {
    fileListEl.className = mode === 'grid' ? 'file-grid' : 'file-list';
  }
  
  // Re-render items with new view
  renderItems(currentItems);
  
  // Save preference
  localStorage.setItem('nanocloud-view-mode', mode);
}

/**
 * Load saved view preference
 */
function loadViewPreference() {
  const savedMode = localStorage.getItem('nanocloud-view-mode');
  if (savedMode === 'list' || savedMode === 'grid') {
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

  // Root breadcrumb
  const rootCrumb = document.createElement('span');
  rootCrumb.className = 'crumb';
  rootCrumb.textContent = 'Home';
  rootCrumb.addEventListener('click', () => {
    setCurrentPath('');
    requestRefresh();
  });
  breadcrumbsEl.appendChild(rootCrumb);

  // Path breadcrumbs
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

  // Update up button state
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
  
  // Clear selection when items change
  selectedItems.clear();
  updateSelectionBar();
  
  setExistingNamesFromList(currentItems);

  if (!currentItems || currentItems.length === 0) {
    emptyStateEl.style.display = 'flex';
    return;
  }
  
  emptyStateEl.style.display = 'none';

  // Render items based on current view mode
  if (currentViewMode === 'grid') {
    renderGridView(currentItems);
  } else {
    renderListView(currentItems);
  }
}

/**
 * Render items in grid view
 * @param {Array} items
 */
function renderGridView(items) {
  fileListEl.className = 'file-grid';
  
  items.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'file-card';
    li.dataset.name = entry.name;
    li.dataset.type = entry.type;
    
    // Create checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'file-checkbox';
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleItemSelection(entry.name, checkbox.checked);
    });
    
    // Create file icon
    const iconEl = createFileIconElement(entry.name, entry.type);
    
    // Create file name
    const nameEl = document.createElement('div');
    nameEl.className = 'file-name';
    nameEl.textContent = entry.name;
    
    // Create file metadata
    const metaEl = document.createElement('div');
    metaEl.className = 'file-meta';
    
    if (entry.type === 'dir') {
      const countText = entry.count != null ? `${entry.count} items` : '';
      const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
      metaEl.textContent = [countText, timeText].filter(Boolean).join(' • ');
    } else {
      const sizeText = entry.size != null ? formatBytes(entry.size) : '';
      const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
      metaEl.textContent = [sizeText, timeText].filter(Boolean).join(' • ');
    }
    
    // Create action buttons
    const actionsEl = document.createElement('div');
    actionsEl.className = 'file-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(entry);
    });
    
    actionsEl.appendChild(deleteBtn);
    
    // Assemble card
    li.appendChild(checkbox);
    li.appendChild(iconEl);
    li.appendChild(nameEl);
    li.appendChild(metaEl);
    li.appendChild(actionsEl);
    
    // Add click handler for navigation/download
    li.addEventListener('click', (e) => {
      // Handle selection with Ctrl/Cmd click
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        toggleItemSelection(entry.name, checkbox.checked);
        return;
      }
      
      handleItemClick(entry);
    });
    
    fileListEl.appendChild(li);
  });
}

/**
 * Render items in list view
 * @param {Array} items
 */
function renderListView(items) {
  fileListEl.className = 'file-list';
  
  items.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    li.dataset.name = entry.name;
    li.dataset.type = entry.type;
    
    // Create checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'file-checkbox';
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleItemSelection(entry.name, checkbox.checked);
    });
    
    // Create file icon
    const iconEl = createListIconElement(entry.name, entry.type);
    
    // Create file info
    const infoEl = document.createElement('div');
    infoEl.className = 'file-info';
    
    const nameEl = document.createElement('div');
    nameEl.className = 'file-list-name';
    nameEl.textContent = entry.name;
    
    const metaEl = document.createElement('div');
    metaEl.className = 'file-list-meta';
    
    if (entry.type === 'dir') {
      const countText = entry.count != null ? `${entry.count} items` : '';
      const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
      metaEl.textContent = [countText, timeText].filter(Boolean).join(' • ');
    } else {
      const sizeText = entry.size != null ? formatBytes(entry.size) : '';
      const timeText = entry.mtime != null ? formatDate(entry.mtime) : '';
      metaEl.textContent = [sizeText, timeText].filter(Boolean).join(' • ');
    }
    
    infoEl.appendChild(nameEl);
    infoEl.appendChild(metaEl);
    
    // Create action buttons
    const actionsEl = document.createElement('div');
    actionsEl.className = 'file-list-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(entry);
    });
    
    actionsEl.appendChild(deleteBtn);
    
    // Assemble list item
    li.appendChild(checkbox);
    li.appendChild(iconEl);
    li.appendChild(infoEl);
    li.appendChild(actionsEl);
    
    // Add click handler
    li.addEventListener('click', (e) => {
      // Handle selection with Ctrl/Cmd click
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        toggleItemSelection(entry.name, checkbox.checked);
        return;
      }
      
      handleItemClick(entry);
    });
    
    fileListEl.appendChild(li);
  });
}

/**
 * Handle item click (navigation or download)
 * @param {Object} entry
 */
function handleItemClick(entry) {
  if (entry.type === 'dir') {
    // Navigate to directory
    setCurrentPath(joinPath(getCurrentPath(), entry.name));
    requestRefresh();
  } else {
    // Handle file click
    const path = getCurrentPath();
    const downloadUrl = DOWNLOAD_BASE + (path ? (`?path=${encodeURIComponent(path)}&file=`) : ('?file=')) + encodeURIComponent(entry.name);
    
    if (isViewableInBrowser(entry.name)) {
      // Open viewable files in new tab
      window.open(downloadUrl, '_blank');
    } else {
      // Download other files
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = entry.name;
      link.click();
    }
  }
}

/**
 * Toggle item selection
 * @param {string} itemName
 * @param {boolean} selected
 */
function toggleItemSelection(itemName, selected) {
  if (selected) {
    selectedItems.add(itemName);
  } else {
    selectedItems.delete(itemName);
  }
  
  // Update visual state
  const itemEl = fileListEl.querySelector(`[data-name="${CSS.escape(itemName)}"]`);
  if (itemEl) {
    itemEl.classList.toggle('selected', selected);
  }
  
  updateSelectionBar();
}

/**
 * Select all items
 */
function selectAllItems() {
  currentItems.forEach(item => {
    selectedItems.add(item.name);
    const itemEl = fileListEl.querySelector(`[data-name="${CSS.escape(item.name)}"]`);
    if (itemEl) {
      itemEl.classList.add('selected');
      const checkbox = itemEl.querySelector('.file-checkbox');
      if (checkbox) checkbox.checked = true;
    }
  });
  
  updateSelectionBar();
}

/**
 * Deselect all items
 */
function deselectAllItems() {
  selectedItems.clear();
  
  fileListEl.querySelectorAll('.selected').forEach(itemEl => {
    itemEl.classList.remove('selected');
    const checkbox = itemEl.querySelector('.file-checkbox');
    if (checkbox) checkbox.checked = false;
  });
  
  updateSelectionBar();
}

/**
 * Update selection bar visibility and content
 */
function updateSelectionBar() {
  if (!selectionBar || !selectionInfo) return;
  
  const count = selectedItems.size;
  
  if (count > 0) {
    selectionBar.classList.add('visible');
    selectionInfo.textContent = `${count} item${count === 1 ? '' : 's'} selected`;
  } else {
    selectionBar.classList.remove('visible');
  }
}

/**
 * Delete selected items
 */
async function deleteSelectedItems() {
  if (selectedItems.size === 0) return;
  
  const itemNames = Array.from(selectedItems);
  const message = itemNames.length === 1 
    ? `Delete "${itemNames[0]}"?`
    : `Delete ${itemNames.length} selected items?`;
  
  if (!confirm(message)) return;
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const itemName of itemNames) {
    try {
      const item = currentItems.find(i => i.name === itemName);
      if (!item) continue;
      
      const resp = item.type === 'dir' 
        ? await apiDeleteDir(getCurrentPath(), itemName)
        : await apiDeleteFile(getCurrentPath(), itemName);
      
      if (resp.success) {
        successCount++;
      } else {
        errorCount++;
        showError(`Failed to delete "${itemName}": ${resp.message || 'Unknown error'}`);
      }
    } catch (err) {
      errorCount++;
      showError(`Error deleting "${itemName}": ${err.message || err}`);
    }
  }
  
  // Show summary
  if (successCount > 0) {
    showSuccess(`Successfully deleted ${successCount} item${successCount === 1 ? '' : 's'}`);
  }
  
  if (errorCount > 0) {
    showError(`Failed to delete ${errorCount} item${errorCount === 1 ? '' : 's'}`);
  }
  
  // Clear selection and refresh
  deselectAllItems();
  requestRefresh(true);
}

/**
 * Rename selected item (only works with single selection)
 */
function renameSelectedItem() {
  if (selectedItems.size !== 1) {
    showWarning('Please select exactly one item to rename');
    return;
  }
  
  const itemName = Array.from(selectedItems)[0];
  const newName = prompt('Enter new name:', itemName);
  
  if (!newName || newName === itemName) return;
  
  // TODO: Implement rename functionality
  showWarning('Rename functionality will be implemented in the next update');
}

/**
 * Move selected items
 */
function moveSelectedItems() {
  if (selectedItems.size === 0) return;
  
  // TODO: Implement move functionality
  showWarning('Move functionality will be implemented in the next update');
}

/**
 * Delete single item
 * @param {Object} entry
 */
async function deleteItem(entry) {
  const message = entry.type === 'dir' 
    ? `Delete folder "${entry.name}" and all its contents?`
    : `Delete "${entry.name}"?`;
  
  if (!confirm(message)) return;
  
  try {
    const resp = entry.type === 'dir' 
      ? await apiDeleteDir(getCurrentPath(), entry.name)
      : await apiDeleteFile(getCurrentPath(), entry.name);
    
    if (!resp.success) {
      throw new Error(resp.message || 'Delete failed');
    }
    
    showSuccess(`Deleted "${entry.name}"`);
    requestRefresh(true);
  } catch (err) {
    showError(`Error deleting "${entry.name}": ${err.message || err}`);
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
