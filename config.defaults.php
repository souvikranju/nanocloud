<?php
// config.defaults.php
// Default configuration template for NanoCloud
// 
// IMPORTANT: Do NOT modify this file directly!
// 
// To customize settings:
// 1. Copy the example file: cp config.local.php.example config.local.php
// 2. Edit config.local.php with your custom values
// 3. Your config.local.php will be preserved during git pull/upgrades
//
// This file is tracked by git and will be updated with new releases.

// required config for php.ini
// file_uploads = On
// upload_max_filesize = 2G     # Must match or exceed MAX_UPLOAD_BYTES
// post_max_size = 2G           # Must be >= upload_max_filesize
// max_file_uploads = 50        # Number of files per request

declare(strict_types=1);

// ============================================
// DEFAULT CONFIGURATION VALUES
// ============================================

// Storage root directory (absolute path)
// Default: '/home/pi/FTP/dropbox'
$STORAGE_ROOT = '/home/pi/FTP/dropbox';

// User-defined maximum file size in bytes
// Default: 2147483648 (2GB)
$user_defined_max = 2147483648; // 2GB

// Maximum session size in bytes
// Default: 2147483648 (2GB)
$MAX_SESSION_BYTES = 2147483648;

// Download rate limit in MB/s (0 = unlimited)
// Default: 5 MB/s
$DOWNLOAD_RATE_LIMIT_MB = 5;

// File and directory permissions
// Directory permissions: 0755 = rwxr-xr-x (owner: full, group/others: read+execute)
// File permissions: 0644 = rw-r--r-- (owner: read+write, group/others: read-only)
$DIR_PERMISSIONS = 0755;
$FILE_PERMISSIONS = 0644;

// Optional: Change owner/group for uploaded/created files and directories
// Leave null to keep default web server user (typically www-data)
// Note: Changing ownership typically requires root privileges or specific server configuration
$FILE_OWNER = null;   // e.g., 'username' or null
$FILE_GROUP = null;   // e.g., 'groupname' or null
