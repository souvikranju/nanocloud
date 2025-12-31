# NanoCloud v2.1

A minimal, fast, self-hosted cloud storage server with a modern, responsive interface. Upload, organize, and access your files from anywhere with an elegant web interface.

## 🚀 Features

- **📁 File Management**: Upload, download, rename, move, and delete files and folders
- **🗂️ Directory Navigation**: Browse nested directories with breadcrumb navigation
- **📊 Storage Monitoring**: Real-time storage usage visualization
- **🎨 Modern UI**: Clean, responsive design with grid and list view modes
- **📱 Mobile Optimized**: Touch-friendly interface with press-and-hold selection
- **⚡ Fast Performance**: Optimized for speed with concurrent uploads
- **🔒 Secure**: Path traversal protection and input sanitization
- **🎯 Multi-Select**: Select multiple items for batch operations
- **⌨️ Keyboard Shortcuts**: Efficient navigation with keyboard commands
- **🎬 Media Streaming**: Stream videos, audio, and view images directly in browser
- **📦 Drag & Drop**: Upload files by dragging them anywhere on the page

## 📋 Requirements

- **PHP 7.4+** with extensions:
  - `fileinfo` (for MIME type detection)
  - `json` (for API responses)
- **Web Server**: Apache, Nginx, or any PHP-compatible server
- **Storage**: Sufficient disk space for your files

## 🛠️ Installation

1. **Clone or download** this repository to your web server directory:
   ```bash
   git clone https://github.com/yourusername/nanocloud.git
   cd nanocloud
   ```

2. **Configure PHP settings** in `php.ini`:
   ```ini
   file_uploads = On
   upload_max_filesize = 2G
   post_max_size = 2G
   max_file_uploads = 50
   max_execution_time = 300
   max_input_time = 300
   ```

3. **Set storage directory** in `config.php`:
   ```php
   define('STORAGE_ROOT', '/path/to/your/storage');
   ```

4. **Set permissions**:
   ```bash
   chmod 755 /path/to/your/storage
   chown www-data:www-data /path/to/your/storage
   ```

5. **Access** via web browser:
   ```
   http://your-server/nanocloud/
   ```

## 📁 Project Structure

```
nanocloud_v2/
├── config.php                 # Configuration and constants
├── index.php                  # Main HTML interface
├── nanocloud_api.php         # REST API endpoints
├── nanocloud_download.php    # File download handler
├── nanocloud_lib.php         # Shared utility functions
├── README.md                 # This file
│
├── assets/
│   ├── css/                  # Modular CSS architecture
│   │   ├── variables.css     # Design system variables
│   │   ├── base.css          # Reset and base styles
│   │   ├── layout.css        # Layout components
│   │   ├── components.css    # UI components
│   │   ├── utilities.css     # Utility classes
│   │   └── responsive.css    # Mobile responsiveness
│   │
│   └── js/                   # Modular JavaScript
│       ├── constants.js      # Application constants
│       ├── main.js           # Application entry point
│       ├── nanocloudClient.js # API client
│       ├── state.js          # State management
│       ├── uploader.js       # Upload orchestration
│       ├── utils.js          # Utility functions
│       │
│       └── ui/               # UI modules
│           ├── fileIcons.js      # File type icons
│           ├── itemActions.js    # Item operations
│           ├── keyboardShortcuts.js # Keyboard handling
│           ├── list.js           # File list rendering
│           ├── progress.js       # Upload progress
│           ├── selection.js      # Multi-select system
│           ├── toast.js          # Notifications
│           └── touchHandlers.js  # Touch interactions
```

## 🎯 Architecture

### Backend (PHP)

**Modular Design:**
- `config.php` - Centralized configuration with constants
- `nanocloud_lib.php` - Reusable utility functions
- `nanocloud_api.php` - RESTful API with action-based routing
- `nanocloud_download.php` - Optimized file streaming with rate limiting

**Key Features:**
- Path traversal protection
- Input sanitization
- Transactional uploads with rollback
- Session-based upload limits
- Recursive directory operations
- Storage metrics calculation

### Frontend (JavaScript)

**ES6 Modules:**
- Separation of concerns with dedicated modules
- State management with reactive updates
- Event-driven architecture
- Optimized rendering with debouncing

**UI Components:**
- Grid and list view modes
- Multi-select with keyboard/touch support
- Real-time upload progress
- Toast notifications
- Modal dialogs
- Breadcrumb navigation

### Styling (CSS)

**Modular CSS Architecture:**
- `variables.css` - Design tokens and CSS custom properties
- `base.css` - Reset and typography
- `layout.css` - Page structure and containers
- `components.css` - Reusable UI components
- `utilities.css` - Helper classes and animations
- `responsive.css` - Mobile-first responsive design

**Design System:**
- Consistent spacing scale
- Color palette with semantic naming
- Typography hierarchy
- Shadow and elevation system
- Transition timing functions

## ⚙️ Configuration

### Storage Settings (`config.php`)

```php
// Storage root directory
define('STORAGE_ROOT', '/local/mnt/workspace');

// File size limits (2GB)
define('MAX_FILE_BYTES', 2147483648);
define('MAX_SESSION_BYTES', 2147483648);

// Download rate limit (MB/s, 0 = unlimited)
define('DOWNLOAD_RATE_LIMIT_MB', 5);

// File permissions
define('DIR_PERMISSIONS', 0755);
define('FILE_PERMISSIONS', 0644);

// Optional: Change owner/group
define('FILE_OWNER', null);
define('FILE_GROUP', null);
```

### Frontend Constants (`assets/js/constants.js`)

```javascript
// API endpoints
export const API_URL = 'nanocloud_api.php';
export const DOWNLOAD_BASE = 'nanocloud_download.php';

// Upload settings
export const MAX_CONCURRENT_UPLOADS = 3;
export const UPLOAD_PROGRESS_AUTO_HIDE_MS = 5000;

// UI settings
export const REFRESH_DEBOUNCE_MS = 300;
export const VIEW_MODE_STORAGE_KEY = 'nanocloud-view-mode';
```

## 🎮 Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + U` | Open upload modal |
| `Ctrl/Cmd + A` | Select all items |
| `Ctrl/Cmd + Click` | Multi-select items |
| `F5` or `Ctrl/Cmd + R` | Refresh listing |
| `Delete` or `Backspace` | Delete selected items |
| `F2` | Rename selected item |
| `Escape` | Deselect all / Close modals |
| `F1` | Open user guide |

### Touch Gestures

- **Tap**: Open file or folder
- **Press & Hold (500ms)**: Select item (with haptic feedback)
- **Tap after selection**: Add more items to selection
- **Drag & Drop**: Upload files anywhere on the page

### File Operations

1. **Upload Files**:
   - Click the `+` button (FAB)
   - Drag and drop files anywhere
   - Use `Ctrl/Cmd + U` shortcut

2. **Create Folder**:
   - Click "New Folder" button
   - Enter folder name
   - Folder appears in current directory

3. **Navigate**:
   - Click folders to open
   - Use breadcrumbs to jump to parent folders
   - Click "Up" button to go to parent

4. **Multi-Select**:
   - `Ctrl/Cmd + Click` to select multiple items
   - Use "Select All" button
   - Press & hold on touch devices

5. **Batch Operations**:
   - Select multiple items
   - Use selection bar buttons:
     - Rename (single item only)
     - Move to another folder
     - Delete selected items

## 🔒 Security

- **Path Traversal Protection**: All paths validated against storage root
- **Input Sanitization**: Filenames and paths sanitized
- **MIME Type Detection**: Proper content-type headers
- **Session Management**: Upload limits per session
- **Hidden Files**: Dot-prefixed files/folders hidden from listings
- **Transactional Uploads**: Rollback on client disconnect

## 🚀 Performance Optimizations

- **Concurrent Uploads**: Multiple files uploaded in parallel
- **Debounced Refresh**: Prevents excessive API calls
- **Request Tracking**: Prevents duplicate refresh operations
- **Lazy Loading**: Components loaded as needed
- **CSS Variables**: Efficient styling with custom properties
- **Rate Limiting**: Configurable download speed limits
- **Session Write Close**: Non-blocking concurrent requests

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Upload Fails

1. Check PHP settings in `php.ini`:
   - `upload_max_filesize` >= file size
   - `post_max_size` >= `upload_max_filesize`
   - `max_file_uploads` sufficient

2. Verify storage directory permissions:
   ```bash
   ls -la /path/to/storage
   ```

3. Check PHP error logs:
   ```bash
   tail -f /var/log/php-fpm/error.log
   ```

### Storage Not Updating

- Ensure `disk_free_space()` and `disk_total_space()` work on your filesystem
- Check if storage directory is mounted correctly

### Permission Errors

- Verify web server user has write access:
  ```bash
  sudo chown -R www-data:www-data /path/to/storage
  sudo chmod -R 755 /path/to/storage
  ```

## 🔄 Recent Changes (v2.1)

### Code Quality & Optimization
- ✅ Eliminated duplicate logic across modules
- ✅ Consolidated repetitive patterns into reusable functions
- ✅ Improved naming conventions for clarity
- ✅ Enhanced error handling and logging

### Structural Improvements
- ✅ Created modular CSS architecture (6 files)
- ✅ Implemented design system with CSS variables
- ✅ Separated concerns in JavaScript modules
- ✅ Centralized configuration and constants
- ✅ Optimized import statements

### CSS Optimization
- ✅ Removed unused selectors and properties
- ✅ Eliminated redundant styles
- ✅ Consolidated duplicate patterns
- ✅ Optimized specificity
- ✅ Reduced file size through efficient organization

### Documentation
- ✅ Updated README with comprehensive project overview
- ✅ Documented architecture and design decisions
- ✅ Added configuration examples
- ✅ Included troubleshooting guide

## 📄 License

MIT License - Feel free to use and modify for your needs.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**NanoCloud** - Simple, fast, self-hosted cloud storage.
