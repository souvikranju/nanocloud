<?php
/**
 * Default Configuration for NanoCloud
 * 
 * These are the default settings. Override them in config/local.php
 * which is gitignored and preserved during updates.
 */

declare(strict_types=1);

// ============================================
// STORAGE CONFIGURATION
// ============================================
// Storage root directory (absolute path)
// Default: storage directory in project root
$STORAGE_ROOT = dirname(__DIR__) . '/storage';

// ============================================
// DOWNLOAD CONFIGURATION
// ============================================
// Download rate limit in MB/s (0 = unlimited)
$DOWNLOAD_RATE_LIMIT_MB = 0;

// ============================================
// PERMISSIONS
// ============================================
// File and directory permissions for uploaded/created items
// Directory permissions (octal notation)
$DIR_PERMISSIONS = 0755;  // rwxr-xr-x

// File permissions (octal notation)
$FILE_PERMISSIONS = 0644; // rw-r--r--

// ============================================
// OWNERSHIP (requires appropriate privileges)
// ============================================
// Change owner for uploaded/created files and directories
$FILE_OWNER = null;
$FILE_GROUP = null;

// ============================================
// UPLOAD CONFIGURATION
// ============================================
// Chunked upload configuration
// Temporary directory for chunk storage
// Default: system temp directory + '/nanocloud-chunks'
$CHUNK_TEMP_DIR = sys_get_temp_dir() . '/nanocloud-chunks';

// Hours to keep incomplete chunk uploads before cleanup
$CHUNK_STALE_HOURS = 2;

// ============================================
// OPERATION CONTROL
// ============================================
// Master read-only switch (overrides all other settings)
$READ_ONLY = false;

// Individual operation controls (only evaluated when READ_ONLY = false)
$UPLOAD_ENABLED = true;  // Allow file/folder uploads and folder creation
$DELETE_ENABLED = true;  // Allow file/folder deletion
$RENAME_ENABLED = true;  // Allow file/folder renaming
$MOVE_ENABLED = true;    // Allow file/folder moving
