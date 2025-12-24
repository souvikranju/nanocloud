// ui/messages.js
// Message utilities for user notifications. Initialized with DOM references to avoid global coupling.

/** @type {HTMLElement|null} */
let globalMessagesEl = null;
/** @type {HTMLElement|null} */
let modalMessagesEl = null;
/** @type {HTMLElement|null} */
let uploadModal = null;

/**
 * Initialize the messages module with DOM elements.
 * @param {{globalMessagesEl:HTMLElement, modalMessagesEl:HTMLElement, uploadModal:HTMLElement}} refs
 */
export function initMessages(refs) {
  globalMessagesEl = refs.globalMessagesEl || null;
  modalMessagesEl = refs.modalMessagesEl || null;
  uploadModal = refs.uploadModal || null;
}

/**
 * Append a message DOM node to a container and auto-remove after a timeout.
 * @param {HTMLElement|null} container
 * @param {string} text
 * @param {'info'|'success'|'error'} type
 * @param {number} lifetimeMs
 */
function appendMessage(container, text, type = 'info', lifetimeMs = 8000) {
  if (!container) return;
  const msg = document.createElement('div');
  msg.className = 'message ' + type;
  msg.textContent = text;
  container.appendChild(msg);
  setTimeout(() => {
    if (msg.parentNode) {
      msg.parentNode.removeChild(msg);
    }
  }, lifetimeMs);
}

/**
 * Show a global message (outside the modal).
 * @param {string} text
 * @param {'info'|'success'|'error'} type
 */
export function addMessage(text, type = 'info') {
  appendMessage(globalMessagesEl, text, type);
}

/**
 * Show a message inside the upload modal.
 * @param {string} text
 * @param {'info'|'success'|'error'} type
 */
export function addModalMessage(text, type = 'info') {
  appendMessage(modalMessagesEl, text, type);
}

/**
 * Notify the user; if modal is visible, use modal-scoped messages, otherwise global.
 * @param {string} text
 * @param {'info'|'success'|'error'} type
 */
export function notifyUser(text, type = 'info') {
  const modalVisible = uploadModal && !uploadModal.classList.contains('hidden');
  if (modalVisible) addModalMessage(text, type);
  else addMessage(text, type);
}

/** Clear all global messages (non-modal). */
export function clearGlobalMessages() {
  if (globalMessagesEl) globalMessagesEl.innerHTML = '';
}

/** Clear all messages inside the modal. */
export function clearModalMessages() {
  if (modalMessagesEl) modalMessagesEl.innerHTML = '';
}
