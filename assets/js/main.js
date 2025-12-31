// main.js
// Modern frontend entrypoint (ES module).
// Wires DOM events, initializes UI modules, fetches server info and listings,
// and delegates uploads to the uploader orchestrator.

import { 
  DRAG_HOVER_CLASS, 
  MODAL_HIDDEN_CLASS, 
  MODAL_ARIA_HIDDEN,
  KEYBOARD_SHORTCUTS 
} from './constants.js';
import { getCurrentPath, setMaxFileBytes, hasExistingName } from './state.js';
import { parentPath, sanitizeSegment, formatBytes } from './utils.js';
import { initProgress, showFab } from './ui/progress.js';
import { initList, fetchAndRenderList } from './ui/list.js';
import { initToast, showSuccess, showError, showInfo } from './ui/toast.js';
import { requestRefresh as stateRequestRefresh, setCurrentPathWithRefresh } from './state.js';
import { info as apiInfo, createDir as apiCreateDir } from './nanocloudClient.js';
import { uploadFiles } from './uploader.js';


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
  uploadSection: document.getElementById('uploadSection'),
  uploadProgressList: document.getElementById('uploadProgressList'),
  closeUploadBtn: document.getElementById('closeUploadBtn'),

  // Message containers
  toastContainer: document.getElementById('toastContainer'),

  // File list & navigation
  fileList: document.getElementById('fileList'),
  emptyState: document.getElementById('emptyState'),
  breadcrumbs: document.getElementById('breadcrumbs'),
  refreshBtn: document.getElementById('refreshBtn'),
  listLoading: document.getElementById('listLoading'),
  upBtn: document.getElementById('upBtn'),
  newFolderBtn: document.getElementById('newFolderBtn'),

  // View controls
  gridViewBtn: document.getElementById('gridViewBtn'),
  listViewBtn: document.getElementById('listViewBtn'),

  // Selection system
  selectionBar: document.getElementById('selectionBar'),
  selectionInfo: document.getElementById('selectionInfo'),

  // Storage meter
  storageText: document.getElementById('storageText'),
  storageBar: document.getElementById('storageBar'),

  // Info modal
  infoBtn: document.getElementById('infoBtn'),
  infoModal: document.getElementById('infoModal'),
  infoModalClose: document.getElementById('infoModalClose'),
};

// =====================================
// MODULE INITIALIZATION
// =====================================
function initializeModules() {
  // Initialize toast notification system
  initToast({
    toastContainer: DOM.toastContainer,
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
  DOM.uploadModal.classList.remove(MODAL_HIDDEN_CLASS);
  DOM.uploadModal.setAttribute(MODAL_ARIA_HIDDEN, 'false');
}

function hideModal() {
  DOM.uploadModal.classList.add(MODAL_HIDDEN_CLASS);
  DOM.uploadModal.setAttribute(MODAL_ARIA_HIDDEN, 'true');
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

  // Upload section close button
  if (DOM.closeUploadBtn) {
    DOM.closeUploadBtn.addEventListener('click', () => {
      if (DOM.uploadSection) {
        DOM.uploadSection.classList.remove('visible');
      }
    });
  }

  // Modal file input
  if (DOM.modalFileInput) {
    DOM.modalFileInput.addEventListener('change', () => {
      const files = DOM.modalFileInput.files;
      if (files && files.length > 0) {
        hideModal();
        uploadFiles(files);
        // Clear the file input so the same file can be selected again
        DOM.modalFileInput.value = '';
      }
    });
  }

  // Make drop area clickable
  if (DOM.modalDropArea) {
    DOM.modalDropArea.addEventListener('click', () => {
      if (DOM.modalFileInput) {
        DOM.modalFileInput.click();
      }
    });
  }

  // Info modal handlers
  setupInfoModalHandlers();
}

// =====================================
// EVENT HANDLERS - INFO MODAL
// =====================================
function showInfoModal() {
  if (DOM.infoModal) {
    DOM.infoModal.classList.remove(MODAL_HIDDEN_CLASS);
    DOM.infoModal.setAttribute(MODAL_ARIA_HIDDEN, 'false');
  }
}

function hideInfoModal() {
  if (DOM.infoModal) {
    DOM.infoModal.classList.add(MODAL_HIDDEN_CLASS);
    DOM.infoModal.setAttribute(MODAL_ARIA_HIDDEN, 'true');
  }
}

function setupInfoModalHandlers() {
  // Info button -> open info modal
  if (DOM.infoBtn) {
    DOM.infoBtn.addEventListener('click', showInfoModal);
  }

  // Info modal close button
  if (DOM.infoModalClose) {
    DOM.infoModalClose.addEventListener('click', hideInfoModal);
  }

  // Close info modal when clicking outside
  if (DOM.infoModal) {
    DOM.infoModal.addEventListener('click', (e) => {
      if (e.target === DOM.infoModal) {
        hideInfoModal();
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
  event.currentTarget.classList.add(DRAG_HOVER_CLASS);
}

function handleDragLeaveDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove(DRAG_HOVER_CLASS);
}

function handleFileDrop(event) {
  const dataTransfer = event.dataTransfer;
  const files = dataTransfer && dataTransfer.files;
  if (files && files.length > 0) {
    hideModal();
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
    showError('Folder name cannot be empty.');
    return;
  }

  // Client-side duplicate check (raw and sanitized variants)
  const sanitized = sanitizeSegment(trimmed);
  if (hasExistingName(trimmed) || (sanitized && hasExistingName(sanitized))) {
    showError(`Folder "${trimmed}" already exists.`);
    return;
  }

  try {
    const resp = await apiCreateDir(getCurrentPath(), trimmed);
    if (!resp.success) throw new Error(resp.message || 'Create folder failed');
    showSuccess(`Created folder "${trimmed}".`);
    // Don't call fetchAndRenderList directly - let state management handle it
    stateRequestRefresh(true); // Force refresh after successful operation
  } catch (err) {
    showError(`Error creating folder: ${err.message || err}`);
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
    setupGlobalEventHandlers();

    // Fetch server information
    await fetchServerInfo();

    // Load initial file listing
    await fetchAndRenderList();

    // Ensure FAB is visible on first load
    showFab();

    // Show welcome message
    showInfo('Welcome to NanoCloud! Upload files using the + button or drag and drop.');

  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to initialize application');
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
// GLOBAL EVENT HANDLERS
// =====================================
function setupGlobalEventHandlers() {
  // Global drag and drop for the entire page
  let dragCounter = 0;
  
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      document.body.classList.add('drag-active');
    }
  });
  
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      document.body.classList.remove('drag-active');
    }
  });
  
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove('drag-active');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Upload shortcut (Ctrl/Cmd + U)
    if ((e.ctrlKey || e.metaKey) && e.key === KEYBOARD_SHORTCUTS.UPLOAD) {
      e.preventDefault();
      showModal();
    }
    
    // Refresh shortcut (F5 or Ctrl/Cmd + R)
    if (e.key === KEYBOARD_SHORTCUTS.REFRESH_ALT || ((e.ctrlKey || e.metaKey) && e.key === KEYBOARD_SHORTCUTS.REFRESH)) {
      e.preventDefault();
      stateRequestRefresh(true);
    }

    // Info modal shortcut (F1)
    if (e.key === KEYBOARD_SHORTCUTS.HELP) {
      e.preventDefault();
      showInfoModal();
    }

    // Close modals with Escape
    if (e.key === KEYBOARD_SHORTCUTS.ESCAPE) {
      hideModal();
      hideInfoModal();
    }
  });

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    // Could implement navigation history here
  });

  // Handle visibility change (pause/resume operations when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Refresh when tab becomes visible again
      stateRequestRefresh();
    }
  });
}

// =====================================
// SINGLE ENTRY POINT
// =====================================
// Start the application
initializeApp().catch(error => {
  console.error('Application failed to start:', error);
});
