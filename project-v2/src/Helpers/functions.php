<?php
/**
 * Helper Functions
 * 
 * Shared utility functions used across the application.
 */

declare(strict_types=1);

namespace NanoCloud\Helpers;

use NanoCloud\Core\Config;

/**
 * Convert PHP upload error code to readable message
 * 
 * @param int $code PHP upload error code
 * @return string Error message
 */
function getUploadErrorMessage(int $code): string
{
    return match($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 
            'File is larger than the server allows (php.ini limit).',
        UPLOAD_ERR_PARTIAL => 
            'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE => 
            'No file was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 
            'Missing a temporary folder on server.',
        UPLOAD_ERR_CANT_WRITE => 
            'Failed to write file to disk.',
        UPLOAD_ERR_EXTENSION => 
            'Upload stopped by a server extension.',
        default => 
            'Unknown upload error.'
    };
}

/**
 * Apply configured permissions and ownership to a file or directory
 * 
 * @param string $path Path to the file or directory
 * @param bool $isDir Whether the path is a directory
 */
function applyPermissions(string $path, bool $isDir): void
{
    // Apply permissions based on type
    $perms = $isDir ? Config::get('DIR_PERMISSIONS') : Config::get('FILE_PERMISSIONS');
    @chmod($path, $perms);
    
    // Apply ownership if configured
    $owner = Config::get('FILE_OWNER');
    if ($owner !== null) {
        @chown($path, $owner);
    }
    
    $group = Config::get('FILE_GROUP');
    if ($group !== null) {
        @chgrp($path, $group);
    }
}

/**
 * Recursively delete a directory and all its contents
 * 
 * @param string $dir Directory path to delete
 * @return bool True on success, false on failure
 */
function recursiveDelete(string $dir): bool
{
    if (!is_dir($dir)) {
        return false;
    }
    
    $items = @scandir($dir);
    if ($items === false) {
        return false;
    }
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        
        if (is_dir($path)) {
            if (!recursiveDelete($path)) {
                return false;
            }
        } else {
            if (!@unlink($path)) {
                return false;
            }
        }
    }
    
    return @rmdir($dir);
}

/**
 * Check if an operation is allowed based on configuration
 * 
 * @param string $operation Operation name: 'upload', 'delete', 'rename', 'move'
 * @return array ['allowed' => bool, 'message' => string]
 */
function checkOperationAllowed(string $operation): array
{
    // READ_ONLY has highest priority - blocks ALL write operations
    if (Config::get('READ_ONLY') === true) {
        return [
            'allowed' => false,
            'message' => 'System is in read-only mode'
        ];
    }
    
    // Check specific operation flags
    $allowed = match($operation) {
        'upload' => Config::get('UPLOAD_ENABLED', true),
        'delete' => Config::get('DELETE_ENABLED', true),
        'rename' => Config::get('RENAME_ENABLED', true),
        'move' => Config::get('MOVE_ENABLED', true),
        default => true
    };
    
    if (!$allowed) {
        $message = match($operation) {
            'upload' => 'Uploads disabled by administrator',
            'delete' => 'Deletion disabled by administrator',
            'rename' => 'Renaming disabled by administrator',
            'move' => 'Moving disabled by administrator',
            default => 'Operation not allowed'
        };
        
        return ['allowed' => false, 'message' => $message];
    }
    
    return ['allowed' => true, 'message' => ''];
}

/**
 * Format bytes to human-readable size
 * 
 * @param int $bytes Size in bytes
 * @param int $precision Decimal precision
 * @return string Formatted size
 */
function formatBytes(int $bytes, int $precision = 2): string
{
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
        $bytes /= 1024;
    }
    
    return round($bytes, $precision) . ' ' . $units[$i];
}

/**
 * Ensure a directory exists, creating it if necessary
 * 
 * @param string $dir Directory path
 * @return bool True if directory exists or was created
 */
function ensureDirectoryExists(string $dir): bool
{
    if (is_dir($dir)) {
        return true;
    }
    
    if (@mkdir($dir, Config::get('DIR_PERMISSIONS'), true)) {
        applyPermissions($dir, true);
        return true;
    }
    
    return false;
}
