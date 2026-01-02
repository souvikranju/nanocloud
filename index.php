<?php
// index.php
// Main HTML page. Adds directory support, breadcrumb navigation,
// create/delete directory, go up one level, storage meter, and nested downloads.
// Assumes nanocloud_api.php and nanocloud_download.php are in the same directory.

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>NanoCloud</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/x-icon" href="assets/image/favicon.ico">
    <!-- Modular CSS Architecture -->
    <link rel="stylesheet" href="assets/css/variables.css">
    <link rel="stylesheet" href="assets/css/base.css">
    <link rel="stylesheet" href="assets/css/layout.css">
    <link rel="stylesheet" href="assets/css/components.css">
    <link rel="stylesheet" href="assets/css/utilities.css">
    <link rel="stylesheet" href="assets/css/responsive.css">
</head>
<body>
    <!-- Header Section -->
    <header class="header-section">
        <div class="container">
            <div class="header-content">
                <div class="header-info">
                    <div class="header-title-row">
                        <img src="assets/image/logo.png" alt="NanoCloud Logo" class="header-logo">
                        <h1>NanoCloud</h1>
                        <button class="info-btn" id="infoBtn" title="User Guide & Info">ℹ</button>
                    </div>
                    <p class="subtitle">
                        A minimal, fast, self-hosted cloud server.
                        Click on files to stream or download.
                    </p>
                </div>
                <div class="storage-card">
                    <div class="storage-title">Storage</div>
                    <div class="storage-text" id="storageText">Used — of —</div>
                    <div class="storage-bar-wrap">
                        <div class="storage-bar bar-green" id="storageBar"></div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <div class="container">
        <!-- Global Messages -->
        <div id="globalMessages" class="messages"></div>

        <!-- Main Content -->
        <main class="main-content">
            <!-- File List Header -->
            <div class="file-list-header">
                <div class="breadcrumbs" id="breadcrumbs"></div>
                <div class="file-list-controls">
                    <!-- View Toggle -->
                    <div class="view-toggle">
                        <button class="view-toggle-btn" id="gridViewBtn" title="Grid View">
                            <span>⊞</span>
                        </button>
                        <button class="view-toggle-btn active" id="listViewBtn" title="List View">
                            <span>☰</span>
                        </button>
                    </div>
                    
                    <!-- Action Buttons -->
                    <button class="btn btn-secondary" id="upBtn" title="Go Up">
                        <span>↑</span> Up
                    </button>
                    <button class="btn btn-primary" id="newFolderBtn" title="Create New Folder">
                        <span>+</span> New Folder
                    </button>
                    <button class="btn btn-secondary" id="refreshBtn" title="Refresh">
                        <span class="refresh-label">↻ Refresh</span>
                        <span class="refresh-spinner hidden" aria-hidden="true">
                            <div class="loading-spinner"></div>
                        </span>
                    </button>
                </div>
            </div>

            <!-- File List Container -->
            <div class="file-list-container">
                <!-- Loading State -->
                <div id="listLoading" class="list-loading hidden">
                    <div class="loading-spinner"></div>
                    Loading items...
                </div>

                <!-- File Grid/List -->
                <ul class="file-grid" id="fileList">
                    <!-- Filled by JS -->
                </ul>

                <!-- Empty State -->
                <div class="empty-state" id="emptyState" style="display:none;">
                    <div class="empty-state-icon">📁</div>
                    <div class="empty-state-title">This folder is empty</div>
                    <div class="empty-state-description">
                        Upload files using the button below or drag and drop files anywhere on this page.
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Selection Bar (Hidden by default) -->
    <div class="selection-bar" id="selectionBar">
        <div class="selection-info" id="selectionInfo">
            0 items selected
        </div>
        <div class="selection-actions">
            <button class="btn" id="selectAllBtn">Select All</button>
            <button class="btn" id="deselectAllBtn">Deselect All</button>
            <button class="btn" id="renameSelectedBtn">Rename</button>
            <button class="btn" id="moveSelectedBtn">Move</button>
            <button class="btn btn-danger" id="deleteSelectedBtn">Delete</button>
        </div>
    </div>

    <!-- Upload Progress Section -->
    <div class="upload-section" id="uploadSection">
        <div class="upload-header">
            <div class="upload-title">Uploading Files</div>
            <button class="btn-icon" id="closeUploadBtn" title="Close">×</button>
        </div>
        <div class="upload-progress-list" id="uploadProgressList">
            <!-- Upload progress items will be added here -->
        </div>
    </div>

    <!-- Upload Modal -->
    <div id="uploadModal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Upload Files</h2>
                <button class="btn btn-secondary" id="modalClose">Close</button>
            </div>
            <div class="modal-body">
                <div class="server-info" id="serverLimitText">Loading server limits…</div>
                <div id="modalMessages" class="messages"></div>
                
                <div class="file-input-wrapper">
                    <input type="file" id="modalFileInput" class="file-input" multiple>
                </div>
                
                <div class="drop-area" id="modalDropArea">
                    <div class="drop-area-icon">📁</div>
                    <div class="drop-area-text">Drag & drop files here</div>
                    <div class="drop-area-subtext">or click to browse files</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Move Modal -->
    <div id="moveModal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Move Items</h2>
                <button class="btn btn-secondary" id="moveModalClose">Close</button>
            </div>
            <div class="modal-body">
                <div id="moveModalMessages" class="messages"></div>
                <p>Select destination folder:</p>
                <div class="folder-tree" id="folderTree">
                    <!-- Folder tree will be populated by JS -->
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="moveCancelBtn">Cancel</button>
                <button class="btn btn-primary" id="moveConfirmBtn">Move Here</button>
            </div>
        </div>
    </div>

    <!-- Rename Modal -->
    <div id="renameModal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Rename Item</h2>
                <button class="btn btn-secondary" id="renameModalClose">Close</button>
            </div>
            <div class="modal-body">
                <div id="renameModalMessages" class="messages"></div>
                <div class="file-input-wrapper">
                    <label for="renameInput">New name:</label>
                    <input type="text" id="renameInput" class="file-input" placeholder="Enter new name">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="renameCancelBtn">Cancel</button>
                <button class="btn btn-primary" id="renameConfirmBtn">Rename</button>
            </div>
        </div>
    </div>

    <!-- Info Modal -->
    <div id="infoModal" class="modal hidden" aria-hidden="true">
        <div class="modal-content info-modal-content">
            <div class="modal-header">
                <h2 class="modal-title">ℹ Info and Guide</h2>
                <button class="btn btn-secondary" id="infoModalClose">Close</button>
            </div>
            <div class="modal-body info-modal-body">
                <!-- Update Section (will be populated by updateChecker.js) -->
                <div id="updateSectionContainer"></div>

                <!-- Keyboard Shortcuts Section -->
                <div class="info-section">
                    <h3 class="info-section-title">⌨️ Keyboard Shortcuts</h3>
                    <div class="shortcuts-grid">
                        <div class="shortcut-item">
                            <span class="shortcut-key">Ctrl/Cmd + U</span>
                            <span class="shortcut-desc">Open upload modal</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">Ctrl/Cmd + A</span>
                            <span class="shortcut-desc">Select all items</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">F5 / Ctrl+R</span>
                            <span class="shortcut-desc">Refresh listing</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">Delete / Backspace</span>
                            <span class="shortcut-desc">Delete selected items</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">F2</span>
                            <span class="shortcut-desc">Rename selected item</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">Escape</span>
                            <span class="shortcut-desc">Deselect all items</span>
                        </div>
                    </div>
                </div>

                <!-- Touchscreen Guide Section -->
                <div class="info-section">
                    <h3 class="info-section-title">📱 Touchscreen Guide</h3>
                    <div class="shortcuts-grid">
                        <div class="shortcut-item">
                            <span class="shortcut-key">Tap</span>
                            <span class="shortcut-desc">Open file or folder</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">Press & Hold (500ms)</span>
                            <span class="shortcut-desc">Select item (haptic feedback)</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">Tap after selection</span>
                            <span class="shortcut-desc">Add more items to selection</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-key">Drag & Drop</span>
                            <span class="shortcut-desc">Upload files anywhere</span>
                        </div>
                    </div>
                </div>

                <!-- GitHub Project Section -->
                <div class="info-section">
                    <h3 class="info-section-title">🔗 GitHub Project</h3>
                    <a href="https://github.com/souvikranju/nanocloud" target="_blank" rel="noopener noreferrer" class="github-link">
                        <span class="github-icon">⚡</span>
                        <span>View on GitHub</span>
                        <span class="external-icon">→</span>
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- Floating Action Button -->
    <button id="fabUpload" class="fab" title="Upload files">+</button>

    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer">
        <!-- Toast notifications will be added here -->
    </div>

    <script type="module" src="assets/js/main.js"></script>
</body>
</html>
