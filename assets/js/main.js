// main.js
// Frontend entrypoint (ES module).
// Wires DOM events, initializes UI modules, fetches server info and listings,
// and delegates uploads to the uploader orchestrator.

import { getCurrentPath, setMaxFileBytes, hasExistingName } from './state.js';
import { parentPath, sanitizeSegment, formatBytes } from './utils.js';
import { initMessages, notifyUser, clearModalMessages } from './ui/messages.js';
import { initProgress, showFab } from './ui/progress.js';
import { initList, fetchAndRenderList } from './ui/list.js';
import { requestRefresh as stateRequestRefresh, setCurrentPathWithRefresh } from './state.js';
import { info as apiInfo, createDir as apiCreateDir } from './nanocloudClient.js';
import { uploadFiles } from './uploader.js';

// =====================================
// CONFIGURATION & CONSTANTS
// =====================================
const CONFIG = {
  DRAG_HOVER_CLASS: 'dragover',
  MODAL_HIDDEN_CLASS: 'hidden',
  MODAL_ARIA_HIDDEN: 'aria-hidden'
};

// =====================================
// DOM REFERENCES (grouped by concern)
// =====================================
const DOM = {
  // Modal & FAB elements
  fabUpload: document.getElementById('fabUpload'),
  uploadModal: document.getElementById('uploadModal'),
  modalClose: document.getElementById('modalClose'),
  modalFileInput: document.getElementById('modalFileInput'),
  modalDropArea: document.getElementById('modalDropArea'),
  serverLimitText: document.getElementById('serverLimitText'),

  // Progress tracking
  uploadSection: document.querySelector('.upload-section'),
  uploadProgressList: document.getElementById('uploadProgressList'),

  // Message containers
  globalMessages: document.getElementById('globalMessages'),
  modalMessages: document.getElementById('modalMessages'),

  // File list & navigation
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

// =====================================
// MODULE INITIALIZATION
// =====================================
function initializeModules() {
  // Initialize message system
  initMessages({
    globalMessagesEl: DOM.globalMessages,
    modalMessagesEl: DOM.modalMessages,
    uploadModal: DOM.uploadModal,
  });

  // Initialize progress tracking
  initProgress({
    uploadSection: DOM.uploadSection,
    uploadProgressList: DOM.uploadProgressList,
    fabBtn: DOM.fabUpload,
    uploadModal: DOM.uploadModal,
  });

  // Initialize file list UI
  initList({
    fileListEl: DOM.fileList,
    emptyStateEl: DOM.emptyState,
    breadcrumbsEl: DOM.breadcrumbs,
    refreshBtn: DOM.refreshBtn,
    storageTextEl: DOM.storageText,
    storageBarEl: DOM.storageBar,
    listLoadingEl: DOM.listLoading,
    upBtn: DOM.upBtn,
  });
}

// =====================================
// EVENT HANDLERS - MODAL MANAGEMENT
// =====================================
function showModal() {
  DOM.uploadModal.classList.remove(CONFIG.MODAL_HIDDEN_CLASS);
  DOM.uploadModal.setAttribute(CONFIG.MODAL_ARIA_HIDDEN, 'false');
}

function hideModal() {
  DOM.uploadModal.classList.add(CONFIG.MODAL_HIDDEN_CLASS);
  DOM.uploadModal.setAttribute(CONFIG.MODAL_ARIA_HIDDEN, 'true');
  clearModalMessages();
}

function setupModalEventHandlers() {
  // FAB -> open modal
  if (DOM.fabUpload) {
    DOM.fabUpload.addEventListener('click', showModal);
  }

  // Modal close button
  if (DOM.modalClose) {
    DOM.modalClose.addEventListener('click', hideModal);
  }

  // Modal file input
  if (DOM.modalFileInput) {
    DOM.modalFileInput.addEventListener('change', () => {
      const files = DOM.modalFileInput.files;
      if (files && files.length > 0) {
        uploadFiles(files);
        // Clear the file input so the same file can be selected again
        DOM.modalFileInput.value = '';
      }
    });
  }
}

// =====================================
// EVENT HANDLERS - DRAG & DROP
// =====================================
function setupDragDropHandlers() {
  setupDropArea(DOM.modalDropArea);
}

function setupDropArea(element) {
  if (!element) return;

  // Handle drag enter/over
  ['dragenter', 'dragover'].forEach(eventName => {
    element.addEventListener(eventName, handleDragEnterOver, false);
  });

  // Handle drag leave/drop
  ['dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, handleDragLeaveDrop, false);
  });

  // Handle file drop
  element.addEventListener('drop', handleFileDrop, false);
}

function handleDragEnterOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add(CONFIG.DRAG_HOVER_CLASS);
}

function handleDragLeaveDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove(CONFIG.DRAG_HOVER_CLASS);
}

function handleFileDrop(event) {
  const dataTransfer = event.dataTransfer;
  const files = dataTransfer && dataTransfer.files;
  if (files && files.length > 0) {
    uploadFiles(files);
  }
}

// =====================================
// EVENT HANDLERS - NAVIGATION
// =====================================
function setupNavigationEventHandlers() {
  // Up button
  if (DOM.upBtn) {
    DOM.upBtn.addEventListener('click', handleNavigationUp);
  }

  // New folder button
  if (DOM.newFolderBtn) {
    DOM.newFolderBtn.addEventListener('click', handleCreateFolder);
  }

  // Refresh button
  if (DOM.refreshBtn) {
    DOM.refreshBtn.addEventListener('click', () => {
      stateRequestRefresh(true); // Force refresh with debouncing
    });
  }
}

function handleNavigationUp() {
  if (getCurrentPath() === '') return;
  setCurrentPathWithRefresh(parentPath(getCurrentPath())); // Use optimized state change with auto-refresh
}

async function handleCreateFolder() {
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
    // Don't call fetchAndRenderList directly - let state management handle it
    stateRequestRefresh(true); // Force refresh after successful operation
  } catch (err) {
    notifyUser(`Error creating folder: ${err.message || err}`, 'error');
  }
}

// =====================================
// APPLICATION BOOTSTRAP
// =====================================
async function initializeApp() {
  try {
    // Initialize all UI modules
    initializeModules();

    // Setup all event handlers
    setupModalEventHandlers();
    setupDragDropHandlers();
    setupNavigationEventHandlers();

    // Fetch server information
    await fetchServerInfo();

    // Load initial file listing
    await fetchAndRenderList();

    // Ensure FAB is visible on first load
    showFab();

  } catch (error) {
    console.error('Failed to initialize app:', error);
    notifyUser('Failed to initialize application', 'error');
  }
}

async function fetchServerInfo() {
  try {
    const data = await apiInfo();
    if (data && data.success) {
      setMaxFileBytes(data.maxFileBytes ?? null);
      if (DOM.serverLimitText) {
        const maxSize = (data.maxFileBytes != null) ? formatBytes(data.maxFileBytes) : 'unknown';
        DOM.serverLimitText.textContent = `Server limit: ${maxSize}`;
      }
    }
  } catch (error) {
    // Ignore errors to keep client behavior safe
    console.warn('Failed to fetch server info:', error);
  }
}

// =====================================
// SINGLE ENTRY POINT
// =====================================
// Start the application
initializeApp().catch(error => {
  console.error('Application failed to start:', error);
});
