// ui/fileIcons.js
// Comprehensive file type icon system for modern file manager
// Provides icons and styling for different file types

/**
 * Get file type category based on file extension
 * @param {string} filename
 * @returns {string} File type category
 */
export function getFileType(filename) {
  if (!filename) return 'default';
  
  const ext = filename.toLowerCase().split('.').pop();
  
  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'].includes(ext)) {
    return 'image';
  }
  
  // Video files
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'ogg', 'm4v', '3gp'].includes(ext)) {
    return 'video';
  }
  
  // Audio files
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'].includes(ext)) {
    return 'audio';
  }
  
  // Document files
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(ext)) {
    return 'document';
  }
  
  // Spreadsheet files
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) {
    return 'spreadsheet';
  }
  
  // Presentation files
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) {
    return 'presentation';
  }
  
  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso'].includes(ext)) {
    return 'archive';
  }
  
  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'sass', 'less', 'php', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'sh', 'bat', 'ps1'].includes(ext)) {
    return 'code';
  }
  
  // Configuration files
  if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'].includes(ext)) {
    return 'config';
  }
  
  // Font files
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) {
    return 'font';
  }
  
  return 'default';
}

/**
 * Get icon character for file type
 * @param {string} type - File type category
 * @returns {string} Icon character
 */
export function getFileIcon(type) {
  switch (type) {
    case 'folder': return '📁';
    case 'image': return '🖼️';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'document': return '📄';
    case 'spreadsheet': return '📊';
    case 'presentation': return '📽️';
    case 'archive': return '📦';
    case 'code': return '💻';
    case 'config': return '⚙️';
    case 'font': return '🔤';
    default: return '📄';
  }
}

/**
 * Get CSS class for file type styling
 * @param {string} type - File type category
 * @returns {string} CSS class name
 */
export function getFileIconClass(type) {
  switch (type) {
    case 'folder': return 'folder';
    case 'image': return 'image';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'document': return 'document';
    case 'spreadsheet': return 'document';
    case 'presentation': return 'document';
    case 'archive': return 'archive';
    case 'code': return 'document';
    case 'config': return 'document';
    case 'font': return 'document';
    default: return 'default';
  }
}

/**
 * Check if file type is viewable in browser
 * @param {string} filename
 * @returns {boolean}
 */
export function isViewableInBrowser(filename) {
  if (!filename) return false;
  
  const ext = filename.toLowerCase().split('.').pop();
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return true;
  }
  
  // Videos
  if (['mp4', 'webm', 'ogg'].includes(ext)) {
    return true;
  }
  
  // Audio
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return true;
  }
  
  // Text files
  if (['txt', 'json', 'xml', 'html', 'css', 'js', 'md'].includes(ext)) {
    return true;
  }
  
  // PDFs
  if (ext === 'pdf') {
    return true;
  }
  
  return false;
}

/**
 * Create file icon element for grid view
 * @param {string} filename
 * @param {string} type - 'file' or 'dir'
 * @returns {HTMLElement}
 */
export function createFileIconElement(filename, type) {
  const iconEl = document.createElement('div');
  iconEl.className = 'file-icon';
  
  if (type === 'dir') {
    iconEl.classList.add('folder');
    iconEl.textContent = getFileIcon('folder');
  } else {
    const fileType = getFileType(filename);
    const iconClass = getFileIconClass(fileType);
    iconEl.classList.add(iconClass);
    iconEl.textContent = getFileIcon(fileType);
  }
  
  return iconEl;
}

/**
 * Create file icon element for list view (smaller)
 * @param {string} filename
 * @param {string} type - 'file' or 'dir'
 * @returns {HTMLElement}
 */
export function createListIconElement(filename, type) {
  const iconEl = document.createElement('div');
  iconEl.className = 'file-list-icon';
  
  if (type === 'dir') {
    iconEl.classList.add('folder');
    iconEl.textContent = getFileIcon('folder');
  } else {
    const fileType = getFileType(filename);
    const iconClass = getFileIconClass(fileType);
    iconEl.classList.add(iconClass);
    iconEl.textContent = getFileIcon(fileType);
  }
  
  return iconEl;
}
