<?php
// config.php
// Configuration loader for NanoCloud

declare(strict_types=1);

// Load default configuration
require_once __DIR__ . '/config.defaults.php';

// Load user's custom configuration if it exists
$local_config = __DIR__ . '/config.local.php';
if (file_exists($local_config)) {
    require_once $local_config;
}

// Helper function to convert PHP ini size notation to bytes
function parse_size_to_bytes(string $size): int
{
    $size = trim($size);
    $last = strtolower($size[strlen($size) - 1]);
    $value = (int)$size;
    
    switch ($last) {
        case 'g':
            $value *= 1024;
        case 'm':
            $value *= 1024;
        case 'k':
            $value *= 1024;
    }
    
    return $value;
}

// Define constants from variables
define('STORAGE_ROOT', $STORAGE_ROOT);
define('MAX_SESSION_BYTES', $MAX_SESSION_BYTES);
define('DOWNLOAD_RATE_LIMIT_MB', $DOWNLOAD_RATE_LIMIT_MB);
define('DIR_PERMISSIONS', $DIR_PERMISSIONS);
define('FILE_PERMISSIONS', $FILE_PERMISSIONS);
define('FILE_OWNER', $FILE_OWNER);
define('FILE_GROUP', $FILE_GROUP);

// Operation control flags
define('READ_ONLY', $READ_ONLY);
define('UPLOAD_ENABLED', $UPLOAD_ENABLED);
define('DELETE_ENABLED', $DELETE_ENABLED);
define('RENAME_ENABLED', $RENAME_ENABLED);
define('MOVE_ENABLED', $MOVE_ENABLED);

// Calculate MAX_FILE_BYTES as minimum of PHP settings and user-defined limit
$upload_max = parse_size_to_bytes(ini_get('upload_max_filesize'));
$post_max = parse_size_to_bytes(ini_get('post_max_size'));
define('MAX_FILE_BYTES', min($user_defined_max, $upload_max, $post_max));

// PHP runtime configuration
ini_set('max_execution_time', '300');
ini_set('max_input_time', '300');

// Derived tmp dir inside storage root
function get_tmp_dir(): string
{
    return STORAGE_ROOT . DIRECTORY_SEPARATOR . '.temp';
}
