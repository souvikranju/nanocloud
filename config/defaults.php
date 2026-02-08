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

// Download rate limit in MB/s (0 = unlimited)
$DOWNLOAD_RATE_LIMIT_MB = 0;

// File and directory permissions (octal notation)
$DIR_PERMISSIONS = 0755;  // rwxr-xr-x
$FILE_PERMISSIONS = 0644; // rw-r--r--

// File ownership (set to null to skip, requires appropriate server permissions)
$FILE_OWNER = null;
$FILE_GROUP = null;

// Chunked upload configuration
// Directory for temporary chunk storage (absolute path)
// Default: system temp directory + '/nanocloud-chunks'
$CHUNK_TEMP_DIR = sys_get_temp_dir() . '/nanocloud-chunks';

// Hours to keep incomplete chunk uploads before cleanup
$CHUNK_STALE_HOURS = 2;

// Operation control flags
// Master read-only switch (overrides all other settings)
$READ_ONLY = false;

// Individual operation controls (only evaluated when READ_ONLY = false)
$UPLOAD_ENABLED = true;  // Allow file/folder uploads and folder creation
$DELETE_ENABLED = true;  // Allow file/folder deletion
$RENAME_ENABLED = true;  // Allow file/folder renaming
$MOVE_ENABLED = true;    // Allow file/folder moving
