<?php
/**
 * Default Configuration for NanoCloud
 * 
 * These are the default settings. Override them in config/local.php
 * which is gitignored and preserved during updates.
 */

declare(strict_types=1);

// Storage root directory (absolute path)
// Default: storage directory in project root
$STORAGE_ROOT = dirname(__DIR__) . '/storage';

// Maximum file size in bytes (user-defined limit)
// This will be compared with PHP's upload_max_filesize and post_max_size
// The smallest value will be used
$USER_DEFINED_MAX_FILE_SIZE = 5368709120; // 5GB

// Maximum total upload size per session in bytes
$MAX_SESSION_BYTES = 5368709120; // 5GB

// Download rate limit in MB/s (0 = unlimited)
$DOWNLOAD_RATE_LIMIT_MB = 0;

// File and directory permissions (octal notation)
$DIR_PERMISSIONS = 0755;  // rwxr-xr-x
$FILE_PERMISSIONS = 0644; // rw-r--r--

// File ownership (set to null to skip, requires appropriate server permissions)
$FILE_OWNER = null;
$FILE_GROUP = null;

// Operation control flags
// Master read-only switch (overrides all other settings)
$READ_ONLY = false;

// Individual operation controls (only evaluated when READ_ONLY = false)
$UPLOAD_ENABLED = true;  // Allow file/folder uploads and folder creation
$DELETE_ENABLED = true;  // Allow file/folder deletion
$RENAME_ENABLED = true;  // Allow file/folder renaming
$MOVE_ENABLED = true;    // Allow file/folder moving
