// constants.js
// Centralized configuration constants for the NanoCloud application.
// This module consolidates all magic numbers, strings, and configuration values
// used across the frontend to improve maintainability and consistency.

// =====================================
// API CONFIGURATION
// =====================================

/** API endpoint for all backend operations */
export const API_URL = 'api.php';

/** Download endpoint for file streaming */
export const DOWNLOAD_BASE = 'download.php';

// =====================================
// UI TIMING & BEHAVIOR
// =====================================

/** Debounce delay for refresh requests (ms) */
export const REFRESH_DEBOUNCE_MS = 300;

/** Auto-hide delay for upload progress panel (ms) */
export const UPLOAD_PROGRESS_AUTO_HIDE_MS = 5000;

/** Long press duration for mobile selection (ms) */
export const LONG_PRESS_DURATION_MS = 500;

/** Toast notification auto-dismiss duration (ms) */
export const TOAST_AUTO_DISMISS_MS = 5000;

// =====================================
// UPLOAD CONFIGURATION
// =====================================

/** Maximum concurrent uploads */
export const MAX_CONCURRENT_UPLOADS = 3;

/** Chunk size for large file uploads (2MB) */
export const CHUNK_SIZE = 2 * 1024 * 1024;

/** Threshold for using chunked upload (files larger than this use chunking) */
export const CHUNKED_UPLOAD_THRESHOLD = CHUNK_SIZE;

/** Maximum retry attempts per chunk */
export const MAX_CHUNK_RETRIES = 3;

// =====================================
// CSS CLASSES
// =====================================

/** CSS class for drag hover state */
export const DRAG_HOVER_CLASS = 'dragover';

/** CSS class for hidden elements */
export const MODAL_HIDDEN_CLASS = 'hidden';

/** ARIA attribute for modal visibility */
export const MODAL_ARIA_HIDDEN = 'aria-hidden';

/** CSS class for visible elements */
export const VISIBLE_CLASS = 'visible';

/** CSS class for selected items */
export const SELECTED_CLASS = 'selected';

/** CSS class for active view mode */
export const ACTIVE_CLASS = 'active';

// =====================================
// VIEW MODES
// =====================================

/** Grid view mode identifier */
export const VIEW_MODE_GRID = 'grid';

/** List view mode identifier */
export const VIEW_MODE_LIST = 'list';

/** LocalStorage key for view mode preference */
export const VIEW_MODE_STORAGE_KEY = 'nanocloud-view-mode';

// =====================================
// FILE TYPES
// =====================================

/** File extensions that can be viewed inline in browser */
export const VIEWABLE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
  'mp4', 'webm', 'ogg',
  'mp3', 'wav', 'flac', 'aac',
  'pdf'
];

/** File type categories for icon assignment */
export const FILE_TYPE_CATEGORIES = {
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'],
  VIDEO: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'mpeg', 'mpg', 'm4v'],
  AUDIO: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'],
  DOCUMENT: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'],
  ARCHIVE: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso']
};

// =====================================
// KEYBOARD SHORTCUTS
// =====================================

/** Keyboard shortcut keys */
export const KEYBOARD_SHORTCUTS = {
  UPLOAD: 'u',           // Ctrl/Cmd + U
  REFRESH: 'r',          // Ctrl/Cmd + R
  SELECT_ALL: 'a',       // Ctrl/Cmd + A
  DELETE: 'Delete',      // Delete or Backspace
  DELETE_ALT: 'Backspace',
  RENAME: 'F2',
  ESCAPE: 'Escape',
  HELP: 'F1',
  REFRESH_ALT: 'F5'
};
