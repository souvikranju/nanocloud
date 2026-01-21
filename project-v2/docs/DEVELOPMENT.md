# Development Guide

This guide is for developers who want to extend, customize, or contribute to NanoCloud.

## Development Setup

### Prerequisites

- PHP 8.0+ with development extensions
- Git
- Text editor or IDE (VS Code, PHPStorm, etc.)
- Web server (Apache/Nginx) or PHP built-in server

### Clone and Setup

```bash
# Clone repository
git clone https://github.com/souvikranju/nanocloud.git
cd nanocloud

# Copy configuration
cp config/local.php.example config/local.php

# Edit configuration
nano config/local.php

# Set permissions
chmod 755 storage
```

### Development Server

```bash
# Start PHP built-in server
cd public
php -S localhost:8000

# Access at http://localhost:8000
```

## Architecture Overview

### Backend Structure

```
src/
├── autoload.php          # PSR-4 autoloader
├── Core/                 # Core functionality
│   ├── Config.php       # Configuration management
│   ├── Request.php      # HTTP request wrapper
│   └── Response.php     # JSON response builder
├── Security/             # Security layer
│   ├── PathValidator.php # Path traversal protection
│   └── Sanitizer.php    # Input sanitization
├── Services/             # Business logic
│   ├── DirectoryService.php
│   ├── FileService.php
│   ├── UploadService.php
│   └── StorageService.php
└── Helpers/              # Utility functions
    └── functions.php
```

### Request Flow

```
1. Browser → public/api.php
2. Load autoloader
3. Parse request (Core/Request)
4. Validate & sanitize (Security layer)
5. Execute business logic (Services)
6. Return response (Core/Response)
```

## Adding New Features

### Example: Adding a Copy File Feature

#### 1. Add Service Method

```php
// src/Services/FileService.php

/**
 * Copy a file to a new location
 *
 * @param string $sourcePath Source file path
 * @param string $targetPath Target file path
 * @return array Result with success status and message
 */
public function copyFile(string $sourcePath, string $targetPath): array
{
    // Check if operation is allowed
    $check = checkOperationAllowed('upload');
    if (!$check['allowed']) {
        return ['success' => false, 'message' => $check['message']];
    }
    
    // Validate paths
    $sourceValidated = PathValidator::validatePath($sourcePath);
    $targetValidated = PathValidator::validatePath($targetPath);
    
    if (!$sourceValidated['valid'] || !$targetValidated['valid']) {
        return ['success' => false, 'message' => 'Invalid path'];
    }
    
    $sourceFile = $sourceValidated['absolute'];
    $targetFile = $targetValidated['absolute'];
    
    // Check source exists
    if (!file_exists($sourceFile)) {
        return ['success' => false, 'message' => 'Source file not found'];
    }
    
    // Check target doesn't exist
    if (file_exists($targetFile)) {
        return ['success' => false, 'message' => 'Target file already exists'];
    }
    
    // Copy file
    if (!@copy($sourceFile, $targetFile)) {
        return ['success' => false, 'message' => 'Failed to copy file'];
    }
    
    // Set permissions
    @chmod($targetFile, Config::get('FILE_PERMISSIONS', 0644));
    
    return [
        'success' => true,
        'message' => 'File copied successfully'
    ];
}
```

#### 2. Add API Endpoint

```php
// public/api.php

$action = Request::get('action', '');

$result = match($action) {
    'list' => handleList(),
    'upload' => handleUpload(),
    'delete' => handleDelete(),
    'copy' => handleCopy(),  // NEW
    // ... other actions
    default => Response::error('Unknown action.')
};

function handleCopy(): never
{
    $service = new FileService();
    $result = $service->copyFile(
        Request::post('source', ''),
        Request::post('target', '')
    );
    Response::json($result);
}
```

#### 3. Add Frontend Function

```javascript
// public/assets/js/nanocloudClient.js

/**
 * Copy a file
 * @param {string} sourcePath Source file path
 * @param {string} targetPath Target file path
 * @returns {Promise<any>}
 */
export function copyFile(sourcePath, targetPath) {
  const form = new FormData();
  form.append('action', 'copy');
  form.append('source', sourcePath);
  form.append('target', targetPath);
  return postForm(form);
}
```

#### 4. Add UI Integration

```javascript
// public/assets/js/ui/itemActions.js

async function handleCopyItem(item) {
  const newName = prompt(`Copy ${item.name} as:`, item.name);
  if (!newName) return;
  
  const result = await copyFile(
    state.currentPath + '/' + item.name,
    state.currentPath + '/' + newName
  );
  
  if (result.success) {
    showToast('File copied successfully', 'success');
    await refreshListing();
  } else {
    showToast(result.message, 'error');
  }
}
```

## Code Style Guidelines

### PHP Standards

Follow PSR-12 coding standards:

```php
<?php

declare(strict_types=1);

namespace NanoCloud\Services;

use NanoCloud\Core\Config;
use NanoCloud\Security\PathValidator;

/**
 * Service for file operations
 */
class FileService
{
    /**
     * Delete a file
     *
     * @param string $path File path
     * @return array Result array
     */
    public function deleteFile(string $path): array
    {
        // Implementation
    }
}
```

**Key Points:**
- Strict types declaration
- Proper namespacing
- DocBlocks for all public methods
- Type hints for parameters and return values
- PSR-12 formatting (4 spaces, opening braces on same line)

### JavaScript Standards

Use ES6+ modules:

```javascript
/**
 * Delete a file
 * @param {string} path File path
 * @param {string} filename Filename
 * @returns {Promise<any>}
 */
export function deleteFile(path, filename) {
  const form = new FormData();
  form.append('action', 'delete');
  form.append('path', path);
  form.append('filename', filename);
  return postForm(form);
}
```

**Key Points:**
- JSDoc comments
- ES6 modules (import/export)
- Const/let (no var)
- Arrow functions where appropriate
- Async/await for promises

### CSS Standards

Use modular CSS with BEM naming:

```css
/* Component: file-item */
.file-item {
  display: flex;
  padding: var(--spacing-md);
}

.file-item__icon {
  width: 24px;
  height: 24px;
}

.file-item__name {
  flex: 1;
  font-size: var(--font-size-base);
}

.file-item--selected {
  background-color: var(--color-primary-light);
}
```

## Testing

### Manual Testing Checklist

- [ ] Upload single file
- [ ] Upload multiple files
- [ ] Upload folder
- [ ] Create directory
- [ ] Delete file
- [ ] Delete directory
- [ ] Rename file
- [ ] Rename directory
- [ ] Move file
- [ ] Move directory
- [ ] Search (quick and deep)
- [ ] Sort (all modes)
- [ ] Multi-select operations
- [ ] Keyboard shortcuts
- [ ] Touch gestures (mobile)
- [ ] Grid/list view toggle

### Testing New Features

```bash
# Test PHP syntax
php -l src/Services/YourService.php

# Test configuration loading
php -r "require 'src/autoload.php'; var_dump(NanoCloud\Core\Config::get('STORAGE_ROOT'));"

# Test API endpoint
curl -X POST http://localhost:8000/api.php \
  -F "action=your_action" \
  -F "param=value"
```

## Debugging

### Enable PHP Error Display

```php
// public/index.php or public/api.php (temporary, for development only)
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);
```

### Check PHP Error Logs

```bash
# Find PHP error log
php -i | grep error_log

# Tail error log
tail -f /var/log/php-fpm/error.log
```

### Browser Console

```javascript
// Enable verbose logging
localStorage.setItem('debug', 'true');

// Check state
console.log(state);

// Test API call
import { list } from './nanocloudClient.js';
list('').then(console.log);
```

## Common Development Tasks

### Adding a New Configuration Option

1. **Add to `config/defaults.php`:**
```php
$NEW_OPTION = 'default_value';
```

2. **Add to `config/local.php.example`:**
```php
// Description of what this does
$NEW_OPTION = 'default_value';
```

3. **Use in code:**
```php
$value = Config::get('NEW_OPTION', 'fallback');
```

4. **Document in `docs/CONFIGURATION.md`**

### Adding a New Service

1. **Create service file:**
```php
// src/Services/MyService.php
<?php

declare(strict_types=1);

namespace NanoCloud\Services;

class MyService
{
    public function doSomething(): array
    {
        return ['success' => true];
    }
}
```

2. **Use in API:**
```php
// public/api.php
use NanoCloud\Services\MyService;

$service = new MyService();
$result = $service->doSomething();
```

### Modifying Frontend UI

1. **Identify component** in `public/assets/js/ui/`
2. **Make changes** following existing patterns
3. **Test in browser**
4. **Check mobile responsiveness**

## Performance Optimization

### Backend

- Use `session_write_close()` for non-blocking requests
- Implement caching where appropriate
- Optimize file operations (batch when possible)
- Use generators for large datasets

### Frontend

- Debounce expensive operations
- Use virtual scrolling for large lists
- Lazy load images
- Minimize DOM manipulations

## Security Considerations

### Always Validate Input

```php
// Bad
$path = $_POST['path'];
$file = $STORAGE_ROOT . '/' . $path;

// Good
$path = Request::post('path', '');
$validated = PathValidator::validatePath($path);
if (!$validated['valid']) {
    return Response::error('Invalid path');
}
$file = $validated['absolute'];
```

### Sanitize Output

```php
// Sanitize filenames
$safeName = Sanitizer::sanitizeFilename($userInput);

// Sanitize paths
$safePath = Sanitizer::sanitizePath($userInput);
```

### Check Permissions

```php
// Always check if operation is allowed
$check = checkOperationAllowed('delete');
if (!$check['allowed']) {
    return ['success' => false, 'message' => $check['message']];
}
```

## Contributing

### Contribution Workflow

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Commit** with clear messages
6. **Push** to your fork
7. **Submit** a pull request

### Commit Message Format

```
type: brief description

Detailed explanation of what changed and why.

Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

### Pull Request Guidelines

- Clear description of changes
- Reference related issues
- Include screenshots for UI changes
- Ensure all tests pass
- Follow code style guidelines

## Resources

- **PSR-12:** https://www.php-fig.org/psr/psr-12/
- **MDN Web Docs:** https://developer.mozilla.org/
- **PHP Manual:** https://www.php.net/manual/
- **ES6 Features:** https://es6-features.org/

## Getting Help

- **GitHub Issues:** Report bugs or request features
- **GitHub Discussions:** Ask questions
- **Documentation:** Check other docs in `/docs`

---

**Happy Coding!** 🚀

**Last Updated:** January 21, 2026
