// nanocloudClient.js
// Thin client for server endpoints. Provides Promise-based wrappers.
// Keeps fetch/XHR details here so the rest of the app stays clean.

import { API_URL } from './constants.js';

/**
 * Internal helper: GET JSON from API with query params.
 * @param {Record<string,string>} params
 * @returns {Promise<any>}
 */
async function getJson(params) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`${API_URL}?${qs}`, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Internal helper: POST FormData and parse JSON.
 * @param {FormData} form
 * @returns {Promise<any>}
 */
async function postForm(form) {
  const resp = await fetch(API_URL, { method: 'POST', body: form });
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
            // Return error in expected format
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

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

/**
 * Generate a deterministic upload ID based on file properties
 * Simple string hash that works in all contexts (HTTP/HTTPS)
 * @param {File} file - The file object
 * @param {string} relativePath - Relative path for the file
 * @param {string} targetPath - Target directory path
 * @returns {string} - Deterministic upload ID
 */
function generateUploadId(file, relativePath, targetPath) {
  // Create a string from file metadata
  const metadata = `${file.name}-${file.size}-${file.lastModified}-${targetPath}-${relativePath}`;
  
  // Simple hash function (similar to Java's hashCode)
  let hash = 0;
  for (let i = 0; i < metadata.length; i++) {
    const char = metadata.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string with padding
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  
  // Return deterministic hash (same file = same ID)
  return hashHex;
}

/**
 * Check upload status for resumability
 * @param {string} uploadId - Upload identifier
 * @returns {Promise<{success:boolean, exists:boolean, nextChunkIndex:number}>}
 */
export function checkUploadStatus(uploadId) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    
    formData.append('action', 'upload_check');
    formData.append('uploadId', uploadId);
    
    xhr.open('POST', API_URL);
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

/**
 * Upload a single chunk of a file
 * @param {Blob} chunk - The chunk data
 * @param {string} uploadId - Unique upload identifier
 * @param {number} chunkIndex - Current chunk index
 * @param {number} totalChunks - Total number of chunks
 * @param {string} filename - Original filename
 * @param {string} relativePath - Relative path for folder uploads
 * @param {string} path - Target directory path
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
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

/**
 * Upload a file using chunked upload (for large files)
 * @param {File} file
 * @param {string} path - Current directory path
 * @param {string} relativePath - Relative path for the file
 * @param {number} chunkSize - Size of each chunk in bytes
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{success:boolean, filename:string, message?:string}>}
 */
export function uploadChunked(file, path, relativePath, chunkSize, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      // Generate deterministic upload ID based on file properties
      const uploadId = await generateUploadId(file, relativePath, path);
      
      // Calculate total chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      // Check if upload can be resumed
      let startChunkIndex = 0;
      try {
        const status = await checkUploadStatus(uploadId);
        if (status.success && status.exists) {
          startChunkIndex = status.nextChunkIndex || 0;
          console.log(`Resuming upload from chunk ${startChunkIndex} of ${totalChunks}`);
          
          // Update progress to reflect already uploaded chunks
          if (typeof onProgress === 'function' && startChunkIndex > 0) {
            const progress = (startChunkIndex / totalChunks) * 100;
            onProgress(progress);
          }
        }
      } catch (err) {
        console.warn('Failed to check upload status, starting from beginning:', err);
        // Continue with startChunkIndex = 0
      }
      
      // Upload chunks sequentially starting from the resume point
      for (let chunkIndex = startChunkIndex; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Retry logic for each chunk
        let retries = 3;
        let success = false;
        let lastError = null;
        
        while (retries > 0 && !success) {
          try {
            const result = await uploadChunk(
              chunk,
              uploadId,
              chunkIndex,
              totalChunks,
              file.name,
              relativePath,
              path
            );
            
            if (result.success) {
              success = true;
              
              // Update progress
              if (typeof onProgress === 'function') {
                const progress = ((chunkIndex + 1) / totalChunks) * 100;
                onProgress(progress);
              }
              
              // If this was the last chunk, return the final result
              if (chunkIndex + 1 === totalChunks) {
                resolve({
                  success: true,
                  filename: result.filename || relativePath,
                  message: result.message || 'File uploaded successfully.'
                });
              }
            } else {
              lastError = new Error(result.message || 'Chunk upload failed');
              retries--;
            }
          } catch (err) {
            lastError = err;
            retries--;
            
            // Wait before retry (exponential backoff)
            if (retries > 0) {
              await new Promise(r => setTimeout(r, (4 - retries) * 1000));
            }
          }
        }
        
        // If chunk failed after all retries, reject
        if (!success) {
          reject(lastError || new Error(`Failed to upload chunk ${chunkIndex}`));
          return;
        }
      }
    } catch (err) {
      reject(err);
    }
  });
}
