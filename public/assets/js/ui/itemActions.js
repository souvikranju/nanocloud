// ui/itemActions.js
// File and directory operations (delete, rename, move)

import { 
  list as apiList, 
  deleteFile as apiDeleteFile, 
  deleteDir as apiDeleteDir,
  renameFile as apiRenameFile,
  renameDir as apiRenameDir,
  moveItem as apiMoveItem
} from '../nanocloudClient.js';
import { getCurrentPath, requestRefresh, isOperationAllowed } from '../state.js';
import { showSuccess, showError, showWarning } from './toast.js';
import { getSelectedItems, deselectAll } from './selection.js';
import { getSearchMode, removeSearchResult, renameSearchResult } from './filterSort.js';

let currentItems = [];

/**
 * Update current items reference
 * @param {Array} items - Updated items array
 */
export function updateItemActionsItems(items) {
  currentItems = items;
}

/**
 * Delete a single item
 * @param {Object} entry - Item to delete
 */
export async function deleteItem(entry) {
  const message = entry.type === 'dir' 
    ? `Delete folder "${entry.name}" and all its contents?`
    : `Delete "${entry.name}"?`;
  
  if (!confirm(message)) return;
  
  try {
    // Use displayPath from deep search results if available, otherwise fall back to current path
    const path = typeof entry.displayPath !== 'undefined' ? entry.displayPath : getCurrentPath();
    
    const resp = entry.type === 'dir' 
      ? await apiDeleteDir(path, entry.name)
      : await apiDeleteFile(path, entry.name);
    
    if (!resp.success) {
      throw new Error(resp.message || 'Delete failed');
    }
    
    showSuccess(`Deleted "${entry.name}"`);
    
    // If we are in deep search mode, we need to remove the item from the search results manually
    // because requestRefresh only reloads the *current directory*, not the search results.
    if (getSearchMode() === 'deep') {
      // Use ID if available, otherwise name (though name is ambiguous in deep search, our ID refactor handles it)
      // Actually, we should use the ID we used for the operation.
      // But deleteItem takes `entry`. In deep search entry has fullPath.
      removeSearchResult(entry.fullPath || entry.name);
    }
    
    requestRefresh(true);
  } catch (err) {
    showError(`Error deleting "${entry.name}": ${err.message || err}`);
  }
}

/**
 * Delete selected items
 */
export async function deleteSelectedItems() {
  const selectedItems = getSelectedItems();
  if (selectedItems.size === 0) return;
  
  const itemIds = Array.from(selectedItems);
  // We need to resolve names for the confirmation message
  // Note: This logic assumes at least one item can be found in currentItems
  // If we used IDs that are not names, we must look them up.
  // In normal view, ID=Name. In deep search, ID=FullPath.
  // We can't easily display "Name" without finding the item first.
  
  // Let's resolve items first to get names
  const itemsToDelete = [];
  for (const id of itemIds) {
    const item = currentItems.find(i => (i.fullPath || i.name) === id);
    if (item) itemsToDelete.push(item);
  }
  
  if (itemsToDelete.length === 0) return;

  const message = itemsToDelete.length === 1 
    ? `Delete "${itemsToDelete[0].name}"?`
    : `Delete ${itemsToDelete.length} selected items?`;
  
  if (!confirm(message)) return;
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of itemsToDelete) {
    try {
      const itemName = item.name;
      
      // Use displayPath from deep search results if available, otherwise fall back to current path
      const path = typeof item.displayPath !== 'undefined' ? item.displayPath : getCurrentPath();
      
      const resp = item.type === 'dir' 
        ? await apiDeleteDir(path, itemName)
        : await apiDeleteFile(path, itemName);
      
      if (resp.success) {
        successCount++;
      } else {
        errorCount++;
        showError(`Failed to delete "${itemName}": ${resp.message || 'Unknown error'}`);
      }
    } catch (err) {
      errorCount++;
      showError(`Error deleting "${itemName}": ${err.message || err}`);
    }
  }
  
  if (successCount > 0) {
    showSuccess(`Successfully deleted ${successCount} item${successCount === 1 ? '' : 's'}`);
    
    // If in deep search, refresh UI by removing deleted items
    if (getSearchMode() === 'deep') {
      // itemsToDelete contains the objects we deleted
      itemsToDelete.forEach(item => {
        removeSearchResult(item.fullPath || item.name);
      });
    }
  }
  
  if (errorCount > 0) {
    showError(`Failed to delete ${errorCount} item${errorCount === 1 ? '' : 's'}`);
  }
  
  deselectAll();
  requestRefresh(true);
}

/**
 * Rename selected item (only works with single selection)
 */
export async function renameSelectedItem() {
  const selectedItems = getSelectedItems();
  if (selectedItems.size !== 1) {
    showWarning('Please select exactly one item to rename');
    return;
  }
  
  const itemId = Array.from(selectedItems)[0];
  const item = currentItems.find(i => (i.fullPath || i.name) === itemId);
  
  if (!item) {
    showError('Item not found');
    return;
  }
  
  const itemName = item.name;
  
  // Show rename modal
  const renameModal = document.getElementById('renameModal');
  const renameInput = document.getElementById('renameInput');
  const renameConfirmBtn = document.getElementById('renameConfirmBtn');
  const renameCancelBtn = document.getElementById('renameCancelBtn');
  const renameModalClose = document.getElementById('renameModalClose');
  const renameModalMessages = document.getElementById('renameModalMessages');
  
  if (!renameModal || !renameInput) {
    showError('Rename modal not found');
    return;
  }
  
  // Clear previous messages
  renameModalMessages.innerHTML = '';
  
  // Set current name
  renameInput.value = itemName;
  renameModal.classList.remove('hidden');
  renameInput.focus();
  renameInput.select();
  
  // Handle rename confirmation
  const handleRename = async () => {
    const newName = renameInput.value.trim();
    
    if (!newName) {
      renameModalMessages.innerHTML = '<div class="upload-error-message">Please enter a new name</div>';
      return;
    }
    
    if (newName === itemName) {
      renameModal.classList.add('hidden');
      return;
    }
    
    try {
      // Use displayPath from deep search results if available, otherwise fall back to current path
      const path = typeof item.displayPath !== 'undefined' ? item.displayPath : getCurrentPath();

      const resp = item.type === 'dir'
        ? await apiRenameDir(path, itemName, newName)
        : await apiRenameFile(path, itemName, newName);
      
      if (!resp.success) {
        throw new Error(resp.message || 'Rename failed');
      }
      
      showSuccess(`Renamed "${itemName}" to "${newName}"`);
      
      // If in deep search, update the item in the search results
      if (getSearchMode() === 'deep') {
        renameSearchResult(itemId, newName);
      }
      
      renameModal.classList.add('hidden');
      deselectAll();
      requestRefresh(true);
    } catch (err) {
      renameModalMessages.innerHTML = `<div class="upload-error-message">Error: ${err.message || err}</div>`;
    }
  };
  
  // Handle cancel
  const handleCancel = () => {
    renameModal.classList.add('hidden');
    cleanup();
  };
  
  // Cleanup function
  const cleanup = () => {
    renameConfirmBtn.removeEventListener('click', handleRename);
    renameCancelBtn.removeEventListener('click', handleCancel);
    renameModalClose.removeEventListener('click', handleCancel);
    renameInput.removeEventListener('keypress', handleKeyPress);
  };
  
  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    }
  };
  
  // Add event listeners
  renameConfirmBtn.addEventListener('click', handleRename);
  renameCancelBtn.addEventListener('click', handleCancel);
  renameModalClose.addEventListener('click', handleCancel);
  renameInput.addEventListener('keypress', handleKeyPress);
}

/**
 * Move selected items
 */
export async function moveSelectedItems() {
  const selectedItems = getSelectedItems();
  if (selectedItems.size === 0) return;
  
  const itemIds = Array.from(selectedItems);
  
  // Show move modal
  const moveModal = document.getElementById('moveModal');
  const folderTree = document.getElementById('folderTree');
  const moveConfirmBtn = document.getElementById('moveConfirmBtn');
  const moveCancelBtn = document.getElementById('moveCancelBtn');
  const moveModalClose = document.getElementById('moveModalClose');
  const moveModalMessages = document.getElementById('moveModalMessages');
  
  if (!moveModal || !folderTree) {
    showError('Move modal not found');
    return;
  }
  
  // Clear previous messages and tree
  moveModalMessages.innerHTML = '';
  folderTree.innerHTML = '<div class="list-loading">Loading folders...</div>';
  
  moveModal.classList.remove('hidden');
  
  let selectedPath = null; // Start with null to detect if user has made a selection
  let hasUserSelected = false; // Track if user has clicked on a folder
  
  // Build folder tree
  try {
    const folders = await buildFolderTree();
    renderFolderTree(folders, folderTree, (path) => {
      selectedPath = path;
      hasUserSelected = true;
    });
  } catch (err) {
    folderTree.innerHTML = `<div class="upload-error-message">Error loading folders: ${err.message}</div>`;
  }
  
  // Handle move confirmation
  const handleMove = async () => {
    // Check if user has selected a folder
    if (!hasUserSelected || selectedPath === null || selectedPath === undefined) {
      moveModalMessages.innerHTML = '<div class="upload-error-message">Please select a destination folder</div>';
      return;
    }
    
    // Only prevent move if trying to move to the same folder
    // Note: selectedPath can be '' (root) or a path string
    if (selectedPath === getCurrentPath()) {
      moveModalMessages.innerHTML = '<div class="upload-error-message">Please select a different folder</div>';
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of itemIds) {
      try {
        const item = currentItems.find(i => (i.fullPath || i.name) === id);
        if (!item) continue;
        
        const itemName = item.name;
        
        const resp = await apiMoveItem(
          getCurrentPath(),
          item.type,
          itemName,
          selectedPath
        );
        
        if (resp.success) {
          successCount++;
        } else {
          errorCount++;
          showError(`Failed to move "${itemName}": ${resp.message || 'Unknown error'}`);
        }
      } catch (err) {
        errorCount++;
        showError(`Error moving "${itemName}": ${err.message || err}`);
      }
    }
    
    if (successCount > 0) {
      showSuccess(`Successfully moved ${successCount} item${successCount === 1 ? '' : 's'}`);
    }
    
    if (errorCount > 0) {
      showError(`Failed to move ${errorCount} item${errorCount === 1 ? '' : 's'}`);
    }
    
    moveModal.classList.add('hidden');
    deselectAll();
    requestRefresh(true);
    cleanup();
  };
  
  // Handle cancel
  const handleCancel = () => {
    moveModal.classList.add('hidden');
    cleanup();
  };
  
  // Cleanup function
  const cleanup = () => {
    moveConfirmBtn.removeEventListener('click', handleMove);
    moveCancelBtn.removeEventListener('click', handleCancel);
    moveModalClose.removeEventListener('click', handleCancel);
  };
  
  // Add event listeners
  moveConfirmBtn.addEventListener('click', handleMove);
  moveCancelBtn.addEventListener('click', handleCancel);
  moveModalClose.addEventListener('click', handleCancel);
}

/**
 * Build folder tree recursively
 * @param {string} path - Current path
 * @param {number} depth - Current depth
 * @returns {Promise<Array>}
 */
async function buildFolderTree(path = '', depth = 0) {
  if (depth > 5) return []; // Limit recursion depth
  
  try {
    const resp = await apiList(path);
    if (!resp.success || !resp.items) return [];
    
    const folders = resp.items
      .filter(item => item.type === 'dir')
      .map(folder => ({
        name: folder.name,
        path: path ? `${path}/${folder.name}` : folder.name,
        children: []
      }));
    
    return folders;
  } catch (err) {
    console.error('Error building folder tree:', err);
    return [];
  }
}

/**
 * Render folder tree in the move modal
 * @param {Array} folders - Folder structure
 * @param {HTMLElement} container - Container element
 * @param {Function} onSelect - Callback when folder is selected
 * @param {number} level - Current nesting level
 */
function renderFolderTree(folders, container, onSelect, level = 0) {
  container.innerHTML = '';
  
  // Add root option
  if (level === 0) {
    const rootItem = document.createElement('div');
    rootItem.className = 'folder-tree-item';
    rootItem.style.paddingLeft = '8px';
    rootItem.innerHTML = `
      <span class="folder-icon">📁</span>
      <span class="folder-name">Home (Root)</span>
    `;
    rootItem.addEventListener('click', () => {
      container.querySelectorAll('.folder-tree-item').forEach(el => el.classList.remove('selected'));
      rootItem.classList.add('selected');
      onSelect('');
    });
    container.appendChild(rootItem);
  }
  
  // Add folders
  folders.forEach(folder => {
    const item = document.createElement('div');
    item.className = 'folder-tree-item';
    item.style.paddingLeft = `${(level + 1) * 16 + 8}px`;
    item.innerHTML = `
      <span class="folder-icon">📁</span>
      <span class="folder-name">${folder.name}</span>
    `;
    
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      container.querySelectorAll('.folder-tree-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      onSelect(folder.path);
      
      // Load subfolders if not already loaded
      if (folder.children.length === 0 && level < 3) {
        const subfolders = await buildFolderTree(folder.path, level + 1);
        folder.children = subfolders;
        
        // Insert subfolders after this item
        if (subfolders.length > 0) {
          const subfoldersContainer = document.createElement('div');
          renderFolderTree(subfolders, subfoldersContainer, onSelect, level + 1);
          item.after(...subfoldersContainer.children);
        }
      }
    });
    
    container.appendChild(item);
  });
  
  if (folders.length === 0 && level === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-state-description';
    emptyMsg.style.padding = '16px';
    emptyMsg.textContent = 'No folders available';
    container.appendChild(emptyMsg);
  }
}
