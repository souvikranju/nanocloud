// state.js
// Centralized client-side state and constants for the upload app.
// This module holds global configuration and mutable UI state in one place,
// avoiding scattered globals across the codebase.

/** API endpoints used by the frontend. */
export const API_URL = 'nanocloud_api.php';
export const DOWNLOAD_BASE = 'nanocloud_download.php';

/** Current relative path within the uploads tree. Empty string means root. */
let currentPath = '';

/** Server-side max file size (bytes). Null when unknown. */
let maxFileBytes = null;

/** Set of names (files + dirs) present in the current directory for duplicate checks. */
const nameSet = new Set();

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
