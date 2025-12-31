// state.js
// Centralized client-side state management for the upload app.
// This module holds mutable UI state and provides state management functions.

import { API_URL, DOWNLOAD_BASE, REFRESH_DEBOUNCE_MS } from './constants.js';

// Re-export API constants for backward compatibility
export { API_URL, DOWNLOAD_BASE };

/** Current relative path within the uploads tree. Empty string means root. */
let currentPath = '';

/** Server-side max file size (bytes). Null when unknown. */
let maxFileBytes = null;

/** Set of names (files + dirs) present in the current directory for duplicate checks. */
const nameSet = new Set();

/** Request tracking for preventing duplicate refresh calls */
let currentRequestId = 0;
let pendingRefresh = false;
let lastRefreshTime = 0;

/** Auto-refresh callback - set by list module */
let autoRefreshCallback = null;

/**
 * Get the current relative path ('' for root).
 * @returns {string}
 */
export function getCurrentPath() {
  return currentPath;
}

/**
 * Set the current relative path. Falsy values reset to '' (root).
 * @param {string} path
 */
export function setCurrentPath(path) {
  currentPath = path || '';
}

/**
 * Get the server-reported max file size in bytes or null when unknown.
 * @returns {number|null}
 */
export function getMaxFileBytes() {
  return maxFileBytes;
}

/**
 * Set the server-reported max file size. Non-finite values become null.
 * @param {number|null|undefined} n
 */
export function setMaxFileBytes(n) {
  maxFileBytes = Number.isFinite(n) ? Number(n) : null;
}

/**
 * Access the Set of existing names in the current directory.
 * Note: Do not mutate it directly; prefer helper functions below.
 * @returns {Set<string>}
 */
export function existingNames() {
  return nameSet;
}

/**
 * Replace the existing names set from a listing response (array of {name}).
 * @param {Array<{name:string}>} items
 */
export function setExistingNamesFromList(items) {
  nameSet.clear();
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it && typeof it.name === 'string') {
        nameSet.add(it.name);
      }
    }
  }
}

/**
 * Mark a name as present (e.g., after a successful upload).
 * @param {string} name
 */
export function markExistingName(name) {
  if (name) nameSet.add(name);
}

/**
 * Check if a name already exists in the current directory.
 * @param {string} name
 * @returns {boolean}
 */
export function hasExistingName(name) {
  return !!name && nameSet.has(name);
}

// =====================================
// REQUEST TRACKING & AUTO-REFRESH
// =====================================

/**
 * Register a callback for auto-refresh when state changes.
 * @param {Function} callback
 */
export function registerAutoRefresh(callback) {
  autoRefreshCallback = callback;
}



/**
 * Trigger state change with auto-refresh.
 * @param {string} path
 */
export function setCurrentPathWithRefresh(path) {
  const oldPath = currentPath;
  setCurrentPath(path);
  
  // Only auto-refresh if path actually changed
  if (oldPath !== (path || '')) {
    requestRefresh();
  }
}

/**
 * Request a refresh with debouncing and request tracking.
 * @param {boolean} force - Force refresh even if debounced
 * @returns {Promise<boolean>} - True if refresh was initiated
 */
export async function requestRefresh(force = false) {
  const now = Date.now();
  
  // Check time-based debouncing (only if not forced)
  if (!force && (now - lastRefreshTime < REFRESH_DEBOUNCE_MS)) {
    console.log('not refreshing now - too soon after last refresh');
    return false;
  }

  // Mark as pending and increment request ID
  console.log('Starting refresh');
  pendingRefresh = true;
  currentRequestId++;
  const requestId = currentRequestId;
  lastRefreshTime = now;

  try {
    if (autoRefreshCallback) {
      await autoRefreshCallback(requestId);
    }
    return true;
  } catch (error) {
    console.warn('Auto-refresh failed:', error);
    return false;
  } finally {
    // Clear pending flag quickly to allow next refresh
    setTimeout(() => {
      if (currentRequestId === requestId) {
        console.log('Clearing pending refresh');
        pendingRefresh = false;
      }
    }, REFRESH_DEBOUNCE_MS);
  }
}
