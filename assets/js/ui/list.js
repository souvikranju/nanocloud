// ui/list.js
// Renders directory/file listings, breadcrumbs, storage meter, and wires item actions.

import { DOWNLOAD_BASE } from '../state.js';
import { joinPath, formatBytes, isOpenable } from '../utils.js';
import { list as apiList, deleteFile as apiDeleteFile, deleteDir as apiDeleteDir } from '../nanocloudClient.js';
import { setExistingNamesFromList, setCurrentPath, getCurrentPath } from '../state.js';
import { notifyUser } from './messages.js';

/** @type {HTMLElement|null} */ let fileListEl = null;
/** @type {HTMLElement|null} */ let emptyStateEl = null;
/** @type {HTMLElement|null} */ let breadcrumbsEl = null;
/** @type {HTMLElement|null} */ let refreshBtn = null;
/** @type {HTMLElement|null} */ let storageTextEl = null;
/** @type {HTMLElement|null} */ let storageBarEl = null;
/** @type {HTMLElement|null} */ let listLoadingEl = null;
/** @type {HTMLElement|null} */ let upBtn = null;

/**
 * Initialize DOM references for list UI.
 * @param {{
 *  fileListEl:HTMLElement,
 *  emptyStateEl:HTMLElement,
 *  breadcrumbsEl:HTMLElement,
 *  refreshBtn:HTMLElement,
 *  storageTextEl:HTMLElement,
 *  storageBarEl:HTMLElement,
 *  listLoadingEl:HTMLElement,
 *  upBtn:HTMLElement
 * }} refs
 */
export function initList(refs) {
  fileListEl = refs.fileListEl || null;
  emptyStateEl = refs.emptyStateEl || null;
  breadcrumbsEl = refs.breadcrumbsEl || null;
  refreshBtn = refs.refreshBtn || null;
  storageTextEl = refs.storageTextEl || null;
  storageBarEl = refs.storageBarEl || null;
  listLoadingEl = refs.listLoadingEl || null;
  upBtn = refs.upBtn || null;
}

/**
 * Toggle loading state (disables refresh, shows spinner placeholder).
 * @param {boolean} isLoading
 */
export function setListLoading(isLoading) {
  if (refreshBtn) refreshBtn.disabled = !!isLoading;
  if (listLoadingEl) {
    if (isLoading) listLoadingEl.classList.remove('hidden');
    else listLoadingEl.classList.add('hidden');
  }
}

/**
 * Update storage meter text and bar color/width.
 * @param {{totalBytes?:number,freeBytes?:number,usedBytes?:number,usedPercent?:number}|null|undefined} storage
 */
export function updateStorage(storage) {
  if (!storage || !storageTextEl || !storageBarEl) return;
  const total = storage.totalBytes ?? 0;
  const free = storage.freeBytes ?? 0;
  const used = storage.usedBytes ?? Math.max(0, total - free);
  const percent = storage.usedPercent ?? (total > 0 ? (used / total) * 100 : 0);

  storageTextEl.textContent = `Used ${formatBytes(used)} of ${formatBytes(total)}`;

  const pct = Math.max(0, Math.min(100, percent));
  storageBarEl.style.width = pct.toFixed(1) + '%';
  storageBarEl.classList.remove('bar-green', 'bar-orange', 'bar-red');
  if (pct < 60) storageBarEl.classList.add('bar-green');
  else if (pct < 85) storageBarEl.classList.add('bar-orange');
  else storageBarEl.classList.add('bar-red');
}

/**
 * Rebuild breadcrumbs and wire click navigation.
 * @param {string[]} breadcrumbs
 */
export function updateBreadcrumbs(breadcrumbs) {
  if (!breadcrumbsEl) return;
  breadcrumbsEl.innerHTML = '';

  const rootCrumb = document.createElement('span');
  rootCrumb.className = 'crumb';
  rootCrumb.textContent = '/';
  rootCrumb.addEventListener('click', () => {
    setCurrentPath('');
    fetchAndRenderList();
  });
  breadcrumbsEl.appendChild(rootCrumb);

  if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
    let accum = '';
    breadcrumbs.forEach(seg => {
      const sep = document.createElement('span');
      sep.className = 'path-sep';
      sep.textContent = ' / ';
      breadcrumbsEl.appendChild(sep);

      const crumb = document.createElement('span');
      crumb.className = 'crumb';
      crumb.textContent = seg;
      accum = joinPath(accum, seg);
      crumb.addEventListener('click', () => {
        setCurrentPath(accum);
        fetchAndRenderList();
      });
      breadcrumbsEl.appendChild(crumb);
    });
  }

  if (upBtn) upBtn.disabled = getCurrentPath() === '';
}

/**
 * Render items into the list with actions (navigate/delete/download).
 * @param {Array<{name:string,type:'file'|'dir',size?:number,mtime?:number,count?:number}>} items
 */
export function renderItems(items) {
  if (!fileListEl || !emptyStateEl) return;
  fileListEl.innerHTML = '';

  setExistingNamesFromList(items || []);

  if (!items || items.length === 0) {
    emptyStateEl.style.display = 'block';
    return;
  }
  emptyStateEl.style.display = 'none';

  for (const entry of items) {
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
        setCurrentPath(joinPath(getCurrentPath(), entry.name));
        fetchAndRenderList();
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
      delBtn.addEventListener('click', async () => {
        if (confirm(`Delete folder "${entry.name}" and all its contents?`)) {
          try {
            const resp = await apiDeleteDir(getCurrentPath(), entry.name);
            if (!resp.success) throw new Error(resp.message || 'Delete folder failed');
            notifyUser(`Deleted folder "${entry.name}".`, 'success');
            updateStorage(resp.storage);
            fetchAndRenderList();
          } catch (err) {
            notifyUser(`Error deleting folder "${entry.name}": ${err.message || err}`, 'error');
          }
        }
      });
      actionsDiv.appendChild(delBtn);
    } else {
      const link = document.createElement('a');
      link.className = 'file-name';
      const path = getCurrentPath();
      const dl = DOWNLOAD_BASE + (path ? (`?path=${encodeURIComponent(path)}&file=`) : ('?file=')) + encodeURIComponent(entry.name);
      link.textContent = entry.name;
      if (isOpenable(entry.name)) {
        link.href = dl;
        link.target = '_blank';
      } else {
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
      delBtn.addEventListener('click', async () => {
        if (confirm(`Delete "${entry.name}"?`)) {
          try {
            const resp = await apiDeleteFile(getCurrentPath(), entry.name);
            if (!resp.success) throw new Error(resp.message || 'Delete failed');
            notifyUser(`Deleted "${entry.name}".`, 'success');
            updateStorage(resp.storage);
            fetchAndRenderList();
          } catch (err) {
            notifyUser(`Error deleting "${entry.name}": ${err.message || err}`, 'error');
          }
        }
      });
      actionsDiv.appendChild(delBtn);
    }

    li.appendChild(infoDiv);
    li.appendChild(actionsDiv);
    fileListEl.appendChild(li);
  }
}

/**
 * Fetch listing from server, update UI state, and render items.
 */
export async function fetchAndRenderList() {
  setListLoading(true);
  try {
    const resp = await apiList(getCurrentPath());
    if (!resp.success) throw new Error(resp.message || 'Failed to load items');
    setCurrentPath(resp.path || '');
    updateBreadcrumbs(resp.breadcrumbs || []);
    updateStorage(resp.storage);
    renderItems(resp.items || []);
  } catch (err) {
    notifyUser(`Error loading items: ${err.message || err}`, 'error');
  } finally {
    setListLoading(false);
  }
}
