// main.js
// Frontend entrypoint (ES module).
// Wires DOM events, initializes UI modules, fetches server info and listings,
// and delegates uploads to the uploader orchestrator.

import { setCurrentPath, getCurrentPath, setMaxFileBytes, existingNames, hasExistingName } from './state.js';
import { parentPath, sanitizeSegment, formatBytes } from './utils.js';
import { initMessages, notifyUser, clearModalMessages } from './ui/messages.js';
import { initProgress, showFab } from './ui/progress.js';
import { initList, fetchAndRenderList, updateStorage } from './ui/list.js';
import { info as apiInfo, createDir as apiCreateDir } from './nanocloudClient.js';
import { uploadFiles } from './uploader.js';

// DOM lookups (kept centralized to avoid scattering ids)
const dom = {
  // Modal + FAB
  fabUpload: document.getElementById('fabUpload'),
  uploadModal: document.getElementById('uploadModal'),
  modalClose: document.getElementById('modalClose'),
  modalFileInput: document.getElementById('modalFileInput'),
  modalDropArea: document.getElementById('modalDropArea'),
  serverLimitText: document.getElementById('serverLimitText'),

  // Legacy upload section + drop area (kept for backward-compat UI)
  uploadSection: document.querySelector('.upload-section'),
  dropArea: document.getElementById('dropArea'),
  uploadProgressList: document.getElementById('uploadProgressList'),

  // Global + modal messages
  globalMessages: document.getElementById('globalMessages'),
  modalMessages: document.getElementById('modalMessages'),

  // File list section
  fileList: document.getElementById('fileList'),
  emptyState: document.getElementById('emptyState'),
  breadcrumbs: document.getElementById('breadcrumbs'),
  refreshBtn: document.getElementById('refreshBtn'),
  listLoading: document.getElementById('listLoading'),
  upBtn: document.getElementById('upBtn'),
  newFolderBtn: document.getElementById('newFolderBtn'),

  // Storage meter
  storageText: document.getElementById('storageText'),
  storageBar: document.getElementById('storageBar'),
};

// Initialize message and progress modules with DOM references
initMessages({
  globalMessagesEl: dom.globalMessages,
  modalMessagesEl: dom.modalMessages,
  uploadModal: dom.uploadModal,
});

initProgress({
  uploadSection: dom.uploadSection,
  uploadProgressList: dom.uploadProgressList,
  fabBtn: dom.fabUpload,
  uploadModal: dom.uploadModal,
});

// Initialize list UI module (render + controls)
initList({
  fileListEl: dom.fileList,
  emptyStateEl: dom.emptyState,
  breadcrumbsEl: dom.breadcrumbs,
  refreshBtn: dom.refreshBtn,
  storageTextEl: dom.storageText,
  storageBarEl: dom.storageBar,
  listLoadingEl: dom.listLoading,
  upBtn: dom.upBtn,
});

// Helpers to show/hide modal
function showModal() {
  dom.uploadModal.classList.remove('hidden');
  dom.uploadModal.setAttribute('aria-hidden', 'false');
}
function hideModal() {
  dom.uploadModal.classList.add('hidden');
  dom.uploadModal.setAttribute('aria-hidden', 'true');
  clearModalMessages();
}

// Wire FAB -> open modal
if (dom.fabUpload) {
  dom.fabUpload.addEventListener('click', showModal);
}

// Wire modal close
if (dom.modalClose) {
  dom.modalClose.addEventListener('click', hideModal);
}

// Wire modal file input -> upload
if (dom.modalFileInput) {
  dom.modalFileInput.addEventListener('change', () => {
    const files = dom.modalFileInput.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  });
}

// Drag & drop helpers
function setupDropArea(el) {
  if (!el) return;
  ['dragenter', 'dragover'].forEach(eventName => {
    el.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('dragover');
    }, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    el.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('dragover');
    }, false);
  });
  el.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt && dt.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  });
}

// Wire drop areas (modal + page)
setupDropArea(dom.modalDropArea);
setupDropArea(dom.dropArea);

// Navigation: Up
if (dom.upBtn) {
  dom.upBtn.addEventListener('click', () => {
    if (getCurrentPath() === '') return;
    setCurrentPath(parentPath(getCurrentPath()));
    fetchAndRenderList();
  });
}

// Create new folder
if (dom.newFolderBtn) {
  dom.newFolderBtn.addEventListener('click', async () => {
    const name = prompt('New folder name:');
    if (name == null) return;
    const trimmed = String(name).trim();
    if (trimmed === '') {
      notifyUser('Folder name cannot be empty.', 'error');
      return;
    }
    // Client-side duplicate check (raw and sanitized variants)
    const sanitized = sanitizeSegment(trimmed);
    if (hasExistingName(trimmed) || (sanitized && hasExistingName(sanitized))) {
      notifyUser(`Folder "${trimmed}" already exists.`, 'error');
      return;
    }
    try {
      const resp = await apiCreateDir(getCurrentPath(), trimmed);
      if (!resp.success) throw new Error(resp.message || 'Create folder failed');
      notifyUser(`Created folder "${trimmed}".`, 'success');
      updateStorage(resp.storage);
      fetchAndRenderList();
    } catch (err) {
      notifyUser(`Error creating folder: ${err.message || err}`, 'error');
    }
  });
}

// Refresh listing
if (dom.refreshBtn) {
  dom.refreshBtn.addEventListener('click', () => {
    fetchAndRenderList();
  });
}

// Initial boot: fetch server limits, update UI text, then load listing
(async function boot() {
  try {
    const data = await apiInfo();
    if (data && data.success) {
      setMaxFileBytes(data.maxFileBytes ?? null);
      if (dom.serverLimitText) {
        const mb = (data.maxFileBytes != null) ? formatBytes(data.maxFileBytes) : 'unknown';
        dom.serverLimitText.textContent = `Server limit: ${mb}`;
      }
    }
  } catch {
    // ignore (keep client behavior safe)
  } finally {
    await fetchAndRenderList();
    // Ensure FAB is visible on first load
    showFab();
  }
})();
