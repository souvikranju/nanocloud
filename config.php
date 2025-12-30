<?php
// config.php
// Centralized configuration/constants for the upload app.

// required config for php.ini
// file_uploads = On
// upload_max_filesize = 2G     # Must match or exceed MAX_UPLOAD_BYTES
// post_max_size = 2G           # Must be >= upload_max_filesize
// max_file_uploads = 50        # Number of files per request

declare(strict_types=1);

// Upload root directory (absolute)
// define('UPLOAD_DIR', '/home/pi/FTP/dropbox');
define('UPLOAD_DIR', '/local/mnt/workspace');

// Limits (2GB)
define('MAX_FILE_BYTES', 2147483648); // 2 * 1024 * 1024 * 1024
define('MAX_SESSION_BYTES', 2147483648);

// Download rate limit in MB/s (0 = unlimited)
define('DOWNLOAD_RATE_LIMIT_MB', 5);

// File and directory permissions
// Directory permissions: 0755 = rwxr-xr-x (owner: full, group/others: read+execute)
// File permissions: 0644 = rw-r--r-- (owner: read+write, group/others: read-only)
define('DIR_PERMISSIONS', 0755);
define('FILE_PERMISSIONS', 0644);

// Optional: Change owner/group for uploaded/created files and directories
// Leave null to keep default web server user (typically www-data)
// Note: Changing ownership typically requires root privileges or specific server configuration
define('FILE_OWNER', null);   // e.g., 'username' or null
define('FILE_GROUP', null);   // e.g., 'groupname' or null

// PHP runtime configuration notes:
ini_set('max_execution_time', '300');
ini_set('max_input_time', '300');

// Derived tmp dir inside uploads
function get_tmp_dir(): string
{
    return UPLOAD_DIR . DIRECTORY_SEPARATOR . '.temp';
}
