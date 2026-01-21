// uploader.js
// High-level upload orchestrator focusing on readability and low nesting.
// Validates files, shows a progress panel, uploads with limited concurrency,
// updates UI on completion, and refreshes the listing.

import { MAX_CONCURRENT_UPLOADS, UPLOAD_PROGRESS_AUTO_HIDE_MS } from './constants.js';
import { getCurrentPath, getMaxFileBytes, hasExistingName, markExistingName, requestRefresh } from './state.js';
import { sanitizeFilename, formatBytes, sanitizeSegment } from './utils.js';
import { showError, showInfo } from './ui/toast.js';
import { showPanel, hidePanel, hideModal, hideFab, showFab, clearAll, createItem } from './ui/progress.js';
import { uploadSingle } from './nanocloudClient.js';

/**
 * Sanitize a relative path by sanitizing each segment.
 * Preserves spaces in folder and file names.
 * @param {string} relativePath - Path like "folder/subfolder/file.txt" or "my folder/my file.txt"
 * @returns {string} - Sanitized path
 */
function sanitizeRelativePath(relativePath) {
  if (!relativePath) return '';
  
  // Split by forward slash only (preserve spaces)
  const segments = relativePath.split('/');
  const sanitizedSegments = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Skip empty segments
    if (!segment) continue;
    
    // Last segment is the filename, others are folder names
    const isLastSegment = (i === segments.length - 1);
    const sanitized = isLastSegment ? sanitizeFilename(segment) : sanitizeSegment(segment);
    
    // Only add if sanitization didn't remove everything
    if (sanitized) {
      sanitizedSegments.push(sanitized);
    }
  }
  
  return sanitizedSegments.join('/');
}

/**
 * Validate files with relative paths against size limits and duplicates.
 * @param {Array<{file: File, relativePath: string}>} fileItems
 * @returns {{selected: Array<{file: File, relativePath: string, sanitizedPath: string}>, invalidFiles: Array<{file: File, relativePath: string, error: string}>}}
 */
function validateFiles(fileItems) {
  const maxBytes = getMaxFileBytes();
  const selected = [];
  const invalidFiles = [];
  
  for (const { file, relativePath } of fileItems) {
    const sanitizedPath = sanitizeRelativePath(relativePath);
    const pathSegments = sanitizedPath.split('/');
    
    // Server limit (if known)
    if (maxBytes != null && file.size > maxBytes) {
      const error = `Skipped "${relativePath}": exceeds server limit of ${formatBytes(maxBytes)}.`;
      invalidFiles.push({ file, relativePath, error });
      continue;
    }
    
    // Client-side duplicate check - only check top-level items in current directory
    const topLevelName = pathSegments[0];
    if (pathSegments.length === 1 && hasExistingName(topLevelName)) {
      const error = `Skipped "${relativePath}": a file or folder with the same name already exists.`;
      invalidFiles.push({ file, relativePath, error });
      continue;
    }
    
    selected.push({ file, relativePath, sanitizedPath });
  }
  
  return { selected, invalidFiles };
}

/**
 * Upload files with progress and concurrency limiting.
 * Supports both simple file uploads and folder uploads with relative paths.
 * @param {Array<{file: File, relativePath: string}>} fileItems - Array of file items with relative paths
 * @param {number} [concurrency] how many uploads to run in parallel (defaults to MAX_CONCURRENT_UPLOADS)
 */
export async function uploadFiles(fileItems, concurrency = MAX_CONCURRENT_UPLOADS) {
  if (!fileItems || fileItems.length === 0) {
    return;
  }

  const { selected: toUpload, invalidFiles } = validateFiles(fileItems);
  
  if (toUpload.length === 0 && invalidFiles.length === 0) {
    return;
  }

  // Prepare UI: show progress panel, hide modal and FAB while running
  showPanel();
  hideModal();
  hideFab();

  // Create per-file UI entries for valid files
  const uiMap = new Map();
  for (const { file, relativePath, sanitizedPath } of toUpload) {
    // Display the relative path in UI for clarity
    const displayName = relativePath;
    uiMap.set(sanitizedPath, createItem(displayName, sanitizedPath));
  }

  // Create UI entries for invalid files and show errors
  for (const { file, relativePath, error } of invalidFiles) {
    const ui = createItem(relativePath, relativePath);
    ui.markError();
    ui.setErrorMessage(error);
  }

  // Simple worker-pool to limit concurrency
  let index = 0;
  const results = [];

  async function worker() {
    while (index < toUpload.length) {
      const current = index++;
      const { file, relativePath, sanitizedPath } = toUpload[current];
      const ui = uiMap.get(sanitizedPath);

      try {
        const res = await uploadSingle(file, getCurrentPath(), sanitizedPath, pct => ui.setProgress(pct));
        if (res && res.success) {
          ui.markComplete();
          // Mark top-level name as existing for duplicate checking
          const topLevelName = sanitizedPath.split('/')[0];
          markExistingName(topLevelName);
        } else {
          ui.markError();
          const fname = res && res.filename ? res.filename : relativePath;
          const msg = res && res.message ? res.message : 'Upload error';
          showError(`Failed "${fname}": ${msg}`);
        }
        results.push(res);
      } catch (err) {
        ui.markError();
        showError(`Upload failed for "${relativePath}": ${err.message || err}`);
        results.push({ success: false, filename: relativePath, message: String(err) });
      }
    }
  }

  const workers = [];
  const limit = Math.max(1, Math.min(concurrency, toUpload.length));
  for (let i = 0; i < limit; i++) workers.push(worker());
  await Promise.all(workers);

  // Refresh list and storage once at the end using optimized request tracking
  requestRefresh(true); // Force refresh after successful uploads

  // Leave progress visible briefly, then clear and bring back FAB
  setTimeout(() => {
    clearAll();
    hidePanel();
    showFab();
  }, UPLOAD_PROGRESS_AUTO_HIDE_MS);
}
