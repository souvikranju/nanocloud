// uploader.js
// High-level upload orchestrator focusing on readability and low nesting.
// Validates files, shows a progress panel, uploads with limited concurrency,
// updates UI on completion, and refreshes the listing.

import { getCurrentPath, getMaxFileBytes, hasExistingName, markExistingName } from './state.js';
import { sanitizeFilename, formatBytes } from './utils.js';
import { notifyUser } from './ui/messages.js';
import { showPanel, hidePanel, hideModal, hideFab, showFab, clearAll, createItem } from './ui/progress.js';
import { uploadSingle } from './nanocloudClient.js';
import { fetchAndRenderList } from './ui/list.js';

/**
 * Validate files against size limits and duplicates.
 * Returns array of { file: File, sanitized: string } to upload.
 * @param {File[]} files
 * @returns {Array<{file: File, sanitized: string}>}
 */
function validateFiles(files) {
  const maxBytes = getMaxFileBytes();
  const selected = [];
  for (const file of files) {
    const sanitized = sanitizeFilename(file.name);
    // Server limit (if known)
    if (maxBytes != null && file.size > maxBytes) {
      notifyUser(`Skipped "${file.name}": exceeds server limit of ${formatBytes(maxBytes)}.`, 'error');
      continue;
    }
    // Client-side duplicate check in current directory
    if (hasExistingName(sanitized)) {
      notifyUser(`Skipped "${file.name}": a file or folder with the same name already exists.`, 'error');
      continue;
    }
    selected.push({ file, sanitized });
  }
  return selected;
}

/**
 * Upload files with progress and concurrency limiting.
 * This function aims to be flat and readable, avoiding deep nesting.
 * @param {FileList|File[]} fileList
 * @param {number} [concurrency=3] how many uploads to run in parallel
 */
export async function uploadFiles(fileList, concurrency = 3) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  const toUpload = validateFiles(files);
  if (toUpload.length === 0) return;

  // Prepare UI: show progress panel, hide modal and FAB while running
  showPanel();
  hideModal();
  hideFab();

  // Create per-file UI entries
  const uiMap = new Map();
  for (const { file, sanitized } of toUpload) {
    uiMap.set(sanitized, createItem(file.name, sanitized));
  }

  // Simple worker-pool to limit concurrency
  let index = 0;
  const results = [];

  async function worker() {
    while (index < toUpload.length) {
      const current = index++;
      const { file, sanitized } = toUpload[current];
      const ui = uiMap.get(sanitized);

      try {
        const res = await uploadSingle(file, getCurrentPath(), pct => ui.setProgress(pct));
        if (res && res.success) {
          ui.markComplete();
          markExistingName(res.filename);
        } else {
          ui.markError();
          const fname = res && res.filename ? res.filename : file.name;
          const msg = res && res.message ? res.message : 'Upload error';
          notifyUser(`Failed "${fname}": ${msg}`, 'error');
        }
        results.push(res);
      } catch (err) {
        ui.markError();
        notifyUser(`Upload failed for "${file.name}": ${err.message || err}`, 'error');
        results.push({ success: false, filename: file.name, message: String(err) });
      }
    }
  }

  const workers = [];
  const limit = Math.max(1, Math.min(concurrency, toUpload.length));
  for (let i = 0; i < limit; i++) workers.push(worker());
  await Promise.all(workers);

  // Refresh list and storage once at the end
  await fetchAndRenderList();

  // Leave progress visible briefly, then clear and bring back FAB
  setTimeout(() => {
    clearAll();
    hidePanel();
    showFab();
  }, 5000);
}
