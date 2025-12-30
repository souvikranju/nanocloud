# NanoCloud

A minimal, fast, self-hosted cloud server designed to run on low-power hardware (e.g., Raspberry Pi). NanoCloud provides a modern, responsive PHP-powered web frontend for browsing, uploading, downloading, and managing files/folders on a trusted private network. Common file types are streamable in the browser.

**Tested environment:** Raspberry Pi (Raspberry Pi OS) with lighttpd and PHP 8.4.

---

## Key Features

### Core Functionality
- **Lightweight & Fast**: Runs on minimal hardware such as Raspberry Pi
- **No Dependencies**: Pure PHP server with no heavy frameworks or databases
- **Modern UI**: Responsive design with grid/list views, drag & drop, and real-time progress tracking
- **File Management**: Browse, upload, download, create folders, delete, rename, and move files/folders
- **Smart Features**: 
  - Duplicate file detection
  - File type icons and categorization
  - Storage meter with visual indicators
  - Breadcrumb navigation
  - Multi-file selection and bulk operations
  - Concurrent uploads with progress tracking
  - Rename files and folders
  - Move items between directories with folder tree navigation
  - Optimized streaming with client disconnect detection and rate limiting

### User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Mobile Optimized**: 
  - Press-and-hold (500ms) for multi-select on mobile
  - Touch-friendly interface with proper spacing
  - Haptic feedback for selections
  - Optimized text overflow handling
- **Drag & Drop**: Drop files anywhere on the page to upload
- **Keyboard Shortcuts**: 
  - `Ctrl/Cmd + U` - Open upload modal
  - `Ctrl/Cmd + A` - Select all items
  - `F5` or `Ctrl/Cmd + R` - Refresh
  - `Delete/Backspace` - Delete selected items
  - `F2` - Rename selected item
  - `Escape` - Deselect all
- **Toast Notifications**: Non-intrusive success/error messages
- **Real-time Progress**: Live upload progress with per-file status
- **Smart Streaming**: Automatic disconnect detection and rate limiting (10MB/s default)

### Security Model
- **Trusted LAN Operation**: Designed for home/private networks where all users are trusted
- **No Authentication by Default**: Suitable for private networks only
- **Configurable Limits**: Server-side file size and upload restrictions

---

## Architecture

NanoCloud follows a modern, modular architecture with clear separation of concerns:

### Backend (PHP)

```
┌─────────────────────────────────────────────────────────────┐
│                         Backend Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  config.php              Configuration & Constants           │
│  ├─ STORAGE_ROOT         Base directory for file storage    │
│  ├─ MAX_UPLOAD_BYTES     Per-file upload limit              │
│  └─ MAX_SESSION_BYTES    Total session upload limit         │
│                                                               │
│  nanocloud_lib.php       Shared Utilities                    │
│  ├─ sanitizePath()       Path validation & sanitization     │
│  ├─ listDirectory()      Directory listing with metadata    │
│  ├─ deleteRecursive()    Recursive directory deletion       │
│  └─ getStorageInfo()     Disk usage statistics              │
│                                                               │
│  nanocloud_api.php       RESTful API Endpoint                │
│  ├─ GET  ?action=info    Server capabilities & limits       │
│  ├─ GET  ?action=list    Directory listing                  │
│  ├─ POST action=upload   File upload handler                │
│  ├─ POST action=delete   File deletion                      │
│  ├─ POST action=create_dir  Folder creation                 │
│  ├─ POST action=delete_dir  Folder deletion                 │
│  ├─ POST action=rename_file  Rename file                    │
│  ├─ POST action=rename_dir   Rename directory               │
│  └─ POST action=move     Move file or directory             │
│                                                               │
│  nanocloud_download.php  File Streaming                      │
│  ├─ Handles file downloads with proper MIME types           │
│  ├─ Client disconnect detection                             │
│  ├─ Rate limiting (10MB/s default)                          │
│  └─ Optimized chunk size (64KB)                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Frontend (JavaScript ES6 Modules)

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  main.js                 Application Bootstrap               │
│  ├─ Module initialization                                    │
│  ├─ Event handler setup                                      │
│  ├─ Global keyboard shortcuts                                │
│  └─ Drag & drop coordination                                 │
│                                                               │
│  state.js                Centralized State Management        │
│  ├─ currentPath          Current directory path             │
│  ├─ maxFileBytes         Server upload limit                │
│  ├─ nameSet              Duplicate detection cache          │
│  ├─ requestRefresh()     Debounced refresh mechanism        │
│  └─ autoRefreshCallback  State change notifications         │
│                                                               │
│  nanocloudClient.js      API Communication Layer             │
│  ├─ info()               Fetch server capabilities          │
│  ├─ list()               Get directory listing              │
│  ├─ uploadSingle()       Upload with XHR progress           │
│  ├─ createDir()          Create new folder                  │
│  ├─ deleteFile()         Delete single file                 │
│  ├─ deleteDir()          Delete folder recursively          │
│  ├─ renameFile()         Rename file                        │
│  ├─ renameDir()          Rename directory                   │
│  └─ moveItem()           Move file or directory             │
│                                                               │
│  uploader.js             Upload Orchestration                │
│  ├─ File validation (size, duplicates)                      │
│  ├─ Concurrent upload management (default: 3)               │
│  ├─ Progress tracking per file                              │
│  └─ Error handling & retry logic                            │
│                                                               │
│  utils.js                Pure Utility Functions              │
│  ├─ formatBytes()        Human-readable file sizes          │
│  ├─ formatDate()         Relative date formatting           │
│  ├─ joinPath()           Path manipulation                  │
│  ├─ sanitizeFilename()   Client-side name sanitization      │
│  └─ sanitizeSegment()    Path segment validation            │
│                                                               │
│  ui/list.js              File List Management                │
│  ├─ Grid/List view rendering                                │
│  ├─ Selection system (single/multi)                         │
│  ├─ Desktop: Ctrl+Click for multi-select                    │
│  ├─ Mobile: Press-and-hold (500ms) for multi-select         │
│  ├─ Breadcrumb navigation                                   │
│  ├─ Storage meter visualization                             │
│  ├─ Item actions (delete, download, navigate)               │
│  ├─ Rename functionality with modal                         │
│  ├─ Move functionality with folder tree                     │
│  └─ Keyboard shortcuts (F2, Delete, Escape, etc.)           │
│                                                               │
│  ui/progress.js          Upload Progress UI                  │
│  ├─ Progress panel management                               │
│  ├─ Per-file progress items                                 │
│  ├─ Status indicators (uploading/complete/error)            │
│  └─ FAB (Floating Action Button) control                    │
│                                                               │
│  ui/toast.js             Notification System                 │
│  ├─ Toast creation & management                             │
│  ├─ Auto-dismiss timers                                     │
│  ├─ Type-based styling (success/error/warning/info)         │
│  └─ Stacking & positioning                                  │
│                                                               │
│  ui/fileIcons.js         File Type System                    │
│  ├─ File type detection by extension                        │
│  ├─ Icon assignment (folders, images, videos, etc.)         │
│  ├─ Browser viewability detection                           │
│  └─ Icon element creation for grid/list views               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ 1. User Action (upload, navigate, delete)
       ↓
┌──────────────────────────────────────────────────────────────┐
│                         main.js                               │
│  • Captures events (click, drag, keyboard)                   │
│  • Delegates to appropriate UI modules                       │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 2. State Update
       ↓
┌──────────────────────────────────────────────────────────────┐
│                        state.js                               │
│  • Updates currentPath, nameSet                              │
│  • Triggers auto-refresh if needed                           │
│  • Manages request debouncing                                │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 3. API Call
       ↓
┌──────────────────────────────────────────────────────────────┐
│                   nanocloudClient.js                          │
│  • Constructs API requests                                   │
│  • Handles XHR for uploads (progress tracking)               │
│  • Parses JSON responses                                     │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 4. HTTP Request
       ↓
┌──────────────────────────────────────────────────────────────┐
│                    nanocloud_api.php                          │
│  • Validates request                                         │
│  • Calls nanocloud_lib.php functions                         │
│  • Returns JSON response                                     │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 5. File System Operation
       ↓
┌──────────────────────────────────────────────────────────────┐
│                   nanocloud_lib.php                           │
│  • Sanitizes paths                                           │
│  • Performs file operations                                  │
│  • Returns results                                           │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 6. JSON Response
       ↓
┌──────────────────────────────────────────────────────────────┐
│                      UI Modules                               │
│  • ui/list.js renders file list                             │
│  • ui/progress.js updates upload status                     │
│  • ui/toast.js shows notifications                          │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 7. DOM Update
       ↓
┌──────────────┐
│   Browser    │
│  (Updated)   │
└──────────────┘
```

### Upload Flow (Detailed)

```
1. User selects files
   ↓
2. uploader.js validates files
   • Check file size against server limits
   • Check for duplicate names in current directory
   • Separate valid and invalid files
   ↓
3. Create UI progress items (ui/progress.js)
   • Show progress panel
   • Create item for each file
   • Hide FAB and modal
   ↓
4. Concurrent upload (default: 3 workers)
   • Worker pool processes files
   • Each worker:
     - Calls uploadSingle() with progress callback
     - Updates progress bar in real-time
     - Marks complete or error
   ↓
5. Update state
   • Mark uploaded files in nameSet
   • Prevent duplicate uploads
   ↓
6. Refresh listing (once at end)
   • Call requestRefresh() with debouncing
   • Update file list and storage meter
   ↓
7. Auto-hide progress panel
   • Wait 5 seconds
   • Clear progress items
   • Show FAB again
```

---

## Project Structure

```
nanocloud_v2/
├── index.php                   # Frontend HTML entry point
├── config.php                  # Configuration (paths, limits)
├── nanocloud_api.php           # RESTful API endpoint
├── nanocloud_download.php      # File streaming handler (enhanced)
├── nanocloud_lib.php           # Shared utility functions
├── README.md                   # This file
├── CLEANUP_SUMMARY.md          # Code cleanup documentation
│
└── assets/
    ├── style.css               # Modern responsive UI styles
    │
    └── js/
        ├── main.js             # Application bootstrap
        ├── state.js            # Centralized state management
        ├── nanocloudClient.js  # API communication layer
        ├── uploader.js         # Upload orchestration
        ├── utils.js            # Pure utility functions
        │
        └── ui/
            ├── list.js         # File list rendering (refactored)
            ├── selection.js    # Selection state management (NEW)
            ├── touchHandlers.js # Mobile touch interactions (NEW)
            ├── keyboardShortcuts.js # Keyboard shortcuts (NEW)
            ├── itemActions.js  # File operations (NEW)
            ├── progress.js     # Upload progress tracking
            ├── toast.js        # Notification system
            └── fileIcons.js    # File type detection & icons (enhanced)
```

**Recent Changes (v2.1):**
- **Modular Architecture**: Refactored frontend following Single Responsibility Principle
- **Enhanced Streaming**: Improved disconnect detection and PDF inline viewing
- **Better Mobile UX**: Fixed long-press selection to prevent accidental downloads
- **File Type Handling**: MKV and similar formats now force download instead of streaming

---

## Installation

### Requirements

- **Web Server**: lighttpd, Apache, or nginx
- **PHP**: Version 7.4+ (tested with PHP 8.4)
- **PHP Extensions**: Standard extensions (no special requirements)
- **Hardware**: Raspberry Pi or any Linux server

### Deployment Steps

1. **Clone or download** the repository to your web server's document root:
   ```bash
   cd /var/www
   sudo git clone <repository-url> nanocloud
   cd nanocloud
   ```

2. **Set permissions** for the storage directory:
   ```bash
   sudo chown -R www-data:www-data /path/to/storage
   sudo chmod -R 755 /path/to/storage
   ```

3. **Configure** `config.php`:
   ```php
   define('STORAGE_ROOT', '/home/pi/FTP/dropbox');
   define('MAX_UPLOAD_BYTES', 256 * 1024 * 1024); // 256 MB
   ```

4. **Configure PHP** (see Configuration section below)

5. **Configure web server** (see Configuration section below)

6. **Restart services**:
   ```bash
   sudo systemctl restart php8.4-fpm
   sudo systemctl restart lighttpd
   ```

7. **Access** NanoCloud via your browser:
   ```
   http://your-server-ip/
   ```

---

## Configuration

### Application Configuration (`config.php`)

```php
<?php
// Storage directory (absolute path)
define('STORAGE_ROOT', '/home/pi/FTP/dropbox');

// Upload limits
define('MAX_UPLOAD_BYTES', 256 * 1024 * 1024);      // 256 MB per file
define('MAX_SESSION_BYTES', 1024 * 1024 * 1024);    // 1 GB per session
```

### PHP Configuration (`php.ini`)

Ensure PHP allows uploads large enough for your needs:

```ini
file_uploads = On
upload_max_filesize = 256M      # Must match or exceed MAX_UPLOAD_BYTES
post_max_size = 256M            # Must be >= upload_max_filesize
memory_limit = 512M             # Ensure enough memory for processing
max_file_uploads = 50           # Number of files per request
max_execution_time = 60         # Adjust based on hardware/network
```

**Location**: `/etc/php/8.4/fpm/php.ini` (adjust version as needed)

**Restart after changes**:
```bash
sudo systemctl restart php8.4-fpm
```

### lighttpd Configuration

Example configuration (`/etc/lighttpd/lighttpd.conf`):

```conf
server.document-root = "/var/www/nanocloud"
index-file.names = ("index.php")

# Enable required modules
server.modules += ( "mod_fastcgi" )

# Upload handling
server.upload-dirs = ( "/var/cache/lighttpd/uploads" )
server.max-request-size = 268435456   # 256 MiB in bytes

# FastCGI + PHP-FPM
fastcgi.server = ( ".php" =>
  ((
    "socket" => "/run/php/php8.4-fpm.sock",
    "broken-scriptfilename" => "enable"
  ))
)
```

**Verify PHP-FPM socket path**:
```bash
ls -l /run/php/
```

**Restart after changes**:
```bash
sudo systemctl restart lighttpd
```

---

## Usage

### Basic Operations

1. **Browse Files**: Click on folders to navigate, use breadcrumbs to go back
2. **Upload Files**: 
   - Click the `+` button (FAB) in the bottom-right
   - Or drag & drop files anywhere on the page
3. **Create Folder**: Click "New Folder" button in the header
4. **Select Items**:
   - Desktop: Ctrl/Cmd + Click to select multiple items
   - Mobile: Press and hold any item for 500ms to select
5. **Rename Items**: 
   - Select one item, click "Rename" button or press F2
   - Enter new name in modal and confirm
6. **Move Items**:
   - Select one or more items, click "Move" button
   - Browse folder tree and select destination
   - Click "Move Here" to confirm
7. **Delete Items**: 
   - Single: Click trash icon on any item
   - Multiple: Select items, then click "Delete" in selection bar
8. **Download Files**: Click on files to download or view in browser
9. **Switch Views**: Toggle between grid and list view using view buttons

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + U` | Open upload modal |
| `Ctrl/Cmd + A` | Select all items |
| `Ctrl/Cmd + R` or `F5` | Refresh listing |
| `Delete` or `Backspace` | Delete selected items |
| `F2` | Rename selected item |
| `Escape` | Deselect all items |

### Selection System

**Desktop:**
- **Ctrl/Cmd + Click**: Toggle selection on any item
- **Select All**: Use button in selection bar or `Ctrl/Cmd + A`
- **Keyboard Shortcuts**: F2 (rename), Delete (delete), Escape (deselect)

**Mobile:**
- **Press and Hold**: Touch and hold any item for 500ms to select
- **Visual Feedback**: Animation and haptic vibration on selection
- **Multi-Select**: Continue tapping items to add to selection
- **Selection Bar**: Appears at top with action buttons

**Bulk Actions:**
- Rename (single item only)
- Move (one or more items)
- Delete (one or more items)

---

## API Endpoints

All API endpoints are routed through `nanocloud_api.php`:

### GET Endpoints

#### Get Server Info
```
GET /nanocloud_api.php?action=info
```
**Response:**
```json
{
  "success": true,
  "maxFileBytes": 268435456,
  "maxSessionBytes": 1073741824
}
```

#### List Directory
```
GET /nanocloud_api.php?action=list&path=relative/path
```
**Response:**
```json
{
  "success": true,
  "path": "relative/path",
  "breadcrumbs": ["relative", "path"],
  "items": [
    {
      "name": "file.txt",
      "type": "file",
      "size": 1024,
      "mtime": 1703721600
    },
    {
      "name": "folder",
      "type": "dir",
      "count": 5,
      "mtime": 1703721600
    }
  ],
  "storage": {
    "totalBytes": 32000000000,
    "freeBytes": 16000000000,
    "usedBytes": 16000000000,
    "usedPercent": 50.0
  }
}
```

### POST Endpoints

#### Upload Files
```
POST /nanocloud_api.php
Content-Type: multipart/form-data

action=upload
path=relative/path
files[]=<file1>
files[]=<file2>
```
**Response:**
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "filename": "file1.txt",
      "message": "Upload successful"
    }
  ],
  "storage": { ... }
}
```

#### Create Directory
```
POST /nanocloud_api.php

action=create_dir
path=relative/path
name=newfolder
```

#### Delete File
```
POST /nanocloud_api.php

action=delete
path=relative/path
filename=file.txt
```

#### Delete Directory
```
POST /nanocloud_api.php

action=delete_dir
path=relative/path
name=foldername
```

#### Rename File
```
POST /nanocloud_api.php

action=rename_file
path=relative/path
filename=oldname.txt
newName=newname.txt
```

#### Rename Directory
```
POST /nanocloud_api.php

action=rename_dir
path=relative/path
name=oldname
newName=newname
```

#### Move Item
```
POST /nanocloud_api.php

action=move
path=source/path
itemType=file (or dir)
itemName=filename.txt
targetPath=destination/path
```

### Download Endpoint

```
GET /nanocloud_download.php?path=relative/path&file=filename.ext
```

---

## Security Considerations

### Current Security Model

- **No Authentication**: Designed for trusted private networks only
- **No Authorization**: All users have full access to all operations
- **Path Sanitization**: Server-side validation prevents directory traversal
- **File Type Restrictions**: None by default (configure as needed)

### Recommendations for Production

1. **Use Behind Reverse Proxy**: Add authentication layer (e.g., nginx with Basic Auth)
2. **Network Isolation**: Deploy on private VLAN or VPN
3. **Firewall Rules**: Restrict access to trusted IP ranges
4. **HTTPS**: Use SSL/TLS for encrypted communication
5. **Regular Backups**: Implement backup strategy for stored files

### Adding Basic Authentication (nginx example)

```nginx
location / {
    auth_basic "NanoCloud Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:8080;
}
```

---

## Troubleshooting

### Upload Fails

1. **Check PHP limits**: Verify `upload_max_filesize` and `post_max_size`
2. **Check web server limits**: Verify `server.max-request-size` (lighttpd)
3. **Check permissions**: Ensure web server can write to storage directory
4. **Check disk space**: Verify sufficient free space available

### Files Not Appearing

1. **Refresh the page**: Use refresh button or `F5`
2. **Check permissions**: Verify web server can read storage directory
3. **Check browser console**: Look for JavaScript errors

### Performance Issues

1. **Reduce concurrent uploads**: Lower from default 3 in `uploader.js`
2. **Increase PHP memory**: Adjust `memory_limit` in `php.ini`
3. **Optimize PHP-FPM**: Tune `pm.max_children` for your hardware

---

## Roadmap

### Completed Features

- [x] **File Rename**: Rename files and folders in-place
- [x] **File Move**: Move files between directories with folder tree
- [x] **Mobile Multi-Select**: Press-and-hold for 500ms to select items
- [x] **Streaming Optimization**: Client disconnect detection and rate limiting

### Planned Features

- [ ] **Authentication System**: Optional user login and session management
- [ ] **Role-Based Access**: Read-only vs. full access permissions
- [ ] **File Preview**: Built-in preview for images, videos, PDFs
- [ ] **Search**: Full-text search across filenames
- [ ] **Sharing**: Generate temporary download links
- [ ] **Themes**: Dark mode and customizable color schemes
- [ ] **Mobile App**: Native mobile applications
- [ ] **Batch Rename**: Rename multiple files with patterns
- [ ] **Copy Files**: Duplicate files and folders

### Future Enhancements

- [ ] **Compression**: Automatic compression for downloads
- [ ] **Thumbnails**: Image thumbnail generation
- [ ] **Versioning**: Keep file version history
- [ ] **Quotas**: Per-directory storage limits
- [ ] **Activity Log**: Track all file operations
- [ ] **API Keys**: Token-based API access

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Open an Issue**: Describe the problem or feature request
2. **Fork the Repository**: Create your feature branch
3. **Follow Code Style**: Match existing code formatting
4. **Test Thoroughly**: Verify on Raspberry Pi if possible
5. **Submit Pull Request**: Include clear description and screenshots

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd nanocloud

# Make changes
# Test locally

# Commit with clear message
git commit -m "Add feature: description"

# Push and create PR
git push origin feature-branch
```

---

## License

MIT License - See `LICENSE` file for details.

---

## Acknowledgments

- Built for Raspberry Pi and low-power hardware
- Inspired by simple file sharing needs on home networks
- Modern UI design influenced by contemporary web applications

---

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

**Note**: This is a community project designed for personal/home use. Use at your own risk in production environments.
