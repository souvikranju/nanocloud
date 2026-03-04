# NanoCloud - Architecture Documentation

## Overview

NanoCloud is a complete re-architecture of the original application, applying modern software engineering principles while maintaining 100% feature parity and UI consistency.

## Design Principles

### 1. Separation of Concerns
Each layer has a single, well-defined responsibility:
- **Core**: HTTP handling and configuration
- **Security**: Input validation and sanitization
- **Services**: Business logic
- **Helpers**: Shared utilities

### 2. DRY (Don't Repeat Yourself)
- Common logic extracted into reusable functions
- No code duplication across the codebase
- Shared utilities in helper functions

### 3. Single Responsibility Principle
- Each class has one clear purpose
- Methods do one thing well
- Easy to understand and maintain

### 4. Type Safety
- Strict typing throughout (`declare(strict_types=1)`)
- Type hints for all parameters and return values
- Prevents type-related bugs

### 5. Security First
- All paths validated before use
- All inputs sanitized
- Path traversal protection

## Architecture Layers

### Layer 1: Core (`src/Core/`)

**Purpose**: Foundation classes for HTTP handling and configuration

#### Config.php
- Loads configuration from files
- Merges defaults with local overrides
- Provides static access to configuration

```php
Config::load();                    // Load configuration
$value = Config::get('KEY');       // Get value
Config::set('KEY', $value);        // Set value
```

#### Request.php
- Wraps PHP superglobals ($_GET, $_POST, $_FILES)
- Provides clean interface for request data
- Type-safe access methods

```php
$path = Request::get('path', '');      // GET parameter
$name = Request::post('name', '');     // POST parameter
$files = Request::files('files');      // Uploaded files
```

#### Response.php
- Builds JSON responses
- Sets appropriate HTTP status codes
- Consistent response structure

```php
Response::success('OK', ['data' => $data]);
Response::error('Error message', 400);
Response::notFound('Resource not found');
```

### Layer 2: Security (`src/Security/`)

**Purpose**: Input validation and sanitization

#### PathValidator.php
- Validates paths against storage root
- Prevents path traversal attacks
- Normalizes paths
- Builds breadcrumbs

```php
$validated = PathValidator::validatePath($relativePath);
// Returns: ['absolute' => '/full/path', 'relative' => 'normalized/path']
// Or null if invalid
```

#### Sanitizer.php
- Sanitizes filenames and path segments
- Removes dangerous characters
- Handles folder upload paths

```php
$safe = Sanitizer::sanitizeFilename($filename);
$safe = Sanitizer::sanitizeSegment($segment);
$safe = Sanitizer::sanitizeRelativePath($path);
```

### Layer 3: Services (`src/Services/`)

**Purpose**: Business logic for file operations

#### StorageService.php
- Calculates storage metrics
- Checks available disk space
- Provides storage information

```php
$service = new StorageService();
$info = $service->getStorageInfo();
// Returns: ['totalBytes', 'freeBytes', 'usedBytes', 'usedPercent']
```

#### DirectoryService.php
- Lists directory contents
- Creates directories
- Deletes directories (recursive)
- Renames directories

```php
$service = new DirectoryService();
$result = $service->listDirectory($path);
$result = $service->createDirectory($path, $name);
$result = $service->deleteDirectory($path, $name);
$result = $service->renameDirectory($path, $old, $new);
```

#### FileService.php
- Deletes files
- Renames files
- Moves files and directories

```php
$service = new FileService();
$result = $service->deleteFile($path, $filename);
$result = $service->renameFile($path, $old, $new);
$result = $service->moveItem($from, $type, $name, $to);
```

#### UploadService.php
- Handles file uploads (standard and chunked)
- Checks disk space availability
- Creates nested directories for folder uploads

```php
$service = new UploadService();
$result = $service->handleUpload($path);
// Processes $_FILES and returns per-file results
```

### Layer 4: Helpers (`src/Helpers/`)

**Purpose**: Shared utility functions

```php
use function NanoCloud\Helpers\applyPermissions;
use function NanoCloud\Helpers\recursiveDelete;
use function NanoCloud\Helpers\checkOperationAllowed;
use function NanoCloud\Helpers\getUploadErrorMessage;
use function NanoCloud\Helpers\formatBytes;
use function NanoCloud\Helpers\ensureDirectoryExists;
```

## Frontend Architecture

The frontend is built with vanilla JavaScript (ES6+) using a modular architecture, avoiding heavy frameworks to maintain speed and simplicity.

### Core Modules

- **`nanocloudClient.js`**: API client wrapper (handles HTTP requests)
- **`state.js`**: Centralized state management (current path, items, etc.)
- **`main.js`**: Entry point and initialization

### UI Modules (`public/assets/js/ui/`)

- **`list.js`**: Handles file list rendering and interactions. Uses **Event Delegation** on the main container to efficiently handle clicks for thousands of items without binding individual listeners. Also manages Shift+Click range selection, Ctrl+Click pivot setting, and pushes `history.pushState` entries on folder navigation to enable browser back / swipe-back.
- **`contextMenu.js`**: Custom context menu implementation with positioning logic and backdrop handling.
- **`inputHandlers.js`**: Single consolidated module for **all** keyboard shortcuts and touch/gesture handling. Replaces the former `keyboardShortcuts.js` and `touchHandlers.js`. Exports `initInputHandlers(config)`, `updateInputHandlerItems(items)`, and `cleanupInputHandlers()`. See [Key Patterns](#key-patterns) below.
- **`itemActions.js`**: Handlers for file operations (delete, rename, move, share).
- **`selection.js`**: Manages selection state (single/multi-select, pivot tracking, range selection). Exports `setPivot`/`getPivot` and `selectRange` in addition to the core selection API (`getSelectedItems`, `toggleItemSelection`, `selectAll`, `deselectAll`, `clearSelection`, `isSelected`).

### Key Patterns

#### Event Delegation
To maximize performance with large file lists, `list.js` uses a single event listener on the parent container (`#fileList`) to handle:
- Navigation (folder clicks)
- Selection (Ctrl/Cmd + click)
- Context actions (right-click)
- Mobile gestures

#### Smart Context Menu
The system handles hybrid inputs (mouse + touch) by intelligently detecting the input source:
- **Desktop**: Right-click triggers custom context menu
- **Mobile**: Long-press (500ms) triggers context menu
- **Hybrid**: "Smart Suppression" prevents double-firing on touch devices

#### Consolidated Input Handling (`inputHandlers.js`)
All keyboard and touch logic lives in a single module initialized once from `main.js`:

```js
initInputHandlers({
  onUpload, onRefresh, onHelp, onCloseModals,
  onNavigateUp, onDelete, onRename, onMove,
  onItemClick, onMenuBuild,
  fileListEl: document.getElementById('fileList'),
});
```

After every render, `list.js` calls `updateInputHandlerItems(items)` to keep the module's item reference current.

**Keyboard shortcuts handled:**

| Key | Behaviour |
|-----|-----------|
| `Ctrl/Cmd + U` | Open upload modal |
| `Ctrl/Cmd + A` | Select all items |
| `Ctrl/Cmd + R` / `F5` | Refresh listing |
| `F1` | Open help/info modal |
| `F2` | Rename selected item (single selection) |
| `Escape` | Close modals + deselect all |
| `Delete` | Delete selected items |
| `Backspace` | Navigate up one directory (clears selection first) |
| Mouse button 3 (Back) | Navigate up one directory (clears selection first) |
| Mouse button 4 (Forward) | Suppressed (no forward history) |

**Touch gestures handled:**

| Gesture | Behaviour |
|---------|-----------|
| Tap | Open file / enter folder |
| Long-press (500 ms) on unselected item | Enter selection mode; select item |
| Long-press (500 ms) on selected item | Show context menu |
| Tap while items are selected | Toggle item selection |
| Scroll / drag | Cancels long-press timer |
| Browser swipe-back | Navigate up (via History API `popstate`) |

#### Pivot-Based Range Selection
`selection.js` tracks a *pivot* — the anchor item for range operations:

- **Ctrl+Click**: sets pivot, toggles item
- **Shift+Click**: selects the contiguous range from pivot → clicked item
- **Plain click**: sets pivot, selects only that item

#### Browser History Integration
`list.js` calls `history.pushState({ path }, '', window.location.pathname)` on every folder entry — the path is stored **only in the state object**, not in the URL bar, keeping the address bar clean at all times.

`main.js` listens for `popstate` and navigates to `e.state.path` (after calling `deselectAll()`), enabling:
- Browser back button
- Mouse back button (button 3)
- Swipe-back on mobile/trackpad

All navigation paths (breadcrumbs, Up button, Backspace, mouse back, browser back) call `deselectAll()` before navigating to keep selection state consistent.

> **Note:** Deep-link folder share URLs (generated by the Share action) still use `#path=` hashes and open in a new tab — this is intentional and separate from the in-app navigation history.

## Request Flow

### 1. List Directory
```
Browser → api.php?action=list&path=folder
    ↓
Request::input('action') → 'list'
    ↓
handleList()
    ↓
DirectoryService::listDirectory($path)
    ↓
PathValidator::validatePath($path)
    ↓
scandir() + filter hidden files
    ↓
Response::json($result)
    ↓
Browser receives JSON
```

### 2. Upload File

**Standard Upload (Small Files)**:
```
Browser → api.php (POST with files)
    ↓
Request::input('action') → 'upload'
    ↓
handleUpload()
    ↓
UploadService::handleUpload($path)
    ↓
checkOperationAllowed('upload')
    ↓
PathValidator::validatePath($path)
    ↓
For each file:
  - Check disk space
  - Sanitize path
  - Move directly to final location
  - Apply permissions
    ↓
Response::json($results)
    ↓
Browser receives per-file results
```

**Chunked Upload (Large Files)**:
For files larger than 2MB, the web UI uses chunked uploads to bypass PHP size limits (threshold and chunk size are configured in `public/assets/js/constants.js`).
See [CHUNKED_UPLOAD.md](CHUNKED_UPLOAD.md) for detailed documentation.

```
Browser → api.php (POST chunk)
    ↓
Request::input('action') → 'upload_chunk'
    ↓
handleUploadChunk()
    ↓
UploadService::handleChunk()
    ↓
Save chunk to temp/chunks/{uploadId}/{index}.part
    ↓
Last chunk? → Merge all chunks → Final file
    ↓
Response::json($result)
```

### 3. Delete File
```
Browser → api.php (POST)
    ↓
Request::input('action') → 'delete'
    ↓
handleDelete()
    ↓
FileService::deleteFile($path, $filename)
    ↓
checkOperationAllowed('delete')
    ↓
PathValidator::validatePath($path)
    ↓
Sanitizer::sanitizeSegment($filename)
    ↓
unlink($file)
    ↓
Response::json($result)
```

## Security Measures

### 1. Path Traversal Protection
```php
// All paths validated before use
$validated = PathValidator::validatePath($relativePath);
if ($validated === null) {
    return error('Invalid path');
}

// Verify within storage root
if (!PathValidator::isWithinRoot($root, $path)) {
    return error('Path outside storage root');
}
```

### 2. Input Sanitization
```php
// All filenames sanitized
$safe = Sanitizer::sanitizeFilename($userInput);

// Path segments sanitized
$safe = Sanitizer::sanitizeSegment($segment);

// Reject dangerous patterns
if ($safe === '' || $safe === '.' || $safe === '..') {
    return error('Invalid name');
}
```

### 3. Upload Security
```php
// Validate uploaded file
if (!is_uploaded_file($tmpName)) {
    return error('Invalid upload');
}

// Check disk space
if (!$storageService->hasEnoughSpace($size)) {
    return error('Insufficient disk space');
}

// Transactional upload with rollback
$tmpPart = $tempDir . '/' . uniqid() . '.part';
move_uploaded_file($tmpName, $tmpPart);

if (connection_aborted()) {
    unlink($tmpPart);  // Rollback
    return;
}

rename($tmpPart, $finalPath);  // Atomic
```

### 4. Operation Control
```php
// Check if operation is allowed
$check = checkOperationAllowed('upload');
if (!$check['allowed']) {
    return error($check['message']);
}

// Supports:
// - READ_ONLY (master switch)
// - UPLOAD_ENABLED
// - DELETE_ENABLED
// - RENAME_ENABLED
// - MOVE_ENABLED
```

## Configuration System

### Loading Order
1. Load `config/defaults.php` (default values)
2. Load `config/local.php` if exists (overrides)
3. Set PHP runtime configuration

### Configuration Access
```php
// Get value with default
$value = Config::get('KEY', 'default');

// Set value
Config::set('KEY', $value);

// Get all configuration
$all = Config::all();

// Get temp directory
$temp = Config::getTempDir();
```

## Error Handling

### Consistent Error Responses
```php
// All errors return JSON
Response::error('Error message', 400);

// Results:
{
    "success": false,
    "message": "Error message"
}
```

### Exception Handling
```php
try {
    // Route to handler
    match($action) {
        'list' => handleList(),
        // ...
    };
} catch (Throwable $e) {
    Response::serverError('Server error: ' . $e->getMessage());
}
```

## Performance Optimizations

### 1. Session Management
```php
session_start();
// ... load configuration
session_write_close();  // Release lock early
```

### 2. Transactional Uploads
```php
// Stage in temp directory
move_uploaded_file($tmp, $tempFile);

// Atomic rename (same filesystem)
rename($tempFile, $finalPath);
```

### 3. Efficient Directory Listing
```php
// Single scandir() call
$items = scandir($dir);

// Filter in PHP (fast)
foreach ($items as $item) {
    if ($item[0] === '.') continue;  // Skip hidden
    // ...
}
```

## Testing Checklist

### Backend
- [ ] All paths validated
- [ ] All inputs sanitized
- [ ] Disk space checks enforced
- [ ] Transactional uploads work
- [ ] Rollback on disconnect works
- [ ] All CRUD operations work
- [ ] Permission checks work
- [ ] Configuration loading works

### Frontend
- [ ] File list displays correctly
- [ ] Upload works (files and folders)
- [ ] Delete works
- [ ] Rename works
- [ ] Move works
- [ ] Search works
- [ ] Sort works
- [ ] Multi-select works
- [ ] Keyboard shortcuts work
- [ ] Touch gestures work

### Security
- [ ] Path traversal blocked
- [ ] Hidden files not listed
- [ ] Invalid filenames rejected
- [ ] Disk space checks enforced
- [ ] Operation controls work
- [ ] Download authentication (if added)

## Extension Points

### Adding a New Service Method
1. Add method to appropriate service class
2. Add permission check
3. Validate inputs
4. Perform operation
5. Return structured result

### Adding a New API Endpoint
1. Add case to match expression in `api.php`
2. Create handler function
3. Call service method
4. Return JSON response

### Adding Configuration Option
1. Add to `config/defaults.php`
2. Add to `config/local.php.example`
3. Document in README
4. Use via `Config::get('KEY')`

## Maintenance Guidelines

### Code Style
- Follow PSR-12
- Use strict typing
- Add DocBlocks
- Keep methods small
- One responsibility per class

### Documentation
- Update README for user-facing changes
- Update ARCHITECTURE.md for structural changes
- Add inline comments for complex logic
- Keep examples up to date

### Version Control
- Commit logical units
- Write clear commit messages
- Tag releases
- Maintain CHANGELOG

---

**NanoCloud** - Clean Architecture, Maximum Maintainability
