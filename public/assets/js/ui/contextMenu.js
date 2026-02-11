// ui/contextMenu.js
// Custom context menu implementation

// DOM reference
let contextMenuEl = null;
let backdropEl = null;

/**
 * Initialize the context menu
 */
export function initContextMenu() {
  // Create menu element if it doesn't exist
  if (!document.getElementById('contextMenu')) {
    contextMenuEl = document.createElement('div');
    contextMenuEl.id = 'contextMenu';
    contextMenuEl.className = 'context-menu';
    document.body.appendChild(contextMenuEl);

    // Create backdrop for closing on click outside
    backdropEl = document.createElement('div');
    backdropEl.className = 'context-menu-backdrop';
    backdropEl.addEventListener('click', hideContextMenu);
    backdropEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      hideContextMenu();
    });
    document.body.appendChild(backdropEl);
    
    // Prevent default context menu on our custom menu
    contextMenuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  } else {
    contextMenuEl = document.getElementById('contextMenu');
    backdropEl = document.querySelector('.context-menu-backdrop');
  }
}

/**
 * Show context menu at specified coordinates
 * @param {number} x - Client X coordinate
 * @param {number} y - Client Y coordinate
 * @param {Array<Object>} items - Array of menu items { label, icon, action, disabled, danger }
 */
export function showContextMenu(x, y, items) {
  if (!contextMenuEl || !items || items.length === 0) return;
  
  // Build menu content
  contextMenuEl.innerHTML = '';
  
  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      contextMenuEl.appendChild(sep);
      return;
    }
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'context-menu-item';
    if (item.danger) menuBtn.classList.add('danger');
    if (item.disabled) {
      menuBtn.disabled = true;
    }
    
    menuBtn.innerHTML = `
      <span class="context-menu-icon">${item.icon || ''}</span>
      <span class="context-menu-label">${item.label}</span>
    `;
    
    if (!item.disabled && item.action) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        item.action();
      });
    }
    
    contextMenuEl.appendChild(menuBtn);
  });
  
  // Show elements to calculate size
  backdropEl.classList.add('visible');
  contextMenuEl.classList.add('visible');
  
  // Position menu with boundary checking
  const rect = contextMenuEl.getBoundingClientRect();
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;
  
  let finalX = x;
  let finalY = y;
  
  // Flip horizontally if overflow right
  if (x + rect.width > winWidth) {
    finalX = x - rect.width;
  }
  
  // Flip vertically if overflow bottom
  if (y + rect.height > winHeight) {
    finalY = y - rect.height;
  }
  
  // Ensure it doesn't go off-screen top/left
  if (finalX < 0) finalX = 0;
  if (finalY < 0) finalY = 0;
  
  contextMenuEl.style.left = `${finalX}px`;
  contextMenuEl.style.top = `${finalY}px`;
}

/**
 * Hide context menu
 */
export function hideContextMenu() {
  if (contextMenuEl) contextMenuEl.classList.remove('visible');
  if (backdropEl) backdropEl.classList.remove('visible');
}

/**
 * Check if context menu is currently visible
 * @returns {boolean}
 */
export function isContextMenuVisible() {
  return contextMenuEl && contextMenuEl.classList.contains('visible');
}
