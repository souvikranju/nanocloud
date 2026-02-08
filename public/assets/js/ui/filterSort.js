// ui/filterSort.js
// Client-side filtering and sorting for file lists
// Supports both quick search (current folder) and deep search (recursive)

import { list as apiList } from '../nanocloudClient.js';
import { getCurrentPath } from '../state.js';

// Constants
const SORT_STORAGE_KEY = 'nanocloud_sort_mode';
const DEFAULT_SORT_MODE = 'name-asc';
const MAX_SEARCH_DEPTH = 10;

// State
let currentSortMode = DEFAULT_SORT_MODE;
let currentSearchQuery = '';
let searchMode = 'quick'; // 'quick' or 'deep'
let deepSearchResults = [];
let searchInProgress = false;

// DOM References
let searchInput = null;
let clearSearchBtn = null;
let deepSearchCheckbox = null;
let gridViewBtn = null;
let listViewBtn = null;

/**
 * Initialize filter and sort module
 * @param {Object} refs - DOM element references
 */
export function initFilterSort(refs) {
  searchInput = refs.searchInput || null;
  clearSearchBtn = refs.clearSearchBtn || null;
  deepSearchCheckbox = refs.deepSearchCheckbox || null;
  gridViewBtn = refs.gridViewBtn || null;
  listViewBtn = refs.listViewBtn || null;
  
  // Load saved sort preference
  loadSortPreference();
  
  // Setup event handlers
  setupEventHandlers();
  
  // Setup sort button handlers
  setupSortButtonHandlers();
  
  // Setup view mode handlers
  setupViewModeHandlers();
}

/**
 * Load sort preference from localStorage
 */
function loadSortPreference() {
  const saved = localStorage.getItem(SORT_STORAGE_KEY);
  if (saved) {
    currentSortMode = saved;
    updateSortButtonStates();
  }
}

/**
 * Save sort preference to localStorage
 * @param {string} mode
 */
function saveSortPreference(mode) {
  localStorage.setItem(SORT_STORAGE_KEY, mode);
}

/**
 * Setup event handlers for search controls
 */
function setupEventHandlers() {
  // Search input with debounce
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        handleSearch(query);
      }, 300);
    });
    
    // Handle Enter key for immediate search and close modal
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        handleSearch(query);
        
        // Close the search modal
        if (window.hideSearchModal) {
          window.hideSearchModal();
        }
      }
    });
  }
  
  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
      }
      currentSearchQuery = '';
      searchMode = 'quick';
      deepSearchResults = [];
      clearSearchBtn.classList.add('hidden');
      
      // Trigger re-render
      if (window.filterSortCallback) {
        window.filterSortCallback();
      }
    });
  }
  
  // Deep search checkbox - re-run search when toggled
  if (deepSearchCheckbox) {
    deepSearchCheckbox.addEventListener('change', () => {
      // If there's an active search query, re-run the search
      if (searchInput && searchInput.value.trim()) {
        handleSearch(searchInput.value.trim());
      }
    });
  }
}

/**
 * Handle search query
 * @param {string} query
 */
async function handleSearch(query) {
  currentSearchQuery = query;
  
  // Show/hide clear button
  if (clearSearchBtn) {
    clearSearchBtn.classList.toggle('hidden', !query);
  }
  
  if (!query) {
    searchMode = 'quick';
    deepSearchResults = [];
    if (window.filterSortCallback) {
      window.filterSortCallback();
    }
    return;
  }
  
  // Check if deep search is enabled
  const isDeepSearch = deepSearchCheckbox && deepSearchCheckbox.checked;
  
  if (isDeepSearch) {
    await performDeepSearch(query);
  } else {
    searchMode = 'quick';
    deepSearchResults = [];
    if (window.filterSortCallback) {
      window.filterSortCallback();
    }
  }
}

/**
 * Perform deep search (recursive)
 * @param {string} query
 */
async function performDeepSearch(query) {
  if (!query) {
    if (window.showError) {
      window.showError('Please enter a search term');
    }
    return;
  }
  
  if (searchInProgress) return;
  
  searchInProgress = true;
  searchMode = 'deep';
  
  try {
    const results = await recursiveSearch(getCurrentPath(), query);
    deepSearchResults = results;
    
    // Trigger re-render with deep search results
    if (window.filterSortCallback) {
      window.filterSortCallback();
    }
    
    if (window.showInfo) {
      window.showInfo(`Found ${results.length} items matching "${query}"`);
    }
  } catch (error) {
    console.error('Deep search failed:', error);
    if (window.showError) {
      window.showError('Search failed: ' + error.message);
    }
  } finally {
    searchInProgress = false;
  }
}

/**
 * Recursive search through directory tree
 * @param {string} path - Starting path
 * @param {string} query - Search query
 * @param {number} maxDepth - Maximum recursion depth
 * @param {number} currentDepth - Current recursion depth
 * @returns {Promise<Array>} - Array of matching items with path info
 */
async function recursiveSearch(path, query, maxDepth = MAX_SEARCH_DEPTH, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];
  
  const queryLower = query.toLowerCase();
  
  try {
    const response = await apiList(path);
    
    if (!response.success || !response.items) {
      return [];
    }
    
    const results = [];
    const subfolderPromises = [];
    
    for (const item of response.items) {
      // Check if item matches query
      if (item.name.toLowerCase().includes(queryLower)) {
        results.push({
          ...item,
          fullPath: path ? `${path}/${item.name}` : item.name,
          displayPath: path || '',
          breadcrumbs: path ? path.split('/') : []
        });
      }
      
      // Queue subfolder searches
      if (item.type === 'dir') {
        const subPath = path ? `${path}/${item.name}` : item.name;
        subfolderPromises.push(
          recursiveSearch(subPath, query, maxDepth, currentDepth + 1)
        );
      }
    }
    
    // Execute subfolder searches in parallel
    const subResults = await Promise.all(subfolderPromises);
    results.push(...subResults.flat());
    
    return results;
  } catch (error) {
    console.warn(`Failed to search path "${path}":`, error);
    return [];
  }
}

/**
 * Quick search in current folder only
 * @param {Array} items - Items to search
 * @param {string} query - Search query
 * @returns {Array} - Filtered items
 */
function quickSearch(items, query) {
  if (!query) return items;
  
  const queryLower = query.toLowerCase();
  return items.filter(item => 
    item.name.toLowerCase().includes(queryLower)
  );
}

/**
 * Sort items by current sort mode
 * @param {Array} items - Items to sort
 * @returns {Array} - Sorted items
 */
function sortItems(items) {
  if (!items || items.length === 0) return items;
  
  const [field, direction] = currentSortMode.split('-');
  
  // Separate folders and files
  const folders = items.filter(item => item.type === 'dir');
  const files = items.filter(item => item.type !== 'dir');
  
  // Sort function
  const sortFn = (a, b) => {
    let comparison = 0;
    
    switch(field) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, {sensitivity: 'base'});
        break;
      case 'date':
        comparison = (a.mtime || 0) - (b.mtime || 0);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      default:
        comparison = 0;
    }
    
    return direction === 'desc' ? -comparison : comparison;
  };
  
  folders.sort(sortFn);
  files.sort(sortFn);
  
  return [...folders, ...files];
}

/**
 * Apply sorting and filtering to items
 * @param {Array} items - Original items from API
 * @returns {Object} - {items: Array, mode: string}
 */
export function applySortAndFilter(items) {
  let processedItems = [];
  let mode = searchMode;
  
  if (searchMode === 'deep' && currentSearchQuery) {
    // Use deep search results
    processedItems = deepSearchResults;
  } else if (currentSearchQuery) {
    // Quick search in current folder
    processedItems = quickSearch(items, currentSearchQuery);
    mode = 'quick';
  } else {
    // No search, show all items
    processedItems = items;
    mode = 'normal';
  }
  
  // Apply sorting
  processedItems = sortItems(processedItems);
  
  return {
    items: processedItems,
    mode: mode,
    query: currentSearchQuery
  };
}

/**
 * Setup sort button handlers
 */
function setupSortButtonHandlers() {
  const sortButtons = document.querySelectorAll('.sort-option-btn');
  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const sortMode = btn.dataset.sort;
      if (sortMode) {
        currentSortMode = sortMode;
        saveSortPreference(sortMode);
        updateSortButtonStates();
        
        // Trigger re-render
        if (window.filterSortCallback) {
          window.filterSortCallback();
        }
      }
    });
  });
}

/**
 * Update sort button active states
 */
function updateSortButtonStates() {
  const sortButtons = document.querySelectorAll('.sort-option-btn');
  sortButtons.forEach(btn => {
    if (btn.dataset.sort === currentSortMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Setup view mode handlers
 */
function setupViewModeHandlers() {
  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      setViewMode('grid');
    });
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      setViewMode('list');
    });
  }
}

/**
 * Set view mode
 * @param {string} mode - 'grid' or 'list'
 */
function setViewMode(mode) {
  const fileList = document.getElementById('fileList');
  if (!fileList) return;
  
  if (mode === 'grid') {
    fileList.classList.remove('file-list');
    fileList.classList.add('file-grid');
  } else {
    fileList.classList.remove('file-grid');
    fileList.classList.add('file-list');
  }
  
  // Update button states in both toolbar and modal
  updateViewModeButtonStates(mode);
  
  // Save preference
  localStorage.setItem('nanocloud_view_mode', mode);
  
  // Trigger re-render
  if (window.filterSortCallback) {
    window.filterSortCallback();
  }
}

/**
 * Update view mode button states
 * @param {string} mode - 'grid' or 'list'
 */
function updateViewModeButtonStates(mode) {
  const allGridBtns = document.querySelectorAll('#gridViewBtn, [data-view="grid"]');
  const allListBtns = document.querySelectorAll('#listViewBtn, [data-view="list"]');
  
  allGridBtns.forEach(btn => {
    if (mode === 'grid') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  allListBtns.forEach(btn => {
    if (mode === 'list') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Get current sort mode
 * @returns {string}
 */
export function getCurrentSortMode() {
  return currentSortMode;
}

/**
 * Get current search query
 * @returns {string}
 */
export function getCurrentSearchQuery() {
  return currentSearchQuery;
}

/**
 * Get current search mode
 * @returns {string}
 */
export function getSearchMode() {
  return searchMode;
}

/**
 * Check if search is active (quick or deep)
 * @returns {boolean}
 */
export function isSearchActive() {
  return currentSearchQuery.trim().length > 0;
}

/**
 * Reset search state
 */
export function resetSearch() {
  currentSearchQuery = '';
  searchMode = 'quick';
  deepSearchResults = [];
  
  if (searchInput) {
    searchInput.value = '';
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.classList.add('hidden');
  }
  
  if (deepSearchCheckbox) {
    deepSearchCheckbox.checked = false;
  }
}
