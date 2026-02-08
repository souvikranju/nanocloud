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
import { getCurrentPath, hasExistingName, setServerConfig, getServerConfig, isOperationAllowed } from './state.js';
import { updateSelectionButtonStates } from './ui/list.js';
import { parentPath, sanitizeSegment, formatBytes, extractFilesFromDataTransfer, extractFilesFromFileList } from './utils.js';
import { initProgress, showFab } from './ui/progress.js';
import { initList, fetchAndRenderList } from './ui/list.js';
import { initToast, showSuccess, showError, showInfo } from './ui/toast.js';
import { requestRefresh as stateRequestRefresh, setCurrentPathWithRefresh } from './state.js';
import { info as apiInfo, createDir as apiCreateDir } from './nanocloudClient.js';
import { uploadFiles } from './uploader.js';
import { updateChecker } from './updateChecker.js';
import { isSearchActive } from './ui/filterSort.js';


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

  // Search modal
  searchTriggerBtn: document.getElementById('searchTriggerBtn'),
  searchModal: document.getElementById('searchModal'),
  searchModalClose: document.getElementById('searchModalClose'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  deepSearchCheckbox: document.getElementById('deepSearchCheckbox'),

  // View Options modal
  viewOptionsTriggerBtn: document.getElementById('viewOptionsTriggerBtn'),
  viewOptionsModal: document.getElementById('viewOptionsModal'),
  viewOptionsModalClose: document.getElementById('viewOptionsModalClose'),
};

// =====================================
// MODULE INITIALIZATION
// =====================================
function initializeModules() {
  // Initialize toast notification system
  initToast({
    toastContainer: DOM.toastContainer,
  });
  
  // Expose toast functions globally for filterSort module
  window.showError = showError;
  window.showInfo = showInfo;
  window.showSuccess = showSuccess;


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
  // Check if search is active
  if (isSearchActive()) {
    showError('Cannot upload files while search is active. Clear search first.');
    return;
  }
  
  // Check if uploads are allowed
  const check = isOperationAllowed('upload');
  if (!check.allowed) {
    showError(check.reason);
    return;
  }
  
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

  // Create hidden file input dynamically
  const hiddenFileInput = document.createElement('input');
  hiddenFileInput.type = 'file';
  hiddenFileInput.multiple = true;
  hiddenFileInput.webkitdirectory = true;
  hiddenFileInput.style.display = 'none';
  document.body.appendChild(hiddenFileInput);
  
  // Handle file selection
  hiddenFileInput.addEventListener('change', () => {
    const files = hiddenFileInput.files;
    if (files && files.length > 0) {
      hideModal();
      const fileItems = extractFilesFromFileList(files);
      uploadFiles(fileItems);
      // Clear the file input so the same file can be selected again
      hiddenFileInput.value = '';
    }
  });

  // Make drop area clickable to trigger file input
  if (DOM.modalDropArea) {
    DOM.modalDropArea.addEventListener('click', () => {
      hiddenFileInput.click();
    });
  }

  // Info modal handlers
  setupInfoModalHandlers();
  
  // Search modal handlers
  setupSearchModalHandlers();
  
  // View Options modal handlers
  setupViewOptionsModalHandlers();
}

// =====================================
// EVENT HANDLERS - SEARCH MODAL
// =====================================
function showSearchModal() {
  if (DOM.searchModal) {
    DOM.searchModal.classList.remove(MODAL_HIDDEN_CLASS);
    DOM.searchModal.setAttribute(MODAL_ARIA_HIDDEN, 'false');
    // Focus the search input
    if (DOM.searchInput) {
      setTimeout(() => DOM.searchInput.focus(), 100);
    }
  }
}

function hideSearchModal() {
  if (DOM.searchModal) {
    DOM.searchModal.classList.add(MODAL_HIDDEN_CLASS);
    DOM.searchModal.setAttribute(MODAL_ARIA_HIDDEN, 'true');
  }
}

// Expose hideSearchModal globally for filterSort module
window.hideSearchModal = hideSearchModal;

function setupSearchModalHandlers() {
  // Search trigger button
  if (DOM.searchTriggerBtn) {
    DOM.searchTriggerBtn.addEventListener('click', showSearchModal);
  }

  // Search modal close button
  if (DOM.searchModalClose) {
    DOM.searchModalClose.addEventListener('click', hideSearchModal);
  }

  // Close search modal when clicking outside
  if (DOM.searchModal) {
    DOM.searchModal.addEventListener('click', (e) => {
      if (e.target === DOM.searchModal) {
        hideSearchModal();
      }
    });
  }
}

// =====================================
// EVENT HANDLERS - VIEW OPTIONS MODAL
// =====================================
function showViewOptionsModal() {
  if (DOM.viewOptionsModal) {
    DOM.viewOptionsModal.classList.remove(MODAL_HIDDEN_CLASS);
    DOM.viewOptionsModal.setAttribute(MODAL_ARIA_HIDDEN, 'false');
  }
}

function hideViewOptionsModal() {
  if (DOM.viewOptionsModal) {
    DOM.viewOptionsModal.classList.add(MODAL_HIDDEN_CLASS);
    DOM.viewOptionsModal.setAttribute(MODAL_ARIA_HIDDEN, 'true');
  }
}

function setupViewOptionsModalHandlers() {
  // View Options trigger button
  if (DOM.viewOptionsTriggerBtn) {
    DOM.viewOptionsTriggerBtn.addEventListener('click', showViewOptionsModal);
  }

  // View Options modal close button
  if (DOM.viewOptionsModalClose) {
    DOM.viewOptionsModalClose.addEventListener('click', hideViewOptionsModal);
  }

  // Close view options modal when clicking outside
  if (DOM.viewOptionsModal) {
    DOM.viewOptionsModal.addEventListener('click', (e) => {
      if (e.target === DOM.viewOptionsModal) {
        hideViewOptionsModal();
      }
    });
  }
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
  // Info button -> open info modal and initialize update checker
  if (DOM.infoBtn) {
    DOM.infoBtn.addEventListener('click', async () => {
      showInfoModal();
      // Initialize update checker only when modal is opened
      await initializeUpdateChecker();
    });
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

async function handleFileDrop(event) {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;
  
  // Try to use DataTransferItem API for folder support
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    hideModal();
    try {
      const fileItems = await extractFilesFromDataTransfer(dataTransfer.items);
      if (fileItems.length > 0) {
        uploadFiles(fileItems);
      }
      // Note: Empty folders are not exposed by browser File API
      // No notification needed as browser won't even trigger drop for empty folders
    } catch (err) {
      console.error('Error extracting files from drop:', err);
      // Fallback to simple file list
      const files = dataTransfer.files;
      if (files && files.length > 0) {
        const fileItems = extractFilesFromFileList(files);
        uploadFiles(fileItems);
      }
    }
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    // Fallback for browsers without DataTransferItem support
    hideModal();
    const fileItems = extractFilesFromFileList(dataTransfer.files);
    uploadFiles(fileItems);
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
  // Check if search is active
  if (isSearchActive()) {
    showError('Cannot create folders while search is active. Clear search first.');
    return;
  }
  
  // Check if uploads are allowed (creating folders is an upload operation)
  const check = isOperationAllowed('upload');
  if (!check.allowed) {
    showError(check.reason);
    return;
  }

  // Close the upload modal if it's open
  hideModal();

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

// Track if update checker has been initialized
let updateCheckerInitialized = false;

async function initializeUpdateChecker() {
  // Only initialize once
  if (updateCheckerInitialized) {
    return;
  }
  
  updateCheckerInitialized = true;
  
  try {
    // Initialize update checker
    await updateChecker.init();
    
    // Update version display in info modal
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay && updateChecker.currentVersion) {
      versionDisplay.textContent = updateChecker.currentVersion;
    }
    
    // Render update UI in info modal
    const updateContainer = document.getElementById('updateSectionContainer');
    if (updateContainer) {
      updateChecker.renderUpdateUI(updateContainer);
    }
  } catch (error) {
    console.warn('Failed to initialize update checker:', error);
    // Don't fail the app if update checker fails
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay) {
      versionDisplay.textContent = 'v2.0';
    }
  }
}

async function fetchServerInfo() {
  try {
    const data = await apiInfo();
    if (data && data.success) {
      // Store all server configuration in one place
      setServerConfig({
        readOnly: data.readOnly ?? false,
        uploadEnabled: data.uploadEnabled ?? true,
        deleteEnabled: data.deleteEnabled ?? true,
        renameEnabled: data.renameEnabled ?? true,
        moveEnabled: data.moveEnabled ?? true,
      });
      
      // Update UI based on configuration
      updateUIForConfiguration();
    }
  } catch (error) {
    // Ignore errors to keep client behavior safe
    console.warn('Failed to fetch server info:', error);
  }
}

/**
 * Update UI controls based on server configuration.
 */
function updateUIForConfiguration() {
  const config = getServerConfig();
  
  // Determine the tooltip message for disabled controls
  const getTooltip = (operation) => {
    if (config.readOnly) {
      return 'System is read-only';
    }
    const check = isOperationAllowed(operation);
    return check.allowed ? '' : check.reason;
  };
  
  // Upload controls (FAB, new folder button, modal, drag-drop)
  const uploadAllowed = isOperationAllowed('upload').allowed;
  
  if (DOM.fabUpload) {
    DOM.fabUpload.disabled = !uploadAllowed;
    DOM.fabUpload.title = uploadAllowed ? 'Upload files' : getTooltip('upload');
    if (!uploadAllowed) {
      DOM.fabUpload.style.opacity = '0.5';
      DOM.fabUpload.style.cursor = 'not-allowed';
    } else {
      DOM.fabUpload.style.opacity = '';
      DOM.fabUpload.style.cursor = '';
    }
  }
  
  if (DOM.newFolderBtn) {
    DOM.newFolderBtn.disabled = !uploadAllowed;
    DOM.newFolderBtn.title = uploadAllowed ? 'Create new folder' : getTooltip('upload');
    if (!uploadAllowed) {
      DOM.newFolderBtn.style.opacity = '0.5';
      DOM.newFolderBtn.style.cursor = 'not-allowed';
    } else {
      DOM.newFolderBtn.style.opacity = '';
      DOM.newFolderBtn.style.cursor = '';
    }
  }
  
  // Disable drag-drop if uploads not allowed
  if (!uploadAllowed) {
    document.body.classList.add('uploads-disabled');
  } else {
    document.body.classList.remove('uploads-disabled');
  }
  
  // Update selection bar button states
  updateSelectionButtonStates();
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
  
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove('drag-active');
    
    // Check if search is active
    if (isSearchActive()) {
      showError('Cannot upload files while search is active. Clear search first.');
      return;
    }
    
    // Check if uploads are allowed before processing
    const check = isOperationAllowed('upload');
    if (!check.allowed) {
      showError(check.reason);
      return;
    }
    
    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;
    
    // Try to use DataTransferItem API for folder support
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      try {
        const fileItems = await extractFilesFromDataTransfer(dataTransfer.items);
        if (fileItems.length > 0) {
          uploadFiles(fileItems);
        }
      } catch (err) {
        console.error('Error extracting files from drop:', err);
        // Fallback to simple file list
        const files = dataTransfer.files;
        if (files && files.length > 0) {
          const fileItems = extractFilesFromFileList(files);
          uploadFiles(fileItems);
        }
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      // Fallback for browsers without DataTransferItem support
      const fileItems = extractFilesFromFileList(dataTransfer.files);
      uploadFiles(fileItems);
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
      hideSearchModal();
      hideViewOptionsModal();
    }
  });

  // Handle browser back/forward and hash navigation
  window.addEventListener('popstate', () => {
    handleHashNavigation();
  });
  
  window.addEventListener('hashchange', () => {
    handleHashNavigation();
  });

  // Handle visibility change (pause/resume operations when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Refresh when tab becomes visible again
      stateRequestRefresh();
    }
  });
  
  // Setup breadcrumb click handler for deep search results
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('breadcrumb-link')) {
      e.stopPropagation();
      const path = e.target.dataset.path;
      const url = `${window.location.origin}${window.location.pathname}#path=${encodeURIComponent(path)}`;
      window.open(url, '_blank');
    }
  });
}

/**
 * Handle hash-based navigation for opening folders via URL
 */
function handleHashNavigation() {
  const hash = window.location.hash;
  if (hash.startsWith('#path=')) {
    const path = decodeURIComponent(hash.substring(6));
    setCurrentPathWithRefresh(path);
  }
}

// =====================================
// SINGLE ENTRY POINT
// =====================================
// Start the application
initializeApp().then(() => {
  // Check for hash navigation on initial load
  handleHashNavigation();
}).catch(error => {
  console.error('Application failed to start:', error);
});
