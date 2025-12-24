// ui/progress.js
// Upload progress panel management. Creates per-file progress items and exposes simple controls.

/** @type {HTMLElement|null} */
let uploadSection = null;
/** @type {HTMLElement|null} */
let uploadProgressList = null;
/** @type {HTMLElement|null} */
let fabBtn = null;
/** @type {HTMLElement|null} */
let uploadModal = null;

/**
 * Initialize the progress UI module with DOM elements.
 * @param {{uploadSection:HTMLElement, uploadProgressList:HTMLElement, fabBtn:HTMLElement, uploadModal:HTMLElement}} refs
 */
export function initProgress(refs) {
  uploadSection = refs.uploadSection || null;
  uploadProgressList = refs.uploadProgressList || null;
  fabBtn = refs.fabBtn || null;
  uploadModal = refs.uploadModal || null;
}

/** Show the floating action button (FAB). */
export function showFab() {
  if (fabBtn) fabBtn.style.display = 'block';
}
/** Hide the floating action button (FAB). */
export function hideFab() {
  if (fabBtn) fabBtn.style.display = 'none';
}

/** Show the upload progress panel. */
export function showPanel() {
  if (uploadSection) uploadSection.style.display = 'block';
}
/** Hide the upload progress panel. */
export function hidePanel() {
  if (uploadSection) uploadSection.style.display = 'none';
}

/** Hide the upload modal if it is visible. */
export function hideModal() {
  if (uploadModal) {
    uploadModal.classList.add('hidden');
    uploadModal.setAttribute('aria-hidden', 'true');
  }
}

/** Remove all progress items from the list. */
export function clearAll() {
  if (uploadProgressList) uploadProgressList.innerHTML = '';
}

/**
 * Create a new progress item for a file and append it to the list.
 * Returns an object with small helpers to manipulate the item.
 * @param {string} displayName - original file name for display
 * @param {string} sanitized - sanitized name (for matching after server reply)
 * @returns {{setProgress:(pct:number)=>void, markComplete:()=>void, markError:()=>void, element:HTMLElement}}
 */
export function createItem(displayName, sanitized) {
  const itemEl = document.createElement('div');
  itemEl.className = 'upload-progress-item';
  itemEl.textContent = displayName;
  itemEl.dataset.orig = displayName;
  itemEl.dataset.sanitized = sanitized;

  const progressWrap = document.createElement('div');
  progressWrap.className = 'progress-bar-wrap';

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressWrap.appendChild(progressBar);
  itemEl.appendChild(progressWrap);

  if (uploadProgressList) uploadProgressList.appendChild(itemEl);

  function setProgress(pct) {
    const pctClamped = Math.max(0, Math.min(100, pct || 0));
    progressBar.style.width = pctClamped + '%';
  }
  function markComplete() {
    setProgress(100);
    itemEl.classList.add('completed');
  }
  function markError() {
    itemEl.classList.add('error');
  }

  return { setProgress, markComplete, markError, element: itemEl };
}

/**
 * Try to find a created progress item by sanitized or original name.
 * @param {string} name
 * @returns {HTMLElement|null}
 */
export function findItem(name) {
  if (!uploadProgressList || !name) return null;
  const items = Array.from(uploadProgressList.children);
  for (const it of items) {
    const ds = /** @type {HTMLElement} */(it).dataset || {};
    if (ds.sanitized === name || ds.orig === name) return /** @type {HTMLElement} */(it);
  }
  return null;
}
