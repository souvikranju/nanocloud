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

// PHP runtime configuration notes:
ini_set('max_execution_time', '300');
ini_set('max_input_time', '300');

// Derived tmp dir inside uploads
function get_tmp_dir(): string
{
    return UPLOAD_DIR . DIRECTORY_SEPARATOR . '.temp';
}
