// apiClient.js
// Thin client for server endpoints. Provides Promise-based wrappers.
// Keeps fetch/XHR details here so the rest of the app stays clean.

import { API_URL } from './state.js';

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
 * Upload a single file using XHR to get progress events.
 * Resolves with the server's single-file result ({success, filename, message}) or rejects on error.
 * @param {File} file
 * @param {string} path
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{success:boolean, filename:string, message?:string}>}
 */
export function uploadSingle(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('path', path);
    formData.append('files[]', file, file.name);

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
