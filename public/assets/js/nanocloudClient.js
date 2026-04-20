// nanocloudClient.js
// Thin client for server endpoints. Provides Promise-based wrappers.
// Keeps fetch/XHR details here so the rest of the app stays clean.

import { API_URL } from './constants.js';

/** Default timeout for all API requests (ms). */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Internal helper: GET JSON from API with query params.
 * @param {Record<string,string>} params
 * @returns {Promise<any>}
 */
async function getJson(params) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`${API_URL}?${qs}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Internal helper: POST FormData and parse JSON.
 * @param {FormData} form
 * @returns {Promise<any>}
 */
async function postForm(form) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Fetch server info (limits).
 * @returns {Promise<{success:boolean,maxFileBytes:number|null,maxSessionBytes:number|null}>}
 */
export function info() {
  return getJson({ action: 'info' });
}

/**
 * List entries (files + dirs) under a relative path.
 * @param {string} path
 * @returns {Promise<{success:boolean,items:Array, path:string, breadcrumbs:Array<string>, storage:any, message?:string}>}
 */
export function list(path = '') {
  const params = { action: 'list' };
  if (path) params['path'] = path;
  return getJson(params);
}

/**
 * Create a directory within the given path.
 * @param {string} path
 * @param {string} name
 * @returns {Promise<any>}
 */
export function createDir(path, name) {
  const form = new FormData();
  form.append('action', 'create_dir');
  form.append('path', path);
  form.append('name', name);
  return postForm(form);
}

/**
 * Delete a file by name under the given path.
 * @param {string} path
 * @param {string} filename
 * @returns {Promise<any>}
 */
export function deleteFile(path, filename) {
  const form = new FormData();
  form.append('action', 'delete');
  form.append('path', path);
  form.append('filename', filename);
  return postForm(form);
}

/**
 * Delete a directory by name under the given path (recursive).
 * @param {string} path
 * @param {string} dirname
 * @returns {Promise<any>}
 */
export function deleteDir(path, dirname) {
  const form = new FormData();
  form.append('action', 'delete_dir');
  form.append('path', path);
  form.append('name', dirname);
  return postForm(form);
}

/**
 * Rename a file within the given path.
 * @param {string} path
 * @param {string} filename
 * @param {string} newName
 * @returns {Promise<any>}
 */
export function renameFile(path, filename, newName) {
  const form = new FormData();
  form.append('action', 'rename_file');
  form.append('path', path);
  form.append('filename', filename);
  form.append('newName', newName);
  return postForm(form);
}

/**
 * Rename a directory within the given path.
 * @param {string} path
 * @param {string} dirname
 * @param {string} newName
 * @returns {Promise<any>}
 */
export function renameDir(path, dirname, newName) {
  const form = new FormData();
  form.append('action', 'rename_dir');
  form.append('path', path);
  form.append('name', dirname);
  form.append('newName', newName);
  return postForm(form);
}

/**
 * Move a file or directory to a different path.
 * @param {string} sourcePath - Current path of the item
 * @param {string} itemType - 'file' or 'dir'
 * @param {string} itemName - Name of the item to move
 * @param {string} targetPath - Destination path
 * @returns {Promise<any>}
 */
export function moveItem(sourcePath, itemType, itemName, targetPath) {
  const form = new FormData();
  form.append('action', 'move');
  form.append('path', sourcePath);
  form.append('itemType', itemType);
  form.append('itemName', itemName);
  form.append('targetPath', targetPath);
  return postForm(form);
}

/**
 * Upload a single file using XHR to get progress events.
 * Resolves with the server's single-file result ({success, filename, message}) or rejects on error.
 * @param {File} file
 * @param {string} path - Current directory path
 * @param {string} relativePath - Relative path for the file (e.g., "folder/subfolder/file.txt")
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{success:boolean, filename:string, message?:string}>}
 */
export function uploadSingle(file, path, relativePath, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('path', path);
    formData.append('files[]', file, file.name);
    formData.append('relativePaths[]', relativePath);

    xhr.open('POST', API_URL);
    xhr.timeout = REQUEST_TIMEOUT_MS;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);

          // Check for server-level error (e.g., uploads disabled)
          if (data && data.success === false && data.message) {
            resolve({
              success: false,
              filename: file.name,
              message: data.message
            });
            return;
          }

          // Normal response with results array
          const res = data && data.results && data.results[0];
          if (res) resolve(res);
          else reject(new Error('Unexpected response shape'));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };

    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

/**
 * Generate a deterministic upload ID based on file properties.
 * Same file + same target = same ID, enabling resumable uploads.
 * @param {File} file
 * @param {string} relativePath
 * @param {string} targetPath
 * @returns {string}
 */
function generateUploadId(file, relativePath, targetPath) {
  const metadata = `${file.name}-${file.size}-${file.lastModified}-${targetPath}-${relativePath}`;

  let hash = 0;
  for (let i = 0; i < metadata.length; i++) {
    const char = metadata.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Check upload status for resumability.
 * Uses fetch (no progress events needed) rather than XHR.
 * @param {string} uploadId
 * @returns {Promise<{success:boolean, exists:boolean, nextChunkIndex:number}>}
 */
export function checkUploadStatus(uploadId) {
  const form = new FormData();
  form.append('action', 'upload_check');
  form.append('uploadId', uploadId);
  return postForm(form);
}

/**
 * Upload a single chunk of a file via XHR.
 * @param {Blob} chunk
 * @param {string} uploadId
 * @param {number} chunkIndex
 * @param {number} totalChunks
 * @param {string} filename
 * @param {string} relativePath
 * @param {string} path
 * @returns {Promise<{success:boolean, message:string}>}
 */
function uploadChunk(chunk, uploadId, chunkIndex, totalChunks, filename, relativePath, path) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('action', 'upload_chunk');
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('filename', filename);
    formData.append('relativePath', relativePath);
    formData.append('path', path);
    formData.append('chunk', chunk);

    xhr.open('POST', API_URL);
    xhr.timeout = REQUEST_TIMEOUT_MS;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };

    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

/**
 * Upload a file using chunked upload (for large files).
 *
 * Previously wrapped in `new Promise(async ...)` which swallowed errors thrown
 * before resolve/reject were called.  Rewritten as a plain async function so
 * every thrown error propagates correctly to the caller.
 *
 * @param {File} file
 * @param {string} path - Current directory path
 * @param {string} relativePath - Relative path for the file
 * @param {number} chunkSize - Size of each chunk in bytes
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{success:boolean, filename:string, message?:string}>}
 */
export async function uploadChunked(file, path, relativePath, chunkSize, onProgress) {
  // generateUploadId is synchronous — no await needed.
  const uploadId = generateUploadId(file, relativePath, path);
  const totalChunks = Math.ceil(file.size / chunkSize);

  // Check if upload can be resumed
  let startChunkIndex = 0;
  try {
    const status = await checkUploadStatus(uploadId);
    if (status.success && status.exists) {
      startChunkIndex = status.nextChunkIndex || 0;
      if (typeof onProgress === 'function' && startChunkIndex > 0) {
        onProgress((startChunkIndex / totalChunks) * 100);
      }
    }
  } catch {
    // Network error checking status — start from chunk 0
  }

  for (let chunkIndex = startChunkIndex; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size));

    let retries = 3;
    let lastError = null;

    while (retries > 0) {
      try {
        const result = await uploadChunk(
          chunk, uploadId, chunkIndex, totalChunks,
          file.name, relativePath, path
        );

        if (result.success) {
          if (typeof onProgress === 'function') {
            onProgress(((chunkIndex + 1) / totalChunks) * 100);
          }

          if (chunkIndex + 1 === totalChunks) {
            return {
              success: true,
              filename: result.filename || relativePath,
              message: result.message || 'File uploaded successfully.'
            };
          }
          break; // chunk OK — move to next
        }

        lastError = new Error(result.message || 'Chunk upload failed');
        retries--;
      } catch (err) {
        lastError = err;
        retries--;
        if (retries > 0) {
          await new Promise(r => setTimeout(r, (4 - retries) * 1000));
        }
      }
    }

    if (retries === 0) {
      throw lastError || new Error(`Failed to upload chunk ${chunkIndex}`);
    }
  }

  // Unreachable for non-empty files, but satisfies linters.
  throw new Error('Upload loop exited without completing');
}
