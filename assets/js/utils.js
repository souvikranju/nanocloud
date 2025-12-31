// utils.js
// Pure utility helpers used across the frontend. No DOM or network access here.

/**
 * Format a byte count into a human-readable string.
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes == null || isNaN(bytes)) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  // 0 decimals for >=10 or bytes, 1 decimal for small non-byte units
  return value.toFixed(value >= 10 || i === 0 ? 0 : 1) + ' ' + sizes[i];
}

/**
 * Join a relative path with a child segment using forward slashes.
 * @param {string} base - e.g. "foo/bar" or "" for root
 * @param {string} name - segment to append (no slashes expected)
 * @returns {string}
 */
export function joinPath(base, name) {
  if (!base) return name;
  return base + '/' + name;
}

/**
 * Compute the parent path of a relative path.
 * @param {string} rel - e.g. "a/b/c" or ""
 * @returns {string} - e.g. "a/b" or "" for root
 */
export function parentPath(rel) {
  if (!rel) return '';
  const parts = rel.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

/**
 * Sanitize a filename (client-side mirror of server rules).
 * Allows: letters, digits, dot, underscore, space, dash, parentheses, square brackets, plus.
 * Strips any directory components and replaces disallowed chars with underscore.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  if (!name) return '';
  // drop any path components
  const parts = String(name).split(/\\|\//);
  let base = parts[parts.length - 1];
  base = base.replace(/[^A-Za-z0-9._ \-\(\)\[\]\+]/g, '_').trim();
  if (base === '' || base === '.' || base === '..') {
    return 'file_' + Date.now();
  }
  return base;
}

/**
 * Sanitize a single path segment (folder or file segment without slashes).
 * @param {string} seg
 * @returns {string}
 */
export function sanitizeSegment(seg) {
  if (!seg) return '';
  let s = String(seg).replace(/[\\\/]/g, '_');
  s = s.replace(/[^A-Za-z0-9._ \-\(\)\[\]\+]/g, '_').trim();
  if (s === '' || s === '.' || s === '..') return '';
  return s;
}

/**
 * Format date for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}
