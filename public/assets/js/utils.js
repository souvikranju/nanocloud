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

/**
 * Recursively traverse a directory entry and extract all files with their relative paths.
 * @param {FileSystemEntry} entry - Directory or file entry from DataTransferItem
 * @param {string} basePath - Base path to prepend to file paths
 * @returns {Promise<Array<{file: File, relativePath: string}>>}
 */
async function traverseDirectoryEntry(entry, basePath = '') {
  const results = [];
  
  if (entry.isFile) {
    // Get the file from the entry
    const file = await new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
    
    // Store file with its relative path - preserve exact names including spaces
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    results.push({ file, relativePath });
  } else if (entry.isDirectory) {
    // Read directory contents
    const reader = entry.createReader();
    const entries = await new Promise((resolve, reject) => {
      const allEntries = [];
      
      function readEntries() {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            readEntries(); // Continue reading if there are more entries
          }
        }, reject);
      }
      
      readEntries();
    });
    
    // Recursively process each entry - preserve exact folder names including spaces
    const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    for (const subEntry of entries) {
      const subResults = await traverseDirectoryEntry(subEntry, newBasePath);
      results.push(...subResults);
    }
  }
  
  return results;
}

/**
 * Extract files from DataTransferItemList, handling both files and folders.
 * @param {DataTransferItemList} items - Items from drag and drop event
 * @returns {Promise<Array<{file: File, relativePath: string}>>}
 */
export async function extractFilesFromDataTransfer(items) {
  const results = [];
  const entries = [];
  
  // Collect all entries
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.();
      if (entry) {
        entries.push(entry);
      }
    }
  }
  
  // Process each entry
  for (const entry of entries) {
    const files = await traverseDirectoryEntry(entry);
    results.push(...files);
  }
  
  return results;
}

/**
 * Extract files from FileList (from input element), preserving folder structure if available.
 * @param {FileList} fileList - Files from input element
 * @returns {Array<{file: File, relativePath: string}>}
 */
export function extractFilesFromFileList(fileList) {
  const results = [];
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    // Use webkitRelativePath if available (folder upload), otherwise just the name
    const relativePath = file.webkitRelativePath || file.name;
    results.push({ file, relativePath });
  }
  
  return results;
}
