# Configuration Guide

This guide covers all configuration options available in NanoCloud.

## Configuration System

NanoCloud uses a flexible, layered configuration system that preserves your custom settings during upgrades:

### Configuration Files

1. **`config/defaults.php`** - Default settings (DO NOT EDIT)
2. **`config/local.php`** - Your custom settings (gitignored, preserved during upgrades)
3. **`config/local.php.example`** - Example configuration with all available options

### How It Works

1. System loads `config/defaults.php` first
2. If `config/local.php` exists, it overrides the defaults
3. Your custom settings in `config/local.php` are preserved during updates

## Initial Setup

```bash
# Copy the example file
cp config/local.php.example config/local.php

# Edit with your settings
nano config/local.php
```

## Configuration Options

### Storage Configuration

#### Storage Root Directory

```php
$STORAGE_ROOT = '/path/to/your/storage';
```

**Description:** Absolute path to the directory where uploaded files will be stored.

**Default:** `dirname(__DIR__) . '/storage'` (storage directory in project root)

**Examples:**
```php
// Local storage
$STORAGE_ROOT = '/var/www/nanocloud/storage';

// Network storage
$STORAGE_ROOT = '/mnt/nas/nanocloud';

// User home directory
$STORAGE_ROOT = '/home/username/nanocloud-files';
```

**Important:**
- Must be an absolute path
- Web server must have read/write permissions
- Should NOT be inside the `public/` directory for security

### Upload Limits

#### Maximum File Size

```php
$USER_DEFINED_MAX_FILE_SIZE = 5368709120; // 5GB in bytes
```

**Description:** Maximum size for a single uploaded file.

**Default:** `5368709120` (5GB)

**Examples:**
```php
// 100MB
$USER_DEFINED_MAX_FILE_SIZE = 104857600;

// 1GB
$USER_DEFINED_MAX_FILE_SIZE = 1073741824;

// 10GB
$USER_DEFINED_MAX_FILE_SIZE = 10737418240;

// No limit (use PHP's limit)
$USER_DEFINED_MAX_FILE_SIZE = null;
```

**Note:** This must be less than or equal to PHP's `upload_max_filesize` and `post_max_size` settings.

#### Maximum Session Size

```php
$MAX_SESSION_BYTES = 5368709120; // 5GB in bytes
```

**Description:** Maximum total size of all files uploaded in a single session.

**Default:** `5368709120` (5GB)

**Purpose:** Prevents a single user from uploading unlimited data in one session.

**Examples:**
```php
// 500MB per session
$MAX_SESSION_BYTES = 524288000;

// 10GB per session
$MAX_SESSION_BYTES = 10737418240;

// No limit
$MAX_SESSION_BYTES = null;
```

### Download Settings

#### Download Rate Limiting

```php
$DOWNLOAD_RATE_LIMIT_MB = 10; // MB/s
```

**Description:** Limits download speed to prevent bandwidth saturation.

**Default:** `0` (unlimited)

**Examples:**
```php
// Unlimited
$DOWNLOAD_RATE_LIMIT_MB = 0;

// 5 MB/s
$DOWNLOAD_RATE_LIMIT_MB = 5;

// 50 MB/s
$DOWNLOAD_RATE_LIMIT_MB = 50;
```

**Use Cases:**
- Prevent single downloads from saturating network
- Ensure fair bandwidth distribution
- Limit bandwidth usage on metered connections

### File Permissions

#### Directory Permissions

```php
$DIR_PERMISSIONS = 0755; // rwxr-xr-x
```

**Description:** Unix permissions for newly created directories.

**Default:** `0755` (owner: rwx, group: r-x, others: r-x)

**Common Values:**
```php
// Owner only
$DIR_PERMISSIONS = 0700; // rwx------

// Owner and group
$DIR_PERMISSIONS = 0750; // rwxr-x---

// Everyone (not recommended)
$DIR_PERMISSIONS = 0777; // rwxrwxrwx
```

#### File Permissions

```php
$FILE_PERMISSIONS = 0644; // rw-r--r--
```

**Description:** Unix permissions for uploaded files.

**Default:** `0644` (owner: rw, group: r, others: r)

**Common Values:**
```php
// Owner only
$FILE_PERMISSIONS = 0600; // rw-------

// Owner and group
$FILE_PERMISSIONS = 0640; // rw-r-----

// Everyone can read
$FILE_PERMISSIONS = 0644; // rw-r--r--
```

### File Ownership

#### Owner and Group

```php
$FILE_OWNER = 'username';
$FILE_GROUP = 'groupname';
```

**Description:** Change owner/group of uploaded files and created directories.

**Default:** `null` (no change, uses web server user)

**Requirements:**
- Web server must run as root OR
- Web server user must have appropriate privileges

**Examples:**
```php
// Set to specific user
$FILE_OWNER = 'john';
$FILE_GROUP = 'users';

// Set to web server user (usually not needed)
$FILE_OWNER = 'www-data';
$FILE_GROUP = 'www-data';

// No change (default)
$FILE_OWNER = null;
$FILE_GROUP = null;
```

**Warning:** Changing ownership requires elevated privileges. Most installations should leave these as `null`.

### Operation Control

These settings provide granular control over which operations are allowed system-wide.

#### Read-Only Mode

```php
$READ_ONLY = false;
```

**Description:** Master switch that disables ALL write operations.

**Default:** `false`

**When `true`:**
- All uploads blocked
- All deletions blocked
- All renames blocked
- All moves blocked
- All folder creation blocked

**Use Cases:**
- Maintenance mode
- Backup operations
- Archive/read-only deployment
- Temporary restriction during system changes

#### Upload Control

```php
$UPLOAD_ENABLED = true;
```

**Description:** Controls file/folder uploads and folder creation.

**Default:** `true`

**When `false`:**
- Upload button disabled
- Drag & drop disabled
- New folder button disabled
- API upload endpoints return error

**Use Cases:**
- Prevent new content during migration
- Restrict uploads while allowing other operations
- Archive mode (view/download only)

#### Delete Control

```php
$DELETE_ENABLED = true;
```

**Description:** Controls file and folder deletion.

**Default:** `true`

**When `false`:**
- Delete button disabled
- Delete keyboard shortcut disabled
- API delete endpoints return error

**Use Cases:**
- Prevent accidental deletions
- Preserve historical data
- Compliance requirements

#### Rename Control

```php
$RENAME_ENABLED = true;
```

**Description:** Controls file and folder renaming.

**Default:** `true`

**When `false`:**
- Rename button disabled
- F2 keyboard shortcut disabled
- API rename endpoints return error

**Use Cases:**
- Maintain consistent naming
- Prevent confusion during shared access
- Lock file structure

#### Move Control

```php
$MOVE_ENABLED = true;
```

**Description:** Controls moving files and folders between directories.

**Default:** `true`

**When `false`:**
- Move button disabled
- API move endpoints return error

**Use Cases:**
- Maintain directory structure
- Prevent accidental moves
- Simplify interface for basic users

### Configuration Priority

Operations are checked in this order:

1. **`READ_ONLY`** - If `true`, ALL write operations blocked (highest priority)
2. **Individual flags** - Only checked if `READ_ONLY = false`

**Example:**
```php
// This configuration allows ONLY downloads and viewing
$READ_ONLY = false;
$UPLOAD_ENABLED = false;
$DELETE_ENABLED = false;
$RENAME_ENABLED = false;
$MOVE_ENABLED = false;
```

### UI Behavior

When operations are disabled:

- **Buttons are dimmed** and show tooltips
- **Keyboard shortcuts are disabled**
- **API calls return error messages**

**Tooltip Messages:**
- When `READ_ONLY = true`: "System is read-only"
- When specific feature disabled: "[Feature] disabled by administrator"

## PHP Settings

In addition to NanoCloud configuration, you need to configure PHP:

### php.ini Settings

```ini
# Enable file uploads
file_uploads = On

# Maximum file size (must be >= NanoCloud's limit)
upload_max_filesize = 5G

# Maximum POST size (must be >= upload_max_filesize)
post_max_size = 5G

# Maximum number of files per upload
max_file_uploads = 50

# Maximum execution time (for large uploads)
max_execution_time = 300

# Maximum input time
max_input_time = 300

# Memory limit
memory_limit = 256M
```

### Finding php.ini

```bash
# Find php.ini location
php --ini

# Or check in phpinfo
php -r "phpinfo();" | grep "Loaded Configuration File"
```

### Restart PHP After Changes

```bash
# PHP-FPM
sudo systemctl restart php8.0-fpm

# Apache with mod_php
sudo systemctl restart apache2

# Nginx with PHP-FPM
sudo systemctl restart php8.0-fpm
```

## Frontend Configuration

Frontend constants are in `public/assets/js/constants.js`:

```javascript
// Upload settings
export const MAX_CONCURRENT_UPLOADS = 3;
export const UPLOAD_PROGRESS_AUTO_HIDE_MS = 5000;

// UI settings
export const REFRESH_DEBOUNCE_MS = 300;
export const LONG_PRESS_DURATION_MS = 500;
export const TOAST_AUTO_DISMISS_MS = 5000;
```

## Example Configurations

### Home Network Setup

```php
<?php
// Generous limits for home use
$STORAGE_ROOT = '/mnt/nas/family-files';
$USER_DEFINED_MAX_FILE_SIZE = 10737418240; // 10GB
$MAX_SESSION_BYTES = 53687091200; // 50GB
$DOWNLOAD_RATE_LIMIT_MB = 0; // Unlimited
$DIR_PERMISSIONS = 0755;
$FILE_PERMISSIONS = 0644;

// All operations enabled
$READ_ONLY = false;
$UPLOAD_ENABLED = true;
$DELETE_ENABLED = true;
$RENAME_ENABLED = true;
$MOVE_ENABLED = true;
```

### Office/Shared Environment

```php
<?php
// Moderate limits with some restrictions
$STORAGE_ROOT = '/var/www/shared-files';
$USER_DEFINED_MAX_FILE_SIZE = 2147483648; // 2GB
$MAX_SESSION_BYTES = 10737418240; // 10GB per session
$DOWNLOAD_RATE_LIMIT_MB = 10; // 10 MB/s
$DIR_PERMISSIONS = 0750;
$FILE_PERMISSIONS = 0640;

// Prevent deletions and moves
$READ_ONLY = false;
$UPLOAD_ENABLED = true;
$DELETE_ENABLED = false; // Prevent accidental deletions
$RENAME_ENABLED = true;
$MOVE_ENABLED = false; // Maintain structure
```

### Archive/Read-Only Mode

```php
<?php
// Read-only archive
$STORAGE_ROOT = '/archive/historical-files';
$DOWNLOAD_RATE_LIMIT_MB = 5;

// Everything disabled
$READ_ONLY = true; // Master switch
$UPLOAD_ENABLED = false;
$DELETE_ENABLED = false;
$RENAME_ENABLED = false;
$MOVE_ENABLED = false;
```

### Guest Upload Station

```php
<?php
// Upload-only for guests
$STORAGE_ROOT = '/incoming/guest-uploads';
$USER_DEFINED_MAX_FILE_SIZE = 524288000; // 500MB
$MAX_SESSION_BYTES = 1073741824; // 1GB per session
$DIR_PERMISSIONS = 0755;
$FILE_PERMISSIONS = 0644;

// Only uploads allowed
$READ_ONLY = false;
$UPLOAD_ENABLED = true;
$DELETE_ENABLED = false; // Can't delete
$RENAME_ENABLED = false; // Can't rename
$MOVE_ENABLED = false; // Can't move
```

## Troubleshooting Configuration

### Changes Not Taking Effect

1. **Clear PHP opcode cache:**
   ```bash
   # PHP-FPM
   sudo systemctl restart php8.0-fpm
   
   # Apache
   sudo systemctl restart apache2
   ```

2. **Check file permissions:**
   ```bash
   ls -la config/local.php
   # Should be readable by web server
   ```

3. **Verify syntax:**
   ```bash
   php -l config/local.php
   ```

### Permission Errors

```bash
# Fix config file permissions
chmod 644 config/local.php
chown www-data:www-data config/local.php

# Fix storage permissions
chmod 755 storage
chown www-data:www-data storage
```

### Upload Limits Not Working

1. Check PHP settings are higher than NanoCloud settings
2. Restart PHP after changing php.ini
3. Check web server limits (Nginx has `client_max_body_size`)

## Security Best Practices

1. **Never commit `config/local.php`** to version control
2. **Use restrictive permissions** on config files (644 or 640)
3. **Set appropriate file/directory permissions** based on your security needs
4. **Enable rate limiting** on public-facing deployments
5. **Use `READ_ONLY` mode** during maintenance
6. **Regularly review** operation control settings

## See Also

- [Quick Start Guide](QUICK_START.md) - Initial setup
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [Architecture Guide](ARCHITECTURE.md) - How configuration is loaded

---

**Last Updated:** January 21, 2026
