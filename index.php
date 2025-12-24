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

    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="container">
    <div class="header-row">
        <div>
            <h1>NanoCloud</h1>
            <p class="subtitle">
                A minimal, fast, self-hosted cloud server.
                Click on file to stream/download.
            </p>
            <div id="globalMessages" class="messages"></div>
        </div>
        <div class="storage-card">
            <div class="storage-title">Server Storage</div>
            <div class="storage-text" id="storageText">Used — of —</div>
            <div class="storage-bar-wrap">
                <div class="storage-bar bar-green" id="storageBar"></div>
            </div>
        </div>
    </div>

    <div class="upload-section" style="display:none;">
        <!-- kept for backward-compat but hidden; uploads now via modal -->
        <div class="upload-controls">
            <input type="file" id="fileInput" multiple>
        </div>
        <div class="drop-area" id="dropArea">
            Drag and drop files here to upload
        </div>
        <div class="messages" id="messages"></div>
        <div class="upload-progress-list" id="uploadProgressList"></div>
    </div>

    <!-- Upload Modal shown when FAB is pressed -->
    <div id="uploadModal" class="modal hidden" aria-hidden="true">
        <div class="card">
            <div class="modal-header">
                <strong>Upload Files</strong>
                <button class="btn btn-secondary" id="modalClose">Close</button>
            </div>
            <div class="server-info" id="serverLimitText">Loading server limits…</div>
            <div id="modalMessages" class="messages"></div>
            <div style="margin-bottom:10px;">
                <input type="file" id="modalFileInput" multiple style="width:100%">
            </div>
            <div class="drop-area" id="modalDropArea">Drag & drop files here</div>
        </div>
    </div>

    <div class="file-list-section">
        <div class="file-list-header">
            <div class="breadcrumbs" id="breadcrumbs"></div>
            <div class="file-list-controls">
                <button class="btn btn-secondary" id="upBtn">Up</button>
                <button class="btn" id="newFolderBtn">New Folder</button>
                <button class="btn" id="refreshBtn">
                    <span class="refresh-label">Refresh</span>
                    <span class="refresh-spinner hidden" aria-hidden="true">⏳</span>
                </button>
            </div>
        </div>
        <div id="listLoading" class="list-loading hidden">Loading items...</div>
        <ul class="file-list" id="fileList">
            <!-- Filled by JS -->
        </ul>
        <div class="empty-state" id="emptyState" style="display:none;">
            This folder is empty.
        </div>
    </div>
</div>

<!-- Floating upload action -->
<button id="fabUpload" class="fab" title="Upload files">+</button>

<script type="module" src="assets/js/main.js"></script>
</body>
</html>
