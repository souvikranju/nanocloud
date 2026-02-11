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

- **`list.js`**: Handles file list rendering and interactions. Uses **Event Delegation** on the main container to efficiently handle clicks for thousands of items without binding individual listeners.
- **`contextMenu.js`**: Custom context menu implementation with positioning logic and backdrop handling.
- **`touchHandlers.js`**: specialized touch logic (long-press detection) for mobile devices, integrating with the context menu.
- **`itemActions.js`**: Handlers for file operations (delete, rename, move).
- **`selection.js`**: Manages selection state (single/multi-select).

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
