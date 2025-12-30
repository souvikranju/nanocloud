<?php
// config.php
// Centralized configuration/constants for the upload app.

declare(strict_types=1);

// Upload root directory (absolute)
// define('UPLOAD_DIR', '/home/pi/FTP/dropbox');
define('UPLOAD_DIR', '/local/mnt/workspace');

// Limits (2GB)
define('MAX_FILE_BYTES', 2147483648); // 2 * 1024 * 1024 * 1024
define('MAX_SESSION_BYTES', 2147483648);

// Derived tmp dir inside uploads
function get_tmp_dir(): string
{
    return UPLOAD_DIR . DIRECTORY_SEPARATOR . '.temp';
}
