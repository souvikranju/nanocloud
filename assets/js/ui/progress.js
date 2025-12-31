// ui/progress.js
// Modern upload progress tracking and UI management with enhanced visual feedback
// Integrates with the new design system and toast notifications

/** @type {HTMLElement|null} */ let uploadSection = null;
/** @type {HTMLElement|null} */ let uploadProgressList = null;
/** @type {HTMLElement|null} */ let fabBtn = null;
/** @type {HTMLElement|null} */ let uploadModal = null;

/**
 * Initialize progress UI references
 * @param {{uploadSection:HTMLElement, uploadProgressList:HTMLElement, fabBtn:HTMLElement, uploadModal:HTMLElement}} refs
 */
export function initProgress(refs) {
  uploadSection = refs.uploadSection || null;
  uploadProgressList = refs.uploadProgressList || null;
  fabBtn = refs.fabBtn || null;
  uploadModal = refs.uploadModal || null;
}

/**
 * Show the floating action button (FAB)
 */
export function showFab() {
  if (fabBtn) {
    fabBtn.style.display = 'flex';
    fabBtn.classList.add('animate-fade-in');
  }
}

/**
 * Hide the floating action button (FAB)
 */
export function hideFab() {
  if (fabBtn) {
    fabBtn.style.display = 'none';
    fabBtn.classList.remove('animate-fade-in');
  }
}

/**
 * Show the upload progress panel with animation
 */
export function showPanel() {
  if (uploadSection) {
    uploadSection.classList.add('visible');
    uploadSection.classList.add('animate-slide-in-up');
  }
}

/**
 * Hide the upload progress panel with animation
 */
export function hidePanel() {
  if (uploadSection) {
    uploadSection.classList.remove('visible');
    uploadSection.classList.remove('animate-slide-in-up');
  }
}

/**
 * Hide the upload modal
 */
export function hideModal() {
  if (uploadModal) {
    uploadModal.classList.add('hidden');
    uploadModal.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Clear all progress items from the list
 */
export function clearAll() {
  if (uploadProgressList) {
    // Fade out existing items before clearing
    const items = uploadProgressList.querySelectorAll('.upload-progress-item');
    items.forEach(item => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(100%)';
    });
    
    setTimeout(() => {
      uploadProgressList.innerHTML = '';
    }, 300);
  }
}

/**
 * Create and return a modern progress item UI controller
 * @param {string} originalName - Original filename
 * @param {string} sanitizedName - Sanitized filename
 * @returns {{setProgress:(pct:number)=>void, markComplete:()=>void, markError:()=>void, setErrorMessage:(msg:string)=>void, element:HTMLElement}}
 */
export function createItem(originalName, sanitizedName) {
  if (!uploadProgressList) {
    return {
      setProgress: () => {},
      markComplete: () => {},
      markError: () => {},
      setErrorMessage: () => {},
      element: null
    };
  }

  // Create main item container
  const itemEl = document.createElement('div');
  itemEl.className = 'upload-progress-item animate-fade-in';
  itemEl.dataset.orig = originalName;
  itemEl.dataset.sanitized = sanitizedName;

  // Create file info section
  const fileInfoEl = document.createElement('div');
  fileInfoEl.className = 'upload-file-info';

  // File name
  const nameEl = document.createElement('div');
  nameEl.className = 'upload-file-name';
  nameEl.textContent = originalName;
  nameEl.title = originalName; // Tooltip for long names

  // Status indicator
  const statusEl = document.createElement('div');
  statusEl.className = 'upload-status uploading';
  statusEl.textContent = 'Uploading...';

  fileInfoEl.appendChild(nameEl);
  fileInfoEl.appendChild(statusEl);

  // Create progress bar
  const progressWrapEl = document.createElement('div');
  progressWrapEl.className = 'progress-bar-wrap';

  const progressBarEl = document.createElement('div');
  progressBarEl.className = 'progress-bar';
  progressBarEl.style.width = '0%';

  progressWrapEl.appendChild(progressBarEl);

  // Create error message container (hidden by default)
  const errorMsgEl = document.createElement('div');
  errorMsgEl.className = 'upload-error-message';
  errorMsgEl.style.display = 'none';

  // Assemble the item
  itemEl.appendChild(fileInfoEl);
  itemEl.appendChild(progressWrapEl);
  itemEl.appendChild(errorMsgEl);

  // Add to list with animation
  uploadProgressList.appendChild(itemEl);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    itemEl.style.opacity = '1';
    itemEl.style.transform = 'translateX(0)';
  });

  // Return controller object
  return {
    setProgress(pct) {
      const percentage = Math.max(0, Math.min(100, pct || 0));
      progressBarEl.style.width = percentage + '%';
      
      // Update status text
      if (percentage < 100) {
        statusEl.textContent = `${Math.round(percentage)}%`;
      }
    },

    markComplete() {
      progressBarEl.style.width = '100%';
      progressBarEl.classList.add('complete');
      statusEl.className = 'upload-status complete';
      statusEl.textContent = 'Complete';
      itemEl.classList.add('completed');
      
      // Add success animation
      itemEl.classList.add('animate-pulse');
      setTimeout(() => {
        itemEl.classList.remove('animate-pulse');
      }, 1000);
    },

    markError() {
      progressBarEl.classList.add('error');
      statusEl.className = 'upload-status error';
      statusEl.textContent = 'Failed';
      itemEl.classList.add('error');
      
      // Add error shake animation
      itemEl.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
        itemEl.style.animation = '';
      }, 500);
    },

    setErrorMessage(msg) {
      if (msg) {
        errorMsgEl.textContent = msg;
        errorMsgEl.style.display = 'block';
        errorMsgEl.classList.add('animate-fade-in');
      } else {
        errorMsgEl.style.display = 'none';
        errorMsgEl.classList.remove('animate-fade-in');
      }
    },

    element: itemEl
  };
}
