// ui/toast.js
// Modern toast notification system for non-blocking user feedback
// Provides color-coded notifications with auto-dismiss and manual close options

/** @type {HTMLElement|null} */ let toastContainer = null;
/** @type {number} */ let toastIdCounter = 0;

/**
 * Initialize the toast notification system
 * @param {{toastContainer: HTMLElement}} refs
 */
export function initToast(refs) {
  toastContainer = refs.toastContainer || null;
  
  // Create container if it doesn't exist
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.id = 'toastContainer';
    document.body.appendChild(toastContainer);
  }
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {'success'|'error'|'warning'|'info'} type - The type of notification
 * @param {number} [duration=5000] - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @param {boolean} [allowClose=true] - Whether to show close button
 * @returns {string} - Toast ID for manual dismissal
 */
export function showToast(message, type = 'info', duration = 5000, allowClose = true) {
  if (!toastContainer) {
    console.warn('Toast container not initialized');
    return '';
  }

  const toastId = `toast-${++toastIdCounter}`;
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = toastId;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  // Create toast icon
  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  icon.textContent = getToastIcon(type);

  // Create toast content
  const content = document.createElement('div');
  content.className = 'toast-content';
  
  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  content.appendChild(messageEl);

  // Create close button if allowed
  let closeBtn = null;
  if (allowClose) {
    closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.addEventListener('click', () => dismissToast(toastId));
  }

  // Assemble toast
  toast.appendChild(icon);
  toast.appendChild(content);
  if (closeBtn) toast.appendChild(closeBtn);

  // Add to container
  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Auto-dismiss if duration is set
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toastId);
    }, duration);
  }

  return toastId;
}

/**
 * Dismiss a specific toast notification
 * @param {string} toastId - The ID of the toast to dismiss
 */
export function dismissToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  toast.classList.remove('visible');
  
  // Remove from DOM after animation
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Dismiss all toast notifications
 */
export function dismissAllToasts() {
  if (!toastContainer) return;
  
  const toasts = toastContainer.querySelectorAll('.toast');
  toasts.forEach(toast => {
    if (toast.id) {
      dismissToast(toast.id);
    }
  });
}

/**
 * Show success toast
 * @param {string} message
 * @param {number} [duration=4000]
 * @returns {string} Toast ID
 */
export function showSuccess(message, duration = 4000) {
  return showToast(message, 'success', duration);
}

/**
 * Show error toast
 * @param {string} message
 * @param {number} [duration=7000]
 * @returns {string} Toast ID
 */
export function showError(message, duration = 7000) {
  return showToast(message, 'error', duration);
}

/**
 * Show warning toast
 * @param {string} message
 * @param {number} [duration=5000]
 * @returns {string} Toast ID
 */
export function showWarning(message, duration = 5000) {
  return showToast(message, 'warning', duration);
}

/**
 * Show info toast
 * @param {string} message
 * @param {number} [duration=4000]
 * @returns {string} Toast ID
 */
export function showInfo(message, duration = 4000) {
  return showToast(message, 'info', duration);
}

/**
 * Get appropriate icon for toast type
 * @param {'success'|'error'|'warning'|'info'} type
 * @returns {string}
 */
function getToastIcon(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
    default: return 'ℹ';
  }
}
