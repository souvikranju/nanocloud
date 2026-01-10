// state.js
// Centralized client-side state management for the upload app.
// This module holds mutable UI state and provides state management functions.

import { API_URL, DOWNLOAD_BASE, REFRESH_DEBOUNCE_MS } from './constants.js';

// Re-export API constants for backward compatibility
export { API_URL, DOWNLOAD_BASE };

/** Current relative path within the uploads tree. Empty string means root. */
let currentPath = '';

/** Server configuration including limits and operation control */
let serverConfig = {
  maxFileBytes: null,
  maxSessionBytes: null,
  readOnly: false,
  uploadEnabled: true,
  deleteEnabled: true,
  renameEnabled: true,
  moveEnabled: true,
};

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
  return serverConfig.maxFileBytes;
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

// =====================================
// SERVER CONFIGURATION MANAGEMENT
// =====================================

/**
 * Set server configuration from API response.
 * @param {Object} config
 */
export function setServerConfig(config) {
  serverConfig = { ...serverConfig, ...config };
}

/**
 * Get current server configuration.
 * @returns {Object}
 */
export function getServerConfig() {
  return { ...serverConfig };
}

/**
 * Check if an operation is allowed based on server configuration.
 * @param {string} operation - One of: 'upload', 'delete', 'rename', 'move'
 * @returns {Object} - {allowed: boolean, reason: string}
 */
export function isOperationAllowed(operation) {
  // READ_ONLY overrides everything
  if (serverConfig.readOnly) {
    return { allowed: false, reason: 'System is read-only' };
  }
  
  switch (operation) {
    case 'upload':
      return { 
        allowed: serverConfig.uploadEnabled, 
        reason: serverConfig.uploadEnabled ? '' : 'Uploads disabled by administrator'
      };
    case 'delete':
      return { 
        allowed: serverConfig.deleteEnabled, 
        reason: serverConfig.deleteEnabled ? '' : 'Deletion disabled by administrator'
      };
    case 'rename':
      return { 
        allowed: serverConfig.renameEnabled, 
        reason: serverConfig.renameEnabled ? '' : 'Renaming disabled by administrator'
      };
    case 'move':
      return { 
        allowed: serverConfig.moveEnabled, 
        reason: serverConfig.moveEnabled ? '' : 'Moving disabled by administrator'
      };
    default:
      return { allowed: true, reason: '' };
  }
}
