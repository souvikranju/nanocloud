// Frontend JS: uses fetch + FormData and XHR for progress

const API_URL = 'nanocloud_api.php';
const DOWNLOAD_BASE = 'nanocloud_download.php';
// MAX_FILE_BYTES will be fetched from server (see GET?action=info)
let MAX_FILE_BYTES = null; // integer bytes

// Track names (files + dirs) returned by the last listing to pre-check duplicates
let existingNames = new Set();

// main hidden file input (kept for compatibility) and modal inputs
const fileInput = document.getElementById('fileInput');
const modalFileInput = document.getElementById('modalFileInput');
const modalDropArea = document.getElementById('modalDropArea');

// FAB and modal controls
const fabUpload = document.getElementById('fabUpload');
const uploadModal = document.getElementById('uploadModal');
const modalClose = document.getElementById('modalClose');
const serverLimitText = document.getElementById('serverLimitText');

fabUpload.addEventListener('click', () => {
    // open modal showing server limits and controls
    uploadModal.classList.remove('hidden');
    uploadModal.setAttribute('aria-hidden', 'false');
});
modalClose.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    uploadModal.setAttribute('aria-hidden', 'true');
    if (modalMessagesEl) modalMessagesEl.innerHTML = '';
});

// Modal file input change -> start upload
modalFileInput.addEventListener('change', () => {
    const files = modalFileInput.files;
    if (!files || files.length === 0) return;
    // attempt upload; uploadFiles will hide modal and FAB only when uploads actually start
    uploadFiles(files);
});

// modal drop area
['dragenter', 'dragover'].forEach(eventName => {
    modalDropArea.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation(); modalDropArea.classList.add('dragover');
    }, false);
});
['dragleave', 'drop'].forEach(eventName => {
    modalDropArea.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation(); modalDropArea.classList.remove('dragover');
    }, false);
});
modalDropArea.addEventListener('drop', e => {
    const dt = e.dataTransfer; const files = dt.files;
    if (files && files.length > 0) uploadFiles(files);
});
const dropArea = document.getElementById('dropArea');
// global message area (visible)
const messagesEl = document.getElementById('globalMessages');
const modalMessagesEl = document.getElementById('modalMessages');
const uploadProgressList = document.getElementById('uploadProgressList');
const fileListEl = document.getElementById('fileList');
const refreshBtn = document.getElementById('refreshBtn');
const emptyStateEl = document.getElementById('emptyState');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const upBtn = document.getElementById('upBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const uploadSection = document.querySelector('.upload-section');

const storageTextEl = document.getElementById('storageText');
const storageBarEl = document.getElementById('storageBar');

let currentPath = ''; // '' means root

function addMessage(text, type = 'info') {
    const msg = document.createElement('div');
    msg.className = 'message ' + type;
    msg.textContent = text;
    if (messagesEl) messagesEl.appendChild(msg);
    setTimeout(() => {
        if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
        }
    }, 8000);
}
function addModalMessage(text, type = 'info') {
    const msg = document.createElement('div');
    msg.className = 'message ' + type;
    msg.textContent = text;
    if (modalMessagesEl) modalMessagesEl.appendChild(msg);
    setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 8000);
}
function notifyUser(text, type = 'info') {
    // If modal is open, display modal-scoped messages, otherwise global
    if (uploadModal && !uploadModal.classList.contains('hidden')) {
        addModalMessage(text, type);
    } else {
        addMessage(text, type);
    }
}
function clearMessages() {
    messagesEl.innerHTML = '';
}

function joinPath(base, name) {
    if (!base) return name;
    return base + '/' + name;
}

function parentPath(rel) {
    if (!rel) return '';
    const parts = rel.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
}

function updateBreadcrumbs(breadcrumbs) {
    breadcrumbsEl.innerHTML = '';
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'crumb';
    rootCrumb.textContent = '/';
    rootCrumb.addEventListener('click', () => {
        currentPath = '';
        fetchFileList();
    });
    breadcrumbsEl.appendChild(rootCrumb);

    if (breadcrumbs && breadcrumbs.length > 0) {
        let accum = '';
        breadcrumbs.forEach((seg, idx) => {
            const sep = document.createElement('span');
            sep.className = 'path-sep';
            sep.textContent = ' / ';
            breadcrumbsEl.appendChild(sep);

            const crumb = document.createElement('span');
            crumb.className = 'crumb';
            crumb.textContent = seg;
            accum = joinPath(accum, seg);
            crumb.addEventListener('click', () => {
                currentPath = accum;
                fetchFileList();
            });
            breadcrumbsEl.appendChild(crumb);
        });
    }

    upBtn.disabled = currentPath === '';
}

function updateStorage(storage) {
    if (!storage) return;
    const total = storage.totalBytes ?? 0;
    const free = storage.freeBytes ?? 0;
    const used = storage.usedBytes ?? Math.max(0, total - free);
    const percent = storage.usedPercent ?? (total > 0 ? used / total * 100 : 0);

    const usedText = formatBytes(used);
    const totalText = formatBytes(total);
    storageTextEl.textContent = `Used ${usedText} of ${totalText}`;

    const pct = Math.max(0, Math.min(100, percent));
    storageBarEl.style.width = pct.toFixed(1) + '%';
    storageBarEl.classList.remove('bar-green', 'bar-orange', 'bar-red');
    if (pct < 60) {
        storageBarEl.classList.add('bar-green');
    } else if (pct < 85) {
        storageBarEl.classList.add('bar-orange');
    } else {
        storageBarEl.classList.add('bar-red');
    }
}

// List items from server (dirs + files)
async function fetchFileList() {
    setListLoading(true);
    try {
        const url = API_URL + '?action=list' + (currentPath ? '&path=' + encodeURIComponent(currentPath) : '');
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!resp.ok) throw new Error('Failed to load items (HTTP ' + resp.status + ')');
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || 'Failed to load items');
        currentPath = data.path || '';
        updateBreadcrumbs(data.breadcrumbs || []);
        updateStorage(data.storage);
        renderItems(data.items || []);
    } catch (err) {
        addMessage('Error loading items: ' + err.message, 'error');
    } finally {
        setListLoading(false);
    }
}

function renderItems(items) {
    fileListEl.innerHTML = '';
    // update existing names set for duplicate checks (files and dirs)
    existingNames = new Set((items || []).map(i => i.name));
    if (!items || items.length === 0) {
        emptyStateEl.style.display = 'block';
        return;
    }
    emptyStateEl.style.display = 'none';

    items.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'file-list-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'file-info';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'file-actions';

        if (entry.type === 'dir') {
            const link = document.createElement('span');
            link.className = 'dir-name';
            link.textContent = entry.name;
            link.addEventListener('click', () => {
                currentPath = joinPath(currentPath, entry.name);
                fetchFileList();
            });
            infoDiv.appendChild(link);

            const meta = document.createElement('div');
            meta.className = 'file-meta';
            const timeText = entry.mtime != null ? new Date(entry.mtime * 1000).toLocaleString() : '';
            const countText = entry.count != null ? `${entry.count} items` : '';
            meta.textContent = [countText, timeText].filter(Boolean).join(' • ');
            infoDiv.appendChild(meta);

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete';
            delBtn.textContent = 'Delete Folder';
            delBtn.addEventListener('click', () => {
                if (confirm(`Delete folder "${entry.name}" and all its contents?`)) {
                    deleteDir(entry.name);
                }
            });
            actionsDiv.appendChild(delBtn);
        } else {
            const link = document.createElement('a');
            link.className = 'file-name';
            const dl = DOWNLOAD_BASE + (currentPath ? ('?path=' + encodeURIComponent(currentPath) + '&file=') : ('?file=')) + encodeURIComponent(entry.name);
            link.textContent = entry.name;

            if (isOpenable(entry)) {
                // Open in browser tab for supported media types
                link.href = dl;
                link.target = '_blank';
            } else {
                // Non-supported: trigger native browser download
                link.href = dl;
                link.setAttribute('download', entry.name);
            }

            infoDiv.appendChild(link);

            const meta = document.createElement('div');
            meta.className = 'file-meta';
            const sizeText = entry.size != null ? formatBytes(entry.size) : 'Unknown size';
            const timeText = entry.mtime != null ? new Date(entry.mtime * 1000).toLocaleString() : '';
            meta.textContent = sizeText + (timeText ? ' • ' + timeText : '');
            infoDiv.appendChild(meta);

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete';
            delBtn.textContent = 'Delete';
            delBtn.addEventListener('click', () => {
                if (confirm('Delete "' + entry.name + '"?')) {
                    deleteFile(entry.name);
                }
            });
            actionsDiv.appendChild(delBtn);
        }

        li.appendChild(infoDiv);
        li.appendChild(actionsDiv);
        fileListEl.appendChild(li);
    });
}

function sanitizeFilename(name) {
    // replicate server-side sanitize_filename: basename + allowed chars [A-Za-z0-9._ -]
    if (!name) return '';
    // drop any path
    const parts = name.split(/\\|\//);
    name = parts[parts.length - 1];
    name = name.replace(/[^A-Za-z0-9._ \-]/g, '_').trim();
    if (name === '' || name === '.' || name === '..') {
        return 'file_' + Date.now();
    }
    return name;
}

function sanitizeSegment(name) {
    if (!name) return '';
    name = name.replace(/\\|\//g, '_');
    name = name.replace(/[^A-Za-z0-9._ \-]/g, '_').trim();
    if (name === '' || name === '.' || name === '..') return '';
    return name;
}

function removeProgressItem(name) {
    if (!name) return;
    const items = Array.from(uploadProgressList.children);
    for (const it of items) {
        if (it.dataset && (it.dataset.sanitized === name || it.dataset.orig === name)) {
            it.remove();
        }
    }
}

function hideFab() {
    const f = document.getElementById('fabUpload');
    if (f) f.style.display = 'none';
}

function showFab() {
    const f = document.getElementById('fabUpload');
    if (f) f.style.display = 'block';
}

function showProgressPanel() {
    if (uploadSection) uploadSection.style.display = 'block';
}

function hideProgressPanel() {
    if (uploadSection) uploadSection.style.display = 'none';
}

async function fetchServerInfo() {
    try {
        const resp = await fetch(API_URL + '?action=info');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data && data.success) {
            MAX_FILE_BYTES = data.maxFileBytes ?? null;
            if (serverLimitText) {
                const mb = MAX_FILE_BYTES ? formatBytes(MAX_FILE_BYTES) : 'unknown';
                serverLimitText.textContent = `Server limit: ${mb}`;
            }
        }
    } catch (e) {
        // ignore; keep client behavior safe
    }
}

async function deleteFile(filename) {
    try {
        const form = new FormData();
        form.append('action', 'delete');
        form.append('filename', filename);
        form.append('path', currentPath);

        const resp = await fetch(API_URL, { method: 'POST', body: form });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || 'Delete failed');
        addMessage('Deleted "' + filename + '".', 'success');
        updateStorage(data.storage);
        // remove any matching progress UI for this filename (server returns sanitized name)
        if (data.filename) removeProgressItem(data.filename);
        // Also remove by original display name
        removeProgressItem(filename);
        fetchFileList();
    } catch (err) {
        addMessage('Error deleting "' + filename + '": ' + err.message, 'error');
    }
}

async function deleteDir(dirname) {
    try {
        const form = new FormData();
        form.append('action', 'delete_dir');
        form.append('name', dirname);
        form.append('path', currentPath);

        const resp = await fetch(API_URL, { method: 'POST', body: form });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || 'Delete folder failed');
        addMessage('Deleted folder "' + dirname + '".', 'success');
        updateStorage(data.storage);
        fetchFileList();
    } catch (err) {
        addMessage('Error deleting folder "' + dirname + '": ' + err.message, 'error');
    }
}

async function createDir() {
    const name = prompt('New folder name:');
    if (name == null) return;
    const trimmed = name.trim();
    if (trimmed === '') {
        addMessage('Folder name cannot be empty.', 'error');
        return;
    }
    // Client-side duplicate check
    if (existingNames.has(trimmed) || existingNames.has(sanitizeSegment(trimmed))) {
        addMessage('Folder "' + trimmed + '" already exists.', 'error');
        return;
    }
    try {
        const form = new FormData();
        form.append('action', 'create_dir');
        form.append('name', trimmed);
        form.append('path', currentPath);

        const resp = await fetch(API_URL, { method: 'POST', body: form });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || 'Create folder failed');
        addMessage('Created folder "' + trimmed + '".', 'success');
        updateStorage(data.storage);
        fetchFileList();
    } catch (err) {
        addMessage('Error creating folder: ' + err.message, 'error');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes == null || isNaN(bytes)) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return value.toFixed(value >= 10 || i === 0 ? 0 : 1) + ' ' + sizes[i];
}

function setListLoading(isLoading) {
    const spinner = document.querySelector('.refresh-spinner');
    const listLoading = document.getElementById('listLoading');

    if (refreshBtn) {
        refreshBtn.disabled = !!isLoading;
    }
    if (spinner) {
        if (isLoading) spinner.classList.remove('hidden');
        else spinner.classList.add('hidden');
    }
    if (listLoading) {
        if (isLoading) listLoading.classList.remove('hidden');
        else listLoading.classList.add('hidden');
    }
}

function isOpenable(entry) {
    const name = (entry && entry.name ? entry.name : '').toLowerCase();
    if (name.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/)) return true;
    if (name.match(/\.(mp4|webm|ogg|mov|mkv)$/)) return true;
    if (name.match(/\.(mp3|wav|flac|aac|ogg)$/)) return true;
    return false;
}

// Drag & drop handlers
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.add('dragover');
    }, false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('dragover');
    }, false);
});
dropArea.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
        uploadFiles(files);
    }
});

// Note: uploads are started from the modal or drag/drop; no in-page upload button.

// Up, New Folder, Refresh
upBtn.addEventListener('click', () => {
    if (currentPath === '') return;
    currentPath = parentPath(currentPath);
    fetchFileList();
});
newFolderBtn.addEventListener('click', () => {
    createDir();
});
refreshBtn.addEventListener('click', () => {
    fetchFileList();
});

// Upload files with progress; uses one XHR per file for progress clarity
function uploadFiles(fileList) {
    clearMessages();
    uploadProgressList.innerHTML = '';
    const files = Array.from(fileList);
    if (files.length === 0) {
        return;
    }

    fileInput.disabled = true;

    let completedCount = 0;

    // Filter and begin uploads
    const toUpload = [];
    files.forEach(file => {
        const sanitized = sanitizeFilename(file.name);
        if (MAX_FILE_BYTES != null && file.size > MAX_FILE_BYTES) {
            notifyUser('Skipped "' + file.name + '": exceeds server limit of ' + formatBytes(MAX_FILE_BYTES) + '.', 'error');
            return;
        }
        if (existingNames.has(sanitized)) {
            notifyUser('Skipped "' + file.name + '": a file or folder with the same name already exists.', 'error');
            return;
        }
        toUpload.push({ file, sanitized });
    });

    if (toUpload.length === 0) {
        // nothing to upload after validation — allow user to try again
        fileInput.disabled = false;
        showFab();
        return;
    }

    // show progress panel and hide the fab/modal while uploads run
    showProgressPanel();
    uploadModal.classList.add('hidden');
    uploadModal.setAttribute('aria-hidden', 'true');
    hideFab();

    toUpload.forEach(({ file, sanitized }) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'upload-progress-item';
        itemEl.textContent = file.name;

        const progressWrap = document.createElement('div');
        progressWrap.className = 'progress-bar-wrap';

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressWrap.appendChild(progressBar);

        itemEl.appendChild(progressWrap);
        itemEl.dataset.orig = file.name;
        itemEl.dataset.sanitized = sanitized;
        uploadProgressList.appendChild(itemEl);

        // Use XHR to get upload progress events
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('path', currentPath);
        formData.append('files[]', file, file.name);

        xhr.open('POST', API_URL);

        xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressBar.style.width = percent + '%';
            }
        });

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                completedCount++;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data && data.results && data.results.length > 0) {
                            const res = data.results[0]; // since we send one file per XHR
                            if (res.success) {
                                addMessage('Uploaded "' + res.filename + '".', 'success');
                                // mark as existing to prevent re-upload collisions
                                existingNames.add(res.filename);
                                // remove the progress item shortly after completion
                                const el = Array.from(uploadProgressList.children).find(n => n.dataset && (n.dataset.sanitized === res.filename || n.dataset.orig === file.name));
                                if (el) {
                                    const pb = el.querySelector('.progress-bar');
                                    if (pb) pb.style.width = '100%';
                                    // keep the completed item visible; mark it completed so panel can hide later
                                    el.classList.add('completed');
                                }
                            } else {
                                addMessage('Failed "' + res.filename + '": ' + (res.message || 'Upload error'), 'error');
                            }
                            updateStorage(data.storage);
                        } else {
                            addMessage('Unexpected response for "' + file.name + '".', 'error');
                        }
                    } catch (e) {
                        addMessage('Error parsing response for "' + file.name + '".', 'error');
                    }
                } else {
                    addMessage('Upload failed for "' + file.name + '" (HTTP ' + xhr.status + ').', 'error');
                }

                if (completedCount === toUpload.length) {
                    // All uploads finished
                    fileInput.disabled = false;
                    fileInput.value = '';
                    fetchFileList(); // refresh items
                    // leave progress visible for a short duration, then clear and hide panel
                    setTimeout(() => {
                        uploadProgressList.innerHTML = '';
                        hideProgressPanel();
                        showFab();
                    }, 5000);
                }
            }
        };

        xhr.send(formData);
    });

}

// Initial load
fetchServerInfo().then(() => fetchFileList());
